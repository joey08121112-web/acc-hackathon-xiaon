import type { AssessmentSnapshot, EngineContext } from '../../../shared/learning-contracts';
import { RuntimeError } from '../../core/errors';
import { revisedEvidenceIds,shanghaiDate } from '../../../src/learning/review';

export function assertAssessment(snapshot:AssessmentSnapshot,context:EngineContext) {
 const {repository:r}=context;
 const saved=r.get('assessments',snapshot.id);
 if(!saved||JSON.stringify(saved)!==JSON.stringify(snapshot)){
  // SQLite canonicalizes object key order; compare normalized field values below.
  const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  if(!saved||canonical(saved)!==canonical(snapshot))throw new RuntimeError('invalid_params','需要已保存的可信 AssessmentSnapshot');
 }
 if(snapshot.evidenceRevision!==r.evidenceRevision())throw new RuntimeError('conflict','依据已更新，请重新核对');
 const ids=new Set(r.list('evidence').map(e=>e.id));
 const references=[...snapshot.evidenceIds,...snapshot.skills.flatMap(s=>s.evidenceIds)];
 if(references.some(id=>!ids.has(id)))throw new RuntimeError('invalid_params','快照依据不存在');
 const revised=revisedEvidenceIds(context);
 if(references.some(id=>revised.has(id)))throw new RuntimeError('conflict','快照仍引用已修订依据，请重新计算');
}

/** Consume B's saved verdict; C checks provenance/independence only, never re-grades an answer. */
export function attemptFacts(attemptId:string,knowledgePointId:string,context:EngineContext) {
 const {repository:r,catalog}=context;
 const attempt=r.get('attempts',attemptId);
 if(!attempt)throw new RuntimeError('not_found','真实尝试不存在');
 const definition=catalog.definition(attempt.taskId,attempt.taskVersion);
 if(!definition?.knowledgePoints.includes(knowledgePointId))throw new RuntimeError('invalid_params','题目不属于目标知识点');
 const grades=r.list('gradings').filter(g=>g.attemptId===attempt.id);
 const grade=grades.filter(g=>!grades.some(n=>n.supersedesGradingId===g.id)).at(-1);
 if(!grade)throw new RuntimeError('invalid_state','需要已保存的评分结果');
 const session=attempt.sessionId?r.get('sessions',attempt.sessionId):undefined;
 const time=attempt.sourceTime.occurredAt;
 const trusted=!!session&&attempt.origin==='student_api'&&attempt.exposureHistory==='complete'&&attempt.sourceTime.trust==='server'&&!!time&&Date.parse(time)>=Date.parse(session.startedAt)&&Date.parse(time)<=Date.parse(context.clock.now());
 const events=r.list('exposures').filter(e=>e.taskId===attempt.taskId&&attempt.exposureIds.includes(e.id));
 const earlierAttempts=r.list('attempts').slice(0,r.list('attempts').findIndex(a=>a.id===attempt.id)).filter(a=>a.taskId===attempt.taskId);
 const help=attempt.hintSnapshot.length>0||attempt.answerExposed||events.some(e=>['hint','answer','chat_help'].includes(e.kind));
 const otherVersionSeen=r.list('exposures').some(e=>e.taskId===attempt.taskId&&e.taskVersion!==attempt.taskVersion&&e.sourceTime.occurredAt&&time&&Date.parse(e.sourceTime.occurredAt)<=Date.parse(time));
 const opens=events.filter(e=>e.kind==='task');
 const openedOnEarlierDate=!!time&&opens.some(e=>e.sourceTime.occurredAt&&shanghaiDate(e.sourceTime.occurredAt)<shanghaiDate(time));
 const complete=!openedOnEarlierDate&&trusted&&opens.length===1&&opens[0].sessionId===attempt.sessionId&&opens.every(e=>e.sourceTime.trust==='server');
 const novelty=!trusted?'unknown' as const:earlierAttempts.length||opens.length>1||openedOnEarlierDate||help||otherVersionSeen?'seen' as const:complete?'unseen' as const:'unknown' as const;
 const independent=grade.verdict==='correct'&&trusted&&complete&&!help&&!earlierAttempts.length&&!otherVersionSeen;
 return {attempt,grade,definition,trusted,novelty,independent,help,time};
}
