import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelProvider } from '../../shared/learning-contracts';
import type { DigestResponse, Profile } from '../../shared/free-chat';
import { createRuntime } from '../bootstrap';
import { createHttpServer } from '../http/server';
import { freePort, temporaryRepository, TestClock } from '../storage/testing';
import { CONSOLIDATE_PROMPT } from './consolidate';
/** 整理请求回固定的操作，其余回一句普通的话；consolidation 计数整理被调用了几次。 */
function provider(){
 const state={consolidations:0};
 const p:ModelProvider={kind:'synthetic',supportsTools:false,async complete({messages}){
  if(messages[0].content===CONSOLIDATE_PROMPT){state.consolidations++;return{content:JSON.stringify({ops:[{op:'add',kind:'about',text:'养了一只橘猫'}]}),toolCalls:[]};}
  return{content:'哇，叫什么名字？',toolCalls:[]};
 }};
 return{p,state};
}
async function serve(freeChatIdleMs:number){
 const clock=new TestClock('2026-10-29T02:00:00.000Z'),f=temporaryRepository(clock),{p,state}=provider(),r=createRuntime({...f,provider:p});
 const port=await freePort(),origin='http://127.0.0.1:5299',base=`http://127.0.0.1:${port}`;
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin],freeChatIdleMs});
 await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
 const get=async<T>(path:string)=>(await (await fetch(base+path,{headers:{Cookie:cookie}})).json()) as T;
 const post=async<T>(path:string,body:unknown)=>{const res=await fetch(base+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:res.status,body:(await res.json()) as T};};
 const close=async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));r.freeChat.close();f.dispose();};
 return{clock,r,state,get,post,close};
}
const until=async(check:()=>Promise<boolean>)=>{for(let i=0;i<50;i++){if(await check())return;await new Promise(r=>setTimeout(r,20));}assert.fail('等待超时');};
test('空闲够久后，打开自由聊会在后台整理，整理完 digest 里能看到；看过就收起', async()=>{
 const s=await serve(0);
 try{
  assert.equal((await s.post('/api/free-chat',{text:'我养了一只橘猫'})).status,200);
  const first=await s.get<DigestResponse>('/api/free-chat/digest');
  assert.equal(first.digest,null);
  await until(async()=>(await s.get<DigestResponse>('/api/free-chat/digest')).digest!==null);
  const{digest,consolidating}=await s.get<DigestResponse>('/api/free-chat/digest');
  assert.equal(consolidating,false);assert.deepEqual(digest!.changes.map(c=>c.op+':'+c.text),['add:养了一只橘猫']);
  assert.equal(s.state.consolidations,1,'没有新对话就不再整理');
  const seen=await s.post<DigestResponse>('/api/free-chat/digest/seen',{runId:digest!.runId});
  assert.equal(seen.body.digest,null);
 }finally{await s.close();}
});
test('还没空闲够久不整理；「现在整理」不等空闲；重置清空整理结果', async()=>{
 const s=await serve(3*3600000);
 try{
  await s.post('/api/free-chat',{text:'我养了一只橘猫'});
  await s.get('/api/free-chat/profile');await s.get('/api/free-chat/digest');
  await new Promise(r=>setTimeout(r,50));assert.equal(s.state.consolidations,0);
  const now=await s.post<{status:string;profile:Profile}>('/api/free-chat/consolidate',{});
  assert.equal(now.body.status,'ok');assert.deepEqual(now.body.profile.items.map(i=>i.text),['养了一只橘猫']);
  assert.equal((await s.post('/api/free-chat/consolidate',{x:1})).status,400);
  assert.equal((await s.post('/api/free-chat/digest/seen',{runId:'../x'})).status,400);
  s.r.freeChat.reset();assert.equal(s.r.freeChat.digest(),null);
 }finally{await s.close();}
});
