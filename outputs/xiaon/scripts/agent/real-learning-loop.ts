/** Synthetic student inputs; local server config is loaded by Node, never copied or printed. */
import assert from 'node:assert/strict';
import { writeFileSync,mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { readGlmConfig } from '../../server/providers/config';
import { GlmProvider } from '../../server/providers/glm';
const out=process.env.XIAON_LOOP_REAL_OUT;if(!out)throw Error('Set XIAON_LOOP_REAL_OUT');mkdirSync(out,{recursive:true});
const cfg=readGlmConfig();const result:{status:string;checks:Record<string,unknown>;error?:string}={status:'NOT_RUN',checks:{}};
if(!cfg.apiKey){result.error='No server model key configured';writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));process.exit(0);}
const id=()=>crypto.randomUUID(),f=temporaryRepository(new TestClock('2026-10-22T01:00:00.000Z'));
const r=createRuntime({...f,provider:new GlmProvider(cfg.apiKey,cfg.model,fetch,cfg)}),d=installLearning(r,{timeoutMs:30000});
try{
 const s=await d.start({operationId:id(),mode:'support'});await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});
 let v=await d.loopEvent({operationId:id(),action:'start',quote:'知道规则，但第二项常常漏掉负号'});
 result.checks.hypothesisSource=v.episode.loop!.hypotheses[0].source;
 const act=async(action:string,extra:Record<string,unknown>={})=>{v=await d.loopEvent({operationId:id(),action,episodeId:v.episode.id,expectedRevision:v.episode.revision,...extra} as never);return v;};
 await act('confirm');
 const reply=await d.chat({operationId:id(),flow:'home',history:[{role:'user',content:'公式我明白了，但这道题还是不会做'}]});assert.equal(reply.stage,'think');result.checks.partialUnderstanding={stage:reply.stage,modelRun:reply.run?.status??null};v=(await d.view()).learningLoops.at(-1)!;
 await act('submit',{value:'x-5'});await act('help');await act('submit',{value:'x+5'});assert.match(v.summary,/提示后/);result.checks.helped=v.summary;
 await act('verify');const answer=r.catalog.definition(v.task!.id,v.task!.version)!.answer[0];await act('submit',{value:answer});assert.equal(v.independent,true);result.checks.unseen=v.summary;
 await act('end');
 let step=await d.interviewStart({operationId:id()});
 for(let index=0;index<3;index++){
  const answer=r.catalog.definition(step.task!.id,step.task!.version)!.answer[0];
  step=await d.interviewAnswer({operationId:id(),interviewId:step.interview!.id,expectedRevision:step.interview!.revision,text:answer});
  step=await d.interviewAnswer({operationId:id(),interviewId:step.interview!.id,expectedRevision:step.interview!.revision,text:'今天阳光真好'});
 }
 const report=await d.interviewReport({operationId:id(),interviewId:step.interview!.id});const calculation=report.modules.find(m=>m.module==='计算')!;
 assert.equal(calculation.basis,'correct_reason_incomplete');result.checks.unrelatedReason={basis:calculation.basis,level:calculation.level,wording:calculation.wording};
 result.checks.runs=r.repository.list('runs').map(x=>({role:x.role,status:x.status,error:x.error?.code??null}));
 result.status=r.repository.list('runs').some(x=>x.status!=='completed')?'PASS_WITH_MODEL_FAILURES':'PASS';
}catch(e){result.status='FAIL';result.error=e instanceof Error?e.message.slice(0,300):'unknown';process.exitCode=1;}
finally{writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));f.dispose();}
