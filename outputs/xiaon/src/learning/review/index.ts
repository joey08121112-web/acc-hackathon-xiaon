/** Browser-safe projections. The server owns mutations and trusted evidence validation. */
import type { AssessmentSnapshot, EngineContext, ReviewItem, TaskPublicView } from '../../../shared/learning-contracts';

export const DAY_MS = 86_400_000;
export function shanghaiDate(instant: string): string {
 const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
 const part=(kind:string)=>parts.find(p=>p.type===kind)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function dateStart(date: string): string {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('日期格式无效');
 const iso=new Date(`${date}T00:00:00+08:00`).toISOString();
 if(shanghaiDate(iso)!==date)throw new RangeError('日期不存在');
 return iso;
}
export function currentReviewItems(context: Pick<EngineContext,'repository'>): ReviewItem[] {
 const latest=new Map<string,ReviewItem>();
 for(const item of context.repository.list('reviewItems')){
  if(!latest.has(item.id)||latest.get(item.id)!.revision<item.revision)latest.set(item.id,item);
 }
 return [...latest.values()];
}
export function revisedEvidenceIds(context:Pick<EngineContext,'repository'>) {
 const evidence=context.repository.list('evidence'),grades=context.repository.list('gradings');
 const revised=new Set(evidence.flatMap(e=>e.supersedesEvidenceId?[e.supersedesEvidenceId]:[]));
 for(const g of grades)if(g.supersedesGradingId){const old=grades.find(o=>o.id===g.supersedesGradingId);old?.evidenceIds.forEach(id=>revised.add(id));}
 return revised;
}
export function reportHistory(context: Pick<EngineContext,'repository'>) {
 const reports=context.repository.list('reports'),revised=revisedEvidenceIds(context);
 return reports.map(snapshot=>({snapshot,basisRevised:snapshot.statements.some(s=>s.evidenceIds.some(id=>revised.has(id))),replacementId:reports.find(r=>r.supersedesReportId===snapshot.id)?.id??null}));
}
export function planHistory(context:Pick<EngineContext,'repository'>) {
 const plans=context.repository.list('plans'),revised=revisedEvidenceIds(context);
 return plans.map(snapshot=>({snapshot,basisRevised:snapshot.items.some(i=>i.evidenceIds.some(id=>revised.has(id))),replacementId:plans.find(p=>p.previousVersionId===snapshot.id)?.id??null}));
}

export function selectReviewTarget(assessment:AssessmentSnapshot, budget:number, context:EngineContext, studentKnowledgePointId?:string) {
 const {repository:r,catalog,clock}=context;
 const sessions=r.list('sessions').map(s=>({...s,status:r.list('sessionEvents').filter(e=>e.sessionId===s.id).at(-1)?.status??s.status}));
 const session=sessions.find(s=>s.status!=='closed');
 const exposures=r.list('exposures'),attempts=r.list('attempts');
 const due=currentReviewItems(context).filter(i=>i.status==='active'&&Date.parse(i.dueAt)<=Date.parse(clock.now()));
 const ordered=[...assessment.skills].sort((a,b)=>{
  const rank=(s:typeof a)=>due.some(i=>i.knowledgePointId===s.knowledgePointId)&&['needs_support','completed_with_help'].includes(s.status)?0:s.recentDifficulty||['needs_support','completed_with_help'].includes(s.status)?1:s.status==='unobserved'?2:3;
  return rank(a)-rank(b)||a.knowledgePointId.localeCompare(b.knowledgePointId);
 });
 const skill=studentKnowledgePointId?ordered.find(s=>s.knowledgePointId===studentKnowledgePointId):ordered[0];
 const kp=skill?.knowledgePointId??'optional-exploration';
 const dimension=skill?.dimension??'理解';
 const calcSeen=new Set(exposures.filter(e=>e.sessionId===session?.id&&e.kind==='task'&&catalog.definition(e.taskId,e.taskVersion)?.primaryDimension==='计算').map(e=>e.taskId));
 const constraints={calculationLimit:10 as const,requireUnderstandLogicFirst:true,timeBudgetMinutes:budget};
 const candidates=session?catalog.candidates({sessionId:session.id,dimension,knowledgePointId:skill?.knowledgePointId,excludeTaskIds:[],limit:100}):[];
 const seen=(t:TaskPublicView)=>attempts.some(a=>a.taskId===t.id)||exposures.some(e=>e.taskId===t.id);
 const attemptedPoints=new Set(attempts.flatMap(a=>catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));
 const eligible=candidates.filter(t=>!seen(t)&&t.estimatedMinutes<=budget&&t.prerequisites.every(k=>attemptedPoints.has(k))&&(t.primaryDimension!=='计算'||calcSeen.size<10));
 const options=candidates.filter(seen);
 const available=session?.status==='active'&&eligible.length>0;
 const reason=!session?'需由学生开始真实场次后选择题目':session.status==='paused'?'当前场次暂停；可查看队列，等待学生主动恢复':dimension==='计算'&&calcSeen.size>=10?'本场次已达 10 道计算题；刷新不重置':!eligible.length?'未见题库已耗尽，或先修/时间预算不满足；可标注为原题回顾':!skill||skill.status==='unobserved'?'证据不足，仅提供可选探索':due.some(i=>i.knowledgePointId===kp)?'到期知识点优先；依据具体困难安排复查':skill.status==='completed_with_help'?'提示依赖：先支持，再用未见同类题检查':skill.recentDifficulty||skill.status==='needs_support'?'近期困难：针对当前知识点提供支持':'已有独立记录，适合延迟新题检查';
 return {status:available?'available' as const:'exhausted' as const,knowledgePointId:kp,skill,candidates:available?eligible:[],originalReviewOptions:options,reason,evidenceIds:skill?.evidenceIds??[],alternatives:ordered.filter(s=>s!==skill).map(s=>({knowledgePointId:s.knowledgePointId,evidenceIds:s.evidenceIds,reason:'学生可改选另一知识点'})),constraints};
}
