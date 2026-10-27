/** 匿名身份与按用户隔离：每个浏览器一个服务端登记的随机身份，每个身份一个独立 SQLite 文件和独立运行时。
 * 学习数据、幂等回执和“重置”都落在本人的库里，不存在跨用户查询路径。 */
import { DatabaseSync } from 'node:sqlite';
import { createHash,randomBytes } from 'node:crypto';
import { mkdirSync,chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelProvider } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { RuntimeError } from '../core/errors';
const USER_ID=/^[0-9a-f]{32}$/;
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
/** Only server-issued tokens resolve; a forged or unknown cookie never creates a database by itself. */
export class IdentityStore {
 private db:DatabaseSync;private starts:number[]=[];
 constructor(directory:string,private limits:{maxUsers:number;newPerMinute:number}){
  mkdirSync(directory,{recursive:true,mode:0o700});const path=join(directory,'identities.sqlite');
  this.db=new DatabaseSync(path);chmodSync(path,0o600);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS identities(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,last_seen TEXT NOT NULL);');
 }
 resolve(token:string):string|undefined {
  if(!/^[0-9a-f]{64}$/.test(token))return undefined;const hash=digest(token);
  const row=this.db.prepare('SELECT user_id FROM identities WHERE token_hash=?').get(hash) as {user_id:string}|undefined;
  if(row)this.db.prepare('UPDATE identities SET last_seen=? WHERE token_hash=?').run(new Date().toISOString(),hash);
  return row?.user_id;
 }
 create():{token:string;userId:string}{
  const now=Date.now();while(this.starts.length&&now-this.starts[0]>60000)this.starts.shift();
  if(this.starts.length>=this.limits.newPerMinute)throw new RuntimeError('unavailable','新用户太多，请稍后再试');
  if(this.count()>=this.limits.maxUsers)throw new RuntimeError('unavailable','体验名额已满');
  this.starts.push(now);const token=randomBytes(32).toString('hex'),userId=randomBytes(16).toString('hex'),at=new Date(now).toISOString();
  this.db.prepare('INSERT INTO identities VALUES(?,?,?,?)').run(digest(token),userId,at,at);return{token,userId};
 }
 count(){return (this.db.prepare('SELECT count(*) AS n FROM identities').get() as {n:number}).n;}
 /** First-seen time for trial limits; unknown ids read as undefined and callers fail closed. */
 createdAtOf(userId:string):string|undefined {
  if(!USER_ID.test(userId))return undefined;
  return (this.db.prepare('SELECT created_at FROM identities WHERE user_id=?').get(userId) as {created_at:string}|undefined)?.created_at;
 }
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
  for(const[id,e]of[...this.open].sort((a,b)=>a[1].used-b[1].used)){if(this.open.size<max)break;if(e.inflight===0&&now-e.used>idle){this.open.delete(id);e.runtime.repository.close();}}
 }
 close(){for(const e of this.open.values())e.runtime.repository.close();this.open.clear();this.identities.close();}
}
