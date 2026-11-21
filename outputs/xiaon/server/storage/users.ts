/** 匿名身份与按用户隔离：每个浏览器一个服务端登记的随机身份，每个身份一个独立 SQLite 文件和独立运行时。
 * 学习数据、幂等回执和“重置”都落在本人的库里，不存在跨用户查询路径。 */
import { DatabaseSync } from 'node:sqlite';
import { createHash,randomBytes,scryptSync,timingSafeEqual } from 'node:crypto';
import { mkdirSync,chmodSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelProvider } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { RuntimeError } from '../core/errors';
import { passwordProblem,phoneProblem } from '../../shared/auth';
import { ensureColumn } from './migrate';
const USER_ID=/^[0-9a-f]{32}$/;
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const LOCK_FAILURES=5,LOCK_MS=10*60000,AUTH_PER_MINUTE=120;
/** 登录令牌的最长存活天数（2026-11-21 加）。到期即失效——不管客户端还带着这个 cookie，也不管它一直在用。
 * 令牌被复制或从设备备份恢复后，泄露窗口最多就是这个天数，不再是无限期。 */
const LOGIN_TTL_DAYS=30;
/** cookie 的 Max-Age 与服务端令牌 TTL 对齐：浏览器不要比服务端多活。 */
export const LOGIN_COOKIE_MAX_AGE=LOGIN_TTL_DAYS*86400;
const hashPassword=(password:string,salt=randomBytes(16))=>'scrypt$'+salt.toString('hex')+'$'+scryptSync(password,salt,32).toString('hex');
function passwordMatches(password:string,stored:string){
 const[,salt,hash]=stored.split('$');if(!salt||!hash)return false;
 const a=scryptSync(password,Buffer.from(salt,'hex'),32),b=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);
}
/** 未注册的分支也要走一次 scrypt：否则「手机号没注册」比「密码错了」快一个数量级，
 * 拿响应时间就能枚举出哪些手机号有账号。这里用同一个算法做一次等价开销的假校验。 */
function burnPasswordTime(password:unknown){if(typeof password==='string')scryptSync(password,randomBytes(16),32);}
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
  // 迁移：logins 补 expires_at 列（2026-11-21）。旧库首开新代码时补列；已有令牌按「从升级这一刻起算满一个 TTL」补，
  // 不让升级把正在用的学生直接踢下线，但从这一刻起每个令牌都有硬上限。
  if(ensureColumn(this.db,'logins','expires_at','TEXT')){
   const expiry=this.expiresAt();
   this.db.prepare('UPDATE logins SET expires_at=? WHERE expires_at IS NULL OR expires_at=?').run(expiry,expiry);
  }
 }
 /** 令牌到期时刻。 */
 private expiresAt(from=new Date()){return new Date(from.getTime()+LOGIN_TTL_DAYS*86400000).toISOString();}
 /** 账号级导出：这个账号在服务端存了什么（2026-11-21 加）。
  *  未成年人的数据也有知情权和删除权——先得有「拿得走」这个能力。
  *  手机号给真值：这是本人或监护人拿到的副本，不是展示给别人的界面。 */
 exportAccount(userId:string){
  const account=this.db.prepare('SELECT phone,created_at AS createdAt,last_login AS lastLogin FROM accounts WHERE user_id=?').get(userId) as {phone:string;createdAt:string;lastLogin:string}|undefined;
  const logins=this.db.prepare('SELECT phone,created_at AS createdAt,last_seen AS lastSeen,expires_at AS expiresAt FROM logins WHERE user_id=? ORDER BY created_at').all(userId) as {phone:string;createdAt:string;lastSeen:string;expiresAt:string|null}[];
  const identity=this.db.prepare('SELECT created_at AS createdAt,last_seen AS lastSeen FROM identities WHERE user_id=?').get(userId) as {createdAt:string;lastSeen:string}|undefined;
  return{phone:account?.phone??null,createdAt:account?.createdAt??null,lastLogin:account?.lastLogin??null,logins,identity:identity??null};
 }
 /** 只验密码，不发令牌：删除账号这类敏感操作要确认「是你本人」。
  *  没有密码记录（匿名身份）时一律失败——匿名身份本来就没有密码可验。 */
 verifyPassword(userId:string,password:unknown){
  if(typeof password!=='string')return false;
  const row=this.db.prepare('SELECT password_hash FROM accounts WHERE user_id=?').get(userId) as {password_hash:string}|undefined;
  if(!row){burnPasswordTime(password);return false;}
  return passwordMatches(password,row.password_hash);
 }
 /** 删除账号记录：这个手机号的账号行、所有登录令牌、匿名身份行全部清掉。
  *  学习数据在另一个文件里，由 UserRuntimes.deleteUserData 一并删。 */
 deleteAccount(userId:string){
  const account=this.db.prepare('SELECT phone FROM accounts WHERE user_id=?').get(userId) as {phone:string}|undefined;
  const accounts=this.db.prepare('DELETE FROM accounts WHERE user_id=?').run(userId);
  const logins=this.db.prepare('DELETE FROM logins WHERE user_id=?').run(userId);
  const identities=this.db.prepare('DELETE FROM identities WHERE user_id=?').run(userId);
  return{phone:account?.phone??null,deleted:{accounts:accounts.changes,logins:logins.changes,identities:identities.changes}};
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
  if(!row){
   // 未注册与密码错误必须看起来完全一样：同样耗时、同样错误码、同样文案。
   burnPasswordTime(password);
   throw new RuntimeError('forbidden','手机号或密码不对');
  }
  if(typeof password!=='string'||!passwordMatches(password,row.password_hash)){
   recent.push(now);this.failures.set(p,recent);
   throw new RuntimeError('forbidden',recent.length>=LOCK_FAILURES?'密码错的次数太多了，10 分钟后再试':'手机号或密码不对');
  }
  this.failures.delete(p);this.db.prepare('UPDATE accounts SET last_login=? WHERE phone=?').run(new Date(now).toISOString(),p);
  return{token:this.issue(p,row.user_id),userId:row.user_id};
 }
 /** 改密码：验旧密码 → 换哈希 → 作废这个手机号的全部登录令牌 → 给当前设备发一个新的。
  * 改完密之后，其他设备上的旧令牌立刻失效——家长换密码就能把泄露的登录踢掉。 */
 changePassword(phone:unknown,oldPassword:unknown,newPassword:unknown):{token:string;userId:string}{
  this.throttle();const p=this.validPhone(phone);
  if(typeof newPassword!=='string')throw new RuntimeError('invalid_params','请设置新密码');
  const problem=passwordProblem(newPassword);if(problem)throw new RuntimeError('invalid_params',problem);
  const row=this.db.prepare('SELECT user_id,password_hash FROM accounts WHERE phone=?').get(p) as {user_id:string;password_hash:string}|undefined;
  if(!row){burnPasswordTime(oldPassword);throw new RuntimeError('forbidden','手机号或密码不对');}
  if(typeof oldPassword!=='string'||!passwordMatches(oldPassword,row.password_hash)){burnPasswordTime(oldPassword);throw new RuntimeError('forbidden','原密码不对');}
  this.db.prepare('UPDATE accounts SET password_hash=? WHERE phone=?').run(hashPassword(newPassword),p);
  this.db.prepare('DELETE FROM logins WHERE phone=?').run(p);
  this.failures.delete(p);
  return{token:this.issue(p,row.user_id),userId:row.user_id};
 }
 /** 退出其他设备：保留当前这个令牌，作废同手机号的其余全部。返回被作废的条数。 */
 revokeOtherLogins(phone:string,keepToken:string){
  if(!/^[0-9a-f]{64}$/.test(keepToken))return 0;
  return this.db.prepare('DELETE FROM logins WHERE phone=? AND token_hash<>?').run(phone,digest(keepToken)).changes;
 }
 private issue(phone:string,userId:string){
  const token=randomBytes(32).toString('hex'),at=new Date().toISOString();
  this.db.prepare('INSERT INTO logins(token_hash,user_id,phone,created_at,last_seen,expires_at) VALUES(?,?,?,?,?,?)').run(digest(token),userId,phone,at,at,this.expiresAt());
  return token;
 }
 resolveLogin(token:string):{userId:string;phone:string}|undefined{
  if(!/^[0-9a-f]{64}$/.test(token))return undefined;const hash=digest(token);
  const row=this.db.prepare('SELECT user_id,phone,expires_at FROM logins WHERE token_hash=?').get(hash) as {user_id:string;phone:string;expires_at:string|null}|undefined;
  if(!row)return undefined;
  // 到期就是没登录：客户端还带着 cookie 也不行，直接把这条清掉。
  if(!row.expires_at||Date.parse(row.expires_at)<=Date.now()){this.db.prepare('DELETE FROM logins WHERE token_hash=?').run(hash);return undefined;}
  this.db.prepare('UPDATE logins SET last_seen=? WHERE token_hash=?').run(new Date().toISOString(),hash);
  return{userId:row.user_id,phone:row.phone};
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
 /** 删掉这个人的学习库文件（含 WAL 残留）。2026-11-21 加：删除权要真的删到磁盘上。
  *  先关掉打开的运行时，避免删完还有句柄往里写。 */
 deleteUserData(userId:string){
  const path=this.databasePath(userId);
  const entry=this.open.get(userId);
  if(entry){try{entry.runtime.repository.close();entry.runtime.freeChat.close();}catch{/* 已经关了 */}this.open.delete(userId);}
  for(const suffix of ['','-wal','-shm'])try{rmSync(path+suffix,{force:true});}catch{/* 没有就算了 */}
  return path;
 }
 close(){for(const e of this.open.values()){e.runtime.repository.close();e.runtime.freeChat.close();}this.open.clear();this.identities.close();}
}
