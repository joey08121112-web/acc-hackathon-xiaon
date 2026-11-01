import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelMessage, ModelProvider } from '../../shared/learning-contracts';
import { TestClock } from '../core/clock';
import { FreeChatStore } from './store';
import { CONSOLIDATE_PROMPT, consolidate, idleMsFromEnv, parseOps, shouldConsolidate, similar } from './consolidate';
const HOUR=3600000,DAY=24*HOUR;
const setup=()=>{const clock=new TestClock('2026-10-29T02:00:00.000Z');const store=new FreeChatStore(':memory:',clock);return{clock,store,now:()=>clock.now()};};
/** 假模型：按顺序回 replies（对象会转成 JSON），记下每次收到的消息。 */
function model(...replies:(unknown|Error)[]){
 const calls:ModelMessage[][]=[];
 const provider:ModelProvider={kind:'synthetic',supportsTools:false,async complete({messages}){calls.push(messages);const r=replies.shift();if(r instanceof Error)throw r;return{content:typeof r==='string'?r:JSON.stringify(r),toolCalls:[]};}};
 return{provider,calls};
}
const signal=new AbortController().signal;
const chat=(store:FreeChatStore,...pairs:[string,string][])=>{for(const[u,a]of pairs)store.appendExchange(store.currentThread(),u,a);};
test('从对话里记下新条目，消息标为整理过，结果出现在 digest 里，看过就收起', async()=>{
 const{store,now}=setup();chat(store,['我最近超喜欢打篮球','哇，打什么位置？'],['下周有篮球赛','加油！']);
 const{provider,calls}=model({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'},{op:'add',kind:'recent',text:'下周有篮球赛',expiresInDays:10}]});
 const r=await consolidate(store,provider,now,signal);
 assert.equal(r.status,'ok');assert.deepEqual(r.changes.map(c=>c.op+':'+c.text),['add:喜欢打篮球','add:下周有篮球赛']);
 assert.equal(calls[0][0].content,CONSOLIDATE_PROMPT);
 assert.match(calls[0][1].content,/学生（2026-10-29）：我最近超喜欢打篮球/);
 const items=store.profile().items;
 assert.ok(items.every(i=>i.source==='chat'&&!i.editedByStudent));
 assert.equal(items.find(i=>i.kind==='recent')!.expiresAt,'2026-11-08T02:00:00.000Z');
 assert.equal(store.pendingMessages().length,0);
 const d=store.digest()!;assert.deepEqual(d.changes.map(c=>c.text),['喜欢打篮球','下周有篮球赛']);
 store.markDigestSeen(d.runId);assert.equal(store.digest(),null);
 assert.deepEqual(await consolidate(store,model().provider,now,signal),{status:'empty',changes:[]});
});
test('已经有的同一件事记一次提到；聊天记下的以前喜欢会回到在玩', async()=>{
 const{store,now}=setup();
 const id=store.insert({kind:'interest',text:'打篮球',source:'chat',editedByStudent:false});store.chatPast(id);
 chat(store,['我又开始打篮球了','太好了']);
 const r=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'},{op:'mention',id}]}).provider,now,signal);
 assert.deepEqual(r.changes.map(c=>c.op),['mention']);
 const item=store.item(id)!;assert.deepEqual([item.status,item.mentionCount],['active',2]);
 assert.equal(store.digest(),null);
});
test('学生改过的条目：只能记提到，不能改写、不能转以前喜欢，状态也不动', async()=>{
 const{store,now}=setup();
 store.studentEdit({action:'add',kind:'interest',text:'画画'});const id=store.profile().items[0].id;
 store.studentEdit({action:'status',id,status:'past'});
 chat(store,['今天画画了','真棒']);
 const r=await consolidate(store,model({ops:[{op:'update',id,text:'喜欢画水彩'},{op:'past',id},{op:'mention',id}]}).provider,now,signal);
 assert.deepEqual(r.changes.map(c=>c.op),['mention']);
 const item=store.item(id)!;assert.deepEqual([item.text,item.status,item.mentionCount],['画画','past',2]);
});
test('学生删掉的不再加回，除非删掉之后又聊起', async()=>{
 const{clock,store,now}=setup();
 chat(store,['我喜欢跳绳','好呀']);
 const id=store.insert({kind:'interest',text:'喜欢跳绳',source:'chat',editedByStudent:false});
 clock.advance(HOUR);store.studentEdit({action:'delete',id});
 const add={ops:[{op:'add',kind:'interest',text:'跳绳'}]};
 let r=await consolidate(store,model(add).provider,now,signal);
 assert.deepEqual([r.status,r.changes.length],['ok',0]);
 clock.advance(HOUR);chat(store,['其实我还是挺喜欢跳绳的','那就接着跳！']);
 r=await consolidate(store,model(add).provider,now,signal);
 assert.deepEqual(r.changes.map(c=>c.op+':'+c.text),['add:跳绳']);
});
test('敏感内容、编造的 id、格式不对的单条操作都被丢掉；最多 10 条', async()=>{
 const{store,now}=setup();chat(store,['最近在忙事实0、事实1、事实2和事实3这些事','好']);
 const ops=[{op:'add',kind:'about',text:'最近有点抑郁'},{op:'add',kind:'about',text:'住在阳光小区'},{op:'add',kind:'about',text:'电话13812345678'},{op:'mention',id:'nope'},{op:'add',kind:'secret',text:'x'},{op:'add',kind:'about',text:''},
  ...Array.from({length:8},(_,i)=>({op:'add',kind:'about',text:'事实'+i}))];
 const r=await consolidate(store,model({ops}).provider,now,signal);
 assert.deepEqual(r.changes.map(c=>c.text),['事实0','事实1','事实2','事实3']);
});
test('R3：删掉之后只聊别的，模型硬要加回旧兴趣也不行（要有“重新聊起”的证据）', async()=>{
 const{clock,store,now}=setup();
 chat(store,['我喜欢打篮球','好']);
 const id=store.insert({kind:'interest',text:'喜欢打篮球',source:'chat',editedByStudent:false});
 clock.advance(HOUR);store.studentEdit({action:'delete',id});
 clock.advance(HOUR);chat(store,['今天的数学题怎么做','先看看题目']);
 const r=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'}]}).provider,now,signal);
 assert.deepEqual([r.status,r.changes.length],['ok',0]);
 assert.deepEqual(store.profile().items,[]);
});
test('R5：身体健康换说法也进不了档案；条目干净但原话带健康内容，一样拦下', async()=>{
 const{store,now}=setup();
 chat(store,['我有哮喘，跑步老是喘不上气','听起来不容易'],['对了我在看《三体》','好看吗？']);
 const ops={ops:[{op:'add',kind:'about',text:'有哮喘'},{op:'add',kind:'about',text:'跑步喘不上气'},{op:'add',kind:'interest',text:'在看三体'}]};
 const r=await consolidate(store,model(ops).provider,now,signal);
 assert.deepEqual(r.changes.map(c=>c.text),['在看三体']);
});
test('R5/R3：没有学生原话做证据的 add/update/mention 都不生效（只记学生自己明确说过的）', async()=>{
 const{store,now}=setup();
 chat(store,['我在看《三体》','好看吗']);
 const id=store.insert({kind:'interest',text:'下棋',source:'chat',editedByStudent:false});
 const ops={ops:[{op:'add',kind:'about',text:'养了一只猫'},{op:'update',id,text:'最近在学游泳'},{op:'mention',id}]};
 const r=await consolidate(store,model(ops).provider,now,signal);
 assert.deepEqual(r.changes,[]);
 assert.equal(store.item(id)!.text,'下棋');
});
test('R1：整理等模型的时候重置演示，回来的结果作废——不写档案、不记 run', async()=>{
 const{store,now}=setup();chat(store,['我喜欢打篮球','好']);
 let release!:()=>void;
 const provider:ModelProvider={kind:'synthetic',supportsTools:false,async complete(){await new Promise<void>(r=>release=r);return{content:JSON.stringify({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'}]}),toolCalls:[]};}};
 const running=consolidate(store,provider,now,signal);
 store.reset();release();
 assert.deepEqual(await running,{status:'stale',changes:[]});
 assert.deepEqual(store.profile().items,[]);
 assert.equal(store.digest(),null);
});
test('R2：整理等模型的时候动了自动记忆开关（关掉、或关了又开），结果作废，对话留到下次', async()=>{
 const{store,now}=setup();chat(store,['我喜欢打篮球','好']);
 let release!:()=>void;
 const hold:ModelProvider={kind:'synthetic',supportsTools:false,async complete(){await new Promise<void>(r=>release=r);return{content:JSON.stringify({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'}]}),toolCalls:[]};}};
 // 关掉
 let running=consolidate(store,hold,now,signal);
 store.setAutoRemember(false);release();
 assert.deepEqual(await running,{status:'stale',changes:[]});
 assert.deepEqual(store.profile().items,[]);
 assert.equal(store.pendingMessages().length,2);
 // 重新打开后再来一次，这次等模型时“关了又马上打开”，同样作废
 store.setAutoRemember(true);
 running=consolidate(store,hold,now,signal);
 store.setAutoRemember(false);store.setAutoRemember(true);release();
 assert.deepEqual(await running,{status:'stale',changes:[]});
 assert.deepEqual(store.profile().items,[]);
 // 之后一次正常整理，把留下的对话处理掉
 const ok=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'}]}).provider,now,signal);
 assert.deepEqual(ok.changes.map(c=>c.op),['add']);
});
test('解析：能剥掉 ```json 包装；整段不是 JSON 返回 null', ()=>{
 assert.deepEqual(parseOps('好的：\n```json\n{"ops":[{"op":"past","id":"a"}]}\n```'),[{op:'past',id:'a'}]);
 assert.equal(parseOps('没有可记的'),null);assert.equal(parseOps('{"items":[]}'),null);
 assert.ok(similar('喜欢打篮球','打篮球！'));assert.ok(!similar('画画','打篮球'));assert.ok(!similar('a','ab'));
});
test('模型回的看不懂：记一次失败，消息留着下次再整理；连续 3 次就跳过这批', async()=>{
 const{store,now}=setup();chat(store,['我喜欢下棋','好']);
 for(let i=0;i<2;i++)assert.equal((await consolidate(store,model('乱码').provider,now,signal)).status,'failed');
 assert.equal(store.pendingMessages().length,2);
 assert.equal((await consolidate(store,model('乱码').provider,now,signal)).status,'skipped');
 assert.equal(store.pendingMessages().length,0);
 // 成功一次后重新计数
 chat(store,['还喜欢围棋','好']);
 assert.equal((await consolidate(store,model('乱码').provider,now,signal)).status,'failed');
 assert.equal(store.consecutiveFailures(),1);
});
test('模型调用失败（限流等）直接抛出，不算失败、不记结果', async()=>{
 const{store,now}=setup();chat(store,['我喜欢下棋','好']);
 await assert.rejects(consolidate(store,model(new Error('429')).provider,now,signal),/429/);
 assert.equal(store.pendingMessages().length,2);assert.equal(store.consecutiveFailures(),0);
});
test('什么时候整理：空闲够久或者跨天；开关关掉时不整理，关着时说的话也不会补记', ()=>{
 const{clock,store}=setup();const idle=3*HOUR;
 assert.equal(shouldConsolidate(store,clock.now(),idle),false);
 chat(store,['在吗','在']);
 assert.equal(shouldConsolidate(store,clock.now(),idle),false);
 clock.advance(3*HOUR);assert.equal(shouldConsolidate(store,clock.now(),idle),true);
 clock.set('2026-10-29T15:30:00.000Z');chat(store,['晚安','晚安']);   // 上海 23:30
 clock.set('2026-10-29T16:10:00.000Z');assert.equal(shouldConsolidate(store,clock.now(),idle),true); // 已经是上海第二天
 store.setAutoRemember(false);assert.equal(shouldConsolidate(store,clock.now(),idle),false);
 const before=store.pendingMessages().length;chat(store,['关着开关说的话','好']);
 assert.equal(store.pendingMessages().length,before);
});
test('整理过的原始对话 30 天后删掉，没整理的留着', async()=>{
 const{clock,store,now}=setup();chat(store,['旧的话','旧的回复']);
 await consolidate(store,model({ops:[]}).provider,now,signal);
 chat(store,['新的话','新的回复']);
 clock.advance(30*DAY);store.profile();
 assert.deepEqual(store.history().messages.map(m=>m.content),['新的话','新的回复']);
});
test('XIAON_FC_IDLE_MIN', ()=>{
 assert.equal(idleMsFromEnv({}),3*HOUR);assert.equal(idleMsFromEnv({XIAON_FC_IDLE_MIN:'0'}),0);
 assert.throws(()=>idleMsFromEnv({XIAON_FC_IDLE_MIN:'abc'}),/XIAON_FC_IDLE_MIN/);
});

test('完整原话证据：不能用通用的“喜欢”编造兴趣或恢复已删除兴趣', async()=>{
 const{clock,store,now}=setup();
 chat(store,['我喜欢打篮球','好呀']);
 let r=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢养猫'}]}).provider,now,signal);
 assert.deepEqual(r.changes,[]);
 const id=store.insert({kind:'interest',text:'喜欢打篮球',source:'chat',editedByStudent:false});
 clock.advance(HOUR);store.studentEdit({action:'delete',id});
 clock.advance(HOUR);chat(store,['我喜欢看三体','好呀']);
 r=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'}]}).provider,now,signal);
 assert.deepEqual(r.changes,[]);assert.deepEqual(store.profile().items,[]);
 clock.advance(HOUR);chat(store,['我不喜欢打篮球了','知道了']);
 r=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢打篮球'}]}).provider,now,signal);
 assert.deepEqual(r.changes,[]);
});
test('更新和提到也检查证据原话的敏感类别', async()=>{
 const{store,now}=setup();
 const id=store.insert({kind:'about',text:'跑步喘不上气',source:'chat',editedByStudent:false});
 const other=store.insert({kind:'about',text:'爱跑步',source:'chat',editedByStudent:false});
 chat(store,['我有哮喘，跑步老是喘不上气','听起来不容易']);
 const r=await consolidate(store,model({ops:[{op:'update',id:other,text:'跑步喘不上气'},{op:'mention',id}]}).provider,now,signal);
 assert.deepEqual(r.changes,[]);assert.equal(store.item(other)!.text,'爱跑步');assert.equal(store.item(id)!.mentionCount,1);
});

test('不删除内容词来凑证据：喜欢人文不能证明喜欢超人；同义改写暂不自动记',async()=>{
 const{store,now}=setup();chat(store,['我喜欢人文','好呀'],['今天画了一幅画','不错']);
 const r=await consolidate(store,model({ops:[{op:'add',kind:'interest',text:'喜欢超人'},{op:'add',kind:'interest',text:'画画'}]}).provider,now,signal);
 assert.deepEqual(r.changes,[]);
});
