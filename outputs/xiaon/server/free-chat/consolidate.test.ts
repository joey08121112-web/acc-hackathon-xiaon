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
 const{store,now}=setup();chat(store,['我最近超喜欢打篮球','哇，打什么位置？'],['下周还有比赛','加油！']);
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
 chat(store,['今天画了一幅画','真棒']);
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
 const{store,now}=setup();chat(store,['随便聊聊','好']);
 const ops=[{op:'add',kind:'about',text:'最近有点抑郁'},{op:'add',kind:'about',text:'住在阳光小区'},{op:'add',kind:'about',text:'电话13812345678'},{op:'mention',id:'nope'},{op:'add',kind:'secret',text:'x'},{op:'add',kind:'about',text:''},
  ...Array.from({length:8},(_,i)=>({op:'add',kind:'about',text:'事实'+i}))];
 const r=await consolidate(store,model({ops}).provider,now,signal);
 assert.deepEqual(r.changes.map(c=>c.text),['事实0','事实1','事实2','事实3']);
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
