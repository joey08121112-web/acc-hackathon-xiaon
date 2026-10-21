import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import { schemas,SCHEMA_VERSION,MEMORY_CONTEXT_MAX_CHARS,MEMORY_CONTEXT_MAX_ITEMS,type ChatReply,type MemoryItem,type ChatStage,type ChatTurn,type LearningEpisode,type ModelProvider,type StageField,type TaskPublicView,type Validation } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { RubricAssessment,createModelAnalyzer,classifyAttempt } from '../plugins/assessment';
import { PlanningEngine } from '../plugins/planning';
import { attemptFacts } from '../plugins/planning/evidence';
import { currentReviewItems,planHistory,reportHistory,shanghaiDate } from '../../src/learning/review';
import { ControlledRoles,tutorOutput,homeTutorOutput,homeTutorPrompt,type TutorStage } from './roles';
import { decideStage,filterStageFields,matchesAnswer,HELP_PATTERN,CHAT_STALE_MS,HOME_QUICK_REPLIES,REST_PATTERN,SAFETY_PATTERN,STAGE_FIELDS,UNDERSTOOD_PATTERN,type ChatStageState } from './stages';
import type { RevampContext } from '../plugins/context';
import { validateProblemDraft,confirmProblem,recognize } from '../plugins/problems';
import { validateMemoryDraft,confirmMemoryDraft,greeting,shouldOfferMemory,selectMemoriesForContext } from '../plugins/memory-flow';
import { draftProgressCard,confirmProgressCard } from '../plugins/progress';
import { validateObservation,endConversation } from '../plugins/conversation';
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
// TODO(product owner): review this wording and add a verified local psychological-support hotline number before wider use.
export const SAFETY_REPLY='谢谢你愿意告诉我。你的安全最重要。请现在就告诉身边你信任的大人，比如爸爸妈妈或者老师，让他们陪着你。如果你现在有危险，请马上拨打110或120。你也可以联系当地的心理援助热线。我会在这里陪着你。';
const TUTOR_HISTORY_TURNS=8;
// Student-selectable shortcuts that answer the question the Tutor just asked (listen: "what happened?", probe: "which kind of stuck?").
// They are plain student messages once clicked, never model output.
export const QUICK_REPLIES:Record<TutorStage,string[]>={listen:['考试没考好','有题不会做','就是不想学','不想说'],probe:['概念不太清楚','公式不会用','不知道从哪下手','说不清楚']};
const ANSWER_HELD_TEXT='这一步我先不直接说答案，我们再往前想一小步，好吗？';
const REST_TEXT='好，先不安排题目。我们可以继续聊，由你决定何时开始。';
const chatReply=(r:Partial<ChatReply>&{text:string;stage:ChatStage}):ChatReply=>schemas.ChatReply.parse({sessionId:null,run:null,safety:false,quickReplies:[],suggestions:[],askStudy:false,needsCheck:false,askProblem:false,modeSuggestion:null,problemDraft:null,progressCardDraft:null,memoryDraft:null,summary:null,...r});
const stateOf=(t:ChatTurn):ChatStageState=>({sessionId:t.sessionId,turn:t.turn,stage:t.stage,listenTurns:t.listenTurns,companionStreak:t.companionStreak,thinkTurns:t.thinkTurns,lastProbeTurn:t.lastProbeTurn,needsCheckAsked:t.needsCheckAsked,askStudyAsked:t.askStudyAsked,studyDeclined:t.studyDeclined,ended:t.ended});
/** Program cap on memory-flow's pick: only ids from the active list (our own copy, never the plugin's text), no repeats, ≤ N items, ≤ M chars. */
export function capMemorySelection(picked:readonly {id:string}[],active:readonly MemoryItem[]):MemoryItem[]{
 const byId=new Map(active.map(m=>[m.id,m]));const out:MemoryItem[]=[];let chars=0;
 for(const m of picked){const own=byId.get(m.id);if(!own||out.includes(own)||out.length>=MEMORY_CONTEXT_MAX_ITEMS||chars+own.text.length>MEMORY_CONTEXT_MAX_CHARS)continue;out.push(own);chars+=own.text.length;}
 return out;
}
const notImplementedError=(e:unknown)=>e instanceof RuntimeError&&e.code==='not_implemented';
const installed=new WeakMap<LearningRuntime,LearningCoordinator>();
export const learningFor=(runtime:LearningRuntime)=>installed.get(runtime);
export function installLearning(runtime:LearningRuntime,options:{timeoutMs?:number;generation?:Partial<GenerationConfig>;modelId?:string}={}){
 const d=new LearningCoordinator(runtime,options.timeoutMs,options);installed.set(runtime,d);return d;
}
export class LearningCoordinator {
 readonly roles:ControlledRoles;readonly generator:TaskGenerator;private readonly rubric:RubricAssessment;
 private flights=new Map<string,{hash:string;promise:Promise<unknown>}>();private active=false;private recognizing=false;
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
 async chat(raw:z.infer<typeof schemas.ChatRequest>,signal?:AbortSignal):Promise<ChatReply>{const p=this.parse(schemas.ChatRequest,raw);const last=p.history.at(-1)?.content??'';
  if(p.flow!=='home'&&(p.intent||p.problemId))throw new RuntimeError('invalid_params','intent 和 problemId 只用于首页综合模式');
  // Program-level safety gate for minors: never delegated to the model or the prompt. Nothing is stored from this message.
  if(SAFETY_PATTERN.test(last))return chatReply({text:SAFETY_REPLY,stage:'safety',safety:true});
  // G0: the home flow runs the stage machine; the legacy D two-step flow below is unchanged.
  if(p.flow==='home')return this.homeChat(p,last,signal);
  if(REST_PATTERN.test(last)){await this.preference({operationId:p.operationId+'-pause',rest:/休息/.test(last),questionInvitePaused:true});return chatReply({text:REST_TEXT,stage:'rest'});}
  // Step 1 (listen) for the first student turn, step 2 (probe) afterwards. The program decides; the client cannot choose a stage.
  const stage:TutorStage=p.history.filter(h=>h.role==='user').length<=1?'listen':'probe';
  return this.perform(p.operationId,{...p,permissions:hash({consents:this.r.repository.list('consents'),sessionEvents:this.r.repository.list('sessionEvents'),memories:this.r.events.context().memories})},async()=>{
   const session=this.r.events.sessions().find(s=>s.status==='active');
   const exposed=this.r.repository.list('exposures').filter(e=>e.sessionId===session?.id&&e.kind==='task').at(-1);
   const task=exposed?this.r.catalog.publicTask(exposed.taskId,exposed.taskVersion):null;
   const context=this.tutorContext(p.history,null,null),ctx=this.r.engineContext();
   // P0: the program hands the Tutor the latest verdict and recent stuck points, so it never has to guess what just happened.
   const stuckPoints=this.recentStuckPoints();
   const result=await this.roles.invoke('tutor',p.operationId,{stage,history:p.history.slice(-TUTOR_HISTORY_TURNS),context,task,paused:!session,latestFeedback:latestFeedback(ctx),stuckPoints},signal);
   // Chat counts as task help only once the Tutor actually answered; a failed/offline turn disclosed nothing.
   if(exposed&&session&&result.run.status==='completed')this.r.events.expose({operationId:p.operationId+'-help',sessionId:session.id,taskId:exposed.taskId,taskVersion:exposed.taskVersion,kind:'chat_help',hintId:null});
   const out=tutorOutput.safeParse(result.value);const value=out.success?out.data:{message:result.run.error?.message??'本地规则模式：我在这里，按你的节奏来。',taskIds:[]};
   const suggestions:TaskPublicView[]=session?value.taskIds.flatMap(id=>{const t=this.r.catalog.publicTask(id,2);return t?[t]:[];}):[];
   return chatReply({text:value.message,run:result.run,suggestions,stage,quickReplies:suggestions.length?[]:QUICK_REPLIES[stage]});
  },signal);
 }
 /** Stuck-point confirmation is derived from a student event: a confirmed ProblemRecord that links the stuck point. */
 private stuckConfirmed(stuckPointId:string){return this.r.repository.list('problems').some(p=>p.stuckPointId===stuckPointId);}
 private recentStuckPoints(){return this.r.repository.list('stuckPoints').slice(-3).map(({id,knowledgePointId,kind,summary,createdAt})=>({knowledgePointId,kind,summary,studentConfirmed:this.stuckConfirmed(id),createdAt}));}
 /** Tutor context with memory-flow's selection. The program keeps only active memories, ≤ MEMORY_CONTEXT_MAX_ITEMS and ≤ MEMORY_CONTEXT_MAX_CHARS in total.
  * While the plugin is a stub the previous behaviour (all active tutoring memories) is kept unchanged. */
 private tutorContext(history:{role:'user'|'assistant';content:string}[],sessionId:string|null,stage:ChatStage|null){
  const context=this.r.events.context();if(!context.memories.length)return context;
  let picked:MemoryItem[];
  try{picked=selectMemoriesForContext({sessionId,stage,studentTexts:history.filter(h=>h.role==='user').map(h=>h.content),memories:context.memories},this.revamp());}
  catch(e){if(!notImplementedError(e))throw e;return context;}
  return {...context,memories:capMemorySelection(picked,context.memories)};
 }
 private revamp():RevampContext{const r=this.r;return {...r.engineContext(),events:r.events,providerKind:r.provider.kind,memoryEnabled:()=>r.events.memoryEnabled(),model:(call,signal)=>this.roles.compose(call,signal)};}
 /** G0 home flow. The stage machine decides stage, signals and allowed model fields; plugins validate what is left. */
 private homeChat(p:z.infer<typeof schemas.ChatRequest>,last:string,signal?:AbortSignal):Promise<ChatReply>{
  return this.perform(p.operationId,{...p,permissions:hash({consents:this.r.repository.list('consents'),sessionEvents:this.r.repository.list('sessionEvents'),memories:this.r.events.context().memories})},async()=>{
   const repo=this.r.repository,now=this.r.clock.now(),ctx=this.revamp();
   const previous=repo.list('chatTurns').at(-1);
   const fresh=!previous||previous.ended||Date.parse(now)-Date.parse(previous.at)>CHAT_STALE_MS||repo.list('summaries').some(s=>s.sessionId===previous.sessionId)||p.history.filter(h=>h.role==='user').length===1;
   const sessionId=fresh||!previous?'chat-'+p.operationId:previous.sessionId,prior=fresh?null:previous??null;
   const problem=p.problemId?repo.get('problems',p.problemId):repo.list('problems').filter(x=>x.sessionId===sessionId).at(-1);
   if(p.problemId&&!problem)throw new RuntimeError('not_found','没有这条错题记录');
   const session=this.r.events.sessions().find(s=>s.status==='active');
   const exposed=repo.list('exposures').filter(e=>e.sessionId===session?.id&&e.kind==='task').at(-1);
   const task=exposed?this.r.catalog.publicTask(exposed.taskId,exposed.taskVersion)??null:null;
   const episode=prior?.episodeId?repo.get('episodes',prior.episodeId)??null:null;
   const answers=episode?.problemId?repo.list('problemSecrets').filter(x=>x.problemId===episode.problemId).at(-1)?.answer??[]:episode?.task?this.r.catalog.definition(episode.task.taskId,episode.task.taskVersion)?.answer??[]:[];
   const memoryEnabled=this.r.events.memoryEnabled();
   const decision=decideStage(prior?stateOf(prior):null,{sessionId,text:last,intent:p.intent??null,hasProblem:!!problem,hasActiveTask:!!task,solved:prior?.stage==='think'&&matchesAnswer(last,answers),progressCardDone:!!episode&&repo.list('progressCards').some(c=>c.episodeId===episode.id),memoryEnabled});
   const stage=decision.stage,s=decision.state,fromStage=prior?.stage??null;
   // Episode revisions follow the program's stage, never the model.
   let episodeId=episode&&episode.status!=='closed'?episode.id:null;
   const revise=(e:LearningEpisode,change:Partial<LearningEpisode>)=>repo.append('episodes',{...e,...change,revision:e.revision+1,updatedAt:now});
   if(stage==='think'&&fromStage!=='think'){const created:LearningEpisode={schemaVersion:SCHEMA_VERSION,id:'episode-'+p.operationId,revision:1,sessionId,problemId:problem?.id??null,task:problem||!exposed?null:{taskId:exposed.taskId,taskVersion:exposed.taskVersion},stage:'think',helpLevelsUsed:[],studentSolvedAt:null,endReason:null,status:'active',startedAt:now,updatedAt:now};repo.append('episodes',created);episodeId=created.id;}
   else if(episode&&episode.status!=='closed'){
    if(stage==='reflect'&&fromStage==='think'){const solved=matchesAnswer(last,answers);revise(episode,{stage:'reflect',status:'reflecting',studentSolvedAt:solved?now:null,endReason:solved?'solved':UNDERSTOOD_PATTERN.test(last)?'understood':'turn_limit'});}
    else if(stage!=='think'&&stage!=='reflect'&&stage!=='rest'){revise(episode,{status:'closed'});episodeId=null;}
   }
   // FR16 help ladder: one level per explicit request, at most 3; recorded on the episode and, for a catalog task, as an exposure.
   let helpLevel=0;
   if(stage==='think'&&decision.helpRequested&&episodeId){
    const current=repo.get('episodes',episodeId)!;helpLevel=Math.min(3,(current.helpLevelsUsed.at(-1)??0)+1);revise(current,{helpLevelsUsed:[...current.helpLevelsUsed,helpLevel]});
    if(current.task&&session)this.r.events.expose({operationId:p.operationId+'-think-help',sessionId:session.id,taskId:current.task.taskId,taskVersion:current.task.taskVersion,kind:'chat_help',hintId:null});
   }
   // Answers stay server-side and are held back until the student said them (decision 7); then those expressions are released.
   const live=episodeId?repo.get('episodes',episodeId)!:null;
   const solvedEpisodes=repo.list('episodes').filter(e=>e.studentSolvedAt);
   const unsolvedProblems=repo.list('problems').filter(x=>x.sessionId===sessionId&&!solvedEpisodes.some(e=>e.problemId===x.id)).map(x=>x.id);
   const secrets=[...repo.list('problemSecrets').filter(x=>unsolvedProblems.includes(x.problemId)).flatMap(x=>x.answer),
    ...(live?.task&&!live.studentSolvedAt?this.r.catalog.definition(live.task.taskId,live.task.taskVersion)?.answer??[]:[])];
   const releasedAnswers=solvedEpisodes.flatMap(e=>e.task?this.r.catalog.definition(e.task.taskId,e.task.taskVersion)?.answer??[]:[]);
   const turn=(dropped:ChatTurn['dropped'],replyFit:ChatTurn['replyFit']='ok'):ChatTurn=>({schemaVersion:SCHEMA_VERSION,id:'turn-'+p.operationId,operationId:p.operationId,sessionId,turn:s.turn,stage,intent:p.intent??null,problemId:problem?.id??null,episodeId,listenTurns:s.listenTurns,companionStreak:s.companionStreak,thinkTurns:s.thinkTurns,lastProbeTurn:s.lastProbeTurn,needsCheckAsked:s.needsCheckAsked,askStudyAsked:s.askStudyAsked,studyDeclined:s.studyDeclined,ended:s.ended,signals:{needsCheck:decision.needsCheck,askStudy:decision.askStudy,askProblem:decision.askProblem,probeAllowed:decision.probeAllowed,modeSuggestion:decision.modeSuggestion},dropped:dropped.slice(0,8),replyFit,at:now});
   if(stage==='rest'){await this.preference({operationId:p.operationId+'-pause',rest:/休息/.test(last),questionInvitePaused:true});repo.append('chatTurns',turn([]));return chatReply({text:REST_TEXT,stage,sessionId});}
   // memoryDraft: the stage machine already removed it when memory is off; memory-flow may narrow it further.
   let memoryGate:'memory_off'|'stage_not_allowed'|'not_implemented'|null=memoryEnabled?null:'memory_off';
   if(decision.allowed.includes('memoryDraft')){try{if(!shouldOfferMemory({sessionId,stage,turn:s.turn},ctx))memoryGate='stage_not_allowed';}catch(e){if(!notImplementedError(e))throw e;memoryGate='not_implemented';}}
   // The card is drafted only after the student had a turn to reflect, so not on the turn that enters reflect.
   const allowed=decision.allowed.filter(f=>(f!=='memoryDraft'||!memoryGate)&&(f!=='progressCardDraft'||fromStage==='reflect'));
   const context=this.tutorContext(p.history,sessionId,stage),ectx=this.r.engineContext();
   const stuckPoints=this.recentStuckPoints();
   const signals={needsCheck:decision.needsCheck,askStudy:decision.askStudy,askProblem:decision.askProblem};
   const result=await this.roles.invoke('tutor',p.operationId,{stage,history:p.history.slice(-TUTOR_HISTORY_TURNS),context,task,problem:problem??null,paused:!session,latestFeedback:latestFeedback(ectx),stuckPoints,signals,helpLevel,helpLevelsUsed:live?.helpLevelsUsed??[]},signal,{prompt:homeTutorPrompt({stage,allowed}),secrets,releasedAnswers});
   if(exposed&&session&&result.run.status==='completed')this.r.events.expose({operationId:p.operationId+'-help',sessionId:session.id,taskId:exposed.taskId,taskVersion:exposed.taskVersion,kind:'chat_help',hintId:null});
   const out=homeTutorOutput.safeParse(result.value);const value=out.success?out.data:{message:result.run.error?.code==='forbidden'?ANSWER_HELD_TEXT:result.run.error?.message??'我在这里，按你的节奏来。',taskIds:[]};
   const proposed:Partial<Record<StageField,unknown>>=out.success?{problemDraft:out.data.problemDraft,observation:out.data.observation,progressCardDraft:out.data.progressCardDraft,memoryDraft:out.data.memoryDraft}:{};
   const {kept,dropped}=filterStageFields(allowed,proposed);
   const log:ChatTurn['dropped']=dropped.map(field=>({field,reason:field==='memoryDraft'&&STAGE_FIELDS[stage].includes(field)&&memoryGate?memoryGate:'stage_not_allowed'}));
   // Plugin validators decide; their output is re-checked against the frozen schema. A stub (not_implemented) drops the field.
   // Quotes must come from this chat session: the last s.turn student messages (safety turns are never counted or quoted).
   const studentTexts=p.history.filter(h=>h.role==='user').map(h=>h.content).slice(-s.turn),check={sessionId,stage,studentTexts};
   const gated=<T>(field:StageField,schema:z.ZodType<T>,work:()=>Validation<unknown>):T|null=>{
    if(kept[field]===undefined)return null;
    try{const v=work();const parsed=v.ok?schema.safeParse(v.value):null;if(parsed?.success)return parsed.data;log.push({field,reason:'invalid'});}
    catch(e){if(!(e instanceof RuntimeError))throw e;log.push({field,reason:e.code==='not_implemented'?'not_implemented':'invalid'});}
    return null;
   };
   const problemDraft=gated('problemDraft',schemas.ProblemDraft,()=>validateProblemDraft(kept.problemDraft,check));
   let memoryDraft=gated('memoryDraft',schemas.MemoryDraft,()=>validateMemoryDraft(kept.memoryDraft,{...check,memoryEnabled,origin:'chat'}));
   const observation=gated('observation',schemas.ObservationDraft,()=>validateObservation(kept.observation,{...check,probeAllowed:decision.probeAllowed,existing:repo.list('observations').filter(o=>o.sessionId===sessionId)}));
   if(observation)repo.append('observations',{schemaVersion:SCHEMA_VERSION,id:'obs-'+p.operationId,...observation,sessionId,status:'unverified',at:now});
   let progressCardDraft=null;
   if(stage==='reflect'&&fromStage==='reflect'&&episodeId){
    // Only this episode's words count as quotable process: the turns since the episode started, plus this one.
    const episodeTexts=studentTexts.slice(-(repo.list('chatTurns').filter(t=>t.episodeId===episodeId).length+1));
    try{const card=await draftProgressCard({sessionId,episode:repo.get('episodes',episodeId)??null,studentTexts:episodeTexts,candidate:kept.progressCardDraft??null},ctx,signal);
     // A progress-card memory line needs only the student's memory switch; chat-offer pacing (shouldOfferMemory) does not apply.
     progressCardDraft=schemas.ProgressCardDraft.parse(card.draft);if(card.memoryDraft&&memoryEnabled)memoryDraft=schemas.MemoryDraft.parse(card.memoryDraft);}
    catch(e){if(!(e instanceof RuntimeError))throw e;if(kept.progressCardDraft!==undefined)log.push({field:'progressCardDraft',reason:e.code==='not_implemented'?'not_implemented':'invalid'});}
   }
   let summary=null;
   if(decision.end){try{summary=schemas.ConversationSummary.parse(await endConversation({operationId:p.operationId+'-end',sessionId,trigger:'farewell',history:p.history},ctx,signal));}catch(e){if(!(e instanceof RuntimeError))throw e;}}
   repo.append('chatTurns',turn(log,result.replyFit));
   const suggestions:TaskPublicView[]=session?value.taskIds.flatMap(id=>{const t=this.r.catalog.publicTask(id,2);return t?[t]:[];}):[];
   return chatReply({text:value.message,stage,sessionId,run:result.run,suggestions,quickReplies:suggestions.length?[]:HOME_QUICK_REPLIES[stage],askStudy:decision.askStudy,needsCheck:decision.needsCheck,askProblem:decision.askProblem,
    modeSuggestion:decision.modeSuggestion?{mode:'professional',reason:'想看清楚自己现在的情况，可以做一次正式测试。'}:null,problemDraft,progressCardDraft,memoryDraft,summary});
  },signal);
 }
 // G0 routes: each delegates to the owning plugin. Plugin output is re-parsed against the frozen schema before it leaves the server.
 async confirmProblem(raw:z.infer<typeof schemas.ConfirmProblem>){const p=this.parse(schemas.ConfirmProblem,raw);
  // A linked stuck point must exist and be about the same knowledge point; confirming the record is what confirms it.
  const linkable=(id:string|null,kp:string)=>id===null||this.r.repository.get('stuckPoints',id)?.knowledgePointId===kp;
  if(!linkable(p.draft.stuckPointId,p.draft.knowledgePointId))throw new RuntimeError('invalid_params','关联的卡点不存在或知识点不一致');
  return this.perform(p.operationId,p,async()=>{const record=schemas.ProblemRecord.parse(await confirmProblem(p,this.revamp()));if(record.stuckPointId!==p.draft.stuckPointId)throw new RuntimeError('internal_error','错题记录的卡点关联与学生确认的不一致');return record;});}
 /** Not receipted: the image is forwarded once and nothing derived from it is stored here. One at a time. */
 async recognize(raw:z.infer<typeof schemas.Recognize>,signal?:AbortSignal){const p=this.parse(schemas.Recognize,raw);
  if(this.recognizing)throw new RuntimeError('invalid_state','上一张图片还在识别，请稍后');this.recognizing=true;
  try{this.check(signal);return schemas.RecognizeResult.parse(await recognize(p,this.revamp(),signal));}finally{this.recognizing=false;}}
 async confirmProgressCard(raw:z.infer<typeof schemas.ConfirmProgressCard>){const p=this.parse(schemas.ConfirmProgressCard,raw);return this.perform(p.operationId,p,async()=>schemas.ProgressCard.parse(await confirmProgressCard(p,this.revamp())));}
 async confirmMemoryDraft(raw:z.infer<typeof schemas.ConfirmMemoryDraft>){const p=this.parse(schemas.ConfirmMemoryDraft,raw);return this.perform(p.operationId,p,async()=>schemas.MemoryItem.parse(await confirmMemoryDraft(p,this.revamp())));}
 async greeting(raw:z.infer<typeof schemas.GreetingRequest>,signal?:AbortSignal){const p=this.parse(schemas.GreetingRequest,raw);return this.perform(p.operationId,p,async()=>schemas.Greeting.parse(await greeting(p,this.revamp(),signal)),signal);}
 async endConversation(raw:z.infer<typeof schemas.EndConversation>,signal?:AbortSignal){const p=this.parse(schemas.EndConversation,raw);return this.perform(p.operationId,p,async()=>schemas.ConversationSummary.parse(await endConversation({...p,trigger:'student_end'},this.revamp(),signal)),signal);}
 async view(){const ctx=this.r.engineContext();await this.r.planning().due({at:this.r.clock.now(),includePaused:true},ctx);const assessment=await this.r.assessment().snapshot({operationId:'view-'+this.r.repository.evidenceRevision()},ctx);
  const session=this.r.events.sessions().find(s=>s.status!=='closed')??null;
  const attempted=new Set(this.r.repository.list('attempts').flatMap(a=>this.r.catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));
  const tasks=this.r.catalog.candidates({sessionId:session?.id??'preview',excludeTaskIds:[],limit:100}).map(t=>({...t,eligible:t.prerequisites.every(k=>attempted.has(k))&&(!(session?.mode==='exploration')||['理解','逻辑'].includes(t.primaryDimension)||['理解','逻辑'].every(d=>this.r.repository.list('attempts').some(a=>a.sessionId===session.id&&this.r.catalog.definition(a.taskId,a.taskVersion)?.primaryDimension===d)))}));
  return {now:this.r.clock.now(),session,paused:session?.status==='paused',assessment,tasks,attempts:this.r.repository.list('attempts').map(a=>({...a,classification:classifyAttempt(a,ctx)})),exposures:this.r.repository.list('exposures'),gradings:this.r.repository.list('gradings'),evidence:this.r.repository.list('evidence'),reports:reportHistory(ctx),plans:planHistory(ctx),proposal:this.r.repository.list('proposals').at(-1)??null,reviews:currentReviewItems(ctx),consentConfigured:this.r.repository.list('consents').length>0,optionalMemory:this.r.events.memoryEnabled(),memories:this.r.repository.list('memories'),runs:this.r.repository.list('runs'),toolCalls:this.r.repository.list('toolCalls'),stuckPoints:this.r.repository.list('stuckPoints').map(s=>({...s,studentConfirmed:this.stuckConfirmed(s.id)})),
  // Audit only: fingerprints and reason codes, never answers or model text. exposed derives from real task exposures.
  generations:this.r.repository.list('generations').map(g=>({...g,exposed:!!g.taskId&&this.r.repository.list('exposures').some(e=>e.kind==='task'&&e.taskId===g.taskId&&e.taskVersion===g.taskVersion)})),generationAvailable:this.r.provider.kind!=='offline',
  // G0: learning records for the home revamp. problemSecrets is deliberately absent; chatTurns carry no student text.
  problems:this.r.repository.list('problems'),episodes:this.r.repository.list('episodes'),progressCards:this.r.repository.list('progressCards'),memoryMentions:this.r.repository.list('memoryMentions'),
  observations:this.r.repository.list('observations'),summaries:this.r.repository.list('summaries'),chatTurns:this.r.repository.list('chatTurns').slice(-20)};
 }
 async memoryCorrect(raw:z.infer<typeof requests.memoryCorrect>){const p=this.parse(requests.memoryCorrect,raw);return this.perform(p.operationId,p,async()=>this.r.repository.transaction(()=>{
  if(!this.r.events.memoryEnabled())throw new RuntimeError('forbidden','可选记忆关闭');
  this.r.events.memoryState({operationId:p.operationId+'-stop',memoryId:p.memoryId,action:'stop'});
  return this.r.events.remember({operationId:p.operationId+'-new',text:p.text,source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
 }));}
 async reset(raw:z.infer<typeof requests.reset>){this.parse(requests.reset,raw);if(this.active)throw new RuntimeError('invalid_state','请先取消并等待当前操作结束，再清除');if(!this.r.repository.reset)throw new RuntimeError('unavailable');this.epoch++;this.r.repository.reset();return {cleared:true};}
}
export type LearningView=Awaited<ReturnType<LearningCoordinator['view']>>;
