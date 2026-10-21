import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,modelResponse } from './fixtures';
import { createModelAnalyzer } from '../../server/plugins/assessment/model-analysis';
import type { ModelProvider } from '../../shared/learning-contracts';
const value='A\n两个数都是负数，但相加等于负五，不是正数。';
const points=(answer=value)=>[
 {pointId:'result',status:'supported',quote:answer.slice(0,1),location:{start:0,end:1},explanation:'选择了符合条件且推翻结论的反例。'},
 {pointId:'reason',status:'supported',quote:answer.slice(2),location:{start:2,end:answer.length},explanation:'明确说明两个负数相加为负数，否定一定为正。'},
];

test('choice correct alone does not prove reasoning; validated explanation has exact saved-answer quotes',async()=>{
 const f=fixture();try{f.open('logic');const a=f.submit('logic','A');const g=await f.grade(a);assert.equal(g.verdict,'needs_review');assert.equal(g.points.find(p=>p.pointId==='result')?.status,'supported');}finally{f.dispose();}
 const f2=fixture({analyzer:createModelAnalyzer(modelResponse(points()))});try{
  f2.open('logic');const a=f2.submit('logic',value);const g=await f2.grade(a);assert.equal(g.verdict,'correct');assert.equal(g.method,'model_assisted');
  for(const e of f2.repository.list('evidence'))assert.equal(a.value.slice(e.location.start,e.location.end),e.quote);
 }finally{f2.dispose();}
});

test('no quote, foreign quote, malformed JSON, unknown points, wrong offsets, extra keys and program/model conflict all defer',async()=>{
 const variants:unknown[]=[
  {points:points().map(p=>({...p,quote:''}))},
  {points:points().map(p=>({...p,quote:'不是这次作答的原文'}))},
  {points:[...points(),{...points()[0],pointId:'fake'}]},
  {points:points().map(p=>({...p,location:{start:999,end:1000}}))},
  {points:points(),verdict:'correct'},
  {points:[{...points()[0],status:'unsupported'},points()[1]]},
  {points:[points()[0],{...points()[1],quote:'A',location:{start:0,end:1}}]},
 ];
 const providers:ModelProvider[]=variants.map(v=>({kind:'synthetic',supportsTools:true,async complete(){return{content:JSON.stringify(v),toolCalls:[]};}}));
 providers.push({kind:'synthetic',supportsTools:true,async complete(){return{content:'broken JSON',toolCalls:[]};}});
 providers.push({kind:'synthetic',supportsTools:true,async complete(){throw new Error('synthetic provider unavailable');}});
 for(const provider of providers){
  const f=fixture({analyzer:createModelAnalyzer(provider)});try{f.open('logic');const a=f.submit('logic',value);assert.equal((await f.grade(a)).verdict,'needs_review');}finally{f.dispose();}
 }
});

test('model sees only required task/rubric, persisted answer and exposure snapshot, no optional profile/chat/history',async()=>{
 let payload='';const provider:ModelProvider={kind:'synthetic',supportsTools:true,async complete(input){payload=input.messages[1].content;assert.deepEqual(input.tools,[]);return{content:JSON.stringify({points:points()}),toolCalls:[]};}};
 const f=fixture({analyzer:createModelAnalyzer(provider)});try{
  f.runtime.events.consent({operationId:f.op(),optionalMemory:true});
  f.runtime.events.remember({operationId:f.op(),text:'synthetic-secret-preference',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
  f.open('logic');const a=f.submit('logic',value);await f.grade(a);
  assert.ok(payload.includes(value.replace(/\n/g,'\\n')));assert.ok(payload.includes('rubric'));assert.ok(payload.includes('exposure'));
  assert.ok(!payload.includes('synthetic-secret-preference'));assert.ok(!payload.includes('legacyLabel'));
 }finally{f.dispose();}
});

test('revision supersedes grading/evidence without overwriting attempts; regrading recomputes latest skill and preserves old success',async()=>{
 let wrong=false;
 const provider:ModelProvider={kind:'synthetic',supportsTools:true,async complete(){return{content:JSON.stringify({points:wrong?points().map(p=>({...p,status:'unsupported'})):points()}),toolCalls:[]};}};
 const f=fixture({analyzer:createModelAnalyzer(provider)});try{
  f.open('logic');const a=f.submit('logic',value);const before=structuredClone(a);const g1=await f.grade(a);
  assert.equal(g1.verdict,'correct');assert.equal((await f.snapshot()).skills.find(s=>s.knowledgePointId==='counterexample')?.status,'first_independent');
  wrong=true;const revisionInput={attemptId:a.id,operationId:f.op(),expectedGradingId:g1.id};
  const g2=await f.engine.regrade(revisionInput,f.runtime.engineContext());assert.equal(g2.verdict,'needs_review');assert.equal(g2.supersedesGradingId,g1.id);assert.ok(g2.evidenceRevision>g1.evidenceRevision);
  assert.deepEqual(await f.engine.regrade(revisionInput,f.runtime.engineContext()),g2);
  assert.equal(f.repository.list('gradings').length,2);assert.deepEqual(f.repository.get('attempts',a.id),before);
  assert.notEqual((await f.snapshot()).skills.find(s=>s.knowledgePointId==='counterexample')?.status,'first_independent');
  assert.ok(f.repository.list('evidence').some(e=>e.supersedesEvidenceId!==null));
 }finally{f.dispose();}
});
