import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import { schemas,SCHEMA_VERSION,type ModelProvider,type TaskPublicView } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { RubricAssessment,createModelAnalyzer,classifyAttempt } from '../plugins/assessment';
import { PlanningEngine } from '../plugins/planning';
import { attemptFacts } from '../plugins/planning/evidence';
import { currentReviewItems,planHistory,reportHistory,shanghaiDate } from '../../src/learning/review';
import { ControlledRoles,tutorOutput,type TutorStage } from './roles';
import { hash } from '../storage/repository';
import { latestFeedback } from '../tools/registry';
import { RuntimeError } from '../core/errors';
import { GeneratedTaskStore,TaskGenerator,GENERATION_DEFAULTS,type GenerationConfig } from '../plugins/generation';
import { readGlmConfig } from '../providers/config';
const op=schemas.StartSession.shape.operationId;
export const requests={
 start:schemas.StartSession,
 activate:z.strictObject({operationId:op,taskId:op,taskVersion:z.number().int().positive(),mode:schemas.LearningSession.shape.mode}),
 open:z.strictObject({operationId:op,sessionId:op,taskId:op,taskVersion:z.number().int().positive()}),
 hint:z.strictObject({operationId:op,sessionId:op,taskId:op,taskVersion:z.number().int().positive(),level:z.number().int().positive()}),
 submit:schemas.SubmitAttempt.extend({reviewItemId:op.nullable(),reviewRevision:z.number().int().positive().nullable()}),
 grade:z.strictObject({operationId:op,attemptId:op,expectedGradingId:op.optional()}),
 generate:z.strictObject({operationId:op,timeBudgetMinutes:z.number().int().min(1).max(30)}),
 confirm:z.strictObject({operationId:op,proposalId:op,expectedPreviousVersionId:op.nullable(),action:schemas.PlanVersion.shape.confirmation.shape.action,scheduledDate:z.string().nullable(),reason:z.string().min(1).max(1000)}),
 preference:z.strictObject({operationId:op,rest:z.boolean(),questionInvitePaused:z.boolean()}),
 memoryCorrect:z.strictObject({operationId:op,memoryId:op,text:z.string().min(1).max(8000)}),
 reset:z.strictObject({operationId:op,confirmation:z.literal('清除本机学习记录与偏好')}),
 // E1: students choose only a whitelisted knowledge point, purpose and budget; never a template, answer or prompt.
 generateTask:z.strictObject({operationId:op,knowledgePointId:z.enum(['negative-brackets','like-terms']),purpose:z.enum(['practice','review']),reviewItemId:op.nullable(),timeBudgetMinutes:z.number().int().min(1).max(30)}),
};
const SAFETY_PATTERN=/自杀|不想活|想死|去死|自残|割腕|结束生命|伤害自己|活着(?:没|没有)意思|跳楼/;
// TODO(product owner): review this wording and add a verified local psychological-support hotline number before wider use.
export const SAFETY_REPLY='谢谢你愿意告诉我。你的安全最重要。请现在就告诉身边你信任的大人，比如爸爸妈妈或者老师，让他们陪着你。如果你现在有危险，请马上拨打110或120。你也可以联系当地的心理援助热线。我会在这里陪着你。';
const TUTOR_HISTORY_TURNS=8;
// Student-selectable shortcuts that answer the question the Tutor just asked (listen: "what happened?", probe: "which kind of stuck?").
// They are plain student messages once clicked, never model output.
export const QUICK_REPLIES:Record<TutorStage,string[]>={listen:['考试没考好','有题不会做','就是不想学','不想说'],probe:['概念不太清楚','公式不会用','不知道从哪下手','说不清楚']};
const installed=new WeakMap<LearningRuntime,LearningCoordinator>();
export const learningFor=(runtime:LearningRuntime)=>installed.get(runtime);
export function installLearning(runtime:LearningRuntime,options:{timeoutMs?:number;generation?:Partial<GenerationConfig>;modelId?:string}={}){
 const d=new LearningCoordinator(runtime,options.timeoutMs,options);installed.set(runtime,d);return d;
}
export class LearningCoordinator {
 readonly roles:ControlledRoles;readonly generator:TaskGenerator;private readonly rubric:RubricAssessment;
 private flights=new Map<string,{hash:string;promise:Promise<unknown>}>();private active=false;
 private scope=new AsyncLocalStorage<AbortSignal>();private epoch=0;
 constructor(readonly r:LearningRuntime,timeout=120000,options:{generation?:Partial<GenerationConfig>;modelId?:string}={}){
  this.roles=new ControlledRoles(r,Math.min(timeout,119000));
  const store=new GeneratedTaskStore(()=>r.repository,()=>this.epoch);
  const traced:ModelProvider={kind:r.provider.kind,supportsTools:r.provider.supportsTools,complete:input=>this.roles.analyze(r.provider,{...input,signal:this.scope.getStore()?AbortSignal.any([input.signal,this.scope.getStore()!]):input.signal})};
  this.rubric=new RubricAssessment({generatedTasks:()=>store.published(),...(r.provider.kind==='offline'?{}:{analyzer:createModelAnalyzer(traced,{timeoutMs:Math.min(timeout+1000,120000)})})});
  r.registerAssessment(this.rubric);r.registerPlanning(new PlanningEngine());
  const modelId=()=>r.provider.kind==='real_http'?options.modelId??readGlmConfig().model:r.provider.kind;
  this.generator=new TaskGenerator(r,()=>this.rubric.catalog,(...args)=>this.roles.generate(...args),{...GENERATION_DEFAULTS,...options.generation},modelId);
 }
 private parse<T>(schema:z.ZodType<T>,raw:unknown):T{const p=schema.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params','无效的学生事件字段');return p.data;}
 private check(signal?:AbortSignal){if(signal?.aborted)throw new RuntimeError('cancelled');}
 private perform<T>(operationId:string,request:unknown,work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  const digest=hash(request),prior=this.flights.get(operationId);if(prior){if(prior.hash!==digest)return Promise.reject(new RuntimeError('conflict'));return prior.promise as Promise<T>;}
  const receipt='d-event-'+operationId;
  // All D writes serialize. Auth/permission changes retain their own immediate A routes.
  if(this.active)return Promise.reject(new RuntimeError('invalid_state','已有学习操作进行中，请等待或取消'));
  try{const cached=this.r.repository.receipt?.<T>(receipt,request);if(cached?.found)return Promise.resolve(cached.value!);}catch(e){return Promise.reject(e);}
  this.active=true;const epoch=this.epoch;
  const promise=(async()=>{this.check(signal);const result=await work();this.check(signal);if(epoch!==this.epoch)throw new RuntimeError('cancelled');return this.r.repository.once(receipt,request,()=>result);})();
  this.flights.set(operationId,{hash:digest,promise});return promise.finally(()=>{this.active=false;this.flights.delete(operationId);});
 }
 async start(raw:z.infer<typeof requests.start>){const p=this.parse(requests.start,raw);return this.perform(p.operationId,p,async()=>{
  const old=this.r.events.sessions().find(s=>s.status!=='closed');
  if(old&&shanghaiDate(old.startedAt)!==shanghaiDate(this.r.clock.now()))this.r.events.sessionState({operationId:p.operationId+'-close',sessionId:old.id,status:'closed'});
  else if(old){if(old.status==='paused')this.r.events.sessionState({operationId:p.operationId+'-resume',sessionId:old.id,status:'active'});return {...old,status:'active' as const};}
  return this.r.events.startSession(p);
 });}
 async activate(raw:z.infer<typeof requests.activate>){const p=this.parse(requests.activate,raw);const session=await this.start({operationId:p.operationId+'-s',mode:p.mode});return this.open({operationId:p.operationId+'-o',sessionId:session.id,taskId:p.taskId,taskVersion:p.taskVersion});}
 async open(raw:z.infer<typeof requests.open>){const p=this.parse(requests.open,raw);return this.perform(p.operationId,p,async()=>{
  const session=this.r.events.requireSession(p.sessionId),t=this.r.catalog.publicTask(p.taskId,p.taskVersion);if(!t)throw new RuntimeError('not_found');
  const points=new Set(this.r.repository.list('attempts').flatMap(a=>this.r.catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));
  if(t.prerequisites.some(k=>!points.has(k)))throw new RuntimeError('invalid_state','请先尝试先修知识点：'+t.prerequisites.filter(k=>!points.has(k)).join('、'));
  this.r.events.expose({...p,kind:'task',hintId:null});return {task:t,session};
 });}
 async hint(raw:z.infer<typeof requests.hint>){const p=this.parse(requests.hint,raw);return this.perform(p.operationId,p,async()=>{
  const h=this.r.catalog.definition(p.taskId,p.taskVersion)?.hints.find(h=>h.level===p.level);if(!h)throw new RuntimeError('unavailable','没有更多分级提示');
  this.r.events.expose({operationId:p.operationId+'-expose',sessionId:p.sessionId,taskId:p.taskId,taskVersion:p.taskVersion,kind:'hint',hintId:h.id});
  return this.r.tools.execute({id:p.operationId,name:'get_hint',arguments:JSON.stringify({sessionId:p.sessionId,taskId:p.taskId,taskVersion:p.taskVersion,level:p.level})},{role:'tutor',runId:'hint-'+p.operationId,signal:new AbortController().signal});
 });}
 async submit(raw:z.infer<typeof requests.submit>,signal?:AbortSignal){const p=this.parse(requests.submit,raw);return this.perform(p.operationId,p,async()=>{
  const {reviewItemId,reviewRevision,...attemptInput}=p;const attempt=this.r.events.submit(attemptInput);
  const grading=await this.assess(attempt.id,p.operationId,signal);this.check(signal);
  if(reviewItemId){const item=currentReviewItems(this.r.engineContext()).find(i=>i.id===reviewItemId);if(!item||item.revision!==reviewRevision)throw new RuntimeError('conflict','复习任务已变更，作答已保存');const facts=attemptFacts(attempt.id,item.knowledgePointId,this.r.engineContext());
   await this.r.planning().recordOutcome({schemaVersion:SCHEMA_VERSION,id:'out-'+p.operationId,operationId:p.operationId+'-out',evidenceRevision:this.r.repository.evidenceRevision(),reviewItemId,reviewRevision:item.revision,attemptId:attempt.id,sessionId:attempt.sessionId!,verdict:grading.verdict,independent:facts.independent,taskNovelty:facts.novelty,completedAt:facts.time!,reason:'学生主动完成；服务端从原始证据核验'},this.r.engineContext());
  }
  return {attempt,grading,classification:classifyAttempt(attempt,this.r.engineContext())};
 },signal);}
 private async assess(attemptId:string,operationId:string,signal?:AbortSignal,expectedGradingId?:string){
  const runId='assess-'+randomUUID(),controller=signal??new AbortController().signal;
  const result=expectedGradingId?schemas.ToolResult.parse({schemaVersion:SCHEMA_VERSION,callId:operationId,ok:true,data:await this.scope.run(controller,()=> (this.r.assessment() as RubricAssessment).regrade({operationId:operationId+'-revision',attemptId,expectedGradingId},this.r.engineContext())),evidenceIds:[],dataVersion:this.r.repository.revision()}):await this.scope.run(controller,()=>this.r.tools.execute({id:operationId,name:'grade_attempt',arguments:JSON.stringify({attemptId})},{role:'assessor',runId,signal:controller}));
  if(expectedGradingId)this.r.repository.append('toolCalls',{schemaVersion:SCHEMA_VERSION,id:'recheck-'+operationId,runId,callId:operationId,name:'program_recheck_saved_attempt',argumentsHash:hash({attemptId,expectedGradingId}),status:'succeeded',errorCode:null,evidenceIds:schemas.GradingResult.parse(result.ok?result.data:{}).evidenceIds,dataVersion:this.r.repository.revision(),at:this.r.clock.now()});
  this.r.repository.append('runs',{schemaVersion:SCHEMA_VERSION,id:runId,operationId,role:'assessor',providerKind:this.r.provider.kind,status:result.ok?'completed':result.error.code==='cancelled'?'cancelled':'failed',rounds:0,toolExecutions:1,callIds:[operationId],permissionFingerprint:hash({}),startedAt:this.r.clock.now(),finishedAt:this.r.clock.now(),error:result.ok?null:result.error});
  if(!result.ok)throw new RuntimeError(result.error.code,result.error.message);return schemas.GradingResult.parse(result.data);
 }
 async grade(raw:z.infer<typeof requests.grade>,signal?:AbortSignal){const p=this.parse(requests.grade,raw);return this.perform(p.operationId,p,()=>{const latest=this.r.repository.list('gradings').filter(g=>g.attemptId===p.attemptId).at(-1);return this.assess(p.attemptId,p.operationId,signal,p.expectedGradingId??(latest?.verdict==='needs_review'?latest.id:undefined));},signal);}
 async generate(raw:z.infer<typeof requests.generate>,signal?:AbortSignal){const p=this.parse(requests.generate,raw);return this.perform(p.operationId,p,async()=>{
  const ctx=this.r.engineContext(),assessment=await this.r.assessment().snapshot({operationId:p.operationId+'-s'},ctx);
  const report=await this.r.planning().report({operationId:p.operationId+'-r',assessment,previousReportId:this.r.repository.list('reports').at(-1)?.id??null},ctx);
  const proposal=await this.r.planning().propose({...p,assessment,operationId:p.operationId+'-p'},ctx);
  const organization=await this.roles.invoke('planner',p.operationId+'-agent',{report,proposal},signal);return {report,proposal,organization:organization.run};
 },signal);}
 /** E1 student event: generate one validated task. Publishing never opens or exposes it. */
 async generateTask(raw:z.infer<typeof requests.generateTask>,signal?:AbortSignal){const p=this.parse(requests.generateTask,raw);const epoch=this.epoch;
  return this.perform(p.operationId,{kind:'e-generate-task',...p},()=>this.generator.generate(p,signal,()=>epoch===this.epoch),signal);}
 async confirm(raw:z.infer<typeof requests.confirm>){const p=this.parse(requests.confirm,raw);return this.perform(p.operationId,p,()=>this.r.planning().confirm(p,this.r.engineContext()));}
 async preference(raw:z.infer<typeof requests.preference>){const p=this.parse(requests.preference,raw);const work=async()=>{
  let session=this.r.events.sessions().find(s=>s.status!=='closed');if(!session)session=this.r.events.startSession({operationId:p.operationId+'-s',mode:'support'});
  this.r.events.sessionState({operationId:p.operationId+'-state',sessionId:session.id,status:p.rest||p.questionInvitePaused?'paused':'active'});
  const plan=this.r.repository.list('plans').at(-1);if((p.rest||p.questionInvitePaused)&&plan&&plan.confirmation.action!=='defer')await this.r.planning().confirm({operationId:p.operationId+'-plan',proposalId:plan.proposalId,expectedPreviousVersionId:plan.id,action:'defer',scheduledDate:null,reason:'学生暂停或暂不看题'},this.r.engineContext());return {paused:p.rest||p.questionInvitePaused};
 };if(this.active&&(p.rest||p.questionInvitePaused))return work();return this.perform(p.operationId,p,work);}
 async chat(raw:z.infer<typeof schemas.ChatRequest>,signal?:AbortSignal){const p=this.parse(schemas.ChatRequest,raw);const last=p.history.at(-1)?.content??'';
  // Program-level safety gate for minors: never delegated to the model or the prompt. Nothing is stored from this message.
  if(SAFETY_PATTERN.test(last))return {text:SAFETY_REPLY,run:null,suggestions:[],stage:'safety' as const,quickReplies:[] as string[],safety:true};
  if(/休息|暂不看|不想看|只想聊|不想探索/.test(last)){await this.preference({operationId:p.operationId+'-pause',rest:/休息/.test(last),questionInvitePaused:true});return {text:'好，先不安排题目。我们可以继续聊，由你决定何时开始。',run:null,suggestions:[],stage:'rest' as const,quickReplies:[] as string[],safety:false};}
  // Step 1 (listen) for the first student turn, step 2 (probe) afterwards. The program decides; the client cannot choose a stage.
  const stage:TutorStage=p.history.filter(h=>h.role==='user').length<=1?'listen':'probe';
  return this.perform(p.operationId,{...p,permissions:hash({consents:this.r.repository.list('consents'),sessionEvents:this.r.repository.list('sessionEvents'),memories:this.r.events.context().memories})},async()=>{
   const session=this.r.events.sessions().find(s=>s.status==='active');
   const exposed=this.r.repository.list('exposures').filter(e=>e.sessionId===session?.id&&e.kind==='task').at(-1);
   const task=exposed?this.r.catalog.publicTask(exposed.taskId,exposed.taskVersion):null;
   const context=this.r.events.context(),ctx=this.r.engineContext();
   // P0: the program hands the Tutor the latest verdict and recent stuck points, so it never has to guess what just happened.
   const stuckPoints=this.r.repository.list('stuckPoints').slice(-3).map(({knowledgePointId,kind,summary,studentConfirmed,createdAt})=>({knowledgePointId,kind,summary,studentConfirmed,createdAt}));
   const result=await this.roles.invoke('tutor',p.operationId,{stage,history:p.history.slice(-TUTOR_HISTORY_TURNS),context,task,paused:!session,latestFeedback:latestFeedback(ctx),stuckPoints},signal);
   // Chat counts as task help only once the Tutor actually answered; a failed/offline turn disclosed nothing.
   if(exposed&&session&&result.run.status==='completed')this.r.events.expose({operationId:p.operationId+'-help',sessionId:session.id,taskId:exposed.taskId,taskVersion:exposed.taskVersion,kind:'chat_help',hintId:null});
   const out=tutorOutput.safeParse(result.value);const value=out.success?out.data:{message:result.run.error?.message??'本地规则模式：我在这里，按你的节奏来。',taskIds:[]};
   const suggestions:TaskPublicView[]=session?value.taskIds.flatMap(id=>{const t=this.r.catalog.publicTask(id,2);return t?[t]:[];}):[];
   return {text:value.message,run:result.run,suggestions,stage,quickReplies:suggestions.length?[]:QUICK_REPLIES[stage],safety:false};
  },signal);
 }
 async view(){const ctx=this.r.engineContext();await this.r.planning().due({at:this.r.clock.now(),includePaused:true},ctx);const assessment=await this.r.assessment().snapshot({operationId:'view-'+this.r.repository.evidenceRevision()},ctx);
  const session=this.r.events.sessions().find(s=>s.status!=='closed')??null;
  const attempted=new Set(this.r.repository.list('attempts').flatMap(a=>this.r.catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));
  const tasks=this.r.catalog.candidates({sessionId:session?.id??'preview',excludeTaskIds:[],limit:100}).map(t=>({...t,eligible:t.prerequisites.every(k=>attempted.has(k))&&(!(session?.mode==='exploration')||['理解','逻辑'].includes(t.primaryDimension)||['理解','逻辑'].every(d=>this.r.repository.list('attempts').some(a=>a.sessionId===session.id&&this.r.catalog.definition(a.taskId,a.taskVersion)?.primaryDimension===d)))}));
  return {now:this.r.clock.now(),session,paused:session?.status==='paused',assessment,tasks,attempts:this.r.repository.list('attempts').map(a=>({...a,classification:classifyAttempt(a,ctx)})),exposures:this.r.repository.list('exposures'),gradings:this.r.repository.list('gradings'),evidence:this.r.repository.list('evidence'),reports:reportHistory(ctx),plans:planHistory(ctx),proposal:this.r.repository.list('proposals').at(-1)??null,reviews:currentReviewItems(ctx),consentConfigured:this.r.repository.list('consents').length>0,optionalMemory:this.r.events.memoryEnabled(),memories:this.r.repository.list('memories'),runs:this.r.repository.list('runs'),toolCalls:this.r.repository.list('toolCalls'),stuckPoints:this.r.repository.list('stuckPoints'),
  // Audit only: fingerprints and reason codes, never answers or model text. exposed derives from real task exposures.
  generations:this.r.repository.list('generations').map(g=>({...g,exposed:!!g.taskId&&this.r.repository.list('exposures').some(e=>e.kind==='task'&&e.taskId===g.taskId&&e.taskVersion===g.taskVersion)})),generationAvailable:this.r.provider.kind!=='offline'};
 }
 async memoryCorrect(raw:z.infer<typeof requests.memoryCorrect>){const p=this.parse(requests.memoryCorrect,raw);return this.perform(p.operationId,p,async()=>this.r.repository.transaction(()=>{
  if(!this.r.events.memoryEnabled())throw new RuntimeError('forbidden','可选记忆关闭');
  this.r.events.memoryState({operationId:p.operationId+'-stop',memoryId:p.memoryId,action:'stop'});
  return this.r.events.remember({operationId:p.operationId+'-new',text:p.text,source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
 }));}
 async reset(raw:z.infer<typeof requests.reset>){this.parse(requests.reset,raw);if(this.active)throw new RuntimeError('invalid_state','请先取消并等待当前操作结束，再清除');if(!this.r.repository.reset)throw new RuntimeError('unavailable');this.epoch++;this.r.repository.reset();return {cleared:true};}
}
export type LearningView=Awaited<ReturnType<LearningCoordinator['view']>>;
