/** 所有者：zCode。聚合视图契约（shared/views.ts）—— LearningView 不再由服务端实现反推类型。
 *
 * 这个测试守两件事：
 *  1. 真实运行时的 view() 输出必须能通过 shared/views.ts 的 schema（前端依赖同一份形状）；
 *  2. schema 真的会拦人：多一个键、少一个键都要失败 —— 否则它只是一张没有约束力的文档。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { LearningView } from '../../shared/views';

const setup=(clock:TestClock=new TestClock())=>{
 const f=temporaryRepository(clock),r=createRuntime({...f}),d=installLearning(r,{timeoutMs:2000});
 return {...f,r,d};
};

test('view() 的真实输出通过 shared/views.ts 契约',async()=>{
 const f=setup();try{
  const view=await f.d.view();
  const parsed=LearningView.safeParse(view);
  assert.equal(parsed.success,true,parsed.success?'':JSON.stringify(parsed.error.issues.slice(0,5)));
  // 契约解析后的结果与服务端返回的是同一份数据，不是另一次推导
  assert.deepEqual(parsed.data,view);
 }finally{f.dispose();}
});

test('契约会拦住多余键与缺失键（不是没有约束力的文档）',async()=>{
 const f=setup();try{
  const view=await f.d.view();
  // 以真实视图为基准派生，不另写一份形状 —— 免得测试里的副本和契约各说各话
  assert.equal(LearningView.safeParse({...view,__extra:1}).success,false,'多余键应当被契约拒绝');
  const {now:dropped,...withoutNow}=view;
  assert.equal(dropped!==undefined,true);
  assert.equal(LearningView.safeParse(withoutNow).success,false,'缺失键应当被契约拒绝');
 }finally{f.dispose();}
});
