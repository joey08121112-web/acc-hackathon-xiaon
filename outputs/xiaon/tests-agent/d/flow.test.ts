import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
const id=()=>crypto.randomUUID();
test('real modules: saved attempts, report, confirmed plan and two later sessions update evidence and history',async()=>{
 const clock=new TestClock();const f=temporaryRepository(clock);try{const r=createRuntime(f),d=installLearning(r);const s=await d.start({operationId:id(),mode:'support'});
 await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});await d.open({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2});
 const wrong=await d.submit({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x-5',reviewItemId:null,reviewRevision:null});assert.equal(wrong.grading.verdict,'incorrect');
 await d.hint({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,level:1});
 const right=await d.submit({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x+5',reviewItemId:null,reviewRevision:null});assert.equal(right.classification.independent,false);
 const first=await d.generate({operationId:id(),timeBudgetMinutes:6});assert.match(first.proposal.goal,/negative-brackets/);
 await d.confirm({operationId:id(),proposalId:first.proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'学生接受'});
 for(const [days,task,value]of [[1,'transfer','4*a+2'],[3,'b-neg-delayed','12-3x']] as const){
 clock.advance(days*86400000);const next=await d.start({operationId:id(),mode:'review'});const item=(await d.view()).reviews.find(i=>i.knowledgePointId==='negative-brackets')!;
 await d.open({operationId:id(),sessionId:next.id,taskId:task,taskVersion:2});
 const result=await d.submit({operationId:id(),sessionId:next.id,taskId:task,taskVersion:2,value,reviewItemId:item.id,reviewRevision:item.revision});assert.equal(result.classification.independent,true);
 }
 const latest=await d.generate({operationId:id(),timeBudgetMinutes:6});const v=await d.view();assert.equal(v.assessment.skills.find(s=>s.knowledgePointId==='negative-brackets')?.status,'cross_session_independent');assert.equal(v.attempts.length,5);assert.equal(v.reports.length,2);assert.equal(v.reports[0].snapshot.id,first.report.id);assert.notEqual(latest.report.id,first.report.id);assert.ok(v.reviews.find(i=>i.knowledgePointId==='negative-brackets')!.stage>=1);
 }finally{f.dispose();}
});
test('operation replay does not duplicate attempts; rest blocks opening and memory off blocks proposals',async()=>{
 const clock=new TestClock();const f=temporaryRepository(clock);try{const r=createRuntime(f),d=installLearning(r);const s=await d.start({operationId:id(),mode:'support'});await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});await d.open({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2});const input={operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x+5',reviewItemId:null,reviewRevision:null};await d.submit(input);await d.submit(input);assert.equal(r.repository.list('attempts').length,2);
 await d.preference({operationId:id(),rest:true,questionInvitePaused:true});await assert.rejects(d.open({operationId:id(),sessionId:s.id,taskId:'transfer',taskVersion:2}));
 const result=await r.tools.execute({id:id(),name:'propose_memory',arguments:JSON.stringify({text:'短一点'})},{role:'tutor',runId:id(),signal:new AbortController().signal});assert.equal(result.ok,false);
 const denied=await r.tools.execute({id:id(),name:'grade_attempt',arguments:JSON.stringify({attemptId:r.repository.list('attempts')[0].id})},{role:'tutor',runId:id(),signal:new AbortController().signal});assert.equal(denied.ok,false);
 }finally{f.dispose();}
});
test('an unseen review opened yesterday but submitted today cannot advance C when B classifies the preview as seen',async()=>{
 const clock=new TestClock(),f=temporaryRepository(clock);try{const r=createRuntime(f),d=installLearning(r);const s=await d.start({operationId:id(),mode:'support'});
 for(const [task,value]of [['b-like-observation','5x-4'],['bracket','x-5']]){await d.open({operationId:id(),sessionId:s.id,taskId:task,taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:task,taskVersion:2,value,reviewItemId:null,reviewRevision:null});}
 const plan=await d.generate({operationId:id(),timeBudgetMinutes:6});await d.confirm({operationId:id(),proposalId:plan.proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生接受'});
 clock.advance(86400000);const review=await d.start({operationId:id(),mode:'review'}),item=(await d.view()).reviews.find(i=>i.knowledgePointId==='negative-brackets')!;await d.open({operationId:id(),sessionId:review.id,taskId:'transfer',taskVersion:2});clock.advance(86400000);
 const result=await d.submit({operationId:id(),sessionId:review.id,taskId:'transfer',taskVersion:2,value:'4a+2',reviewItemId:item.id,reviewRevision:item.revision});assert.equal(result.classification.independent,false);assert.equal((await d.view()).reviews.find(i=>i.id===item.id)?.stage,0);
 }finally{f.dispose();}
});
