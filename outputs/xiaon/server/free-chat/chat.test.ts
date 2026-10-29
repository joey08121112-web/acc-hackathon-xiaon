import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelMessage, ModelProvider } from '../../shared/learning-contracts';
import { TestClock } from '../core/clock';
import { FreeChatStore } from './store';
import { FREE_CHAT_PROMPT, freeChat } from './chat';
/** 记下每次发给模型的消息，按顺序回 replies；回 Error 就抛出。 */
function fakeProvider(replies:(string|Error)[],kind:ModelProvider['kind']='synthetic'){
 const calls:ModelMessage[][]=[];
 const provider:ModelProvider={kind,supportsTools:false,async complete({messages}){calls.push(messages);const next=replies.shift();if(next instanceof Error)throw next;return{content:next??'',toolCalls:[]};}};
 return{provider,calls};
}
const signal=new AbortController().signal;
const setup=()=>new FreeChatStore(':memory:',new TestClock('2026-10-29T00:00:00.000Z'));
test('一问一答存进当前这段对话，下一句带上之前的对话', async()=>{
 const store=setup(),{provider,calls}=fakeProvider(['你觉得呢？','对，就是摩擦力。']);
 const first=await freeChat(store,provider,{text:' 没有摩擦力会怎样 '},signal);
 assert.deepEqual([first.user.content,first.reply.content],['没有摩擦力会怎样','你觉得呢？']);
 await freeChat(store,provider,{text:'会滑倒'},signal);
 assert.deepEqual(calls[1].map(m=>m.role+':'+(m.role==='system'?'':m.content)),['system:','user:没有摩擦力会怎样','assistant:你觉得呢？','user:会滑倒']);
 assert.equal(calls[1][0].content,FREE_CHAT_PROMPT);
 const h=store.history();
 assert.equal(h.threadId,first.threadId);
 assert.deepEqual(h.messages.map(m=>m.content),['没有摩擦力会怎样','你觉得呢？','会滑倒','对，就是摩擦力。']);
});
test('只带最近 20 条给模型', async()=>{
 const store=setup();for(let i=0;i<15;i++)store.appendExchange(store.currentThread(),'问'+i,'答'+i);
 const{provider,calls}=fakeProvider(['好']);await freeChat(store,provider,{text:'最后一句'},signal);
 assert.equal(calls[0].length,1+20+1);assert.equal(calls[0][1].content,'问5');
});
test('模型出错或没回话时什么都不存', async()=>{
 const store=setup(),{provider}=fakeProvider([new Error('boom'),'  ']);
 await assert.rejects(freeChat(store,provider,{text:'在吗'},signal),/boom/);
 await assert.rejects(freeChat(store,provider,{text:'在吗'},signal),/没有回话/);
 assert.deepEqual(store.history(),{threadId:null,messages:[]});
});
test('没连模型、格式不对会被拒绝', async()=>{
 const store=setup();
 await assert.rejects(freeChat(store,fakeProvider([],'offline').provider,{text:'在吗'},signal),/还没有连接模型/);
 for(const bad of [{text:'  '},{text:'x'.repeat(2001)},{messages:[]},{text:'a',extra:1}])await assert.rejects(freeChat(store,fakeProvider(['x']).provider,bad,signal),/需要 \{text\}/);
});
test('重新开始：新的一段不带旧对话；空的一段不会重复新开；等待中重新开始不会串段', async()=>{
 const store=setup();
 const a=store.appendExchange(null,'旧的话','旧的回复');
 const b=store.newThread();assert.notEqual(b.threadId,a.threadId);assert.deepEqual(store.newThread(),b);
 const{provider,calls}=fakeProvider(['新回复']);await freeChat(store,provider,{text:'新的话'},signal);
 assert.equal(calls[0].length,2);
 assert.deepEqual(store.history().messages.map(m=>m.content),['新的话','新回复']);
 // 发问时在 a 段，回复回来前学生已经新开了一段：这一问一答仍记在 a 段
 store.appendExchange(a.threadId,'晚到的问','晚到的答');
 assert.deepEqual(store.history().messages.map(m=>m.content),['新的话','新回复']);
});
test('重置清空对话', ()=>{
 const store=setup();store.appendExchange(null,'问','答');store.reset();
 assert.deepEqual(store.history(),{threadId:null,messages:[]});
});
