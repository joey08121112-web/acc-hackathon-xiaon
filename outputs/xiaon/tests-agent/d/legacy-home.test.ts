import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,freePort } from '../../server/storage/testing';
import { LEGACY_HOME_DISABLED_MESSAGE } from '../../shared/legacy-home';
import { apiRequest } from '../../src/agent-client';

test('旧客户端聊天入口在发出网络请求前即被拒绝',async()=>{
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('不应联网');};
 try{
  for(const path of ['chat','learning/chat','learning/greeting','learning/conversation/end'])await assert.rejects(apiRequest(path,{}),{message:LEGACY_HOME_DISABLED_MESSAGE});
  assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});

test('旧小N HTTP 入口无论是否安装学习模块都不能调用模型或改记录，自由聊仍可用',async()=>{
 for(const learning of [false,true]){
  const f=temporaryRepository();let modelCalls=0;
  const r=createRuntime({...f,provider:{kind:'synthetic',supportsTools:true,async complete(){modelCalls++;return{content:'自由聊仍在。',toolCalls:[]};}}});
  if(learning)installLearning(r);
  const port=await freePort(),base=`http://127.0.0.1:${port}`,origin='http://127.0.0.1:5199';
  const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
  try{
   const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
   const csrf=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
   const post=(path:string,body:unknown,token=csrf)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
   assert.equal((await post('learning/chat',{},'wrong')).status,403,'停用入口仍保留会话防护');
   const revision=r.repository.revision();
   for(const path of ['chat','learning/chat','learning/greeting','learning/conversation/end','learning/loop','learning/recognize','learning/problem/confirm','learning/progress-card/confirm','learning/memory/confirm-draft']){
    const response=await post(path,{operationId:crypto.randomUUID(),history:[{role:'user',content:'旧入口不能再回复'}]});
    assert.equal(response.status,409,path);const json=await response.json();assert.equal(json.error.code,'invalid_state');assert.equal(json.error.message,LEGACY_HOME_DISABLED_MESSAGE);
   }
   assert.equal(modelCalls,0);assert.equal(r.repository.revision(),revision);assert.equal(r.repository.list('runs').length,0);
   const reply=await post('free-chat',{text:'新首页聊天'});assert.equal(reply.status,200);assert.equal((await reply.json()).reply.content,'自由聊仍在。');assert.equal(modelCalls,1);
   assert.equal((await post('free-chat/profile/item',{action:'add',kind:'interest',text:'画画'})).status,200);
   assert.equal((await fetch(base+'/api/free-chat/history',{headers:{Cookie:cookie}})).status,200);
   if(learning){assert.equal((await post('learning/start',{operationId:crypto.randomUUID(),mode:'exploration'})).status,200);assert.equal((await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).status,200);}
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));r.freeChat.close();f.dispose();}
 }
});
