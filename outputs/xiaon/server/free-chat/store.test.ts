import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TestClock } from '../core/clock';
import { FreeChatStore } from './store';
import { profilePost } from './profile';
const DAY=86400000;
const setup=()=>{const clock=new TestClock('2026-10-29T00:00:00.000Z');return{clock,store:new FreeChatStore(':memory:',clock)};};
test('学生加的条目马上出现在档案里，并标为自己加的', ()=>{
 const{store}=setup();
 const p=profilePost(store,'/api/free-chat/profile/item',{action:'add',kind:'interest',text:' 打篮球 '})!;
 assert.equal(p.items.length,1);
 assert.deepEqual([p.items[0].text,p.items[0].source,p.items[0].status,p.items[0].editedByStudent,p.items[0].expiresAt],['打篮球','student','active',true,null]);
});
test('近况默认 14 天后自动删除', ()=>{
 const{clock,store}=setup();
 store.studentEdit({action:'add',kind:'recent',text:'下周有篮球赛'});
 assert.equal(store.profile().items[0].expiresAt,'2026-11-12T00:00:00.000Z');
 clock.advance(13*DAY);assert.equal(store.profile().items.length,1);
 clock.advance(DAY);assert.equal(store.profile().items.length,0);
});
test('聊天里记下的兴趣 60 天没提到就变成以前喜欢，学生加的不会', ()=>{
 const{clock,store}=setup();
 store.insert({kind:'interest',text:'打篮球',source:'chat',editedByStudent:false});
 store.studentEdit({action:'add',kind:'interest',text:'画画'});
 clock.advance(59*DAY);assert.deepEqual(store.profile().items.map(i=>i.status),['active','active']);
 clock.advance(DAY);
 const byText=Object.fromEntries(store.profile().items.map(i=>[i.text,i.status]));
 assert.deepEqual(byText,{打篮球:'past',画画:'active'});
});
test('改、切换状态、删除；删掉的进 forgotten 并在 90 天后清掉', ()=>{
 const{clock,store}=setup();
 const id=store.insert({kind:'interest',text:'打篮球',source:'chat',editedByStudent:false});
 store.studentEdit({action:'update',id,text:'打篮球（校队）'});
 store.studentEdit({action:'status',id,status:'past'});
 let item=store.profile().items[0];
 assert.deepEqual([item.text,item.status,item.editedByStudent],['打篮球（校队）','past',true]);
 store.studentEdit({action:'delete',id});
 assert.equal(store.profile().items.length,0);
 assert.deepEqual(store.forgotten().map(f=>f.text),['打篮球（校队）']);
 clock.advance(90*DAY);store.profile();assert.equal(store.forgotten().length,0);
 assert.throws(()=>store.studentEdit({action:'delete',id}),/不在/);
});
test('基本信息、开关和重置', ()=>{
 const{store}=setup();
 assert.equal(store.profile().autoRemember,true);
 profilePost(store,'/api/free-chat/profile/basic',{nickname:'小明',grade:'七年级'});
 const p=profilePost(store,'/api/free-chat/settings',{autoRemember:false})!;
 assert.deepEqual([p.basic,p.autoRemember],[{nickname:'小明',grade:'七年级'},false]);
 store.studentEdit({action:'add',kind:'method',text:'画个图'});
 store.reset();
 const r=store.profile();assert.deepEqual([r.basic,r.items.length,r.autoRemember],[{nickname:'',grade:''},0,true]);
});
test('请求格式不对、一类条目太多都会被拒绝', ()=>{
 const{store}=setup();
 assert.throws(()=>profilePost(store,'/api/free-chat/profile/item',{action:'add',kind:'secret',text:'x'}),/格式/);
 assert.throws(()=>profilePost(store,'/api/free-chat/profile/item',{action:'add',kind:'about',text:'   '}),/格式/);
 assert.throws(()=>profilePost(store,'/api/free-chat/profile/item',{action:'add',kind:'about',text:'x'.repeat(61)}),/格式/);
 for(let i=0;i<30;i++)store.studentEdit({action:'add',kind:'about',text:'第'+i+'条'});
 assert.throws(()=>store.studentEdit({action:'add',kind:'about',text:'再一条'}),/很多条/);
 assert.equal(profilePost(store,'/api/free-chat/nope',{}),undefined);
});
