import { randomUUID } from 'node:crypto';
import { SCHEMA_VERSION as V, schemas, type EngineContext, type PlanningEnginePort, type ReviewItem, type ReviewOutcome, type ReviewPolicy, type PlanProposal, type PlanVersion } from '../../../shared/learning-contracts';
import { currentReviewItems, dateStart, reportHistory, selectReviewTarget, shanghaiDate } from '../../../src/learning/review';
import { RuntimeError } from '../../core/errors';
import { assertAssessment, attemptFacts } from './evidence';

type PolicyOptions=Partial<Pick<ReviewPolicy,'id'|'version'|'intervalDays'|'minimumAdvanceHours'|'helpRetryHours'|'errorRetryHours'>>;
const addHours=(at:string,hours:number)=>new Date(Date.parse(at)+hours*3_600_000).toISOString();
const latestPlan=(c:EngineContext)=>c.repository.list('plans').at(-1);

/** Rules only. Call mutations from an authenticated student-event handler, never a model tool. */
export class PlanningEngine implements PlanningEnginePort {
 readonly id='c-planning-v1';
 readonly policy:ReviewPolicy;
 constructor(options:PolicyOptions={}) {
  this.policy=schemas.ReviewPolicy.parse({schemaVersion:V,id:'c-default-policy',version:1,intervalDays:[1,3,7,14],minimumAdvanceHours:24,helpRetryHours:12,errorRetryHours:6,timezone:'Asia/Shanghai',...options});
 }
 private rememberPolicy(c:EngineContext){c.repository.append('reviewPolicies',this.policy);}
 private current(c:EngineContext){return currentReviewItems(c);}
 private validTime(time:string){if(!schemas.SourceTime.shape.recordedAt.safeParse(time).success)throw new RuntimeError('invalid_params','时间必须是 ISO UTC');}

 async due(input:Parameters<PlanningEnginePort['due']>[0],c:EngineContext) {
  this.validTime(input.at);
  await this.reconcile({operationId:randomUUID()},c);
  return this.current(c).filter(i=>Date.parse(i.dueAt)<=Date.parse(input.at)&&(i.status==='active'||input.includePaused&&i.status==='paused')).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt)||a.id.localeCompare(b.id));
 }

 private rootAttempt(item:ReviewItem,c:EngineContext) {
  const root=c.repository.list('reviewItems').filter(i=>i.id===item.id).sort((a,b)=>a.revision-b.revision)[0]??item;
  return c.repository.list('attempts').filter(a=>a.sessionId===root.sourceSessionIds[0]&&a.sourceTime.occurredAt&&Date.parse(a.sourceTime.occurredAt)<=Date.parse(root.createdAt)&&a.exposureIds.length>0&&a.exposureIds.every(id=>root.exposureIds.includes(id))&&c.catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints.includes(root.knowledgePointId)).at(-1);
 }
 private initialDue(attemptId:string,kp:string,c:EngineContext) {
  const facts=attemptFacts(attemptId,kp,c);
  if(!facts.trusted||!facts.time)return null;
  const hours=facts.grade.verdict==='needs_review'?24:facts.grade.verdict==='incorrect'?this.policy.errorRetryHours:facts.help?this.policy.helpRetryHours:this.policy.intervalDays[0]*24;
  const reason=facts.grade.verdict==='needs_review'?'待核查；不作为确定错误或稳定证据':facts.grade.verdict==='incorrect'?'先针对具体困难提供支持，再复测':facts.help?'提示/帮助后完成，较早复查':'根据可信完成时刻安排延迟新题检查';
  return {dueAt:addHours(facts.time,hours),reason,facts};
 }

 private apply(item:ReviewItem,outcome:ReviewOutcome,c:EngineContext,previous:ReviewOutcome[]) {
  const f=attemptFacts(outcome.attemptId,item.knowledgePointId,c);
  if(!f.trusted||!f.time)throw new RuntimeError('invalid_state','未知历史时间不能作为跨次复习结果');
  const originalSession=item.sourceSessionIds[0];
  const anchor=this.rootAttempt({...item,sourceSessionIds:[originalSession]},c)?.sourceTime.occurredAt;
  const last=[anchor,...previous.map(o=>o.completedAt)].filter((x):x is string=>!!x).sort().at(-1);
  const elapsed=last?Date.parse(f.time)-Date.parse(last):0;
  const canAdvance=f.independent&&f.novelty==='unseen'&&!item.sourceSessionIds.includes(outcome.sessionId)&&Date.parse(f.time)>=Date.parse(item.dueAt)&&elapsed>=this.policy.minimumAdvanceHours*3_600_000&&(!last||shanghaiDate(f.time)!==shanghaiDate(last));
  let stage=item.stage,status:ReviewItem['status']='active',dueAt:string,reason:string;
  if(f.grade.verdict==='needs_review'){dueAt=addHours(f.time,24);reason='待核查：保持阶段，不作确定错误，不推进稳定状态';}
  else if(f.grade.verdict==='incorrect'){dueAt=addHours(f.time,this.policy.errorRetryHours);reason='先提供针对性支持，再复测；此次错误不自动推断整体能力';}
  else if(f.help){dueAt=addHours(f.time,this.policy.helpRetryHours);reason='提示/帮助后正确，保持阶段并较早复查';}
  else if(canAdvance){
   stage++;status=stage>=this.policy.intervalDays.length?'completed':'active';
   dueAt=status==='completed'?f.time:addHours(f.time,this.policy.intervalDays[stage]*24);
   reason=status==='completed'?'已完成本轮延迟独立检查；不等于长期教学效果已证实':'延迟未见新题、跨场次独立正确，进入下一阶段';
  }else{
   dueAt=[item.dueAt,addHours(f.time,this.policy.minimumAdvanceHours)].sort().at(-1)!;
   reason=f.novelty!=='unseen'||!f.independent?'原题/已见题回顾或独立证据不足，不用于新题迁移进级':'最低间隔、到期或不同学习场次条件不足，保持阶段';
  }
  return {...item,stage,status,dueAt,reason,sourceSessionIds:[...new Set([...item.sourceSessionIds,outcome.sessionId])],exposureIds:[...new Set([...item.exposureIds,...f.attempt.exposureIds])],task:null,evidenceRevision:c.repository.evidenceRevision()};
 }

 async recordOutcome(raw:ReviewOutcome,c:EngineContext) {
  const parsed=schemas.ReviewOutcome.safeParse(raw);if(!parsed.success)throw new RuntimeError('invalid_params','复习结果契约无效');const input=parsed.data;
  return c.repository.once(input.operationId,{kind:'c-outcome',input},()=>{
   this.rememberPolicy(c);
   const item=this.current(c).find(i=>i.id===input.reviewItemId);
   if(!item||item.revision!==input.reviewRevision||item.status!=='active')throw new RuntimeError('conflict','任务已更新或暂停，请重新核对');
   if(c.repository.list('reviewOutcomes').some(o=>o.attemptId===input.attemptId))throw new RuntimeError('conflict','本次尝试已有复习结果');
   if(this.requiresReplay(item,c))throw new RuntimeError('conflict','评分已修订，请先刷新复习队列');
   const f=attemptFacts(input.attemptId,item.knowledgePointId,c);
   if(!f.trusted||input.completedAt!==f.time||input.sessionId!==f.attempt.sessionId||input.verdict!==f.grade.verdict||input.independent!==f.independent||input.taskNovelty!==f.novelty||input.evidenceRevision!==c.repository.evidenceRevision())throw new RuntimeError('invalid_params','结果必须与已保存尝试、暴露、时间和最新评分一致');
   const prior=c.repository.list('reviewOutcomes').filter(o=>o.reviewItemId===item.id);
   if(input.attemptId===this.rootAttempt(item,c)?.id||Date.parse(f.time!)<Date.parse(item.createdAt)||prior.some(o=>Date.parse(o.completedAt)>Date.parse(f.time!)))throw new RuntimeError('invalid_state','复习结果不能复用初始依据或倒序更新');
   const next=schemas.ReviewItem.parse({...this.apply(item,input,c,prior),operationId:input.operationId,revision:item.revision+1});
   c.repository.append('reviewOutcomes',{...input,reason:next.reason});c.repository.append('reviewItems',next);return [next];
  });
 }

 private requiresReplay(item:ReviewItem,c:EngineContext) {
  const ats=new Set([this.rootAttempt(item,c)?.id,...c.repository.list('reviewOutcomes').filter(o=>o.reviewItemId===item.id).map(o=>o.attemptId)]);
  return c.repository.list('gradings').some(g=>g.supersedesGradingId&&ats.has(g.attemptId)&&g.evidenceRevision>item.evidenceRevision);
 }
 /** Additional D entry point for correction events; reads the same frozen repository, no new protocol. */
 async reconcile(input:{operationId:string},c:EngineContext):Promise<ReviewItem[]> {
  const affected=this.current(c).filter(i=>i.status!=='superseded'&&this.requiresReplay(i,c));
  if(!affected.length)return this.current(c);
  return c.repository.once(input.operationId,{kind:'c-reconcile'},()=>this.replayAffected(input.operationId,c));
 }
 private replayAffected(operationId:string,c:EngineContext) {
   const affected=this.current(c).filter(i=>i.status!=='superseded'&&this.requiresReplay(i,c));
   if(affected.length)this.rememberPolicy(c);
   for(const old of affected){
    const root=c.repository.list('reviewItems').filter(i=>i.id===old.id).sort((a,b)=>a.revision-b.revision)[0];
    const anchor=this.rootAttempt(root,c);const initial=anchor?this.initialDue(anchor.id,root.knowledgePointId,c):null;
    if(!initial)continue;
    let replay:ReviewItem={...root,dueAt:initial.dueAt,reason:initial.reason};const previous:ReviewOutcome[]=[];
    for(const outcome of c.repository.list('reviewOutcomes').filter(o=>o.reviewItemId===old.id).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt))){
     const historical=c.repository.get('reviewItems',`${old.id}:r${outcome.reviewRevision}`);
     const postpone=historical?.postponements.at(-1);
     if(postpone&&Date.parse(postpone.to)>Date.parse(replay.dueAt))replay.dueAt=postpone.to;
     replay=this.apply(replay,outcome,c,previous);previous.push(outcome);
    }
    // Preserve actual student decisions while replacing derived scheduling. Old versions remain immutable.
    const lastPostponement=old.postponements.at(-1);
    if(lastPostponement&&lastPostponement.to>replay.dueAt)replay.dueAt=lastPostponement.to;
    const revised=schemas.ReviewItem.parse({...replay,revision:old.revision+1,operationId,evidenceRevision:c.repository.evidenceRevision(),postponements:old.postponements,planVersionId:old.planVersionId,status:old.status==='paused'?'paused':replay.status,reason:'评分依据已修订，已重算当前安排；'+replay.reason});
    c.repository.append('reviewItems',revised);
   }
   return this.current(c);
 }

 async propose(input:Parameters<PlanningEnginePort['propose']>[0],c:EngineContext):Promise<PlanProposal> {
  if(!Number.isFinite(input.timeBudgetMinutes)||input.timeBudgetMinutes<1||input.timeBudgetMinutes>120)throw new RuntimeError('invalid_params','时间预算应为 1 至 120 分钟');
  return c.repository.once(input.operationId,{kind:'c-propose',...input},()=>{
   assertAssessment(input.assessment,c);
   const existing=c.repository.list('proposals').at(-1);
   if(existing?.evidenceRevision===input.assessment.evidenceRevision&&existing.constraints.timeBudgetMinutes===input.timeBudgetMinutes&&shanghaiDate(existing.createdAt)===shanghaiDate(c.clock.now()))return existing;
   const choice=selectReviewTarget(input.assessment,input.timeBudgetMinutes,c),skill=choice.skill;
   const optional=!skill||skill.status==='unobserved';
   const stable=skill?.status==='cross_session_independent'||skill?.status==='first_independent';
   const goal=optional?'可选探索：先从理解或逻辑了解自己的想法':stable?`${choice.knowledgePointId}：延迟新题检查，观察跨次独立表现`:skill.status==='completed_with_help'?`${choice.knowledgePointId}：从提示帮助过渡到独立处理`:`${choice.knowledgePointId}：厘清具体关系与步骤，再复测`;
   const basis=optional?[]:choice.evidenceIds;
   let scheduledDate=shanghaiDate(c.clock.now());
   const trusted=skill?.attemptIds.map(id=>{try{return this.initialDue(id,choice.knowledgePointId,c);}catch{return null;}}).filter(x=>x!==null).at(-1);
   if(trusted)scheduledDate=[scheduledDate,shanghaiDate(trusted.dueAt)].sort().at(-1)!;
   const task=choice.candidates[0];
   const items:PlanProposal['items']=[];
   const makeItem=(type:PlanProposal['items'][number]['taskType'],minutes:number,selected:typeof task|undefined,detail:string)=>({id:randomUUID(),knowledgePointId:choice.knowledgePointId,taskType:type,task:selected?{taskId:selected.id,taskVersion:selected.version}:null,estimatedMinutes:minutes,scheduledDate,evidenceIds:basis,goal:detail,status:'proposed' as const});
   if(optional)items.push(makeItem('explore',Math.min(task?.estimatedMinutes??2,Math.floor(input.timeBudgetMinutes)),task,'可选探索；无记录不代表能力弱'));
   else if(stable)items.push(makeItem('delayed_check',Math.min(task?.estimatedMinutes??3,Math.floor(input.timeBudgetMinutes)),task,'延迟未见同类题检查；题库不足时等待补充可信题目'));
   else {
    items.push(makeItem('supported_practice',Math.min(3,Math.floor(input.timeBudgetMinutes)),undefined,'只看当前知识点的一个具体步骤，先提供支持'));
    if(task&&input.timeBudgetMinutes>=3+task.estimatedMinutes)items.push(makeItem('independent_transfer',task.estimatedMinutes,task,'支持后自选未见新题；完成支持前须再次核对题目暴露'));
   }
   const p=schemas.PlanProposal.parse({schemaVersion:V,id:randomUUID(),operationId:input.operationId,evidenceRevision:input.assessment.evidenceRevision,createdAt:c.clock.now(),assessmentSnapshotId:input.assessment.id,goal,items,statements:[{text:optional?'尚无足够记录，只提供可选探索':choice.reason,kind:optional?'unknown':'inference',evidenceIds:basis}],alternatives:[choice.reason,...choice.alternatives.map(a=>`${a.knowledgePointId}：${a.reason}`),...choice.originalReviewOptions.map(t=>`原题回顾：${t.id}（已见，不作为未见检验）`)],constraints:choice.constraints,supersedesProposalId:existing?.id??null});
   c.repository.append('proposals',p);return p;
  });
 }

 async confirm(input:Parameters<PlanningEnginePort['confirm']>[0],c:EngineContext):Promise<PlanVersion> {
  if(!input.reason.trim()||!['accept','lighter','reschedule','defer','resume'].includes(input.action))throw new RuntimeError('invalid_params','需要学生明确选择及原因');
  return c.repository.once(input.operationId,{kind:'c-confirm',...input},()=>{
   const proposal=c.repository.get('proposals',input.proposalId),previous=latestPlan(c);
   if(!proposal)throw new RuntimeError('not_found','计划草案不存在');
   const pausingCurrent=input.action==='defer'&&previous?.proposalId===proposal.id;
   if((previous?.id??null)!==input.expectedPreviousVersionId||!pausingCurrent&&(proposal.evidenceRevision!==c.repository.evidenceRevision()||c.repository.list('proposals').at(-1)?.id!==proposal.id))throw new RuntimeError('conflict','计划或依据已更新，请重新核对');
   const now=c.clock.now();let scheduledDate:string|null=null;
   if(['accept','lighter'].includes(input.action)&&proposal.items.some(i=>i.scheduledDate<shanghaiDate(now)))throw new RuntimeError('conflict','草案日期已过，请重新生成并核对');
   if(input.action==='reschedule'){
    if(!input.scheduledDate)throw new RuntimeError('invalid_params','改期需要明确日期');
    try{dateStart(input.scheduledDate);}catch{throw new RuntimeError('invalid_params','改期日期不存在');}
    if(input.scheduledDate<shanghaiDate(now))throw new RuntimeError('invalid_params','不能改到过去日期');scheduledDate=input.scheduledDate;
   }else if(input.scheduledDate!==null)throw new RuntimeError('invalid_params','只有改期可设置日期');
   let items=structuredClone(previous?.proposalId===proposal.id?previous.items:proposal.items);
   if(input.action==='lighter'){
    if(items.length>1)items=items.slice(0,1);
    else items=items.map(i=>({...i,task:null,taskType:'original_review',estimatedMinutes:1,goal:'减量：只回顾一个已有步骤，整题留待之后自选'}));
   }
   items=items.map(i=>({...i,scheduledDate:scheduledDate??(input.action==='resume'&&i.scheduledDate<shanghaiDate(now)?shanghaiDate(addHours(now,24)):i.scheduledDate),status:input.action==='defer'?'paused':'scheduled'}));
   const plan=schemas.PlanVersion.parse({schemaVersion:V,id:randomUUID(),operationId:input.operationId,evidenceRevision:proposal.evidenceRevision,version:(previous?.version??0)+1,proposalId:proposal.id,previousVersionId:previous?.id??null,goal:proposal.goal,items,changes:[`学生选择 ${input.action}：${input.reason}`,...(scheduledDate?[`日期调整为 ${scheduledDate}`]:[])],confirmation:{action:input.action,confirmedAt:now,actor:'student',expectedPreviousVersionId:input.expectedPreviousVersionId,reason:input.reason},createdAt:now});
   c.repository.append('plans',plan);this.rememberPolicy(c);this.replayAffected(input.operationId,c);
   const targets=new Set(items.map(i=>i.knowledgePointId));
   for(const old of this.current(c).filter(i=>['active','paused'].includes(i.status)&&!targets.has(i.knowledgePointId)))c.repository.append('reviewItems',{...old,revision:old.revision+1,status:'superseded',operationId:input.operationId,reason:'学生确认新目标，旧安排失效'});
   const assessment=c.repository.get('assessments',proposal.assessmentSnapshotId)!;
   for(const kp of targets){
    const old=this.current(c).find(i=>i.knowledgePointId===kp&&i.status!=='superseded');
    if(old?.status==='completed')continue;
    let next=old;
    if(!next){
     const skill=assessment.skills.find(s=>s.knowledgePointId===kp);
     const anchor=skill?.attemptIds.map(id=>{try{return this.initialDue(id,kp,c);}catch{return null;}}).filter(x=>x!==null).sort((a,b)=>a.facts.time!.localeCompare(b.facts.time!)).at(-1);
     // A legacy time label cannot create a genuine due time. The confirmed optional plan still exists.
     if(!anchor)continue;
     next={schemaVersion:V,id:randomUUID(),operationId:input.operationId,evidenceRevision:proposal.evidenceRevision,revision:0,knowledgePointId:kp,stage:0,task:items.find(i=>i.knowledgePointId===kp&&i.task)?.task??null,originalDueAt:anchor.dueAt,dueAt:anchor.dueAt,status:'active',sourceSessionIds:[anchor.facts.attempt.sessionId!],exposureIds:anchor.facts.attempt.exposureIds,reason:anchor.reason,postponements:[],planVersionId:plan.id,createdAt:now};
    }
    let dueAt=next.dueAt;const postponements=[...next.postponements];
    if(scheduledDate){dueAt=[dateStart(scheduledDate),now].sort().at(-1)!;postponements.push({from:next.dueAt,to:dueAt,reason:input.reason,at:now});}
    if(input.action==='resume'&&dueAt<=now){const resumed=addHours(now,24);postponements.push({from:dueAt,to:resumed,reason:'学生恢复；不集中堆积补做任务',at:now});dueAt=resumed;}
    c.repository.append('reviewItems',schemas.ReviewItem.parse({...next,operationId:input.operationId,revision:next.revision+1,evidenceRevision:c.repository.evidenceRevision(),planVersionId:plan.id,dueAt,postponements,status:input.action==='defer'?'paused':'active',reason:input.action==='defer'?'学生暂不开始；队列可见，不催促、不自动开题':scheduledDate?'学生改期，保留原到期时间与原因':input.action==='resume'?'学生主动恢复；每个知识点保留一个任务':next.reason}));
   }
   return plan;
  });
 }

 async report(input:Parameters<PlanningEnginePort['report']>[0],c:EngineContext) {
  return c.repository.once(input.operationId,{kind:'c-report',...input},()=>{
   assertAssessment(input.assessment,c);
   const latest=c.repository.list('reports').at(-1);
   if(input.previousReportId!==null&&!c.repository.get('reports',input.previousReportId))throw new RuntimeError('not_found','前一报告不存在');
   if(latest?.evidenceRevision===input.assessment.evidenceRevision)return latest;
   const revised=reportHistory(c).filter(r=>r.basisRevised);
   const previousAssessment=latest?c.repository.get('assessments',latest.assessmentSnapshotId):undefined;
   const changes=input.assessment.skills.flatMap(s=>{
    const old=previousAssessment?.skills.find(p=>p.knowledgePointId===s.knowledgePointId);
    return !old?[`${s.knowledgePointId}：新增观察 ${s.status}`]:old.status!==s.status?[`${s.knowledgePointId}：${old.status} → ${s.status}`]:[];
   });
   const statements:PlanProposal['statements']=input.assessment.skills.flatMap(s=>[
    {text:s.status==='unobserved'?`${s.knowledgePointId}：尚无足够依据，不推断能力弱`:`${s.knowledgePointId}：本次知识点状态 ${s.status}，仅适用于已观察任务`,kind:s.status==='unobserved'?'unknown' as const:'fact' as const,evidenceIds:s.evidenceIds},
    ...s.unknowns.map(text=>({text,kind:'unknown' as const,evidenceIds:[]})),
   ]);
   if(!statements.length)statements.push({text:'没有可用记录，不能给出个性化能力判断',kind:'unknown',evidenceIds:[]});
   const choice=selectReviewTarget(input.assessment,6,c);
   statements.push({text:choice.reason,kind:'inference',evidenceIds:choice.evidenceIds});
   const report=schemas.ReportSnapshot.parse({schemaVersion:V,id:randomUUID(),operationId:input.operationId,evidenceRevision:input.assessment.evidenceRevision,createdAt:c.clock.now(),assessmentSnapshotId:input.assessment.id,statements,coverage:input.assessment.coverage.map(d=>`${d.dimension}：${d.evidenceCount} 条依据；${d.unknowns.join('；')||'覆盖仅限记录任务'}`),changes:[...(latest?[`证据版本 ${latest.evidenceRevision} → ${input.assessment.evidenceRevision}`]:['首份观察快照']),...changes,...(revised.length?['历史依据已修订；原报告保留，当前结论使用新版证据']:[])],recommendations:[choice.reason,'仅为待验证产品策略；不代表长期掌握或教学效果',...input.assessment.limitations],supersedesReportId:latest?.id??null});
   c.repository.append('reports',report);return report;
  });
 }
}
