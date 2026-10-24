import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readdirSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttpServer } from '../../server/http/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { UserRuntimes } from '../../server/storage/users';
import { SyntheticProvider } from '../../server/providers/synthetic';
import { freePort } from '../../server/storage/testing';

// Reproduces the 2026-10-24 review probe (two cookies read each other's memory; one reset cleared everyone) and checks it no longer holds.
test('anonymous identities get separate databases: no cross-user reads, writes, receipts or reset',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'xiaon-users-test-'));const provider=new SyntheticProvider();
 const pool=(maxUsers=3)=>new UserRuntimes({directory,provider,learning:true,maxUsers,create:path=>{const r=createRuntime({databasePath:path,provider});installLearning(r,{timeoutMs:2000});return r;}});
 let origin='',users=pool(),server=createHttpServer(users,{allowedOrigins:[],host:''});
 const start=async()=>{const port=await freePort();origin=`http://127.0.0.1:${port}`;server=createHttpServer(users,{allowedOrigins:[origin],host:`127.0.0.1:${port}`});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));};
 await start();
 const stop=async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));users.close();};
 type Client={Cookie:string;'X-Xiaon-CSRF':string;user:string};
 const login=async(user?:string):Promise<Client>=>{
  const res=await fetch(origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(user?{Cookie:user}:{})},body:'{}'});
  assert.equal(res.status,200);const set=res.headers.getSetCookie().map(c=>c.split(';')[0]);
  const session=set.find(c=>c.startsWith('xiaon_session='))!;const issued=set.find(c=>c.startsWith('xiaon_user='));
  const u=issued??user!;return{Cookie:`${session}; ${u}`,'X-Xiaon-CSRF':(await res.json()).csrfToken,user:u};
 };
 const post=(path:string,body:unknown,c:Client)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:c.Cookie,'X-Xiaon-CSRF':c['X-Xiaon-CSRF']},body:JSON.stringify(body)});
 const memories=async(c:Client)=>(await (await fetch(origin+'/api/learning',{headers:{Cookie:c.Cookie}})).json()).memories.map((m:{text:string})=>m.text) as string[];
 const remember=(c:Client,operationId:string,text:string)=>post('/api/memories',{operationId,text,source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null},c);
 try{
  const a=await login(),b=await login();assert.notEqual(a.user,b.user);
  for(const c of[a,b])assert.equal((await post('/api/consent',{operationId:'consent-on',optionalMemory:true},c)).status,200);
  assert.equal((await remember(a,'memory-1','合成用户甲喜欢篮球')).status,200);
  assert.deepEqual(await memories(a),['合成用户甲喜欢篮球']);
  assert.deepEqual(await memories(b),[]);
  // Same operationId with a different payload is not a cross-user conflict: receipts live in each user's own database.
  assert.equal((await remember(b,'memory-1','合成用户乙喜欢画画')).status,200);
  assert.deepEqual(await memories(b),['合成用户乙喜欢画画']);
  assert.equal(readdirSync(directory).filter(n=>/^[0-9a-f]{32}\.sqlite$/.test(n)).length,2);
  // B's reset clears only B.
  const reset=await post('/api/learning/reset',{operationId:'reset-b',confirmation:'清除本机学习记录与偏好'},b);assert.equal(reset.status,200);
  assert.deepEqual(await memories(b),[]);assert.deepEqual(await memories(a),['合成用户甲喜欢篮球']);
  // A new session with A's identity cookie is still A; a forged identity cookie is a new, empty user.
  assert.deepEqual(await memories(await login(a.user)),['合成用户甲喜欢篮球']);
  const forged=await login('xiaon_user='+'0'.repeat(64));assert.notEqual(forged.user,a.user);assert.deepEqual(await memories(forged),[]);
  // A session cookie alone (no CSRF) still cannot write, and identities are capped.
  assert.equal((await fetch(origin+'/api/memories',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:a.Cookie},body:'{}'})).status,403);
  assert.equal((await fetch(origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{}'})).status,503);
  // After a restart (fresh port, so no pooled socket is reused) the same identity cookie reaches the same data.
  await stop();users=pool();await start();
  assert.deepEqual(await memories(await login(a.user)),['合成用户甲喜欢篮球']);
 }finally{await stop();rmSync(directory,{recursive:true,force:true});}
});
