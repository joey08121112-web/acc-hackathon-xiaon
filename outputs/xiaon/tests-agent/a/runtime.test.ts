import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { SyntheticProvider } from '../../server/providers/synthetic';
import { SCHEMA_VERSION, schemas } from '../../shared/learning-contracts';
import { temporaryRepository } from '../../server/storage/testing';

const clock = { now: () => '2026-10-21T03:00:00.000Z' };
function fixture(provider = new SyntheticProvider()) {
  const temp = temporaryRepository(clock);
  const runtime = createRuntime({ repository: temp.repository, clock, provider });
  return { ...runtime, dispose: temp.dispose };
}
const op = (id: string) => ({ operationId: id });
function start(r: ReturnType<typeof fixture>) {
  const session = r.events.startSession({ ...op('start-1'), mode: 'support' });
  r.events.expose({ ...op('open-1'), sessionId: session.id, taskId: 'bracket', taskVersion: 1, kind: 'task', hintId: null });
  return session;
}

test('strict schema and browser public view deny answer, role, learner and invalid versions', () => {
  assert.equal(SCHEMA_VERSION, '1.0.0');
  assert.throws(() => schemas.SubmitAttempt.parse({ sessionId: 's', taskId: 'bracket', taskVersion: 0, value: 'x+5', operationId: 'o', answer: 'x+5' }));
  assert.throws(() => schemas.ChatRequest.parse({ history: [], operationId: 'o', role: 'assessor' }));
  const r = fixture();
  try {
    const t = r.catalog.publicTask('bracket', 1)!;
    assert.equal('answer' in t, false); assert.equal('rubric' in t, false);
    assert.throws(() => schemas.TaskPublicView.parse({ ...t, answer: ['x+5'] }));
  } finally { r.dispose(); }
});

test('native synthetic tool loop really queries SQLite and returns a tool result to model', async () => {
  const provider = new SyntheticProvider(); const r = fixture(provider);
  try {
    const session = start(r);
    r.events.submit({ ...op('submit-1'), sessionId: session.id, taskId: 'bracket', taskVersion: 1, value: 'x+5' });
    const run = await r.agent.run({ ...op('chat-1'), history: [{ role: 'user', content: '合成测试：查看记录' }] });
    assert.equal(run.status, 'completed'); assert.equal(provider.receivedResults.length, 1);
    const result = provider.receivedResults[0];
    assert.equal(result.ok, true); assert.equal(result.evidenceIds.length, 1);
    assert.equal(r.repository.list('toolCalls').length, 1);
    assert.equal(JSON.stringify(r.repository.list('toolCalls')).includes('x+5'), false);
  } finally { r.dispose(); }
});

test('unknown tool, invalid args, role escalation, forged task and unsaved attempts rejected', async () => {
  const r = fixture(); try {
    const ctx = { role: 'tutor' as const, runId: 'run-test', signal: new AbortController().signal };
    for (const [name,args,code] of [
      ['execute_sql',{},'unknown_tool'], ['grade_attempt',{attemptId:'missing',answer:'x+5'},'invalid_params'],
      ['grade_attempt',{attemptId:'missing'},'not_found'], ['select_task',{sessionId:'missing',taskId:'fake'},'invalid_params'],
      ['request_hint',{taskId:'bracket'},'unavailable'],
    ] as const) {
      const result = await r.tools.execute({ id:'call-'+name+'-'+code, name, arguments: JSON.stringify(args) },name==='grade_attempt'?{...ctx,role:'assessor'}:ctx);
      assert.equal(result.ok,false); if (!result.ok) assert.equal(result.error.code,code);
    }
    const denied = await r.tools.execute({ id:'denied',name:'grade_attempt',arguments:'{"attemptId":"x"}' },{...ctx,role:'reporter'});
    assert.equal(denied.ok,false); if (!denied.ok) assert.equal(denied.error.code,'forbidden');
    assert.throws(()=>r.events.submit({...op('fake'),sessionId:'missing',taskId:'fake',taskVersion:1,value:'x'}));
  } finally { r.dispose(); }
});

test('append-only attempts, hint snapshot order, trusted grading, idempotency and conflict', async () => {
  const r = fixture(); try {
    const s=start(r); const input={...op('a-1'),sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x-5'};
    const a=r.events.submit(input); assert.deepEqual(r.events.submit(input),a);
    assert.throws(()=>r.events.submit({...input,value:'x+5'}),/conflict/);
    r.events.expose({...op('hint-1'),sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'hint',hintId:'legacy-hint'});
    const b=r.events.submit({...input,...op('a-2'),value:'x+5'});
    assert.equal(a.exposureIds.length,1);assert.equal(a.hintSnapshot.length,0); assert.equal(b.hintSnapshot.length,1);
    const g=await r.tools.execute({id:'grade',name:'grade_attempt',arguments:JSON.stringify({attemptId:b.id})},{role:'assessor',runId:'r',signal:new AbortController().signal});
    assert.equal(g.ok,true);assert.equal(r.repository.list('gradings')[0].verdict,'correct');
    assert.equal(r.repository.list('attempts').length,2);
    assert.throws(()=>r.repository.append('attempts', {...a,value:'forged'}),/conflict/);
  } finally { r.dispose(); }
});

test('optional memory switch, inactive, expiry, unrelated purpose and deletion affect next context', async () => {
  const r=fixture();try {
    r.events.consent({...op('consent'),optionalMemory:true});
    const m=r.events.remember({...op('memory-1'),text:'合成偏好:短句',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
    assert.equal(r.context().memories.length,1);assert.equal(r.events.remember({...op('memory-1'),text:'合成偏好:短句',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null}).id,m.id);
    r.events.consent({...op('off'),optionalMemory:false}); assert.equal(r.context().memories.length,0);
    assert.throws(()=>r.events.remember({...op('blocked'),text:'blocked',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null}));
    r.events.consent({...op('on'),optionalMemory:true});
    r.events.memoryState({...op('stop'),memoryId:m.id,action:'stop'});assert.equal(r.context().memories.length,0);
    r.events.memoryState({...op('delete'),memoryId:m.id,action:'delete'});assert.equal(r.repository.list('memories').some(x=>x.id===m.id),false);
    r.events.remember({...op('expired'),text:'old',source:'student_explicit',purpose:'tutoring',expiresAt:'2026-10-20T00:00:00.000Z',reviewAt:null});
    r.events.remember({...op('unrelated'),text:'other',source:'student_explicit',purpose:'planning',expiresAt:null,reviewAt:null});
    assert.equal(r.context().memories.length,0);
    assert.equal(r.repository.list('attempts').length,0);
  } finally {r.dispose();}
});

test('restart preserves attempts, operation receipts and sessions in a real SQLite file', () => {
  const dir=mkdtempSync(join(tmpdir(),'xiaon-restart-'));const path=join(dir,'test.sqlite');
  let r=createRuntime({databasePath:path,clock});
  try {const s=r.events.startSession({...op('s'),mode:'support'});r.events.expose({...op('e'),sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});const input={...op('a'),sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'};const a=r.events.submit(input);r.repository.close();r=createRuntime({databasePath:path,clock});assert.deepEqual(r.events.submit(input),a);assert.equal(r.repository.list('attempts').length,1);}finally{r.repository.close();rmSync(dir,{recursive:true});}
});

test('timeout, cancellation, unsupported provider and budget do not fake completion', async () => {
  for(const mode of ['timeout','unsupported','endless','text-json'] as const){
    const r=fixture(new SyntheticProvider(mode));try {
      const run=await r.agent.run({...op('chat-'+mode),history:[{role:'user',content:'合成'}]},{timeoutMs:15});
      assert.equal(run.status,mode==='endless'?'budget_exhausted':mode==='text-json'?'completed':mode==='unsupported'?'unavailable':'timeout');
      if(mode==='text-json')assert.equal(run.toolExecutions,0);
      assert.ok(run.rounds<=4);assert.ok(run.toolExecutions<=6);
    } finally{r.dispose();}
  }
  const r=fixture(new SyntheticProvider('timeout'));try{const c=new AbortController();const p=r.agent.run({...op('cancel'),history:[{role:'user',content:'x'}]},{signal:c.signal});c.abort();assert.equal((await p).status,'cancelled');}finally{r.dispose();}
});

test('legacy import preview, transaction rollback, retry and unknown time keep original untouched', () => {
  const r=fixture();try{
    const original=JSON.stringify({version:1,records:{bracket:{id:'bracket',attempts:[{id:'old1',value:'x+5',correct:true,hinted:false,time:'10/20 12:00'}],hint:false,paused:false,draft:''}}});
    const preview=r.importer.preview(original);assert.equal(preview.attemptCount,1);
    assert.throws(()=>r.importer.import({...op('import'),source:original,previewHash:'bad',scope:'attempts_only'}));
    const input={...op('import'),source:original,previewHash:preview.hash,scope:'attempts_only' as const};
    r.importer.import(input);r.importer.import(input);
    const a=r.repository.list('attempts');assert.equal(a.length,1);assert.equal(a[0].sourceTime.trust,'legacy_unknown');assert.equal(a[0].sessionId,null);assert.equal(a[0].sourceTime.occurredAt,null);
    assert.equal(original,input.source);
    const bad=JSON.stringify({version:1,records:{bracket:{attempts:[{id:'old2',value:'x',time:'?',hinted:false}]},fake:{attempts:[{id:'old3',value:'x',time:'?',hinted:false}]}}});
    assert.throws(()=>r.importer.import({...op('bad-import'),source:bad,previewHash:r.importer.preview(bad).hash,scope:'attempts_only'}));assert.equal(r.repository.list('attempts').length,1);
  }finally{r.dispose();}
});
