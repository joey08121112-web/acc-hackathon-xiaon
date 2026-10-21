/** SYNTHETIC ONLY: predetermined assessment/grades test C rules, not B scoring or real learners. */
import { randomUUID } from 'node:crypto';
import { schemas, SCHEMA_VERSION as V, type TaskDefinition, type TaskCatalog, type EngineContext, type SkillState, type AssessmentSnapshot } from '../../shared/learning-contracts';
import { temporaryRepository, TestClock } from '../../server/storage/testing';
import { StudentEvents } from '../../server/core/events';
import { publicView } from '../../server/tools/legacy';

export function fixture() {
 const clock = new TestClock('2026-10-20T04:00:00.000Z');
 const db = temporaryRepository(clock);
 const tasks: TaskDefinition[] = ['brackets','relations','meaning','logic'].flatMap((kp) => Array.from({length:16},(_,i)=>schemas.TaskDefinition.parse({
  schemaVersion:V,id:`synthetic-${kp}-${i}`,version:1,title:`合成 ${kp} ${i}`,question:`合成题干 ${kp} ${i}`,choices:[],knowledgePoints:[kp],primaryDimension:kp==='brackets'?'计算':kp==='relations'?'建模':kp==='meaning'?'理解':'逻辑',auxiliaryDimensions:[],familyId:`synthetic-${kp}`,variantKind:i===0?'observation':'delayed',difficulty:'standard',prerequisites:[],estimatedMinutes:3,visual:null,answer:['synthetic-result'],rubric:[{id:'point',description:'合成评分点',expected:'synthetic-result',weight:1,requiresExplanation:false}],hints:[{id:'hint',text:'合成提示',level:1}],commonErrors:[],
 })));
 const catalog: TaskCatalog = {definition:(id,v)=>tasks.find(t=>t.id===id&&t.version===v),publicTask:(id,v)=>{const t=tasks.find(t=>t.id===id&&t.version===v);return t?publicView(t):undefined;},candidates:s=>tasks.filter(t=>(!s.dimension||t.primaryDimension===s.dimension)&&(!s.knowledgePointId||t.knowledgePoints.includes(s.knowledgePointId))&&!s.excludeTaskIds.includes(t.id)).slice(0,s.limit).map(publicView)};
 const ctx: EngineContext = {repository:db.repository,clock,catalog};
 const events = new StudentEvents(()=>ctx);
 let session=events.startSession({operationId:randomUUID(),mode:'review'});
 function nextSession() {events.sessionState({operationId:randomUUID(),sessionId:session.id,status:'closed'});session=events.startSession({operationId:randomUUID(),mode:'review'});return session;}
 function attempt(kp='brackets',i=0,verdict:'correct'|'incorrect'|'needs_review'='correct',help=false) {
  const taskId=`synthetic-${kp}-${i}`;
  events.expose({operationId:randomUUID(),sessionId:session.id,taskId,taskVersion:1,kind:'task',hintId:null});
  if(help)events.expose({operationId:randomUUID(),sessionId:session.id,taskId,taskVersion:1,kind:'hint',hintId:'hint'});
  const a=events.submit({operationId:randomUUID(),sessionId:session.id,taskId,taskVersion:1,value:'合成作答'});
  grade(a.id,kp,verdict);
  return a;
 }
 function grade(attemptId:string,kp:string,verdict:'correct'|'incorrect'|'needs_review') {
  const a=ctx.repository.get('attempts',attemptId)!;
  const prev=ctx.repository.list('gradings').filter(g=>g.attemptId===attemptId).at(-1);
  const eid=randomUUID();const revision=ctx.repository.evidenceRevision()+2;
  ctx.repository.append('evidence',schemas.Evidence.parse({schemaVersion:V,id:eid,evidenceRevision:revision,attemptId,taskId:a.taskId,taskVersion:1,knowledgePointId:kp,pointId:'point',status:verdict==='correct'?'supported':verdict==='incorrect'?'unsupported':'uncertain',quote:'合成作答',location:{start:0,end:4},explanation:'预设合成证据，不运行 B 判题',errorClues:verdict==='incorrect'?['合成关系线索']:[],uncertainties:verdict==='needs_review'?['需要人工核对']:[],source:'program',createdAt:clock.now(),supersedesEvidenceId:prev?.evidenceIds[0]??null}));
  const g=schemas.GradingResult.parse({schemaVersion:V,id:randomUUID(),operationId:randomUUID(),evidenceRevision:revision,attemptId,verdict,points:[{pointId:'point',status:verdict==='correct'?'supported':verdict==='incorrect'?'unsupported':'uncertain',evidenceIds:[eid]}],evidenceIds:[eid],errorClues:[],uncertainties:[],method:'rubric_program',createdAt:clock.now(),supersedesGradingId:prev?.id??null});ctx.repository.append('gradings',g);return g;
 }
 function snapshot(profile:Partial<Record<string,SkillState['status']>>={brackets:'completed_with_help'}):AssessmentSnapshot {
  const revision=ctx.repository.evidenceRevision();
  const skills=Object.entries(profile).map(([kp,status])=>{
   const ats=ctx.repository.list('attempts').filter(a=>a.taskId.includes(`-${kp}-`));
   const evidence=ctx.repository.list('evidence').filter(e=>e.knowledgePointId===kp&&!ctx.repository.list('evidence').some(n=>n.supersedesEvidenceId===e.id));
   return schemas.SkillState.parse({schemaVersion:V,id:randomUUID(),evidenceRevision:revision,knowledgePointId:kp,dimension:kp==='brackets'?'计算':kp==='relations'?'建模':kp==='meaning'?'理解':'逻辑',status,evidenceIds:evidence.map(e=>e.id),attemptIds:ats.map(a=>a.id),observedTaskIds:[...new Set(ats.map(a=>a.taskId))],trustedLearningDates:[],recentDifficulty:status==='needs_support',coverage:'合成覆盖',unknowns:[],computedAt:clock.now()});
  });
  const s=schemas.AssessmentSnapshot.parse({schemaVersion:V,id:randomUUID(),evidenceRevision:revision,createdAt:clock.now(),skills,coverage:skills.map(s=>({dimension:s.dimension,knowledgePointIds:[s.knowledgePointId],evidenceCount:s.evidenceIds.length,lastObservedAt:clock.now(),unknowns:[]})),evidenceIds:skills.flatMap(s=>s.evidenceIds),limitations:['合成画像，非 B 实现输出']});ctx.repository.append('assessments',s);return s;
 }
 return {...db,clock,ctx,events,tasks,catalog,nextSession,attempt,grade,snapshot};
}
