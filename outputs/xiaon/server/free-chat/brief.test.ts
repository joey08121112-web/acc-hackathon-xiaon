import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelMessage, ModelProvider } from '../../shared/learning-contracts';
import { TestClock } from '../core/clock';
import { FreeChatStore } from './store';
import { FREE_CHAT_PROMPT, freeChat } from './chat';
import { BRIEF_MAX, profileBrief } from './brief';
const setup=()=>{const clock=new TestClock('2026-10-29T00:00:00.000Z');return{clock,store:new FreeChatStore(':memory:',clock)};};
test('档案是空的就不附摘要', ()=>{
 const{store}=setup();assert.equal(profileBrief(store.profile()),'');
});
test('摘要带上称呼、年级和在玩的兴趣，不带以前喜欢的；近况带上记下的日期', ()=>{
 const{clock,store}=setup();
 store.setBasic('小明','七年级');
 store.studentEdit({action:'add',kind:'interest',text:'打篮球'});
 const old=store.insert({kind:'interest',text:'跳绳',source:'chat',editedByStudent:false});
 store.studentEdit({action:'status',id:old,status:'past'});
 clock.advance(3600000);store.studentEdit({action:'add',kind:'recent',text:'下周有篮球赛'});
 store.studentEdit({action:'add',kind:'method',text:'画个图就懂了'});
 const brief=profileBrief(store.profile());
 assert.match(brief,/可以叫他“小明”，读七年级/);
 assert.match(brief,/最近喜欢：打篮球\n/);
 assert.match(brief,/最近的事：下周有篮球赛（10月29日记下的）/);
 assert.match(brief,/对他有用的学习方法：画个图就懂了/);
 assert.doesNotMatch(brief,/跳绳/);
});
test('每类有上限，最近提到的优先；总长度不超过上限', ()=>{
 const{clock,store}=setup();
 for(let i=0;i<10;i++){store.studentEdit({action:'add',kind:'interest',text:'兴趣'+i});clock.advance(1000);}
 const brief=profileBrief(store.profile());
 assert.match(brief,/最近喜欢：兴趣9；兴趣8；兴趣7；兴趣6；兴趣5；兴趣4\n/);
 for(const kind of ['about','recent','method'] as const)for(let i=0;i<30;i++)store.studentEdit({action:'add',kind,text:kind+'很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长'+i});
 const long=profileBrief(store.profile());
 const body=long.split('\n\n')[0].split('\n').slice(1).join('\n');
 assert.ok(body.length<=BRIEF_MAX,`摘要 ${body.length} 字`);
 assert.match(long,/最近喜欢：兴趣9/);
});
test('自由聊把摘要附在提示词后面', async()=>{
 const{store}=setup();store.studentEdit({action:'add',kind:'interest',text:'打篮球'});
 const calls:ModelMessage[][]=[];
 const provider:ModelProvider={kind:'synthetic',supportsTools:false,async complete({messages}){calls.push(messages);return{content:'好呀',toolCalls:[]};}};
 await freeChat(store,provider,{text:'在吗'},new AbortController().signal);
 const system=calls[0][0].content;
 assert.ok(system.startsWith(FREE_CHAT_PROMPT+'\n\n关于这个同学'));
 assert.match(system,/最近喜欢：打篮球/);
});
