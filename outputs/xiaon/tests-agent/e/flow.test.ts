import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { SqliteRepository } from '../../server/storage/repository';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { OfflineProvider } from '../../server/providers/glm';
import { GenerationProvider,candidate,likeCandidate } from './provider';
const id=()=>crypto.randomUUID();
const DAY=86400000;
function setup(provider=new GenerationProvider(),options:Parameters<typeof installLearning>[1]={}){
 const clock=new TestClock(),f=temporaryRepository(clock),r=createRuntime({...f,provider}),d=installLearning(r,{timeoutMs:2000,...options});
 return{clock,f,r,d,provider};
}
/** Real student path: like-terms first (prerequisite), then a wrong bracket attempt as evidence. */
async function withEvidence(d:ReturnType<typeof setup>['d']){
 const s=await d.start({operationId:id(),mode:'support'});
 for(const [task,value] of [['b-like-observation','5x-4'],['bracket','x-5']] as const){await d.open({operationId:id(),sessionId:s.id,taskId:task,taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:task,taskVersion:2,value,reviewItemId:null,reviewRevision:null});}
 return s;
}
const ask=(over:Record<string,unknown>={})=>({operationId:id(),knowledgePointId:'negative-brackets' as const,purpose:'practice' as const,reviewItemId:null,timeBudgetMinutes:6,...over});

test('synthetic generation → real handler → validation → SQLite → unified catalog → student opens → real grading',async()=>{
 const {f,r,d,provider}=setup();try{
  const s=await withEvidence(d);
  const evidenceId=r.repository.list('gradings').at(-1)!.evidenceIds[0];
  provider.queue=[candidate({evidenceIds:[evidenceId]})];
  const out=await d.generateTask(ask());
  assert.equal(out.status,'published');assert.ok(out.task);
  const sent=JSON.parse(provider.generatorMessages[0].find(m=>m.role==='user')!.content);
  assert.equal(sent.basis,'difficulty');assert.ok(sent.evidence.some((e:{evidenceIds:string[]})=>e.evidenceIds.includes(evidenceId)));
  assert.ok(!JSON.stringify(sent).includes('x-5'),'raw student answers are not sent to the generator');
  assert.deepEqual(Object.keys(out.task!).filter(k=>['answer','rubric','hints','commonErrors'].includes(k)),[]);
  const rec=r.repository.list('generations')[0];
  assert.equal(rec.status,'published');assert.equal(rec.taskId,out.task!.id);assert.equal(rec.relation,'same_family_numeric_variant');assert.equal(rec.promptVersion,'generator-e1');assert.equal(rec.providerKind,'synthetic');assert.ok(rec.runId);
  assert.ok(!JSON.stringify(rec).includes('5x+7'),'record holds fingerprints, not answers');
  assert.equal(r.repository.list('runs').filter(x=>x.role==='generator').length,1);
  // Published is not exposed.
  let v=await d.view();assert.equal(v.generations[0].exposed,false);assert.ok(v.tasks.some(t=>t.id===out.task!.id));
  assert.equal(r.repository.list('exposures').some(e=>e.taskId===out.task!.id),false);
  assert.ok(r.tools.definitions('tutor').every(t=>t.name!=='generate_task_candidates'));
  await d.open({operationId:id(),sessionId:s.id,taskId:out.task!.id,taskVersion:2});
  const graded=await d.submit({operationId:id(),sessionId:s.id,taskId:out.task!.id,taskVersion:2,value:'9x-4x+7\n=5x+7',reviewItemId:null,reviewRevision:null});
  assert.equal(graded.grading.verdict,'correct');assert.equal(graded.classification.kind,'new_independent');
  const wrong=await d.generateTask(ask({operationId:id()}));assert.equal(wrong.status,'rejected','default synthetic reply repeats the same content → duplicate');
  assert.ok(r.repository.list('generations')[1].candidates.every(c=>c.reasons.includes('duplicate_content')));
  v=await d.view();assert.equal(v.generations[0].exposed,true);
  assert.equal(v.assessment.skills.find(k=>k.knowledgePointId==='negative-brackets')!.attemptIds.includes(graded.attempt.id),true);
  // Restart on the same SQLite file: definition, public view and grading survive without any model call.
  const path=f.databasePath;
  const again=new SqliteRepository(path),r2=createRuntime({repository:again,clock:f.clock,provider:new OfflineProvider()}),d2=installLearning(r2);
  assert.equal(r2.catalog.definition(out.task!.id,2)?.answer[0],'5x+7');assert.ok(r2.catalog.publicTask(out.task!.id,2));
  const regrade=await d2.grade({operationId:id(),attemptId:graded.attempt.id,expectedGradingId:graded.grading.id});assert.equal(regrade.verdict,'correct');
  assert.equal((await d2.view()).generations.length,2);again.close();
 }finally{f.dispose();}
});

test('repair round: a wrong first candidate is rejected and a valid second one publishes; two failures publish nothing',async()=>{
 const {f,r,d,provider}=setup();try{
  await withEvidence(d);
  provider.queue=[candidate({answer:'5x-7'}),candidate({params:{a:8,b:3,c:6},expression:'8x-(3x-6)',answer:'5x+6',steps:['5x+6']})];
  const ok=await d.generateTask(ask());assert.equal(ok.status,'published');
  assert.deepEqual(ok.generation.candidates.map(c=>c.status),['rejected','accepted']);assert.deepEqual(ok.generation.candidates[0].reasons,['answer_mismatch']);
  const repair=provider.generatorMessages[1].at(-1)!.content;assert.match(repair,/answer_mismatch/);assert.ok(!repair.includes('5x+6'));
  provider.queue=[candidate({steps:['8x-3x-6','5x+6']}),{toolCall:true},candidate()];
  const bad=await d.generateTask(ask());assert.equal(bad.status,'rejected');assert.equal(bad.task,null);
  assert.deepEqual(bad.generation.candidates.map(c=>c.reasons),[['steps_invalid','steps_final_mismatch'],['tool_call_not_allowed']]);
  assert.equal(provider.generatorMessages.length,4,'at most two model responses per operation');
  assert.equal(r.repository.list('generations').filter(g=>g.status==='published').length,1);
  assert.equal(r.repository.list('toolCalls').some(t=>t.name==='execute_sql'),false,'tool calls from the generator are never executed');
 }finally{f.dispose();}
});

test('idempotent operation IDs, conflicting reuse and concurrent requests never double-publish',async()=>{
 const {f,r,d,provider}=setup();try{
  await withEvidence(d);const request=ask();
  const first=await d.generateTask(request);const replay=await d.generateTask(request);
  assert.equal(replay.generation.id,first.generation.id);assert.equal(provider.generatorMessages.length,1);
  await assert.rejects(d.generateTask({...request,timeBudgetMinutes:5}),{code:'conflict'});
  provider.delayMs=50;provider.queue=[candidate({params:{a:8,b:3,c:6},expression:'8x-(3x-6)',answer:'5x+6',steps:['5x+6']}),candidate({params:{a:8,b:3,c:6},expression:'8x-(3x-6)',answer:'5x+6',steps:['5x+6']})];
  const results=await Promise.allSettled([d.generateTask(ask()),d.generateTask(ask())]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal(r.repository.list('generations').filter(g=>g.status==='published').length,2);
  assert.equal(new Set(r.repository.list('tasks').filter(t=>t.id.startsWith('gen-')).map(t=>t.id)).size,2);
 }finally{f.dispose();}
});

test('program gates: prerequisite, pause, exploration order, 10-calculation cap, daily cost cap and offline fallback',async()=>{
 {const {f,d,provider}=setup();try{
  const s=await d.start({operationId:id(),mode:'support'});
  await assert.rejects(d.generateTask(ask()),{code:'invalid_state'},'negative brackets requires like-terms first');
  provider.queue=[likeCandidate()];const basic=await d.generateTask(ask({knowledgePointId:'like-terms'}));assert.equal(basic.status,'published');assert.equal(basic.generation.basis,'no_evidence');
  const sent=JSON.parse(provider.generatorMessages[0][1].content);assert.deepEqual(sent.allowedDifficulties,['introductory']);
  await assert.rejects(d.generateTask(ask({knowledgePointId:'like-terms',timeBudgetMinutes:1})),{code:'budget_exhausted'});
  await d.preference({operationId:id(),rest:true,questionInvitePaused:true});
  await assert.rejects(d.generateTask(ask({knowledgePointId:'like-terms'})),{code:'invalid_state'});
  assert.equal(provider.generatorMessages.length,1,'gates run before any model call');void s;
 }finally{f.dispose();}}
 {const {f,d}=setup();try{
  const s=await d.start({operationId:id(),mode:'exploration'});void s;
  await assert.rejects(d.generateTask(ask({knowledgePointId:'like-terms'})),{code:'invalid_state'});
 }finally{f.dispose();}}
 {const {f,d,r,provider}=setup();try{
  const s=await withEvidence(d);
  for(let i=0;i<8;i++)await d.open({operationId:id(),sessionId:s.id,taskId:`calc-${i}`,taskVersion:2});
  // 2 earlier calculation tasks + 8 bank extras = the session's 10 distinct calculation tasks.
  const calc=new Set(r.repository.list('exposures').filter(e=>e.kind==='task'&&r.catalog.definition(e.taskId,e.taskVersion)?.primaryDimension==='计算').map(e=>e.taskId));
  assert.equal(calc.size,10);
  await assert.rejects(d.generateTask(ask()),{code:'budget_exhausted'});assert.equal(provider.generatorMessages.length,0);
 }finally{f.dispose();}}
 {const {f,d,provider}=setup(undefined,{generation:{dailyLimit:2}});try{
  await withEvidence(d);provider.queue=[candidate({answer:'1'}),candidate({answer:'1'}),candidate({answer:'1'}),candidate({answer:'1'})];
  assert.equal((await d.generateTask(ask())).status,'rejected');assert.equal((await d.generateTask(ask())).status,'rejected');
  await assert.rejects(d.generateTask(ask()),{code:'budget_exhausted'});
 }finally{f.dispose();}}
 {const clock=new TestClock(),f=temporaryRepository(clock);try{const r=createRuntime({...f,provider:new OfflineProvider()}),d=installLearning(r);await d.start({operationId:id(),mode:'support'});
  await assert.rejects(d.generateTask(ask({knowledgePointId:'like-terms'})),{code:'unavailable'});assert.equal((await d.view()).generationAvailable,false);
 }finally{f.dispose();}}
});

test('cancel, timeout, pause during generation and reset discard late results; nothing is opened automatically',async()=>{
 const {f,r,d,provider}=setup(undefined,{generation:{timeoutMs:1500}});try{
  await withEvidence(d);
  provider.hang=true;const controller=new AbortController();const pending=d.generateTask(ask(),controller.signal);
  setTimeout(()=>controller.abort(),30);await assert.rejects(pending,{code:'cancelled'});
  const timed=d.generateTask(ask());await assert.rejects(timed,{code:'timeout'});
  const paused=d.generateTask(ask());setTimeout(()=>void d.preference({operationId:id(),rest:true,questionInvitePaused:true}),30);await assert.rejects(paused,{code:'cancelled'});
  assert.deepEqual(r.repository.list('generations').map(g=>g.status),['cancelled','failed','cancelled']);
  assert.equal(r.repository.list('generations')[1].failure?.code,'timeout');
  assert.equal(r.repository.list('tasks').some(t=>t.id.startsWith('gen-')),false);
  assert.equal(r.repository.list('runs').filter(x=>x.role==='generator').map(x=>x.status).join(),'cancelled,timeout,cancelled');
 }finally{f.dispose();}
 const late=setup();try{
  await withEvidence(late.d);late.provider.delayMs=80;
  const pending=late.d.generateTask(ask());await new Promise(res=>setTimeout(res,20));
  (late.d as unknown as {epoch:number}).epoch++;// what reset does before clearing; the late model answer must be discarded
  await assert.rejects(pending,{code:'cancelled'});
  assert.equal(late.r.repository.list('tasks').some(t=>t.id.startsWith('gen-')),false);
 }finally{late.f.dispose();}
});

test('optional memory reaches the generator only when enabled; reset removes generated tasks and records',async()=>{
 const {f,r,d,provider}=setup();try{
  await withEvidence(d);
  r.events.consent({operationId:id(),optionalMemory:true});
  r.events.remember({operationId:id(),text:'合成偏好：一次只讲一步',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
  await d.generateTask(ask());
  r.events.consent({operationId:id(),optionalMemory:false});
  provider.queue=[candidate({params:{a:8,b:3,c:6},expression:'8x-(3x-6)',answer:'5x+6',steps:['5x+6']})];await d.generateTask(ask());
  const prefs=provider.generatorMessages.map(m=>JSON.parse(m[1].content).preferences);
  assert.deepEqual(prefs,[['合成偏好：一次只讲一步'],[]]);
  const taskId=r.repository.list('generations')[0].taskId!;assert.ok(r.catalog.definition(taskId,2));
  await d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});
  assert.equal(r.repository.list('generations').length,0);assert.equal(r.catalog.definition(taskId,2),undefined,'reset cannot resurrect from cache');
  assert.equal((await d.view()).tasks.some(t=>t.id.startsWith('gen-')),false);
 }finally{f.dispose();}
});

test('review purpose: due item → generated unseen task → next-day review advances the stage through the normal C path',async()=>{
 const {clock,f,r,d,provider}=setup();try{
  const s=await withEvidence(d);
  await d.hint({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,level:1});
  await d.submit({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x+5',reviewItemId:null,reviewRevision:null});
  const plan=await d.generate({operationId:id(),timeBudgetMinutes:6});
  await d.confirm({operationId:id(),proposalId:plan.proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生接受'});
  let item=(await d.view()).reviews.find(i=>i.status==='active')!;assert.ok(item);
  await assert.rejects(d.generateTask(ask({knowledgePointId:item.knowledgePointId,purpose:'review',reviewItemId:item.id})),{code:'invalid_state'},'not yet due');
  await assert.rejects(d.generateTask(ask({purpose:'practice',reviewItemId:item.id})),{code:'invalid_params'});
  clock.advance(DAY+3600000);const next=await d.start({operationId:id(),mode:'review'});
  item=(await d.view()).reviews.find(i=>i.id===item.id)!;
  provider.queue=[item.knowledgePointId==='like-terms'?likeCandidate({difficulty:'standard',params:{terms:[{k:6,variable:true},{k:-2,variable:false},{k:-2,variable:true},{k:9,variable:false}]},expression:'6a − 2 − 2a + 9',answer:'4a+7',steps:['4a+7'],focus:'combine_with_negatives'}):candidate({difficulty:'standard',params:{a:4,b:9,c:3},expression:'4x-(9x-3)',answer:'-5x+3',steps:['4x-9x+3','-5x+3']})];
  const gen=await d.generateTask(ask({knowledgePointId:item.knowledgePointId,purpose:'review',reviewItemId:item.id}));
  assert.equal(gen.status,'published');assert.equal(gen.generation.basis,'review_due');assert.equal(gen.task!.variantKind,'delayed');
  await d.open({operationId:id(),sessionId:next.id,taskId:gen.task!.id,taskVersion:2});
  const answer=item.knowledgePointId==='like-terms'?'4a+7':'-5x+3';
  const done=await d.submit({operationId:id(),sessionId:next.id,taskId:gen.task!.id,taskVersion:2,value:answer,reviewItemId:item.id,reviewRevision:item.revision});
  assert.equal(done.classification.kind,'new_independent');
  const after=(await d.view()).reviews.find(i=>i.id===item.id)!;assert.equal(after.stage,item.stage+1);
  assert.equal(r.repository.list('reviewOutcomes').at(-1)!.taskNovelty,'unseen');
 }finally{f.dispose();}
});
