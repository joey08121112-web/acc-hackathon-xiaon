/** 所有者：Claude。集成第一期：ChatGPT 契约变更申请「已有场次切换专业模式」的回归测试。显式切换沿用同一场次，不重置计算题预算、暴露与证据。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
const id=()=>crypto.randomUUID();
const setup=()=>{const clock=new TestClock(),f=temporaryRepository(clock),r=createRuntime(f),d=installLearning(r);return{...f,clock,r,d};};

test('an explicit switch turns today\'s open support session into exploration: same session, recorded as a session event',async()=>{
 const f=setup();try{
  const s=await f.d.start({operationId:id(),mode:'support'});
  await f.d.open({operationId:id(),sessionId:s.id,taskId:'model',taskVersion:2});
  await f.d.submit({operationId:id(),sessionId:s.id,taskId:'model',taskVersion:2,value:'3x+2',reviewItemId:null,reviewRevision:null});
  const legacy=await f.d.start({operationId:id(),mode:'exploration'});
  assert.equal(legacy.id,s.id);assert.equal(legacy.mode,'support','without an explicit switch the old behaviour is unchanged');
  const switched=await f.d.start({operationId:id(),mode:'exploration',switchMode:true});
  assert.equal(switched.id,s.id);assert.equal(switched.mode,'exploration');assert.equal(switched.status,'active');
  const v=await f.d.view();assert.equal(v.session?.id,s.id);assert.equal(v.session?.mode,'exploration');
  assert.equal(f.r.repository.list('sessions').length,1,'no new session is created');
  assert.ok(f.r.repository.list('sessionEvents').some(e=>e.sessionId===s.id&&e.mode==='exploration'));
  assert.ok(v.attempts.every(a=>a.sessionId===s.id),'earlier evidence stays on the same session');
  const again=await f.d.start({operationId:id(),mode:'exploration',switchMode:true});assert.equal(again.mode,'exploration');
  assert.equal(f.r.repository.list('sessionEvents').filter(e=>e.mode).length,1,'switching to the current mode adds nothing');
 }finally{f.dispose();}
});

test('switching cannot reset the per-session calculation cap or the exposures',async()=>{
 const f=setup();try{
  const s=await f.d.start({operationId:id(),mode:'support'});
  const calc=f.r.catalog.candidates({sessionId:s.id,excludeTaskIds:[],limit:100}).filter(t=>t.primaryDimension==='计算');assert.ok(calc.length>10);
  for(const t of calc.slice(0,10))f.r.events.expose({operationId:id(),sessionId:s.id,taskId:t.id,taskVersion:t.version,kind:'task',hintId:null});
  const exposures=f.r.repository.list('exposures').length;
  await f.d.start({operationId:id(),mode:'review',switchMode:true});
  assert.throws(()=>f.r.events.expose({operationId:id(),sessionId:s.id,taskId:calc[10].id,taskVersion:calc[10].version,kind:'task',hintId:null}),/最多 10 道/);
  assert.equal(f.r.repository.list('exposures').length,exposures);
 }finally{f.dispose();}
});

test('a paused session is resumed and switched by the same explicit click; another day still starts fresh',async()=>{
 const f=setup();try{
  const s=await f.d.start({operationId:id(),mode:'support'});
  await f.d.preference({operationId:id(),rest:true,questionInvitePaused:true});assert.equal((await f.d.view()).paused,true);
  const switched=await f.d.start({operationId:id(),mode:'exploration',switchMode:true});
  assert.equal(switched.id,s.id);assert.equal(switched.mode,'exploration');assert.equal((await f.d.view()).paused,false);
  await f.d.preference({operationId:id(),rest:true,questionInvitePaused:true});
  assert.equal((await f.d.view()).session?.mode,'exploration','a later pause keeps the switched mode');
  f.clock.advance(24*3600_000);
  const next=await f.d.start({operationId:id(),mode:'support',switchMode:true});
  assert.notEqual(next.id,s.id);assert.equal(next.mode,'support');
 }finally{f.dispose();}
});
