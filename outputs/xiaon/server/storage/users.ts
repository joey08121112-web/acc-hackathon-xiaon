/** 匿名身份与按用户隔离：每个浏览器一个服务端登记的随机身份，每个身份一个独立 SQLite 文件和独立运行时。
 * 学习数据、幂等回执和“重置”都落在本人的库里，不存在跨用户查询路径。 */
import { DatabaseSync } from 'node:sqlite';
import { createHash,randomBytes,scryptSync,timingSafeEqual } from 'node:crypto';
import { mkdirSync,chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelProvider } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { RuntimeError } from '../core/errors';
import { passwordProblem,phoneProblem } from '../../shared/auth';
const USER_ID=/^[0-9a-f]{32}$/;
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const LOCK_FAILURES=5,LOCK_MS=10*60000,AUTH_PER_MINUTE=120;
const hashPassword=(password:string,salt=randomBytes(16))=>'scrypt$'+salt.toString('hex')+'$'+scryptSync(password,salt,32).toString('hex');
function passwordMatches(password:string,stored:string){
 const[,salt,hash]=stored.split('$');if(!salt||!hash)return false;
 const a=scryptSync(password,Buffer.from(salt,'hex'),32),b=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);
}
/** Only server-issued tokens resolve; a forged or unknown cookie never creates a database by itself.
 * 账号：手机号 + 学生自己设的密码（scrypt 加盐哈希）。登录令牌只存哈希，一个账号可在多台设备各有一个。 */
export class IdentityStore {
 private db:DatabaseSync;private starts:number[]=[];private authStarts:number[]=[];private failures=new Map<string,number[]>();
 constructor(directory:string,private limits:{maxUsers:number;newPerMinute:number}){
  mkdirSync(directory,{recursive:true,mode:0o700});const path=join(directory,'identities.sqlite');
  this.db=new DatabaseSync(path);chmodSync(path,0o600);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS identities(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,last_seen TEXT NOT NULL);'
  +'CREATE TABLE IF NOT EXISTS accounts(phone TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL,last_login TEXT NOT NULL);'
  +'CREATE TABLE IF NOT EXISTS logins(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,phone TEXT NOT NULL,created_at TEXT NOT NULL,last_seen TEXT NOT NULL);');
 }
 resolve(token:string):string|undefined {
  if(!/^[0-9a-f]{64}$/.test(token))return undefined;const hash=digest(token);
  const row=this.db.prepare('SELECT user_id FROM identities WHERE token_hash=?').get(hash) as {user_id:string}|undefined;
  if(row)this.db.prepare('UPDATE identities SET last_seen=? WHERE token_hash=?').run(new Date().toISOString(),hash);
  return row?.user_id;
 }
 create():{token:string;userId:string}{
  const userId=this.allot(),token=randomBytes(32).toString('hex'),at=new Date().toISOString();
  this.db.prepare('INSERT INTO identities VALUES(?,?,?,?)').run(digest(token),userId,at,at);return{token,userId};
 }
 /** A fresh user id within the new-user rate and the total user cap. */
 private allot(){
  const now=Date.now();while(this.starts.length&&now-this.starts[0]>60000)this.starts.shift();
  if(this.starts.length>=this.limits.newPerMinute)throw new RuntimeError('unavailable','新用户太多，请稍后再试');
  if(this.count()>=this.limits.maxUsers)throw new RuntimeError('unavailable','体验名额已满');
  this.starts.push(now);return randomBytes(16).toString('hex');
 }
 count(){return (this.db.prepare('SELECT count(*) AS n FROM (SELECT user_id FROM identities UNION SELECT user_id FROM accounts)').get() as {n:number}).n;}
 /** Caps check/register/login together so phone numbers cannot be swept quickly. */
 private throttle(){
  const now=Date.now();while(this.authStarts.length&&now-this.authStarts[0]>60000)this.authStarts.shift();
  if(this.authStarts.length>=AUTH_PER_MINUTE)throw new RuntimeError('unavailable','登录的人太多，请稍后再试');this.authStarts.push(now);
 }
 private validPhone(phone:unknown):string{if(typeof phone!=='string'||phoneProblem(phone))throw new RuntimeError('invalid_params','请填 11 位手机号');return phone;}
 isRegistered(phone:unknown){this.throttle();return !!this.db.prepare('SELECT 1 FROM accounts WHERE phone=?').get(this.validPhone(phone));}
 /** 新账号优先接管这个浏览器原来的匿名记录（还没绑过账号的话），这样注册前聊过、做过的都还在。 */
 register(phone:unknown,password:unknown,anonymousToken:string):{token:string;userId:string}{
  this.throttle();const p=this.validPhone(phone);
  if(typeof password!=='string')throw new RuntimeError('invalid_params','请设置密码');const problem=passwordProblem(password);if(problem)throw new RuntimeError('invalid_params',problem);
  if(this.db.prepare('SELECT 1 FROM accounts WHERE phone=?').get(p))throw new RuntimeError('conflict','这个手机号已经注册过了，直接登录就行');
  const anonymous=this.resolve(anonymousToken);
  const userId=anonymous&&!this.db.prepare('SELECT 1 FROM accounts WHERE user_id=?').get(anonymous)?anonymous:this.allot(),at=new Date().toISOString();
  this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(p,userId,hashPassword(password),at,at);
  return{token:this.issue(p,userId),userId};
 }
 login(phone:unknown,password:unknown):{token:string;userId:string}{
  this.throttle();const p=this.validPhone(phone),now=Date.now();
  const recent=(this.failures.get(p)??[]).filter(t=>now-t<LOCK_MS);
  if(recent.length>=LOCK_FAILURES)throw new RuntimeError('unavailable','密码错的次数太多了，10 分钟后再试');
  const row=this.db.prepare('SELECT user_id,password_hash FROM accounts WHERE phone=?').get(p) as {user_id:string;password_hash:string}|undefined;
  if(!row)throw new RuntimeError('not_found','这个手机号还没注册');
  if(typeof password!=='string'||!passwordMatches(password,row.password_hash)){
   recent.push(now);this.failures.set(p,recent);
   throw new RuntimeError('forbidden',recent.length>=LOCK_FAILURES?'密码错的次数太多了，10 分钟后再试':'密码不对，再试一次');
  }
  this.failures.delete(p);this.db.prepare('UPDATE accounts SET last_login=? WHERE phone=?').run(new Date(now).toISOString(),p);
  return{token:this.issue(p,row.user_id),userId:row.user_id};
 }
 private issue(phone:string,userId:string){
  const token=randomBytes(32).toString('hex'),at=new Date().toISOString();
  this.db.prepare('INSERT INTO logins VALUES(?,?,?,?,?)').run(digest(token),userId,phone,at,at);return token;
 }
 resolveLogin(token:string):{userId:string;phone:string}|undefined{
  if(!/^[0-9a-f]{64}$/.test(token))return undefined;const hash=digest(token);
  const row=this.db.prepare('SELECT user_id,phone FROM logins WHERE token_hash=?').get(hash) as {user_id:string;phone:string}|undefined;
  if(row)this.db.prepare('UPDATE logins SET last_seen=? WHERE token_hash=?').run(new Date().toISOString(),hash);
  return row&&{userId:row.user_id,phone:row.phone};
 }
 logout(token:string){if(/^[0-9a-f]{64}$/.test(token))this.db.prepare('DELETE FROM logins WHERE token_hash=?').run(digest(token));}
 close(){this.db.close();}
}
type Entry={runtime:LearningRuntime;inflight:number;used:number};
/** Opens a user's runtime on first use and closes idle ones beyond maxOpen. */
export class UserRuntimes {
 readonly identities:IdentityStore;readonly provider:ModelProvider;readonly learning:boolean;
 private open=new Map<string,Entry>();
 constructor(private options:{directory:string;provider:ModelProvider;learning:boolean;create:(databasePath:string)=>LearningRuntime;maxOpen?:number;idleMs?:number;maxUsers?:number;newPerMinute?:number}){
  this.provider=options.provider;this.learning=options.learning;
  this.identities=new IdentityStore(options.directory,{maxUsers:options.maxUsers??1000,newPerMinute:options.newPerMinute??30});
 }
 databasePath(userId:string){if(!USER_ID.test(userId))throw new RuntimeError('forbidden');return join(this.options.directory,userId+'.sqlite');}
 /** The caller must call release() once its request has finished. */
 acquire(userId:string):{runtime:LearningRuntime;release:()=>void}{
  let entry=this.open.get(userId);
  if(!entry){this.evict();entry={runtime:this.options.create(this.databasePath(userId)),inflight:0,used:0};this.open.set(userId,entry);}
  const e=entry;e.inflight++;e.used=Date.now();let done=false;
  return{runtime:e.runtime,release:()=>{if(done)return;done=true;e.inflight--;e.used=Date.now();}};
 }
 private evict(){
  const max=this.options.maxOpen??200,idle=this.options.idleMs??30*60000;if(this.open.size<max)return;
  const now=Date.now();
  for(const[id,e]of[...this.open].sort((a,b)=>a[1].used-b[1].used)){if(this.open.size<max)break;if(e.inflight===0&&now-e.used>idle){this.open.delete(id);e.runtime.repository.close();e.runtime.freeChat.close();}}
 }
 close(){for(const e of this.open.values()){e.runtime.repository.close();e.runtime.freeChat.close();}this.open.clear();this.identities.close();}
}
