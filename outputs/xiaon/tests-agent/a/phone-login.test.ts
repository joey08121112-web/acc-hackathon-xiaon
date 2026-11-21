import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHttpServer } from '../../server/http/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { UserRuntimes } from '../../server/storage/users';
import { SyntheticProvider } from '../../server/providers/synthetic';
import { freePort } from '../../server/storage/testing';

// 手机号+密码登录：没注册的先注册，注册过的登录；不登录拿不到会话；换设备登录是同一份记录。
test('phone login: register, log in from another device, log out, lockout and adopting the anonymous record',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'xiaon-login-test-'));const provider=new SyntheticProvider();
 const users=new UserRuntimes({directory,provider,learning:true,create:path=>{const r=createRuntime({databasePath:path,provider});installLearning(r,{timeoutMs:2000});return r;}});
 const servers:ReturnType<typeof createHttpServer>[]=[];
 const start=async(requireLogin:boolean)=>{const port=await freePort(),origin=`http://127.0.0.1:${port}`,server=createHttpServer(users,{allowedOrigins:[origin],host:`127.0.0.1:${port}`,requireLogin});servers.push(server);await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));return origin;};
 const cookiesOf=(res:Response)=>res.headers.getSetCookie().map(c=>c.split(';')[0]);
 try{
  // Before the upgrade: an anonymous visitor with a memory.
  const anonymousOrigin=await start(false);
  const anon=await fetch(anonymousOrigin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:anonymousOrigin},body:'{}'});
  const anonCookies=cookiesOf(anon),anonUser=anonCookies.find(c=>c.startsWith('xiaon_user='))!,anonCsrf=(await anon.json()).csrfToken;
  const anonPost=(path:string,body:unknown)=>fetch(anonymousOrigin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:anonymousOrigin,Cookie:anonCookies.join('; '),'X-Xiaon-CSRF':anonCsrf},body:JSON.stringify(body)});
  assert.equal((await anonPost('/api/consent',{operationId:'consent-on',optionalMemory:true})).status,200);
  assert.equal((await anonPost('/api/memories',{operationId:'memory-1',text:'注册前说过喜欢篮球',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null})).status,200);

  const origin=await start(true);
  const auth=(path:string,body:unknown,cookie='')=>fetch(origin+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const session=(cookie:string)=>fetch(origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:'{}'});
  const memories=async(login:string)=>{const s=await session(login);assert.equal(s.status,200);const c=cookiesOf(s).find(x=>x.startsWith('xiaon_session='))!;return (await (await fetch(origin+'/api/learning',{headers:{Cookie:c}})).json()).memories.map((m:{text:string})=>m.text) as string[];};

  assert.deepEqual(await (await auth('status',{})).json(),{required:true,phone:null});
  assert.equal((await session('')).status,403);
  assert.equal((await session(anonUser)).status,403,'an anonymous identity alone no longer opens a session');
  assert.equal((await auth('check',{phone:'12345'})).status,400);
  assert.deepEqual(await (await auth('check',{phone:'13800138000'})).json(),{registered:false});
  // 2026-11-21：未注册与密码错误现在完全一样——同样的错误码（403）、同样的文案、同样量级的耗时。
  // 之前是 404 + 「这个手机号还没注册」，光看状态码就能枚举出哪些手机号有账号。
  const unregistered=await auth('login',{phone:'13800138000',password:'abc12345'});
  assert.equal(unregistered.status,403);
  assert.deepEqual(await unregistered.json(),{schemaVersion:'1.0.0',ok:false,error:{code:'forbidden',message:'手机号或密码不对',recoverable:true}});
  assert.equal((await auth('register',{phone:'13800138000',password:'12345'})).status,400);
  assert.equal((await auth('register',{phone:'13800138000',password:'abc 12345'})).status,400);

  // Registering in the browser that already had an anonymous record keeps that record.
  const registered=await auth('register',{phone:'13800138000',password:'abc12345'},anonUser);assert.equal(registered.status,200);
  assert.deepEqual(await registered.json(),{phone:'138****8000'});
  const phoneLogin=cookiesOf(registered).find(c=>c.startsWith('xiaon_login='))!;
  assert.deepEqual(await (await auth('status',{},phoneLogin)).json(),{required:true,phone:'138****8000'});
  assert.deepEqual(await memories(phoneLogin),['注册前说过喜欢篮球']);
  assert.deepEqual(await (await auth('check',{phone:'13800138000'})).json(),{registered:true});
  assert.equal((await auth('register',{phone:'13800138000',password:'other123'})).status,409);

  // Another device: wrong password, then the right one reaches the same record.
  assert.equal((await auth('login',{phone:'13800138000',password:'wrong123'})).status,403);
  const second=await auth('login',{phone:'13800138000',password:'abc12345'});assert.equal(second.status,200);
  const secondLogin=cookiesOf(second).find(c=>c.startsWith('xiaon_login='))!;assert.notEqual(secondLogin,phoneLogin);
  assert.deepEqual(await memories(secondLogin),['注册前说过喜欢篮球']);

  // A second account registered without an anonymous record starts empty.
  const other=await auth('register',{phone:'13900139000',password:'pass6789'});assert.equal(other.status,200);
  assert.deepEqual(await memories(cookiesOf(other).find(c=>c.startsWith('xiaon_login='))!),[]);

  // Logging out ends only that device's login.
  assert.equal((await auth('logout',{},secondLogin)).status,200);
  assert.equal((await session(secondLogin)).status,403);
  assert.equal((await session(phoneLogin)).status,200);

  // Five wrong passwords lock the number for a while, even for the right password.
  for(let i=0;i<5;i++)assert.equal((await auth('login',{phone:'13900139000',password:'nope'+i+'xx'})).status,403);
  assert.equal((await auth('login',{phone:'13900139000',password:'pass6789'})).status,503);

  // Passwords are stored only as salted hashes.
  const db=new DatabaseSync(join(directory,'identities.sqlite'));
  const stored=db.prepare('SELECT password_hash FROM accounts').all() as {password_hash:string}[];db.close();
  assert.equal(stored.length,2);for(const s of stored){assert.match(s.password_hash,/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);assert.ok(!s.password_hash.includes('abc12345'));}
 }finally{
  for(const s of servers)await new Promise<void>(r=>s.close(()=>r()));users.close();rmSync(directory,{recursive:true,force:true});
 }
});

// 2026-11-21：令牌有到期时间、能改密、能吊销其他设备。此前令牌没有服务端有效期，也没有改密入口，
// 家长没法让泄露的登录失效。
test('token expiry, password change and revoking other devices',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'xiaon-login-ttl-'));
 const provider=new SyntheticProvider();
 const users=new UserRuntimes({directory,provider,learning:true,create:path=>createRuntime({databasePath:path,provider})});
 const port=await freePort(),origin=`http://127.0.0.1:${port}`,server=createHttpServer(users,{allowedOrigins:[origin],host:`127.0.0.1:${port}`,requireLogin:true});
 await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
 const cookiesOf=(res:Response)=>res.headers.getSetCookie().map(c=>c.split(';')[0]);
 const auth=(path:string,body:unknown,cookie='')=>fetch(origin+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const session=(cookie:string)=>fetch(origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:'{}'});
 try{
  const registered=await auth('register',{phone:'13800138000',password:'abc12345'});
  const first=cookiesOf(registered).find(c=>c.startsWith('xiaon_login='))!;
  const second=await auth('login',{phone:'13800138000',password:'abc12345'});
  const secondLogin=cookiesOf(second).find(c=>c.startsWith('xiaon_login='))!;
  assert.equal((await session(first)).status,200);
  assert.equal((await session(secondLogin)).status,200);

  // 退出其他设备：当前设备留着，另一个立刻失效。
  const revoked=await auth('logout-all',{},first);
  assert.equal(revoked.status,200);
  assert.deepEqual(await revoked.json(),{ok:true,revoked:1});
  assert.equal((await session(first)).status,200,'当前设备不受影响');
  assert.equal((await session(secondLogin)).status,403,'别的设备被踢掉');

  // 改密：原密码不对就拒绝。
  assert.equal((await auth('password',{oldPassword:'wrong123',newPassword:'newpass1'},first)).status,403);
  // 改密成功：当前设备拿到新令牌，这个手机号的其它令牌全部作废。
  const changed=await auth('password',{oldPassword:'abc12345',newPassword:'newpass1'},first);
  assert.equal(changed.status,200);
  assert.deepEqual(await changed.json(),{ok:true,phone:'138****8000'});
  const newLogin=cookiesOf(changed).find(c=>c.startsWith('xiaon_login='))!;
  assert.equal((await session(newLogin)).status,200);
  assert.equal((await session(first)).status,403,'改密后旧令牌失效');
  assert.equal((await auth('login',{phone:'13800138000',password:'abc12345'})).status,403,'旧密码不能再登录');
  assert.equal((await auth('login',{phone:'13800138000',password:'newpass1'})).status,200,'新密码可以登录');

  // 令牌到期：expires_at 过了，服务端就不认了（客户端还带着 cookie 也不行）。
  const db=new DatabaseSync(join(directory,'identities.sqlite'));
  db.prepare('UPDATE logins SET expires_at=?').run(new Date(Date.now()-1000).toISOString());
  db.close();
  assert.equal((await session(newLogin)).status,403,'到期的令牌不再有效');
 }finally{await new Promise<void>(r=>server.close(()=>r()));users.close();rmSync(directory,{recursive:true,force:true});}
});

test('without requireLogin the auth routes stay closed and anonymous sessions work as before',async()=>{ const directory=mkdtempSync(join(tmpdir(),'xiaon-login-off-'));const provider=new SyntheticProvider();
 const users=new UserRuntimes({directory,provider,learning:true,create:path=>createRuntime({databasePath:path,provider})});
 const port=await freePort(),origin=`http://127.0.0.1:${port}`,server=createHttpServer(users,{allowedOrigins:[origin],host:`127.0.0.1:${port}`});
 await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
 const post=(path:string,body:unknown)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 try{
  assert.deepEqual(await (await post('/api/auth/status',{})).json(),{required:false,phone:null});
  assert.equal((await post('/api/auth/register',{phone:'13800138000',password:'abc12345'})).status,404);
  assert.equal((await post('/api/local-session',{})).status,200);
 }finally{await new Promise<void>(r=>server.close(()=>r()));users.close();rmSync(directory,{recursive:true,force:true});}
});
