import { tasks,correct } from '../../src/data';
import { SCHEMA_VERSION,schemas,type TaskDefinition,type TaskPublicView,type TaskSelection,type TaskCatalog,type AssessmentEnginePort,type EngineContext,type SkillState,type GradingResult } from '../../shared/learning-contracts';
import { RuntimeError } from '../core/errors';
import { randomUUID } from 'node:crypto';
export function publicView(task:TaskDefinition):TaskPublicView {
 const {answer:_answer,rubric:_rubric,hints,commonErrors:_errors,...visible}=task;
 return schemas.TaskPublicView.parse({...visible,hintAvailable:hints.length>0});
}
const dimensionKey:Record<string,string>={'理解':'understand','逻辑':'logic','计算':'calculation','建模':'modeling','空间想象':'spatial'};
export const legacyTasks:TaskDefinition[]=tasks.map(t=>({schemaVersion:SCHEMA_VERSION,id:t.id,version:1,title:t.title,question:t.question,choices:t.choices??[],knowledgePoints:['legacy-'+dimensionKey[t.dim]],primaryDimension:t.dim,auxiliaryDimensions:[],familyId:t.dim==='计算'?'legacy-brackets':'legacy-'+t.id,variantKind:'legacy',difficulty:'introductory',prerequisites:[],estimatedMinutes:3,visual:null,answer:t.answer,rubric:[{id:'legacy-result',description:'仅核对既有题库支持范围内的结果',expected:t.answer[0],weight:1,requiresExplanation:false}],hints:[{id:'legacy-hint',text:t.hint,level:1}],commonErrors:[]}));
export class LegacyCatalog implements TaskCatalog {
 definition(taskId:string,taskVersion:number){return legacyTasks.find(t=>t.id===taskId&&t.version===taskVersion);}
 publicTask(taskId:string,taskVersion:number){const t=this.definition(taskId,taskVersion);return t?publicView(t):undefined;}
 candidates(s:TaskSelection){return legacyTasks.filter(t=>(!s.dimension||t.primaryDimension===s.dimension)&&(!s.knowledgePointId||t.knowledgePoints.includes(s.knowledgePointId))&&!s.excludeTaskIds.includes(t.id)).slice(0,s.limit).map(publicView);}
}
export function legacySkills(context:EngineContext):SkillState[]{
 const attempts=context.repository.list('attempts');
 return [...new Set(legacyTasks.flatMap(t=>t.knowledgePoints))].map(k=>{
  const ts=legacyTasks.filter(t=>t.knowledgePoints.includes(k));const basis=attempts.filter(a=>ts.some(t=>t.id===a.taskId));
  return{schemaVersion:SCHEMA_VERSION,id:'legacy-state-'+k+'-'+context.repository.revision(),evidenceRevision:context.repository.evidenceRevision(),knowledgePointId:k,dimension:ts[0].primaryDimension,status:'unobserved',evidenceIds:[],attemptIds:basis.map(a=>a.id),observedTaskIds:[...new Set(basis.map(a=>a.taskId))],trustedLearningDates:[],recentDifficulty:false,coverage:basis.length?'已有尝试；legacy 不作跨次能力判断':'尚未观察',unknowns:['尚未注册 B 知识点证据引擎；此状态不代表能力弱'],computedAt:context.clock.now()};
 });
}
export class LegacyAssessment implements AssessmentEnginePort {
 readonly id='legacy-v1';readonly catalog=new LegacyCatalog();
 async grade(input:{attemptId:string;operationId:string},context:EngineContext):Promise<GradingResult>{
  return context.repository.once(input.operationId,{kind:'grade',...input},()=>{
   const a=context.repository.get('attempts',input.attemptId);if(!a)throw new RuntimeError('not_found','没有已保存学生作答');
   const t=tasks.find(t=>t.id===a.taskId);if(!t||a.taskVersion!==1)throw new RuntimeError('not_found','题目版本不存在');
   const previous=context.repository.list('gradings').find(g=>g.attemptId===a.id&&g.method==='legacy_program');if(previous)return previous;
   const ok=correct(t,a.value);const eid=randomUUID();const rev=context.repository.evidenceRevision()+2;
   const evidence=schemas.Evidence.parse({schemaVersion:SCHEMA_VERSION,id:eid,evidenceRevision:rev,attemptId:a.id,taskId:a.taskId,taskVersion:a.taskVersion,knowledgePointId:'legacy-'+dimensionKey[t.dim],pointId:'legacy-result',status:ok?'supported':'unsupported',quote:a.value,location:{start:0,end:a.value.length},explanation:'既有 correct() 在有限题库内核对结果；不解释心理过程或长期掌握',errorClues:[],uncertainties:['仅结果核对，不代表理解了理由'],source:'program',createdAt:context.clock.now(),supersedesEvidenceId:null});
   context.repository.append('evidence',evidence);
   const result=schemas.GradingResult.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,evidenceRevision:rev,verdict:ok?'correct':'incorrect',points:[{pointId:'legacy-result',status:evidence.status,evidenceIds:[eid]}],evidenceIds:[eid],errorClues:[],uncertainties:evidence.uncertainties,method:'legacy_program',createdAt:context.clock.now(),supersedesGradingId:null});context.repository.append('gradings',result);return result;
  });
 }
 async snapshot(_input:{operationId:string},_context:EngineContext):Promise<never>{throw new RuntimeError('not_implemented','B assessment snapshot 尚未注册');}
}
