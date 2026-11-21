import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttpServer } from '../../server/http/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository } from '../../server/storage/testing';
import { UserRuntimes } from '../../server/storage/users';
import { freePort } from '../../server/storage/testing';
import type { ModelProvider } from '../../shared/learning-contracts';
/** 自由聊要求模型真的回一句话（空回复会被判成 provider_error）。 */
const talkingProvider:ModelProvider={kind:'synthetic',supportsTools:false,async complete(){return{content:'在呢，想聊什么？',toolCalls:[]};}};

// 2026-11-21：会花钱的接口必须有人看住。此前自由聊与学习接口完全没有上限，
// 注册只要手机号 + 自设密码（无验证码），理论上可以直接刷爆模型额度。
test('free-chat and learning are rate limited per user',async()=>{
 const f=temporaryRepository();const runtime=createRuntime({...f,provider:talkingProvider});
 installLearning(runtime);
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const server=createHttpServer(runtime,{allowedOrigins:[origin],host:`127.0.0.1:${port}`});
 await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
 try{
  const login=await fetch(origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{}'});
  const cookie=login.headers.get('set-cookie')!.split(';')[0],csrf=(await login.json()).csrfToken as string;
  const post=(path:string,body:unknown)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':csrf},body:JSON.stringify(body)});
  // 自由聊：前 20 次放行，第 21 次被限流。
  for(let i=0;i<20;i++){
   const res=await post('/api/free-chat',{text:'在吗 '+i});
   assert.equal(res.status,200,`第 ${i+1} 次应当放行`);
  }
  const blocked=await post('/api/free-chat',{text:'第 21 次'});
  assert.equal(blocked.status,429,'超限应当是 429');
  assert.equal((await blocked.json()).error.code,'budget_exhausted');
  // 学习接口另有一套额度（前 60 次放行）。
  for(let i=0;i<60;i++){
   const res=await post('/api/learning/preference',{operationId:'pref-'+i,rest:false,questionInvitePaused:false});
   assert.equal(res.status,200,`学习第 ${i+1} 次应当放行`);
  }
  assert.equal((await post('/api/learning/preference',{operationId:'pref-over',rest:false,questionInvitePaused:false})).status,429);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));f.dispose();}
});

// 手机号「注册过没有」这件事本身会泄露信息（哪些手机号是未成年人的账号）。
// 枚举必须付出代价，所以这条单独限流。
test('the phone-registration check is rate limited per source',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'xiaon-check-limit-'));
 const provider=talkingProvider;
 const users=new UserRuntimes({directory,provider,learning:true,create:path=>createRuntime({databasePath:path,provider})});
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const server=createHttpServer(users,{allowedOrigins:[origin],host:`127.0.0.1:${port}`,requireLogin:true});
 await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
 try{
  const check=(phone:string)=>fetch(origin+'/api/auth/check',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({phone})});
  for(let i=0;i<20;i++)assert.equal((await check('1380000'+String(i).padStart(4,'0'))).status,200,`第 ${i+1} 次应当放行`);
  const blocked=await check('13800009999');
  assert.equal(blocked.status,503,'超限应当被挡下');
  assert.equal((await blocked.json()).error.code,'unavailable');
 }finally{await new Promise<void>(r=>server.close(()=>r()));users.close();rmSync(directory,{recursive:true,force:true});}
});
