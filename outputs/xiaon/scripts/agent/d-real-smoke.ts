/** Uses only synthetic lessons in a private temporary SQLite database. Never prints credentials. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { readGlmConfig } from '../../server/providers/config';
import { GlmProvider } from '../../server/providers/glm';
import { temporaryRepository } from '../../server/storage/testing';
const out=resolve('../../任务书/2026-10-21-Agent升级/交付/D/evidence/real-model.json');
const config=readGlmConfig(),id=()=>crypto.randomUUID();
if(!config.apiKey){writeFileSync(out,JSON.stringify({status:'NOT_RUN',reason:'No server key configured',model:config.model},null,2));console.log('REAL_MODEL_NOT_RUN');process.exit(2);}
const f=temporaryRepository(),r=createRuntime({...f,provider:new GlmProvider(config.apiKey,config.model,fetch,config),modelTimeoutMs:config.timeoutMs}),d=installLearning(r,{timeoutMs:config.timeoutMs});
const stages:Record<string,unknown>={model:config.model,baseUrl:config.baseUrl,material:'synthetic only',startedAt:new Date().toISOString()};
try{
 const basic=await r.provider.complete({messages:[{role:'user',content:'这是软件集成验收，只需回复JSON：{"ok":true}'}],tools:[],signal:AbortSignal.timeout(config.timeoutMs)});stages.basic={completed:!!basic.content,toolCalls:basic.toolCalls.length};console.log('basic response received');
 const session=await d.start({operationId:id(),mode:'support'});await d.open({operationId:id(),sessionId:session.id,taskId:'model',taskVersion:2});
 const result=await d.submit({operationId:id(),sessionId:session.id,taskId:'model',taskVersion:2,value:'3x+2\n3x是x本练习本的总价；2是只收一次的纸袋费，不随本数增加。',reviewItemId:null,reviewRevision:null});stages.assessor={verdict:result.grading.verdict,method:result.grading.method,evidenceIds:result.grading.evidenceIds};console.log('assessor finished: '+result.grading.verdict);
 const tutor=await d.chat({operationId:id(),history:[{role:'user',content:'这是合成验收。请调用query_learning_evidence读取我刚保存的作答证据，不要依据猜测。然后严格用你指定的JSON结构简短回应，taskIds留空。'}]});stages.tutor={status:tutor.run?.status,tools:tutor.run?.toolExecutions,error:tutor.run?.error};console.log('tutor finished: '+tutor.run?.status);
 const plan=await d.generate({operationId:id(),timeBudgetMinutes:6});stages.plannerReporter={status:plan.organization.status,error:plan.organization.error,reportId:plan.report.id,proposalId:plan.proposal.id,automaticallyAccepted:r.repository.list('plans').length};console.log('planner finished: '+plan.organization.status);
 const runs=r.repository.list('runs'),tools=r.repository.list('toolCalls');const verified=stages.basic&&result.grading.method==='model_assisted'&&result.grading.verdict==='correct'&&tutor.run?.status==='completed'&&tools.some(t=>t.name==='query_learning_evidence'&&t.status==='succeeded')&&plan.organization.status==='completed';
 writeFileSync(out,JSON.stringify({...stages,status:verified?'VERIFIED':'FAILED',runs,tools,finishedAt:new Date().toISOString()},null,2));process.exitCode=verified?0:1;
}catch(e){writeFileSync(out,JSON.stringify({...stages,status:'FAILED',error:{name:(e as Error).name,message:(e as Error).message},runs:r.repository.list('runs'),tools:r.repository.list('toolCalls')},null,2));console.log('real model verification failed; sanitized evidence saved');process.exitCode=1;}finally{f.dispose();}
