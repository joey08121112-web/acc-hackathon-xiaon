/**
 * E1 real-model evidence. Synthetic student material only, private temporary SQLite, TestClock for the
 * next-day review. Writes de-sensitized records (no key, headers, reasoning or raw model text).
 */
import { writeFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { readGlmConfig } from '../../server/providers/config';
import { GlmProvider } from '../../server/providers/glm';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
const out=resolve(process.env.XIAON_E_REAL_OUT??'../../文档/交接/2026-10-21/交付/E/evidence/real-generation.json');mkdirSync(dirname(out),{recursive:true});
const config=readGlmConfig(),id=()=>crypto.randomUUID();
if(!config.apiKey){writeFileSync(out,JSON.stringify({status:'NOT_RUN',reason:'No server key configured',model:config.model},null,2));console.log('REAL_GENERATION_NOT_RUN');process.exit(2);}
const clock=new TestClock(new Date().toISOString()),f=temporaryRepository(clock);
const r=createRuntime({...f,provider:new GlmProvider(config.apiKey,config.model,fetch,config),modelTimeoutMs:config.timeoutMs});
const d=installLearning(r,{timeoutMs:config.timeoutMs,modelId:config.model,generation:{timeoutMs:Math.min(config.timeoutMs,120000)}});
const stages:Record<string,unknown>={model:config.model,baseUrl:config.baseUrl,material:'synthetic only',startedAt:new Date().toISOString()};
const summary=(g:{status:string;candidates:unknown[];taskId:string|null;focus:string|null;basis:string;runId:string|null})=>({status:g.status,candidates:g.candidates,taskId:g.taskId,focus:g.focus,basis:g.basis,runId:g.runId});
try{
 const s=await d.start({operationId:id(),mode:'support'});
 for(const [task,value] of [['b-like-observation','5x-4'],['bracket','x-5']] as const){await d.open({operationId:id(),sessionId:s.id,taskId:task,taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:task,taskVersion:2,value,reviewItemId:null,reviewRevision:null});}
 await d.hint({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,level:1});
 await d.submit({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x+5',reviewItemId:null,reviewRevision:null});
 // Plan first, while the synthetic evidence is still "completed with help", so the review targets this point.
 const plan=await d.generate({operationId:id(),timeBudgetMinutes:6});
 await d.confirm({operationId:id(),proposalId:plan.proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生接受'});
 const practice=await d.generateTask({operationId:id(),knowledgePointId:'negative-brackets',purpose:'practice',reviewItemId:null,timeBudgetMinutes:6});
 stages.practice=summary(practice.generation);console.log('practice generation: '+practice.status);
 if(practice.status==='published'){
  const task=practice.task!,trusted=r.catalog.definition(task.id,task.version)!;
  await d.open({operationId:id(),sessionId:s.id,taskId:task.id,taskVersion:task.version});
  const done=await d.submit({operationId:id(),sessionId:s.id,taskId:task.id,taskVersion:task.version,value:trusted.answer[0],reviewItemId:null,reviewRevision:null});
  stages.practiceGrading={question:task.question,verdict:done.grading.verdict,method:done.grading.method,kind:done.classification.kind};
 }
 clock.advance(86400000+3600000);const next=await d.start({operationId:id(),mode:'review'});
 const item=(await d.view()).reviews.find(i=>i.status==='active'&&i.knowledgePointId==='negative-brackets');
 if(item){
  const review=await d.generateTask({operationId:id(),knowledgePointId:'negative-brackets',purpose:'review',reviewItemId:item.id,timeBudgetMinutes:6});
  stages.review=summary(review.generation);console.log('review generation: '+review.status);
  if(review.status==='published'){
   const task=review.task!,trusted=r.catalog.definition(task.id,task.version)!;
   await d.open({operationId:id(),sessionId:next.id,taskId:task.id,taskVersion:task.version});
   const done=await d.submit({operationId:id(),sessionId:next.id,taskId:task.id,taskVersion:task.version,value:trusted.answer[0],reviewItemId:item.id,reviewRevision:item.revision});
   const after=(await d.view()).reviews.find(i=>i.id===item.id)!;
   stages.reviewOutcome={question:task.question,verdict:done.grading.verdict,kind:done.classification.kind,stageBefore:item.stage,stageAfter:after.stage};
  }
 }else stages.review={status:'NO_DUE_ITEM'};
 const runs=r.repository.list('runs').filter(x=>x.role==='generator');
 const verified=practice.status==='published'&&(stages.practiceGrading as {verdict:string}|undefined)?.verdict==='correct'&&runs.every(x=>x.providerKind==='real_http')&&(stages.reviewOutcome as {stageAfter:number;stageBefore:number}|undefined)?.stageAfter===((stages.reviewOutcome as {stageBefore:number}|undefined)?.stageBefore??-2)+1;
 writeFileSync(out,JSON.stringify({...stages,status:verified?'VERIFIED':'FAILED',generatorRuns:runs,generations:r.repository.list('generations'),finishedAt:new Date().toISOString()},null,2));process.exitCode=verified?0:1;
}catch(e){writeFileSync(out,JSON.stringify({...stages,status:'FAILED',error:{name:(e as Error).name,message:(e as Error).message,code:(e as {code?:string}).code},generatorRuns:r.repository.list('runs').filter(x=>x.role==='generator'),generations:r.repository.list('generations')},null,2));console.log('real generation failed: '+(e as Error).message);process.exitCode=1;}
finally{f.dispose();}
