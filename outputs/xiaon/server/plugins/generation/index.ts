/**
 * E1 controlled generation: evidence → model candidate → program validation → immutable publication.
 * Called only from an authenticated student event; never registered as a model tool.
 */
import { randomUUID } from 'node:crypto';
import { SCHEMA_VERSION,schemas,type AgentRun,type GenerationRecord,type TaskPublicView } from '../../../shared/learning-contracts';
import type { LearningRuntime } from '../../bootstrap';
import { RuntimeError } from '../../core/errors';
import { hash } from '../../storage/repository';
import { classifyAttempt } from '../assessment/state';
import { skillDefinitions,type AssessmentCatalog } from '../assessment/catalog';
import { currentReviewItems,shanghaiDate } from '../../../src/learning/review';
import { questionExpression } from './expression';
import { GENERATOR_PROMPT,repairMessage } from './prompt';
import { ESTIMATED_MINUTES,MAGNITUDE_LIMIT,TEMPLATE_VERSION,templatesFor,type Difficulty,type KnowledgePointId } from './templates';
import { VALIDATOR_VERSION,validateCandidate,type Accepted } from './validator';
import { knownFingerprints } from './store';
import type { GenerationConfig } from './config';
export { GeneratedTaskStore } from './store';
export { GENERATOR_PROMPT } from './prompt';
export { readGenerationConfig,GENERATION_DEFAULTS,type GenerationConfig } from './config';
export type GenerateRequest={operationId:string;knowledgePointId:KnowledgePointId;purpose:'practice'|'review';reviewItemId:string|null;timeBudgetMinutes:number};
export type GenerateResponse={status:GenerationRecord['status'];generation:GenerationRecord;task:TaskPublicView|null};
type Step={accept:true}|{accept:false;repair:string};
export type ModelInvoker=(operationId:string,data:unknown,attempt:(content:string,round:number,toolCall:boolean)=>Step,maxRounds:number,timeoutMs:number,signal?:AbortSignal)=>Promise<{run:AgentRun}>;
const CALCULATION_LIMIT=10;
export class TaskGenerator {
 constructor(private r:LearningRuntime,private catalog:()=>AssessmentCatalog,private invoke:ModelInvoker,private config:GenerationConfig,private modelId:()=>string){}
 private response(record:GenerationRecord):GenerateResponse{
  return{status:record.status,generation:record,task:record.status==='published'&&record.taskId&&record.taskVersion?this.catalog().publicTask(record.taskId,record.taskVersion)??null:null};
 }
 /** Program gates. Every check happens before any model call and again (paused/cancel) before publication. */
 private gates(p:GenerateRequest){
  const repo=this.r.repository,catalog=this.catalog(),now=this.r.clock.now();
  const session=this.r.events.sessions().find(s=>s.status!=='closed')??null;
  if(session?.status==='paused')throw new RuntimeError('invalid_state','学习已暂停；由你主动恢复后才能出新题');
  const attempts=repo.list('attempts');
  const attempted=new Set(attempts.flatMap(a=>catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));
  if(p.knowledgePointId==='negative-brackets'&&!attempted.has('like-terms'))throw new RuntimeError('invalid_state','请先尝试先修知识点：like-terms');
  if(session?.mode==='exploration'&&!['理解','逻辑'].every(d=>attempts.some(a=>a.sessionId===session.id&&catalog.definition(a.taskId,a.taskVersion)?.primaryDimension===d)))throw new RuntimeError('invalid_state','探索先进行理解和逻辑');
  if(session){
   const calc=new Set(repo.list('exposures').filter(e=>e.sessionId===session.id&&e.kind==='task'&&catalog.definition(e.taskId,e.taskVersion)?.primaryDimension==='计算').map(e=>e.taskId));
   if(calc.size>=CALCULATION_LIMIT)throw new RuntimeError('budget_exhausted','本场次已达 10 道计算题；新出的题也计入，刷新不重置');
   const published=repo.list('generations').filter(g=>g.status==='published'&&g.createdAt>=session.startedAt).length;
   if(published>=this.config.sessionLimit)throw new RuntimeError('budget_exhausted',`本场次已新出 ${published} 道题，达到出题上限`);
  }
  const today=shanghaiDate(now);
  if(repo.list('generations').filter(g=>g.runId&&shanghaiDate(g.createdAt)===today).length>=this.config.dailyLimit)throw new RuntimeError('budget_exhausted','今天的出题次数已达上限，可继续使用原题库');
  let review=null;
  if(p.purpose==='review'){
   review=currentReviewItems(this.r.engineContext()).find(i=>i.id===p.reviewItemId)??null;
   if(!review||review.knowledgePointId!==p.knowledgePointId)throw new RuntimeError('conflict','复习任务不存在或已更新');
   if(review.status!=='active'||Date.parse(review.dueAt)>Date.parse(now))throw new RuntimeError('invalid_state','复习尚未到期或已暂停');
  }else if(p.reviewItemId!==null)throw new RuntimeError('invalid_params','练习出题不关联复习任务');
  if(this.r.provider.kind==='offline')throw new RuntimeError('unavailable','未配置模型，暂时不能出新题；可以继续使用原题库');
  return{session,review};
 }
 /** Only this knowledge point's saved attempts; no chat, no raw answers, optional memory only when enabled. */
 private modelInput(p:GenerateRequest,review:{stage:number;dueAt:string}|null){
  const ctx=this.r.engineContext(),catalog=this.catalog(),repo=this.r.repository;
  const related=repo.list('attempts').filter(a=>catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints.includes(p.knowledgePointId)).slice(-this.config.evidenceLimit).reverse();
  const evidence=related.map(a=>{
   const grade=repo.list('gradings').filter(g=>g.attemptId===a.id).at(-1);const def=catalog.definition(a.taskId,a.taskVersion);
   return{attemptId:a.id,taskId:a.taskId,evidenceIds:grade?.evidenceIds??[],taskExpression:def?questionExpression(def.question):null,verdict:grade?.verdict??'ungraded',kind:classifyAttempt(a,ctx).kind,hintBeforeSubmit:a.hintSnapshot.length>0,answerOrChatHelp:a.answerExposed,errorClues:grade?.errorClues??[]};
  });
  const latest=evidence[0]?.kind;
  const basis:GenerationRecord['basis']=p.purpose==='review'?'review_due':!latest?'no_evidence':['incorrect','corrected_original','pending'].includes(latest)?'difficulty':latest==='completed_with_help'?'help_dependence':'independent';
  const byBasis:Record<GenerationRecord['basis'],Difficulty[]>={no_evidence:['introductory'],difficulty:['introductory','standard'],help_dependence:['introductory','standard'],review_due:['introductory','standard'],independent:['standard','stretch']};
  const allowedDifficulties=byBasis[basis].filter(d=>ESTIMATED_MINUTES[d]<=p.timeBudgetMinutes);
  const avoidExpressions=catalog.all().filter(t=>t.knowledgePoints.includes(p.knowledgePointId)).map(t=>questionExpression(t.question)).filter((e):e is string=>!!e);
  const skill=skillDefinitions.find(s=>s.id===p.knowledgePointId)!;
  const data={knowledgePointId:p.knowledgePointId,knowledgePointLabel:skill.label,purpose:p.purpose,basis,
   basisNote:basis==='no_evidence'?'没有该环节的作答记录：只出课程范围内可选基础题，不是诊断':'依据仅限下列已保存作答',
   allowedDifficulties,magnitudeLimit:Object.fromEntries(allowedDifficulties.map(d=>[d,MAGNITUDE_LIMIT[d]])),timeBudgetMinutes:p.timeBudgetMinutes,
   templates:templatesFor(p.knowledgePointId).map(t=>({templateId:t.id,difficulties:t.difficulties.filter(d=>allowedDifficulties.includes(d)),description:t.description,params:t.params,focus:t.focus})).filter(t=>t.difficulties.length),
   evidence:evidence.map(({taskId:_t,...e})=>e),dueReview:review?{stage:review.stage,dueAt:review.dueAt}:null,avoidExpressions,
   preferences:this.r.events.context().memories.map(m=>m.text)};
  return{data,basis,allowedDifficulties,evidence};
 }
 async generate(p:GenerateRequest,signal:AbortSignal|undefined,stillCurrent:()=>boolean):Promise<GenerateResponse>{
  const repo=this.r.repository;
  const requestFingerprint=hash({kind:'e-generate',knowledgePointId:p.knowledgePointId,purpose:p.purpose,reviewItemId:p.reviewItemId,timeBudgetMinutes:p.timeBudgetMinutes});
  const prior=repo.list('generations').filter(g=>g.operationId===p.operationId);
  if(prior.some(g=>g.requestFingerprint!==requestFingerprint))throw new RuntimeError('conflict','operationId 已用于不同的出题请求');
  const final=prior.find(g=>g.status==='published'||g.status==='rejected');
  if(final)return this.response(final);
  const {review}=this.gates(p);
  const input=this.modelInput(p,review);
  if(!input.allowedDifficulties.length)throw new RuntimeError('budget_exhausted','时间预算不足以完成一道新题');
  const allowedEvidenceIds=new Set(input.evidence.flatMap(e=>e.evidenceIds));
  const existingFingerprints=knownFingerprints(p.knowledgePointId,this.catalog().all());
  const candidates:GenerationRecord['candidates']=[];let accepted:Accepted|null=null;
  const {run}=await this.invoke(p.operationId+'-generator',input.data,(content,round,toolCall)=>{
   if(toolCall){candidates.push({round,status:'rejected',templateId:null,difficulty:null,parameterFingerprint:null,contentFingerprint:null,reasons:['tool_call_not_allowed']});return{accept:false,repair:repairMessage(['tool_call_not_allowed'])};}
   const v=validateCandidate(content,{knowledgePointId:p.knowledgePointId,purpose:p.purpose,allowedDifficulties:input.allowedDifficulties,allowedEvidenceIds,existingFingerprints});
   candidates.push(v.ok?{round,status:'accepted',templateId:v.candidate.templateId,difficulty:v.candidate.difficulty,parameterFingerprint:v.parameterFingerprint,contentFingerprint:v.contentFingerprint,reasons:[]}:{round,status:'rejected',templateId:v.templateId,difficulty:v.difficulty,parameterFingerprint:v.parameterFingerprint,contentFingerprint:v.contentFingerprint,reasons:v.reasons});
   if(v.ok){accepted=v;return{accept:true};}
   return{accept:false,repair:repairMessage(v.reasons)};
  },this.config.maxRounds,this.config.timeoutMs,signal);
  const record=(status:GenerationRecord['status'],extra:Partial<GenerationRecord>={}):GenerationRecord=>schemas.GenerationRecord.parse({schemaVersion:SCHEMA_VERSION,id:'gen-record-'+randomUUID(),operationId:p.operationId,knowledgePointId:p.knowledgePointId,purpose:p.purpose,basis:input.basis,reviewItemId:p.reviewItemId,status,
   providerKind:this.r.provider.kind,modelId:this.modelId(),promptVersion:GENERATOR_PROMPT.version,templateVersion:TEMPLATE_VERSION,validatorVersion:VALIDATOR_VERSION,requestFingerprint,
   evidenceRevision:repo.evidenceRevision(),evidenceIds:[...allowedEvidenceIds],attemptIds:input.evidence.map(e=>e.attemptId),candidates,taskId:null,taskVersion:null,focus:null,familyId:null,relation:'same_family_numeric_variant',
   variantOfTaskIds:[...new Set(input.evidence.map(e=>e.taskId))],runId:run.id,failure:null,createdAt:this.r.clock.now(),...extra});
  const done=accepted as Accepted|null;
  if(run.status!=='completed'||!done){
   if(run.status==='completed'){const rejected=record('rejected');repo.append('generations',rejected);return this.response(rejected);}
   const failure=run.error??{code:'provider_error' as const,message:'模型没有给出可用候选',recoverable:true};
   repo.append('generations',record(failure.code==='cancelled'?'cancelled':'failed',{failure}));
   throw new RuntimeError(failure.code,failure.code==='cancelled'?'已取消出题；迟到的模型结果不会发布':failure.message);
  }
  // Late results: cancellation, reset or a pause after the model answered discard the candidate.
  const paused=this.r.events.sessions().some(s=>s.status==='paused');
  if(signal?.aborted||!stillCurrent()||paused){
   const failure={code:'cancelled' as const,message:paused?'学习已暂停，迟到的候选已丢弃':'已取消，迟到的候选已丢弃',recoverable:true};
   if(stillCurrent())repo.append('generations',record('cancelled',{failure}));
   throw new RuntimeError('cancelled',failure.message);
  }
  return repo.transaction(()=>{
   // Re-check against the latest catalog inside the write transaction; content never publishes twice.
   if(knownFingerprints(p.knowledgePointId,this.catalog().all()).has(done.contentFingerprint)){
    candidates[candidates.length-1]={...candidates[candidates.length-1],status:'rejected',reasons:['duplicate_content']};
    const rejected=record('rejected');repo.append('generations',rejected);return this.response(rejected);
   }
   repo.append('tasks',done.task);
   const published=record('published',{taskId:done.task.id,taskVersion:done.task.version,focus:done.focus,familyId:done.task.familyId});
   repo.append('generations',published);return this.response(published);
  });
 }
}
