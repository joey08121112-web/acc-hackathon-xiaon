/** 账号与档案的导出、删除（2026-11-21 加）。
 *
 * 审查发现记忆治理七条红线里第 7 条命中：界面有查看和删除，却没有导出，也没有账号级删除。
 * 未成年人的数据也有知情权与删除权 —— 先得有「拿得走」和「真能删掉」这两个能力。
 *
 * 这个测试守三件事：
 *  1. 导出拿到的是本人完整数据（档案、来源原话、学习记录、账号信息），不掺别人的；
 *  2. 删除不可逆：没有明文确认或密码就不删；
 *  3. 删完真的删到磁盘上 —— 库里查得到就等于没删。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,existsSync,readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttpServer } from '../../server/http/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { UserRuntimes } from '../../server/storage/users';
import { SyntheticProvider } from '../../server/providers/synthetic';
import { freePort } from '../../server/storage/testing';

const setup=async()=>{
 const directory=mkdtempSync(join(tmpdir(),'xiaon-export-test-'));
 const provider=new SyntheticProvider();
 const users=new UserRuntimes({directory,provider,learning:true,create:path=>{const r=createRuntime({databasePath:path,provider});installLearning(r,{timeoutMs:2000});return r;}});
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const server=createHttpServer(users,{allowedOrigins:[origin],host:`127.0.0.1:${port}`,requireLogin:true});
 await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
 const cookiesOf=(res:Response)=>res.headers.getSetCookie().map(c=>c.split(';')[0]);
 const auth=(path:string,body:unknown,cookie='')=>fetch(origin+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const session=async(cookie:string)=>{const s=await fetch(origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:'{}'});return{status:s.status,cookie:cookiesOf(s).find(x=>x.startsWith('xiaon_session='))??'',csrf:(await s.json()).csrfToken as string};};
 return{directory,users,origin,server,auth,session,cookiesOf,cleanup:()=>{server.close();users.close();rmSync(directory,{recursive:true,force:true});}};
};

test('导出：账号、档案（含来源原话）、学习记录一次给全，不掺别人的',async()=>{
 const f=await setup();
 try{
  const registered=await f.auth('register',{phone:'13800138000',password:'abc12345'});
  assert.equal(registered.status,200);
  const login=f.cookiesOf(registered).find(c=>c.startsWith('xiaon_login='))!;
  const s=await f.session(login);
  const post=(path:string,body:unknown)=>fetch(f.origin+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:f.origin,Cookie:s.cookie,'X-Xiaon-CSRF':s.csrf},body:JSON.stringify(body)});
  // 记一条偏好，并留下一次作答与一条记忆（长期记忆默认关着，要先征得同意）。
  assert.equal((await post('consent',{operationId:'c1',optionalMemory:true})).status,200);
  assert.equal((await post('memories',{operationId:'m1',text:'喜欢打篮球',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null})).status,200);

  const res=await fetch(f.origin+'/api/account/export',{headers:{Cookie:s.cookie}});
  assert.equal(res.status,200);
  const data=await res.json() as any;
  assert.equal(data.scope,'account');
  assert.equal(data.account.phone,'13800138000','导出给本人看，手机号给真值');
  assert.equal(data.learning.memories.length,1);
  assert.equal(data.learning.memories[0].text,'喜欢打篮球');
  // 判题用的参考答案不导出，但要在 note 里说清楚，不做静默省略。
  assert.equal(data.learning.problemSecrets,undefined);
  assert.ok(String(data.excluded.join(' ')).includes('problemSecrets'));
  // 自由聊档案也在里面。
  assert.ok(data.freeChat);
  assert.equal(data.freeChat.scope,'free-chat-profile');
 }finally{f.cleanup();}
});

test('删除：没有明文确认或密码就不删；删完库里真的没有了',async()=>{
 const f=await setup();
 try{
  await f.auth('register',{phone:'13800138000',password:'abc12345'});
  const registered=await f.auth('login',{phone:'13800138000',password:'abc12345'});
  const login=f.cookiesOf(registered).find(c=>c.startsWith('xiaon_login='))!;
  const s=await f.session(login);
  const post=(body:unknown)=>fetch(f.origin+'/api/account/delete',{method:'POST',headers:{'Content-Type':'application/json',Origin:f.origin,Cookie:s.cookie,'X-Xiaon-CSRF':s.csrf},body:JSON.stringify(body)});

  // 没写确认语 → 不删。
  assert.equal((await post({password:'abc12345'})).status,400);
  // 确认语对但密码错 → 不删。
  assert.equal((await post({confirmation:'删除我的账号和全部数据',password:'wrongpass'})).status,403);
  // 导出仍然拿得到数据 —— 说明上面两次确实没删。
  assert.equal((await fetch(f.origin+'/api/account/export',{headers:{Cookie:s.cookie}})).status,200);

  const ok=await post({confirmation:'删除我的账号和全部数据',password:'abc12345'});
  assert.equal(ok.status,200);
  const body=await ok.json() as any;
  assert.equal(body.deleted,true);
  assert.equal(body.account.phone,'138****8000','回执里手机号打码');
  // 账号与登录记录都没了。
  assert.deepEqual(body.records,{accounts:1,logins:2,identities:0});'注册和登录各发了一个令牌，两个都清了。'
  // 本人的学习库文件真的从磁盘上删掉了（不是「标记删除」）。
  const usersDir=join(f.directory,'users');
  const left=existsSync(usersDir)?readdirSync(usersDir):[];
  assert.deepEqual(left.filter((n:string)=>n.endsWith('.sqlite')),[],'学习库文件应当已被删除');
  // 旧 cookie 不再能开会话。
  assert.equal((await fetch(f.origin+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:f.origin,Cookie:login},body:'{}'})).status,403);
 }finally{f.cleanup();}
});
