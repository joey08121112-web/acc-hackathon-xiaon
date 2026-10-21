import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures';
import { classifyAttempt } from '../../server/plugins/assessment/state';
import { AssessmentCatalog } from '../../server/plugins/assessment';
import { checkObjective } from '../../server/plugins/assessment/grading';

test('opening version 1 yesterday prevents version 2 of the same original from becoming unseen without an earlier attempt',async()=>{
 const f=fixture();try{
  f.runtime.events.expose({operationId:f.op(),sessionId:f.session().id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});
  f.nextDay();f.open('bracket');const a=f.submit('bracket','x+5');await f.grade(a);
  assert.notEqual(classifyAttempt(a,f.runtime.engineContext()).kind,'new_independent');
  assert.equal(classifyAttempt(a,f.runtime.engineContext()).novelty,'seen');
 }finally{f.dispose();}
});

test('a single active session spanning midnight cannot turn a previously opened original into an unseen new problem',async()=>{
 const f=fixture();try{
  f.open('bracket');f.clock.set('2026-10-21T02:00:00.000Z');const a=f.submit('bracket','x+5');await f.grade(a);
  assert.equal(classifyAttempt(a,f.runtime.engineContext()).kind,'original_redo');
 }finally{f.dispose();}
});

test('unassisted redo next day records delayed retention but adds neither a new task nor a new independent date',async()=>{
 const f=fixture();try{
  f.open('bracket');await f.grade(f.submit('bracket','x+5'));
  f.nextDay();f.open('bracket');const a=f.submit('bracket','x+5');await f.grade(a);
  const fact=classifyAttempt(a,f.runtime.engineContext());assert.equal(fact.kind,'original_redo');assert.equal(fact.delayedRetention,true);
  const state=(await f.snapshot()).skills.find(s=>s.knowledgePointId==='negative-brackets')!;
  assert.equal(state.status,'first_independent');assert.deepEqual(state.trustedLearningDates,['2026-10-20']);
 }finally{f.dispose();}
});

test('supplemental calc family math is checked at independent values; padded answers retain exact quotes; second-line contradictions fail',()=>{
 const c=new AssessmentCatalog();
 for(let i=0;i<10;i++){
  const t=c.definition('calc-'+i,2)!;
  for(const x of [-5,0,3])assert.equal(3*x+i+1,(i+5)*x-((i+2)*x-(i+1)));
  assert.equal(checkObjective(t,`3x+${i+1}`).status,'supported');
  assert.equal(checkObjective(t,`3x-${i+1}`).status,'unsupported');
 }
 const t=c.definition('bracket',2)!;const input='   x+5   ';
 const check=checkObjective(t,input);assert.equal(check.status,'supported');assert.equal(input.slice(check.location.start,check.location.end),check.quote);
 assert.equal(checkObjective(t,'x+5\n3x-2x-5=x+5').status,'unsupported');
});

test('registered frozen port is consumed by A tools without changing registry; public selection hides trusted grading key',async()=>{
 const f=fixture();try{
  f.open('bracket');const a=f.submit('bracket','x+5');
  const access={role:'assessor' as const,runId:'synthetic-run-b',signal:new AbortController().signal};
  const graded=await f.runtime.tools.execute({id:'grade-1',name:'grade_attempt',arguments:JSON.stringify({attemptId:a.id})},access);
  assert.equal(graded.ok,true);
  const state=await f.runtime.tools.execute({id:'state-1',name:'get_skill_state',arguments:'{}'},access);
  assert.equal(state.ok,true);
  if(state.ok&&'skills' in state.data)assert.equal(state.data.skills.find(s=>s.knowledgePointId==='negative-brackets')?.status,'first_independent');
  const selected=await f.runtime.tools.execute({id:'select-1',name:'select_task',arguments:JSON.stringify({sessionId:f.session().id,dimension:'计算'})},{...access,role:'tutor'});
  assert.equal(selected.ok,true);if(selected.ok)for(const key of ['answer','rubric','hints','commonErrors'])assert.equal(key in selected.data,false);
 }finally{f.dispose();}
});

test('parallel duplicate grades commit one immutable revision, and catalog output mutations cannot replace the trusted answer',async()=>{
 const f=fixture();try{
  const task=f.engine.catalog.definition('bracket',2)!;task.answer[0]='x-5';
  f.open('bracket');const a=f.submit('bracket','x+5');const input={attemptId:a.id,operationId:f.op()};
  const [one,two]=await Promise.all([f.engine.grade(input,f.runtime.engineContext()),f.engine.grade(input,f.runtime.engineContext())]);
  assert.deepEqual(one,two);assert.equal(one.verdict,'correct');assert.equal(f.repository.list('gradings').length,1);
 }finally{f.dispose();}
});

test('same-timestamp cross-version exposure has no provable ordering and cannot establish unseen independence',async()=>{
 const f=fixture();try{
  f.runtime.events.expose({operationId:f.op(),sessionId:f.session().id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});
  f.open('bracket');const a=f.submit('bracket','x+5');await f.grade(a);
  assert.equal(classifyAttempt(a,f.runtime.engineContext()).novelty,'unknown');
  assert.equal(classifyAttempt(a,f.runtime.engineContext()).independent,false);
 }finally{f.dispose();}
});
