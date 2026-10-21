import type { Attempt,EngineContext,GradingResult,SkillState,AssessmentSnapshot,TaskDefinition } from '../../../shared/learning-contracts';
import { skillDefinitions,skillIdsForTask } from './catalog';
import type { evidenceKindLabels } from '../../../src/learning/assessment';
export type IndependencePolicy={minimumTasks:number;minimumDates:number;minimumSessions:number};
export const DEFAULT_INDEPENDENCE_POLICY:IndependencePolicy={minimumTasks:2,minimumDates:2,minimumSessions:2};
export function latestGrade(attemptId:string,ctx:EngineContext):GradingResult|undefined{return ctx.repository.list('gradings').filter(g=>g.attemptId===attemptId).at(-1);}
function questionKey(t:TaskDefinition){return t.question.replace(/[\s。]/g,'').replace(/[−–]/g,'-');}
function sameProblem(a:Pick<Attempt,'taskId'|'taskVersion'>,b:Pick<Attempt,'taskId'|'taskVersion'>,ctx:EngineContext){
 if(a.taskId===b.taskId)return true;
 const t=ctx.catalog.definition(a.taskId,a.taskVersion),u=ctx.catalog.definition(b.taskId,b.taskVersion);
 return !!t&&!!u&&questionKey(t)===questionKey(u);
}
export function trustedDate(a:Attempt,ctx:EngineContext):string|null {
 if(a.sourceTime.trust!=='server'||!a.sourceTime.occurredAt||!a.sessionId||a.exposureHistory!=='complete'||a.origin!=='student_api')return null;
 const session=ctx.repository.get('sessions',a.sessionId);const at=a.sourceTime.occurredAt;
 if(!session||at<session.startedAt||at>a.sourceTime.recordedAt)return null;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
}
export type AttemptClassification={
 kind:keyof typeof evidenceKindLabels;novelty:'unseen'|'seen'|'unknown';learningDate:string|null;
 independent:boolean;delayedRetention:boolean;reason:string;
};
/** Uses saved exposure IDs, never a later live hint flag. Raw earlier wrong attempts continue to count. */
export function classifyAttempt(a:Attempt,ctx:EngineContext):AttemptClassification{
 const at=ctx.repository.list('attempts').findIndex(x=>x.id===a.id);
 const earlier=ctx.repository.list('attempts').slice(0,Math.max(0,at)).filter(x=>sameProblem(a,x,ctx)&&x.value.trim());
 const exposures=a.exposureIds.map(id=>ctx.repository.get('exposures',id));
 const date=trustedDate(a,ctx);
 const incomplete=a.exposureHistory!=='complete'||a.taskVersion===1||!date||exposures.some(e=>!e)||!exposures.some(e=>e?.kind==='task'&&e.sessionId===a.sessionId&&e.taskId===a.taskId&&e.taskVersion===a.taskVersion);
 const earlierUnknown=earlier.some(x=>x.exposureHistory==='legacy_unknown'||x.origin==='legacy_import');
 // A snapshots same-version exposures. Cross-version original IDs are conservatively matched,
 // but only strictly earlier trusted timestamps may supplement a snapshot (never later hints).
 const priorAliases=ctx.repository.list('exposures').filter(e=>e.taskVersion!==a.taskVersion&&sameProblem(a,e,ctx)&&e.sourceTime.trust==='server'&&e.sourceTime.occurredAt&&a.sourceTime.occurredAt&&e.sourceTime.occurredAt<a.sourceTime.occurredAt);
 const localDay=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
 const previouslyOpened=exposures.some(e=>e?.kind==='task'&&(e.sessionId!==a.sessionId||(e.sourceTime.occurredAt&&date&&localDay(e.sourceTime.occurredAt)<date)))||priorAliases.some(e=>e.kind==='task');
 // Frozen SourceTime has millisecond precision and no cross-collection sequence.
 // When an alias-version task opening ties submission time, leave novelty unknown.
 const tiedAlias=ctx.repository.list('exposures').some(e=>e.kind==='task'&&e.taskVersion!==a.taskVersion&&sameProblem(a,e,ctx)&&e.sourceTime.occurredAt===a.sourceTime.occurredAt);
 const novelty=incomplete||earlierUnknown||tiedAlias?'unknown':earlier.length||previouslyOpened?'seen':'unseen';
 const helped=a.answerExposed||a.hintSnapshot.length>0||[...exposures,...priorAliases].some(e=>e&&['hint','answer','chat_help'].includes(e.kind));
 const grade=latestGrade(a.id,ctx);let kind:AttemptClassification['kind']='unknown';let reason='时间或暴露历史不完整，不能认定未见新题独立完成';
 if(!a.value.trim()||!grade||grade.verdict==='needs_review'){kind='pending';reason='作答或评分证据不足，不作能力弱判断';}
 else if(grade.verdict==='incorrect'){kind='incorrect';reason='这次作答的评分点未通过；保留具体证据，不推断人格或智力';}
 else if(helped){kind='completed_with_help';reason='作答之前存在提示、答案或聊天关键帮助';}
 else if(novelty==='unseen'){kind='new_independent';reason='首次有效尝试正确且本场次之前无原题及关键帮助暴露';}
 else if(novelty==='seen'){
  const sameSession=earlier.some(x=>x.sessionId===a.sessionId);
  kind=sameSession?'corrected_original':'original_redo';reason=sameSession?'同一原题已有有效尝试，修改正确不能算首次独立':'原题已在此前场次见过，重做不代表新题迁移';
 }
 const priorDate=earlier.map(x=>trustedDate(x,ctx)).filter((d):d is string=>!!d).find(d=>date&&d<date);
 return{kind,novelty,learningDate:date,independent:kind==='new_independent',delayedRetention:!!priorDate&&grade?.verdict==='correct'&&!helped,reason};
}
const unique=<T>(values:T[])=>[...new Set(values)];
export function computeAssessment(ctx:EngineContext,policy:IndependencePolicy,ids:{snapshot:string;skill:()=>string}):AssessmentSnapshot{
 const attempts=ctx.repository.list('attempts');const revision=ctx.repository.evidenceRevision();
 const allEvidence=ctx.repository.list('evidence');
 const skills:SkillState[]=skillDefinitions.map(skill=>{
  const basis=attempts.filter(a=>{const t=ctx.catalog.definition(a.taskId,a.taskVersion);return !!t&&skillIdsForTask(t).includes(skill.id)&&a.value.trim();});
  const facts=basis.map(a=>({attempt:a,grade:latestGrade(a.id,ctx),classification:classifyAttempt(a,ctx)}));
  const independent=facts.filter(f=>f.classification.independent);
  const dates=unique(independent.map(f=>f.classification.learningDate!));const sessions=unique(independent.map(f=>f.attempt.sessionId!));
  const helped=facts.filter(f=>f.classification.kind==='completed_with_help');
  const hasDifficulty=facts.some(f=>['incorrect','corrected_original'].includes(f.classification.kind));
  const stable=independent.length>=policy.minimumTasks&&dates.length>=policy.minimumDates&&sessions.length>=policy.minimumSessions;
  const status:SkillState['status']=stable?'cross_session_independent':independent.length?'first_independent':helped.length?'completed_with_help':hasDifficulty?'needs_support':'unobserved';
  const lastKnown=facts.filter(f=>f.grade&&f.grade.verdict!=='needs_review').at(-1);
  const recentDifficulty=lastKnown?.grade?.verdict==='incorrect';
  const evidenceIds=unique(facts.flatMap(f=>f.grade?.evidenceIds??[]));
  const unknowns=['只覆盖'+skill.scope+'，不外推整个维度'];
  if(facts.some(f=>f.classification.novelty==='unknown'))unknowns.push('存在时间/暴露不完整或旧版本记录，不能补成独立迁移');
  if(facts.some(f=>!f.grade||f.grade.verdict==='needs_review'))unknowns.push('存在未评分或待核查尝试；未据此判断能力弱');
  if(!stable)unknowns.push(`跨次产品规则尚未满足：${policy.minimumTasks}道未见题、${policy.minimumDates}个可信日期、${policy.minimumSessions}个场次`);
  if(recentDifficulty)unknowns.push('最近一次有效评分仍有困难，需要再观察；此前成功仍保留');
  return{schemaVersion:'1.0.0',id:ids.skill(),evidenceRevision:revision,knowledgePointId:skill.id,dimension:skill.dimension,status,evidenceIds,attemptIds:basis.map(a=>a.id),observedTaskIds:unique(basis.map(a=>a.taskId)),trustedLearningDates:dates.sort(),recentDifficulty:!!recentDifficulty,coverage:`${skill.label}：${basis.length}次有效尝试，${independent.length}道未见题独立完成，${helped.length}次提示后完成，${facts.filter(f=>f.classification.kind==='original_redo').length}次原题重做；同题族简单换数覆盖有限`,unknowns,computedAt:ctx.clock.now()};
 });
 const dimensions=['理解','逻辑','计算','建模','空间想象'] as const;
 return{schemaVersion:'1.0.0',id:ids.snapshot,evidenceRevision:revision,createdAt:ctx.clock.now(),skills,coverage:dimensions.map(d=>{
  const observed=skills.filter(s=>s.dimension===d&&s.attemptIds.length);
  const evidenceIds=new Set(observed.flatMap(s=>s.evidenceIds));
  const relevant=attempts.filter(a=>observed.some(s=>s.attemptIds.includes(a.id))&&trustedDate(a,ctx));
  return{dimension:d,knowledgePointIds:observed.map(s=>s.knowledgePointId),evidenceCount:allEvidence.filter(e=>evidenceIds.has(e.id)&&e.status!=='uncertain'&&e.quote.trim()&&attempts.find(a=>a.id===e.attemptId)?.value.slice(e.location.start,e.location.end)===e.quote).length,lastObservedAt:relevant.map(a=>a.sourceTime.occurredAt!).sort().at(-1)??null,unknowns:[...skillDefinitions.filter(s=>s.dimension===d&&!observed.some(o=>o.knowledgePointId===s.id)).map(s=>'尚未观察：'+s.label),'覆盖仅限列出的子技能，不能解释为完整五维测量']};
 }),evidenceIds:unique(skills.flatMap(s=>s.evidenceIds)),limitations:['状态是可配置产品规则，不是标准化测评；不计算五维平均分、不推断智力/人格','同题族简单换数不证明广泛迁移；原题延迟保持不等于新题独立完成','模型仅提供带原文定位的评分点分析；真实模型与长期教学效果仍需另行验证']};
}
