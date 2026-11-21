/** 自由聊的存储：放在这个学生自己的 SQLite 文件里，表名都以 fc_ 开头，跟 learning 的追加式集合互不相干。
 * 档案条目可改可删（学生说了算），删掉的内容进 fc_forgotten，整理时不再自动加回。
 * 对话按段（thread）存：点「重新开始」新开一段；consolidated_at 标记整理过的消息，fc_runs 记每次整理的结果。 */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { Clock } from '../../shared/learning-contracts';
import { FORGOTTEN_DAYS,INTEREST_COOL_DAYS,ITEMS_PER_KIND_MAX,MESSAGE_KEEP_DAYS,RECENT_DAYS,type ConsolidationChange,type Digest,type FreeChatTurn,type FreeChatHistory,type FreeChatMessage,type Profile,type ProfileItem,type ProfileItemRequest,type ProfileKind,type ProfileData } from '../../shared/free-chat';
import { RuntimeError } from '../core/errors';
import { ensureColumn } from '../storage/migrate';
const DAY=86400000;
type ItemRow={id:string;kind:ProfileKind;text:string;status:'active'|'past';source:'chat'|'student';first_mentioned_at:string;last_mentioned_at:string;mention_count:number;expires_at:string|null;edited_by_student:number;created_at:string;updated_at:string;origin_thread_id?:string|null;evidence_quote?:string|null;invalidated_at?:string|null;supersedes_id?:string|null};
const toItem=(r:ItemRow):ProfileItem=>({id:r.id,kind:r.kind,text:r.text,status:r.status,source:r.source,firstMentionedAt:r.first_mentioned_at,lastMentionedAt:r.last_mentioned_at,mentionCount:r.mention_count,expiresAt:r.expires_at,editedByStudent:!!r.edited_by_student,createdAt:r.created_at,updatedAt:r.updated_at,originThreadId:r.origin_thread_id??null,evidenceQuote:r.evidence_quote??null,invalidatedAt:r.invalidated_at??null,supersedesId:r.supersedes_id??null});
const newId=()=>randomBytes(9).toString('base64url');
const plusDays=(at:string,days:number)=>new Date(Date.parse(at)+days*DAY).toISOString();
export class FreeChatStore {
 private db:DatabaseSync;
 constructor(path:string,private clock:Clock){
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
   CREATE TABLE IF NOT EXISTS fc_basic(id INTEGER PRIMARY KEY CHECK(id=1),nickname TEXT NOT NULL,grade TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS fc_settings(id INTEGER PRIMARY KEY CHECK(id=1),auto_remember INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS fc_items(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('about','interest','recent','method')),text TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active','past')),source TEXT NOT NULL CHECK(source IN ('chat','student')),
    first_mentioned_at TEXT NOT NULL,last_mentioned_at TEXT NOT NULL,mention_count INTEGER NOT NULL,expires_at TEXT,
    edited_by_student INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    -- 2026-11-21 溯源：这一条是从哪段对话、凭学生哪句原话记下来的。
    origin_thread_id TEXT,evidence_quote TEXT,
    -- 「失效不删」：内容变了不原地覆盖，旧版本标失效留着（当历史看），新版本另起一条。
    invalidated_at TEXT,supersedes_id TEXT);
   CREATE TABLE IF NOT EXISTS fc_forgotten(id TEXT PRIMARY KEY,kind TEXT NOT NULL,text TEXT NOT NULL,deleted_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS fc_threads(id TEXT PRIMARY KEY,started_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS fc_messages(id TEXT PRIMARY KEY,thread_id TEXT NOT NULL REFERENCES fc_threads(id),role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL,created_at TEXT NOT NULL,consolidated_at TEXT);
   CREATE INDEX IF NOT EXISTS fc_messages_thread ON fc_messages(thread_id);
   CREATE TABLE IF NOT EXISTS fc_runs(id TEXT PRIMARY KEY,ran_at TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('ok','failed','skipped')),
    up_to_rowid INTEGER NOT NULL,changes TEXT NOT NULL,seen_at TEXT);
   CREATE TABLE IF NOT EXISTS fc_epoch(id INTEGER PRIMARY KEY CHECK(id IN (1,2)),value INTEGER NOT NULL);`);
  this.migrateItems();
 }
 /** 补列迁移：老库里的 fc_items 没有溯源列。CREATE TABLE IF NOT EXISTS 不会补列，必须显式 ALTER。
  *  2026-11-21 加（记忆治理第三档）：让「这一条为什么被记住」说得清。 */
 private migrateItems(){
  for(const [name,decl] of [['origin_thread_id','TEXT'],['evidence_quote','TEXT'],['invalidated_at','TEXT'],['supersedes_id','TEXT']] as const)
   ensureColumn(this.db,'fc_items',name,decl);
 }
 /** 固定规则，不用模型：近况到期删除；聊天里记下的兴趣久没提到就转为“以前喜欢”；删掉的内容过期后彻底清掉。 */
 applyRules(){
  const now=this.clock.now();
  this.db.prepare('DELETE FROM fc_items WHERE expires_at IS NOT NULL AND expires_at<=?').run(now);
  this.db.prepare("UPDATE fc_items SET status='past',updated_at=? WHERE kind='interest' AND status='active' AND edited_by_student=0 AND last_mentioned_at<=?").run(now,plusDays(now,-INTEREST_COOL_DAYS));
  this.db.prepare('DELETE FROM fc_forgotten WHERE deleted_at<=?').run(plusDays(now,-FORGOTTEN_DAYS));
  this.db.prepare('DELETE FROM fc_messages WHERE consolidated_at IS NOT NULL AND created_at<=?').run(plusDays(now,-MESSAGE_KEEP_DAYS));
 }
 profile():ProfileData{
  this.applyRules();
  const basic=this.db.prepare('SELECT nickname,grade FROM fc_basic WHERE id=1').get() as {nickname:string;grade:string}|undefined;
  const items=(this.db.prepare('SELECT * FROM fc_items WHERE invalidated_at IS NULL ORDER BY last_mentioned_at DESC,created_at DESC').all() as ItemRow[]).map(toItem);
  return{basic:{nickname:basic?.nickname??'',grade:basic?.grade??''},items,autoRemember:this.autoRemember(),autoRememberConfigured:this.autoRememberConfigured(),now:this.clock.now()};
 }
 /** 自由聊自动记忆的生效值。2026-11-21：从未设置过（表里没有这一行）时默认关闭——PRD FR12「长期记忆默认关闭」。
  * 只有学生自己明确开过（表里有 1）才保持开；明确关过的（表里有 0）保持关。 */
 autoRemember(){return this.autoRememberConfigured()&&this.autoRememberSetting()===1;}
 /** 学生是否明确表过态：表里有这一行 = 表过（开或关）；没有 = 还没表过。首访征询靠这个区分「还没问」和「说了不要」。 */
 autoRememberConfigured(){return this.db.prepare('SELECT auto_remember FROM fc_settings WHERE id=1').get()!==undefined;}
 private autoRememberSetting(){return (this.db.prepare('SELECT auto_remember FROM fc_settings WHERE id=1').get() as {auto_remember:number}).auto_remember;}
 /** 开关一变就换一个记忆代次：正在等模型的整理结果整体作废，关掉后马上再打开也救不回来（R2）。 */
 setAutoRemember(on:boolean){this.db.prepare('INSERT INTO fc_settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET auto_remember=excluded.auto_remember').run(on?1:0);this.bumpEpoch(2);}
 /** 数据代次（id=1）：重置演示时 +1。聊天和整理在调模型前记下代次，落库前核对——晚到的结果不写回已清空的库（R1）。 */
 epoch(){return this.epochValue(1);}
 /** 记忆代次（id=2）：自动记忆开关每变一次 +1。 */
 memoryEpoch(){return this.epochValue(2);}
 private epochValue(id:1|2){return (this.db.prepare('SELECT value FROM fc_epoch WHERE id=?').get(id) as {value:number}|undefined)?.value??0;}
 private bumpEpoch(id:1|2){this.db.prepare('INSERT INTO fc_epoch VALUES(?,1) ON CONFLICT(id) DO UPDATE SET value=value+1').run(id);}
 setBasic(nickname:string,grade:string){this.db.prepare('INSERT INTO fc_basic VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,grade=excluded.grade,updated_at=excluded.updated_at').run(nickname,grade,this.clock.now());}
 /** 学生在档案页的操作。学生加的、改过的条目都标记 editedByStudent，整理时只能给它记一次“又提到了”。 */
 studentEdit(req:ProfileItemRequest){
  const now=this.clock.now();
  if(req.action==='add'){
   this.applyRules();
   if(this.countKind(req.kind)>=ITEMS_PER_KIND_MAX)throw new RuntimeError('invalid_state','这一类已经记了很多条，先删掉一些再加吧');
   this.insert({kind:req.kind,text:req.text,source:'student',editedByStudent:true});return;
  }
  const row=this.db.prepare('SELECT * FROM fc_items WHERE id=?').get(req.id) as ItemRow|undefined;
  if(!row)throw new RuntimeError('not_found','这一条已经不在了');
  if(req.action==='update')this.db.prepare('UPDATE fc_items SET text=?,edited_by_student=1,updated_at=? WHERE id=?').run(req.text,now,req.id);
  else if(req.action==='status')this.db.prepare('UPDATE fc_items SET status=?,edited_by_student=1,updated_at=? WHERE id=?').run(req.status,now,req.id);
  else{
   this.db.prepare('DELETE FROM fc_items WHERE id=?').run(req.id);
   this.db.prepare('INSERT INTO fc_forgotten VALUES(?,?,?,?)').run(newId(),row.kind,row.text,now);
  }
 }
 /** 新增一条。近况默认 RECENT_DAYS 天后自动删除。整理（第 4 步）也走这里，source 为 chat。 */
 insert(input:{kind:ProfileKind;text:string;source:'chat'|'student';editedByStudent:boolean;expiresAt?:string|null;originThreadId?:string|null;evidenceQuote?:string|null;supersedesId?:string|null;firstMentionedAt?:string;mentionCount?:number}){
  const now=this.clock.now(),id=newId();
  const expiresAt=input.kind==='recent'?input.expiresAt??plusDays(now,RECENT_DAYS):null;
  this.db.prepare(`INSERT INTO fc_items(id,kind,text,status,source,first_mentioned_at,last_mentioned_at,mention_count,expires_at,edited_by_student,created_at,updated_at,origin_thread_id,evidence_quote,invalidated_at,supersedes_id)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?)`).run(id,input.kind,input.text,'active',input.source,input.firstMentionedAt??now,now,input.mentionCount??1,expiresAt,input.editedByStudent?1:0,now,now,input.originThreadId??null,input.evidenceQuote??null,input.supersedesId??null);
  return id;
 }
 /** 已被新版本取代的旧条目（内容变了不原地覆盖，旧版本留着当历史）。 */
 itemHistory():ProfileItem[]{
  return(this.db.prepare('SELECT * FROM fc_items WHERE invalidated_at IS NOT NULL ORDER BY invalidated_at DESC').all() as ItemRow[]).map(toItem);
 }
 forgotten(){return this.db.prepare('SELECT kind,text,deleted_at AS deletedAt FROM fc_forgotten ORDER BY deleted_at DESC').all() as {kind:ProfileKind;text:string;deletedAt:string}[];}
 currentThread(){return (this.db.prepare('SELECT id FROM fc_threads ORDER BY rowid DESC LIMIT 1').get() as {id:string}|undefined)?.id??null;}
 /** 当前这段对话（最近 limit 条，按时间先后）。 */
 history(limit=200):FreeChatHistory{
  const threadId=this.currentThread();if(!threadId)return{threadId,messages:[]};
  const rows=this.db.prepare('SELECT id,role,content,created_at AS createdAt FROM fc_messages WHERE thread_id=? ORDER BY rowid DESC LIMIT ?').all(threadId,limit) as FreeChatMessage[];
  return{threadId,messages:rows.reverse().map(r=>({id:r.id,role:r.role,content:r.content,createdAt:r.createdAt}))};
 }
 /** 重新开始：当前这段已经是空的就不再新开。 */
 threads(){
  return this.db.prepare(`SELECT t.id AS threadId,t.started_at AS startedAt,
   (SELECT content FROM fc_messages WHERE thread_id=t.id AND role='user' ORDER BY rowid LIMIT 1) AS preview,
   (SELECT count(*) FROM fc_messages WHERE thread_id=t.id) AS messageCount
   FROM fc_threads t WHERE EXISTS(SELECT 1 FROM fc_messages WHERE thread_id=t.id) ORDER BY t.rowid DESC`).all();
 }
 /** 按消息游标回看任意一段，只读这个学生自己的库；不会切换正在聊的线程。 */
 historyPage(threadId=this.currentThread(),before?:string){
  if(!threadId)return{threadId:null,messages:[],hasMore:false,before:null};
  const cursor=before?(this.db.prepare('SELECT rowid FROM fc_messages WHERE id=? AND thread_id=?').get(before,threadId) as {rowid:number}|undefined)?.rowid:undefined;
  if(before&&cursor===undefined)throw new RuntimeError('invalid_params','这页对话已经不在了，请刷新');
  const rows=this.db.prepare(`SELECT id,role,content,created_at AS createdAt FROM fc_messages WHERE thread_id=? ${cursor===undefined?'':'AND rowid<?'} ORDER BY rowid DESC LIMIT 201`).all(...(cursor===undefined?[threadId]:[threadId,cursor])) as FreeChatMessage[];
  const hasMore=rows.length>200,messages=rows.slice(0,200).reverse();
  return{threadId,messages,hasMore,before:messages[0]?.id??null};
 }
 /** 重新开始：当前这段已经是空的就不再新开。 */
 newThread():FreeChatHistory{
  const current=this.currentThread();
  if(current&&!this.db.prepare('SELECT 1 FROM fc_messages WHERE thread_id=? LIMIT 1').get(current))return{threadId:current,messages:[]};
  const id=newId();this.db.prepare('INSERT INTO fc_threads VALUES(?,?)').run(id,this.clock.now());return{threadId:id,messages:[]};
 }
 /** 一问一答一起存：回复失败时什么都不存，学生的话留在前端重发。threadId 是发问时的那一段，等待中点了重新开始也不会串到新的一段。
  * sinceEpoch 是发问时记下的数据代次：等待回复期间发生重置的话，这一问一答不再写回（R1）。 */
 appendExchange(threadId:string|null,userText:string,replyText:string,sinceEpoch?:number):FreeChatTurn{
  const now=this.clock.now();
  this.db.exec('BEGIN IMMEDIATE');
  try{
   if(sinceEpoch!==undefined&&sinceEpoch!==this.epoch())throw new RuntimeError('invalid_state','数据刚刚重置过，这句没有保存');
   let thread=threadId&&this.db.prepare('SELECT 1 FROM fc_threads WHERE id=?').get(threadId)?threadId:null;
   if(!thread){thread=newId();this.db.prepare('INSERT INTO fc_threads VALUES(?,?)').run(thread,now);}
   const user={id:newId(),role:'user' as const,content:userText,createdAt:now},reply={id:newId(),role:'assistant' as const,content:replyText,createdAt:now};
   // 关掉自动记时说的话直接标成整理过：以后再打开开关，也不会回头去记这段时间的对话。
   const skip=this.autoRemember()?null:now;
   const insert=this.db.prepare('INSERT INTO fc_messages(id,thread_id,role,content,created_at,consolidated_at) VALUES(?,?,?,?,?,?)');
   for(const m of [user,reply])insert.run(m.id,thread,m.role,m.content,m.createdAt,skip);
   this.db.exec('COMMIT');return{threadId:thread,user,reply};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 transaction<T>(work:()=>T):T{
  this.db.exec('BEGIN IMMEDIATE');
  try{const result=work();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 /** 还没整理过的消息，按先后。rowid 用来标记整理到哪一条。 */
 pendingMessages(){return (this.db.prepare('SELECT rowid,role,content,created_at AS createdAt,thread_id AS threadId FROM fc_messages WHERE consolidated_at IS NULL ORDER BY rowid').all() as {rowid:number;role:'user'|'assistant';content:string;createdAt:string;threadId:string}[]).map(r=>({rowid:Number(r.rowid),role:r.role,content:r.content,createdAt:r.createdAt,threadId:r.threadId}));}
 markConsolidated(upToRowid:number){this.db.prepare('UPDATE fc_messages SET consolidated_at=? WHERE consolidated_at IS NULL AND rowid<=?').run(this.clock.now(),upToRowid);}
 /** 取条目。传入的是旧版本 id 时，顺着版本链返回当前有效的那一条（内容变了旧 id 仍然可用）。 */
 item(id:string){
  const row=this.db.prepare('SELECT * FROM fc_items WHERE id=?').get(id) as ItemRow|undefined;if(!row)return undefined;
  if(!row.invalidated_at)return toItem(row);
  const next=this.db.prepare('SELECT * FROM fc_items WHERE supersedes_id=? AND invalidated_at IS NULL').get(id) as ItemRow|undefined;
  return next?toItem(next):toItem(row);
 }
 countKind(kind:ProfileKind){return (this.db.prepare('SELECT count(*) AS n FROM fc_items WHERE kind=? AND invalidated_at IS NULL').get(kind) as {n:number}).n;}
 /** 聊天里又提到了：记一次。聊天里记下的“以前喜欢”会回到“在玩”；学生自己改过状态的不动。 */
 mention(id:string){const now=this.clock.now();this.db.prepare("UPDATE fc_items SET mention_count=mention_count+1,last_mentioned_at=?,updated_at=?,status=CASE WHEN edited_by_student=1 THEN status ELSE 'active' END WHERE id=?").run(now,now,id);}
 /** 整理改写内容。2026-11-21 起不再原地覆盖：
  *  旧条目标为失效（保留内容与来源，当历史看），新内容另起一条并指向旧条目。
  *  「只增不改」——记忆被改过这件事本身要看得见。返回新条目的 id。 */
 chatUpdate(id:string,text:string,origin?:{threadId?:string|null;evidenceQuote?:string|null}):string{
  const now=this.clock.now();
  const old=this.db.prepare('SELECT * FROM fc_items WHERE id=?').get(id) as ItemRow|undefined;
  if(!old)throw new RuntimeError('not_found','这一条已经不在了');
  // 旧版本保留 FORGOTTEN_DAYS 天：够孩子和家长回看「之前记的是什么」，又不无限堆积。
  this.db.prepare('UPDATE fc_items SET invalidated_at=?,updated_at=?,expires_at=? WHERE id=?').run(now,now,plusDays(now,FORGOTTEN_DAYS),id);
  return this.insert({kind:old.kind,text,source:'chat',editedByStudent:false,originThreadId:origin?.threadId??old.origin_thread_id??null,evidenceQuote:origin?.evidenceQuote??old.evidence_quote??null,supersedesId:id,firstMentionedAt:old.first_mentioned_at,mentionCount:old.mention_count});
 }
 chatPast(id:string){this.db.prepare("UPDATE fc_items SET status='past',updated_at=? WHERE id=?").run(this.clock.now(),id);}
 recordRun(status:'ok'|'failed'|'skipped',upToRowid:number,changes:ConsolidationChange[]){const id=newId();this.db.prepare('INSERT INTO fc_runs VALUES(?,?,?,?,?,NULL)').run(id,this.clock.now(),status,upToRowid,JSON.stringify(changes));return id;}
 /** 最近一次成功整理之后，又连续失败了几次。 */
 consecutiveFailures(){
  const last=(this.db.prepare("SELECT max(rowid) AS r FROM fc_runs WHERE status!='failed'").get() as {r:number|null}).r??0;
  return (this.db.prepare("SELECT count(*) AS n FROM fc_runs WHERE status='failed' AND rowid>?").get(last) as {n:number}).n;
 }
 /** 最近一次成功整理里新增或更新、学生还没看过的条目；已经被删掉的不再出现。 */
 digest():Digest|null{
  const run=this.db.prepare("SELECT id,changes FROM fc_runs WHERE status='ok' ORDER BY rowid DESC LIMIT 1").get() as {id:string;changes:string}|undefined;
  if(!run||(this.db.prepare('SELECT seen_at FROM fc_runs WHERE id=?').get(run.id) as {seen_at:string|null}).seen_at)return null;
  const changes=(JSON.parse(run.changes) as ConsolidationChange[]).filter(c=>(c.op==='add'||c.op==='update')&&this.item(c.itemId)).map(c=>({...c,text:this.item(c.itemId)!.text}));
  return changes.length?{runId:run.id,changes}:null;
 }
 markDigestSeen(runId:string){this.db.prepare('UPDATE fc_runs SET seen_at=? WHERE id=? AND seen_at IS NULL').run(this.clock.now(),runId);}
 /** 「重置整个演示」：清空自由聊的全部数据，并换一个数据代次——在途的聊天回复和整理结果全部作废，不会写回新库（R1）。 */
 reset(){this.db.exec('DELETE FROM fc_items; DELETE FROM fc_forgotten; DELETE FROM fc_basic; DELETE FROM fc_settings; DELETE FROM fc_messages; DELETE FROM fc_threads; DELETE FROM fc_runs;');this.bumpEpoch(1);}
 close(){if(this.db.isOpen)this.db.close();}
}
