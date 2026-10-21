import { randomUUID } from 'node:crypto';
import { schemas,SCHEMA_VERSION,type AssessmentEnginePort,type EngineContext,type GradingResult,type Attempt,type TaskDefinition } from '../../../shared/learning-contracts';
import { RuntimeError } from '../../core/errors';
import { AssessmentCatalog,skillIdsForTask } from './catalog';
import { evaluateRubric } from './grading';
import type { AnswerAnalyzer,AnswerAnalysis } from './model-analysis';
import { computeAssessment,DEFAULT_INDEPENDENCE_POLICY,type IndependencePolicy } from './state';
export { AssessmentCatalog,assessmentTasks,skillDefinitions,legacyIdMapping } from './catalog';
export { createModelAnalyzer,ASSESSOR_PROMPT } from './model-analysis';
export { classifyAttempt,DEFAULT_INDEPENDENCE_POLICY } from './state';
export type AssessmentOptions={analyzer?:AnswerAnalyzer;policy?:Partial<IndependencePolicy>};
export class RubricAssessment implements AssessmentEnginePort {
 readonly id='assessment-rubric-v1';readonly catalog=new AssessmentCatalog();
 private readonly policy:IndependencePolicy;
 constructor(private readonly options:AssessmentOptions={}){
  this.policy={...DEFAULT_INDEPENDENCE_POLICY,...options.policy};
  if(Object.values(this.policy).some(n=>!Number.isInteger(n)||n<2||n>30))throw new RuntimeError('invalid_params','跨次规则各阈值需为2–30的整数');
 }
 async grade(input:{attemptId:string;operationId:string},ctx:EngineContext):Promise<GradingResult>{return this.runGrade(input,ctx);}
 /** Trusted D/Assessor program entry. Reanalyzes the saved attempt; caller supplies neither answer nor verdict. */
 async regrade(input:{attemptId:string;operationId:string;expectedGradingId:string},ctx:EngineContext):Promise<GradingResult>{return this.runGrade(input,ctx,input.expectedGradingId);}
 private async runGrade(input:{attemptId:string;operationId:string},ctx:EngineContext,expectedGradingId?:string):Promise<GradingResult>{
  schemas.ToolArguments.grade_attempt.parse({attemptId:input.attemptId});
  schemas.StartSession.shape.operationId.parse(input.operationId);
  const repository=ctx.repository;const request={kind:'b-rubric-grade',...input,expectedGradingId:expectedGradingId??null};
  const cached=repository.list('gradings').find(g=>g.operationId===input.operationId);
  if(cached)return repository.once(input.operationId,request,()=>cached);
  const attempt=repository.get('attempts',input.attemptId);if(!attempt)throw new RuntimeError('not_found','没有已保存学生作答');
  const task=this.catalog.definition(attempt.taskId,attempt.taskVersion);if(!task)throw new RuntimeError('not_found','可信题目版本不存在');
  const previous=repository.list('gradings').filter(g=>g.attemptId===attempt.id).at(-1);
  // Legacy results lack the B rubric and are upgraded by a new immutable grading, never overwritten.
  if(previous&&previous.method!=='legacy_program'&&!expectedGradingId)return repository.once(input.operationId,request,()=>previous);
  if(expectedGradingId&&previous?.id!==expectedGradingId)throw new RuntimeError('conflict','评分revision已变化，请先读取最新版本');
  let analysis:AnswerAnalysis|undefined;
  if(this.options.analyzer&&task.rubric.some(r=>r.requiresExplanation)){
   try{analysis=await this.options.analyzer(structuredClone(task),structuredClone(attempt));}
   catch{analysis={points:[],issues:['模型分析未完成，需核查']};}
  }
  return repository.once(input.operationId,request,()=>{
   const latest=repository.list('gradings').filter(g=>g.attemptId===attempt.id).at(-1);
   if(latest?.id!==previous?.id){if(!expectedGradingId&&latest)return latest;throw new RuntimeError('conflict','分析期间评分revision已变化');}
   return this.persist(task,attempt,input.operationId,ctx,analysis,previous);
  });
 }
 private persist(task:TaskDefinition,attempt:Attempt,operationId:string,ctx:EngineContext,analysis?:AnswerAnalysis,previous?:GradingResult):GradingResult{
  const evaluation=evaluateRubric(task,attempt,analysis);const knowledgePoints=skillIdsForTask(task);
  if(!knowledgePoints.length)throw new RuntimeError('invalid_state','题目缺知识点映射');
  const revision=ctx.repository.evidenceRevision()+evaluation.findings.length*knowledgePoints.length+1;
  const oldEvidence=(previous?.evidenceIds??[]).map(id=>ctx.repository.get('evidence',id));
  const evidence=evaluation.findings.flatMap(point=>knowledgePoints.map(knowledgePointId=>schemas.Evidence.parse({
   schemaVersion:SCHEMA_VERSION,id:randomUUID(),evidenceRevision:revision,attemptId:attempt.id,taskId:task.id,taskVersion:task.version,knowledgePointId,pointId:point.pointId,status:point.status,quote:point.quote,location:point.location,explanation:point.explanation,errorClues:evaluation.errorClues,uncertainties:evaluation.uncertainties,source:point.source,createdAt:ctx.clock.now(),supersedesEvidenceId:oldEvidence.find(e=>e?.pointId===point.pointId&&e.knowledgePointId===knowledgePointId)?.id??null,
  })));
  const result=schemas.GradingResult.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),operationId,evidenceRevision:revision,attemptId:attempt.id,verdict:evaluation.verdict,points:evaluation.findings.map(p=>({pointId:p.pointId,status:p.status,evidenceIds:evidence.filter(e=>e.pointId===p.pointId).map(e=>e.id)})),evidenceIds:evidence.map(e=>e.id),errorClues:evaluation.errorClues,uncertainties:evaluation.uncertainties,method:evaluation.method,createdAt:ctx.clock.now(),supersedesGradingId:previous?.id??null});
  for(const e of evidence)ctx.repository.append('evidence',e);
  ctx.repository.append('gradings',result);return result;
 }
 async snapshot(input:{operationId:string},ctx:EngineContext){
  schemas.StartSession.shape.operationId.parse(input.operationId);
  return ctx.repository.once(input.operationId,{kind:'b-assessment-snapshot',...input,policy:this.policy},()=>{
   const snapshot=schemas.AssessmentSnapshot.parse(computeAssessment(ctx,this.policy,{snapshot:randomUUID(),skill:randomUUID}));
   for(const state of snapshot.skills)ctx.repository.append('skills',schemas.SkillState.parse(state));
   ctx.repository.append('assessments',snapshot);return snapshot;
  });
 }
}
