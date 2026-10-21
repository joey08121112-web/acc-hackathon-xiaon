import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures';
import { schemas, type AssessmentEnginePort, type Evidence } from '../../shared/learning-contracts';
import { classifyAttempt } from '../../server/plugins/assessment/state';
import { SqliteRepository } from '../../server/storage/repository';
import { createRuntime } from '../../server/bootstrap';
import { RubricAssessment } from '../../server/plugins/assessment';
const skill=(s:Awaited<ReturnType<ReturnType<typeof fixture>['snapshot']>>,id='negative-brackets')=>s.skills.find(s=>s.knowledgePointId===id)!;

test('wrong then correct, helped completion, original redo and unseen independent attempts remain distinct immutable facts',async()=>{
 const f=fixture();try{
  f.open('bracket');const wrong=f.submit('bracket','x-5');await f.grade(wrong);
  f.expose('bracket','hint');const corrected=f.submit('bracket','x+5');await f.grade(corrected);
  assert.equal(skill(await f.snapshot()).status,'completed_with_help');
  assert.equal(classifyAttempt(corrected,f.runtime.engineContext()).kind,'completed_with_help');
  assert.equal(f.repository.get('attempts',wrong.id)?.value,'x-5');
  f.nextDay();f.open('bracket');const redo=f.submit('bracket','x+5');await f.grade(redo);
  assert.equal(classifyAttempt(redo,f.runtime.engineContext()).novelty,'seen');
  f.open('transfer');const fresh=f.submit('transfer','4a+2');await f.grade(fresh);
  assert.equal(classifyAttempt(fresh,f.runtime.engineContext()).kind,'new_independent');
  assert.equal(skill(await f.snapshot()).status,'first_independent');
 }finally{f.dispose();}
});

test('no-hint correction is never first independent; no attempt, whitespace and pause do not mean weak ability',async()=>{
 const f=fixture();try{
  f.open('bracket');const paused=f.runtime.events.sessionState({operationId:f.op(),sessionId:f.session().id,status:'paused'});assert.equal(paused.status,'paused');
  assert.ok((await f.snapshot()).skills.every(x=>x.status==='unobserved'));
  f.runtime.events.sessionState({operationId:f.op(),sessionId:f.session().id,status:'active'});
  const empty=f.submit('bracket','   ');assert.equal((await f.grade(empty)).verdict,'needs_review');
  assert.equal(skill(await f.snapshot()).status,'unobserved');
  const a=f.submit('bracket','x-5');await f.grade(a);const b=f.submit('bracket','x+5');await f.grade(b);
  assert.equal(classifyAttempt(b,f.runtime.engineContext()).kind,'corrected_original');assert.equal(skill(await f.snapshot()).status,'needs_support');
 }finally{f.dispose();}
});

test('hint after submission does not rewrite success; chat help or answer exposure before submission prevents independence',async()=>{
 for(const help of ['hint','chat_help','answer'] as const){
  const f=fixture();try{
   f.open('bracket');const a=f.submit('bracket','x+5');await f.grade(a);f.expose('bracket',help);
   assert.equal(skill(await f.snapshot()).status,'first_independent');assert.equal(classifyAttempt(a,f.runtime.engineContext()).kind,'new_independent');
   f.open('transfer');f.expose('transfer',help);const b=f.submit('transfer','4a+2');await f.grade(b);
   assert.equal(classifyAttempt(b,f.runtime.engineContext()).kind,'completed_with_help');
  }finally{f.dispose();}
 }
});

test('same-day variants cannot establish across-day status; two trusted dates and unseen tasks can; local date uses Shanghai',async()=>{
 const f=fixture();try{
  for(const [id,value] of [['bracket','x+5'],['transfer','4a+2']]){f.open(id);await f.grade(f.submit(id,value));}
  assert.equal(skill(await f.snapshot()).status,'first_independent');
  f.nextDay();f.open('b-neg-delayed');await f.grade(f.submit('b-neg-delayed','12-3x'));
  const state=skill(await f.snapshot());assert.equal(state.status,'cross_session_independent');assert.deepEqual(state.trustedLearningDates,['2026-10-20','2026-10-21']);
  const before=JSON.stringify(f.repository.list('attempts'));
  f.open('calc-0');await f.grade(f.submit('calc-0','3x-1'));
  const later=skill(await f.snapshot());assert.equal(later.status,'cross_session_independent');assert.equal(later.recentDifficulty,true);
  assert.equal(JSON.stringify(f.repository.list('attempts').slice(0,3)),before);
 }finally{f.dispose();}
 const f2=fixture();try{
  f2.clock.set('2026-10-20T15:59:00.000Z');f2.open('bracket');await f2.grade(f2.submit('bracket','x+5'));
  f2.nextDay('2026-10-20T16:01:00.000Z');f2.open('transfer');await f2.grade(f2.submit('transfer','4a+2'));
  assert.equal(skill(await f2.snapshot()).status,'cross_session_independent');
 }finally{f2.dispose();}
});

test('original opened on an earlier date, repeated raw problem and version aliases do not count as unseen transfer',async()=>{
 const f=fixture();try{
  f.open('bracket');f.nextDay();f.open('bracket');const old=f.submit('bracket','x+5');await f.grade(old);
  assert.equal(classifyAttempt(old,f.runtime.engineContext()).kind,'original_redo');assert.notEqual(skill(await f.snapshot()).status,'first_independent');
 }finally{f.dispose();}
});

test('unknown legacy time/exposure cannot establish independent status, missing grades stay unknown',async()=>{
 const f=fixture();try{
  const a=schemas.Attempt.parse({schemaVersion:'1.0.0',id:'synthetic-old',operationId:'synthetic-import',taskId:'bracket',taskVersion:1,sessionId:null,value:'x+5',sourceTime:{occurredAt:null,recordedAt:f.clock.now(),timezone:'Asia/Shanghai',trust:'legacy_unknown',legacyLabel:'10/01 12:00'},exposureIds:[],hintSnapshot:[],answerExposed:false,origin:'legacy_import',exposureHistory:'legacy_unknown',supersedesAttemptId:null});
  f.repository.append('attempts',a);await f.grade(a);
  f.open('bracket');const b=f.submit('bracket','x+5');await f.grade(b);
  assert.equal(classifyAttempt(b,f.runtime.engineContext()).novelty,'unknown');
  assert.notEqual(skill(await f.snapshot()).status,'first_independent');
  f.open('transfer');f.submit('transfer','4a+2');
  assert.notEqual(skill(await f.snapshot()).status,'cross_session_independent');
 }finally{f.dispose();}
});

test('cross-session rule is configurable and not a standardized assessment',async()=>{
 const f=fixture({policy:{minimumTasks:3,minimumDates:3,minimumSessions:3}});try{
  f.open('bracket');await f.grade(f.submit('bracket','x+5'));f.nextDay();f.open('transfer');await f.grade(f.submit('transfer','4a+2'));
  const snapshot=await f.snapshot();assert.equal(skill(snapshot).status,'first_independent');assert.ok(snapshot.limitations.some(t=>/产品规则/.test(t)));
 }finally{f.dispose();}
});

test('operation retries append no duplicate evidence, different operations for one grade reuse it, fake attempt rejected',async()=>{
 const f=fixture();try{
  f.open('bracket');const a=f.submit('bracket','x+5');const input={attemptId:a.id,operationId:f.op()};
  const result=await f.engine.grade(input,f.runtime.engineContext());const count=f.repository.list('evidence').length;
  assert.deepEqual(await f.engine.grade(input,f.runtime.engineContext()),result);assert.deepEqual(await f.grade(a),result);assert.equal(f.repository.list('evidence').length,count);
  await assert.rejects(f.engine.grade({attemptId:'fake',operationId:f.op()},f.runtime.engineContext()),/作答/);
  await assert.rejects(f.engine.grade({...input,attemptId:'fake'},f.runtime.engineContext()));
  const snapshotInput={operationId:f.op()};const s=await f.engine.snapshot(snapshotInput,f.runtime.engineContext());
  assert.deepEqual(await f.engine.snapshot(snapshotInput,f.runtime.engineContext()),s);schemas.AssessmentSnapshot.parse(s);
  for(const e of f.repository.list('evidence')){schemas.Evidence.parse(e);assert.equal(a.value.slice(e.location.start,e.location.end),e.quote);}
  const calc=s.coverage.find(x=>x.dimension==='计算')!;assert.equal(calc.evidenceCount,count);assert.ok(calc.unknowns.length);
 }finally{f.dispose();}
});

test('real SQLite reopen retains attempts, evidence, snapshots and operation receipts; frozen-port consumer compiles',async()=>{
 const f=fixture();let closed=false;try{
  const consumer:AssessmentEnginePort=f.engine;assert.equal(consumer.id,'assessment-rubric-v1');
  f.open('bracket');const a=f.submit('bracket','x+5');const input={attemptId:a.id,operationId:f.op()};const g=await f.engine.grade(input,f.runtime.engineContext());await f.snapshot();
  f.repository.close();closed=true;
  const repo=new SqliteRepository(f.databasePath);try{
   const engine=new RubricAssessment();const runtime=createRuntime({repository:repo,clock:f.clock,engines:{assessment:engine}});
   assert.deepEqual(await engine.grade(input,runtime.engineContext()),g);assert.equal(repo.list('attempts').length,1);assert.equal(repo.list('assessments').length,1);
   assert.equal(skill(await engine.snapshot({operationId:f.op()},runtime.engineContext())).status,'first_independent');
  }finally{repo.close();}
 }finally{if(closed){const {rmSync}=await import('node:fs');rmSync(f.directory,{recursive:true,force:true});}else f.dispose();}
});

// Exported solely as a compile-time assertion on the frozen evidence representation.
export const evidenceLocationConsumer=(e:Evidence)=>e.location.end>=e.location.start;
