import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync,chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { schemas,type EntityMap,type LearningRepository } from '../../shared/learning-contracts';
import { RuntimeError } from '../core/errors';
export const entitySchemas = {
 tasks:schemas.TaskDefinition,generations:schemas.GenerationRecord,sessions:schemas.LearningSession,sessionEvents:schemas.SessionEvent,attempts:schemas.Attempt,exposures:schemas.ExposureEvent,gradings:schemas.GradingResult,evidence:schemas.Evidence,skills:schemas.SkillState,assessments:schemas.AssessmentSnapshot,reviewPolicies:schemas.ReviewPolicy,reviewItems:schemas.ReviewItem,reviewOutcomes:schemas.ReviewOutcome,reports:schemas.ReportSnapshot,proposals:schemas.PlanProposal,plans:schemas.PlanVersion,memories:schemas.MemoryItem,consents:schemas.ConsentState,toolCalls:schemas.ToolCall,runs:schemas.AgentRun,stuckPoints:schemas.StuckPoint,
 // G0 首页改版. problemSecrets is server-only: never listed by the coordinator view().
 problems:schemas.ProblemRecord,problemSecrets:schemas.ProblemSecret,episodes:schemas.LearningEpisode,progressCards:schemas.ProgressCard,memoryMentions:schemas.MemoryMention,observations:schemas.ChatObservation,summaries:schemas.ConversationSummary,chatTurns:schemas.ChatTurn,
} satisfies {[K in keyof EntityMap]:z.ZodType<EntityMap[K]>};
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
export const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
/** No SQL, file or deletion capability is exposed as a model tool. */
export class SqliteRepository implements LearningRepository {
 private db:DatabaseSync;private depth=0;
 constructor(path:string){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path);if(path!==':memory:')chmodSync(path,0o600);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
  this.db.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY); CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,evidence_revision INTEGER NOT NULL DEFAULT 0); INSERT OR IGNORE INTO meta VALUES(1,0,0);');
  // v1: separate typed append-only collections, indexes on JSON reference fields for future B/C queries.
  this.transaction(()=>{
   for(const name of Object.keys(entitySchemas)){
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${name}(key TEXT PRIMARY KEY,id TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data))); CREATE INDEX IF NOT EXISTS ${name}_id ON ${name}(id);`);
   }
   this.db.exec('CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,result TEXT NOT NULL); INSERT OR IGNORE INTO migrations VALUES(1);');
   // v2 (E1): additive generations table, created by the loop above; existing rows are untouched.
   this.db.exec('INSERT OR IGNORE INTO migrations VALUES(2);');
   // v3 (P0): additive stuckPoints table, created by the same loop.
   this.db.exec('INSERT OR IGNORE INTO migrations VALUES(3);');
   // v4 (G0): additive revamp tables (problems … chatTurns), created by the same loop; existing rows are untouched.
   this.db.exec('INSERT OR IGNORE INTO migrations VALUES(4);');
   for(const table of ['attempts','exposures','gradings','evidence','reviewItems','reviewOutcomes','reports','plans','problems','episodes','progressCards','observations','summaries','chatTurns'])this.db.exec(`CREATE INDEX IF NOT EXISTS ${table}_session ON ${table}(json_extract(data,'$.sessionId')); CREATE INDEX IF NOT EXISTS ${table}_knowledge ON ${table}(json_extract(data,'$.knowledgePointId'));`);
  });
 }
 private table<K extends keyof EntityMap>(name:K){if(!Object.hasOwn(entitySchemas,name))throw new RuntimeError('invalid_params');return name;}
 get<K extends keyof EntityMap>(collection:K,id:string):EntityMap[K]|undefined {
  const row=this.db.prepare(`SELECT data FROM ${this.table(collection)} WHERE key=? OR id=? ORDER BY rowid DESC LIMIT 1`).get(id,id) as {data:string}|undefined;
  return row?JSON.parse(row.data) as EntityMap[K]:undefined;
 }
 list<K extends keyof EntityMap>(collection:K):EntityMap[K][]{return (this.db.prepare(`SELECT data FROM ${this.table(collection)} ORDER BY rowid`).all() as {data:string}[]).map(r=>JSON.parse(r.data) as EntityMap[K]);}
 append<K extends keyof EntityMap>(collection:K,value:EntityMap[K]):void {
  if(this.depth===0)return this.transaction(()=>this.append(collection,value));
  const parsed=entitySchemas[collection].safeParse(value);if(!parsed.success)throw new RuntimeError('invalid_params','无效的持久化契约对象');
  const key=collection==='tasks'?`${value.id}:v${(value as EntityMap['tasks']).version}`:collection==='reviewItems'||collection==='episodes'?`${value.id}:r${(value as EntityMap['reviewItems']|EntityMap['episodes']).revision}`:value.id;
  const data=canonical(parsed.data);const previous=this.db.prepare(`SELECT data FROM ${this.table(collection)} WHERE key=?`).get(key) as {data:string}|undefined;
  if(previous){if(previous.data!==data)throw new RuntimeError('conflict','不可覆盖已有记录: conflict');return;}
  this.db.prepare(`INSERT INTO ${this.table(collection)}(key,id,data) VALUES(?,?,?)`).run(key,value.id,data);this.db.exec('UPDATE meta SET revision=revision+1 WHERE id=1');
  if(['attempts','exposures','gradings','evidence'].includes(collection))this.db.exec('UPDATE meta SET evidence_revision=evidence_revision+1 WHERE id=1');
 }
 transaction<T>(work:()=>T):T {
  if(this.depth>0)return work();this.db.exec('BEGIN IMMEDIATE');this.depth++;
  try{const result=work();if(result instanceof Promise)throw new RuntimeError('invalid_state','事务回调不能异步');this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}finally{this.depth--;}
 }
 once<T>(operationId:string,request:unknown,work:()=>T):T {
  return this.transaction(()=>{
   const digest=hash(request);const row=this.db.prepare('SELECT request_hash,result FROM operations WHERE id=?').get(operationId) as {request_hash:string;result:string}|undefined;
   if(row){if(row.request_hash!==digest)throw new RuntimeError('conflict','operationId conflict');return JSON.parse(row.result) as T;}
   const value=work();this.db.prepare('INSERT INTO operations VALUES(?,?,?)').run(operationId,digest,JSON.stringify(value));return value;
  });
 }
 revision(){return (this.db.prepare('SELECT revision FROM meta WHERE id=1').get() as {revision:number}).revision;}
 evidenceRevision(){return (this.db.prepare('SELECT evidence_revision FROM meta WHERE id=1').get() as {evidence_revision:number}).evidence_revision;}
 setMemoryState(id:string,action:'stop'|'delete'){
  if(action==='delete')this.db.prepare('DELETE FROM memories WHERE id=?').run(id);
  else this.db.prepare("UPDATE memories SET data=json_set(data,'$.active',json('false')) WHERE id=?").run(id);
  // Receipts cannot resurrect deleted/stopped optional text. Keep hash, redact saved memory result.
  this.db.prepare("UPDATE operations SET result=json_object('id',?,'removed',1) WHERE json_extract(result,'$.id')=?").run(id,id);
  this.db.exec('UPDATE meta SET revision=revision+1 WHERE id=1');
 }
 receipt<T>(operationId:string,request:unknown):{found:boolean;value?:T}{const row=this.db.prepare('SELECT request_hash,result FROM operations WHERE id=?').get(operationId) as {request_hash:string;result:string}|undefined;if(!row)return {found:false};if(row.request_hash!==hash(request))throw new RuntimeError('conflict');return {found:true,value:JSON.parse(row.result) as T};}
 reset(){this.transaction(()=>{for(const name of Object.keys(entitySchemas))this.db.exec(`DELETE FROM ${name}`);this.db.exec('DELETE FROM operations; UPDATE meta SET revision=0,evidence_revision=0 WHERE id=1;');});this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}
 close(){this.db.close();}
}
