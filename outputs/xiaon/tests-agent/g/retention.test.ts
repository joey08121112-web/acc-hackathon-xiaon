/** 所有者：Claude。集成第一期：zCode 契约变更申请第 2 条「确认记忆时选择时效」。forever → 不过期、30 天后复核；7d/30d → 到期即失效、无需复核。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { retentionWindow,schemas } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const DAY=86_400_000,now='2026-10-21T00:00:00.000Z',plus=(days:number)=>new Date(Date.parse(now)+days*DAY).toISOString();

test('retentionWindow maps the three choices; omitted means forever',()=>{
 assert.deepEqual(retentionWindow('forever',now),{expiresAt:null,reviewAt:plus(30)});
 assert.deepEqual(retentionWindow('7d',now),{expiresAt:plus(7),reviewAt:null});
 assert.deepEqual(retentionWindow('30d',now),{expiresAt:plus(30),reviewAt:null});
 assert.deepEqual(retentionWindow(undefined,now),retentionWindow('forever',now));
 assert.equal(schemas.ConfirmMemoryDraft.safeParse({operationId:'op',sessionId:null,draft:{text:'拆开来看',kind:'method',origin:'progress_card'},text:'拆开来看',retention:'1y'}).success,false);
});

test('confirm-draft stores the chosen window; an expired or due memory leaves the Tutor context; "still applies" renews it',async()=>{
 const clock=new TestClock(now),f=temporaryRepository(clock),r=createRuntime(f),d=installLearning(r);try{
  r.events.consent({operationId:id(),optionalMemory:true});
  const draft={text:'拆开来看',kind:'method' as const,origin:'progress_card' as const};
  const week=await d.confirmMemoryDraft({operationId:id(),sessionId:null,draft,text:'拆开来看',retention:'7d'});
  assert.equal(week.expiresAt,plus(7));assert.equal(week.reviewAt,null);
  const kept=await d.confirmMemoryDraft({operationId:id(),sessionId:null,draft,text:'一次只讲一步'});
  assert.equal(kept.expiresAt,null);assert.equal(kept.reviewAt,plus(30));
  clock.advance(8*DAY);assert.deepEqual(r.events.context().memories.map(m=>m.id),[kept.id],'the 7-day memory expired');
  clock.advance(23*DAY);assert.deepEqual(r.events.context().memories,[],'the long-term memory is due for review and waits for the student');
  const renewed=await d.memoryCorrect({operationId:id(),memoryId:kept.id,text:kept.text,retention:'forever'});
  assert.equal(renewed.reviewAt,new Date(Date.parse(clock.now())+30*DAY).toISOString());
  assert.deepEqual(r.events.context().memories.map(m=>m.id),[renewed.id]);
 }finally{f.dispose();}
});
