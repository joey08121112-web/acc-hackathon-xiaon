import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { createHttpServer } from '../../server/http/server';
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';
import { SyntheticProvider } from '../../server/providers/synthetic';

test('HTTP local session, strict origin/host, CSRF, request validation and native tool chain',async()=>{
 const f=temporaryRepository();const runtime=createRuntime({...f,provider:new SyntheticProvider()});
 const port=Number(process.env.XIAON_A_TEST_PORT??18921);const origin=`http://127.0.0.1:${port}`;
 const server=createHttpServer(runtime,{allowedOrigins:[origin],host:`127.0.0.1:${port}`});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const request=(path:string,body:unknown,extra:Record<string,string>={})=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...extra},body:JSON.stringify(body)});
  assert.equal((await fetch(origin+'/api/health')).status,200);
  assert.equal((await request('/api/local-session',{}, {Origin:'https://evil.invalid'})).status,403);
  const hostileStatus=await new Promise<number>(resolve=>{const req=httpRequest(origin+'/api/local-session',{method:'POST',headers:{Host:'evil.invalid',Origin:origin,'Content-Type':'application/json'}},res=>{res.resume();resolve(res.statusCode!);});req.end('{}');});
  assert.equal(hostileStatus,403);
  const login=await request('/api/local-session',{});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')!.split(';')[0];const token=(await login.json()).csrfToken as string;
  const auth={Cookie:cookie,'X-Xiaon-CSRF':token};
  assert.equal((await request('/api/sessions',{operationId:'s',mode:'support'})).status,403);
  assert.equal((await request('/api/sessions',{operationId:'s',mode:'support'},{Cookie:cookie})).status,403);
  assert.equal((await request('/api/sessions',{operationId:'s',mode:'support',role:'assessor'},auth)).status,400);
  const s=await (await request('/api/sessions',{operationId:'s',mode:'support'},auth)).json();
  await request('/api/exposures',{operationId:'open',sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null},auth);
  const submission={operationId:'a',sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'};
  const a=await request('/api/attempts',submission,auth);assert.equal(a.status,200);
  assert.equal((await request('/api/attempts',{...submission,operationId:'a2',answer:'forged'},auth)).status,400);
  const publicTask=await fetch(origin+'/api/tasks/bracket/1',{headers:{Cookie:cookie}});const t=await publicTask.json();assert.equal('answer'in t,false);assert.equal('rubric'in t,false);
  const chat=await request('/api/chat',{operationId:'chat',history:[{role:'user',content:'合成测试'}]},auth);const reply=await chat.json();assert.equal(reply.run.status,'completed');assert.equal(reply.run.providerKind,'synthetic');
  assert.equal((await request('/api/chat',{operationId:'chat',history:[{role:'user',content:'合成测试'}]},auth)).status,200);
  assert.equal((await request('/api/chat',{operationId:'chat',history:[{role:'user',content:'different'}]},auth)).status,409);
  assert.equal((await request('/api/planning/due',{},auth)).status,501);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));f.dispose();}
});
