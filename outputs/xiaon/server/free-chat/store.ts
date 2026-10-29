/** 自由聊的存储：放在这个学生自己的 SQLite 文件里，表名都以 fc_ 开头，跟 learning 的追加式集合互不相干。
 * 档案条目可改可删（学生说了算），删掉的内容进 fc_forgotten，整理时不再自动加回。 */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { Clock } from '../../shared/learning-contracts';
import { FORGOTTEN_DAYS,INTEREST_COOL_DAYS,ITEMS_PER_KIND_MAX,RECENT_DAYS,type Profile,type ProfileItem,type ProfileItemRequest,type ProfileKind } from '../../shared/free-chat';
import { RuntimeError } from '../core/errors';
const DAY=86400000;
type ItemRow={id:string;kind:ProfileKind;text:string;status:'active'|'past';source:'chat'|'student';first_mentioned_at:string;last_mentioned_at:string;mention_count:number;expires_at:string|null;edited_by_student:number;created_at:string;updated_at:string};
const toItem=(r:ItemRow):ProfileItem=>({id:r.id,kind:r.kind,text:r.text,status:r.status,source:r.source,firstMentionedAt:r.first_mentioned_at,lastMentionedAt:r.last_mentioned_at,mentionCount:r.mention_count,expiresAt:r.expires_at,editedByStudent:!!r.edited_by_student,createdAt:r.created_at,updatedAt:r.updated_at});
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
    edited_by_student INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS fc_forgotten(id TEXT PRIMARY KEY,kind TEXT NOT NULL,text TEXT NOT NULL,deleted_at TEXT NOT NULL);`);
 }
 /** 固定规则，不用模型：近况到期删除；聊天里记下的兴趣久没提到就转为“以前喜欢”；删掉的内容过期后彻底清掉。 */
 applyRules(){
  const now=this.clock.now();
  this.db.prepare('DELETE FROM fc_items WHERE expires_at IS NOT NULL AND expires_at<=?').run(now);
  this.db.prepare("UPDATE fc_items SET status='past',updated_at=? WHERE kind='interest' AND status='active' AND edited_by_student=0 AND last_mentioned_at<=?").run(now,plusDays(now,-INTEREST_COOL_DAYS));
  this.db.prepare('DELETE FROM fc_forgotten WHERE deleted_at<=?').run(plusDays(now,-FORGOTTEN_DAYS));
 }
 profile():Profile{
  this.applyRules();
  const basic=this.db.prepare('SELECT nickname,grade FROM fc_basic WHERE id=1').get() as {nickname:string;grade:string}|undefined;
  const items=(this.db.prepare('SELECT * FROM fc_items ORDER BY last_mentioned_at DESC,created_at DESC').all() as ItemRow[]).map(toItem);
  return{basic:{nickname:basic?.nickname??'',grade:basic?.grade??''},items,autoRemember:this.autoRemember(),now:this.clock.now()};
 }
 autoRemember(){return ((this.db.prepare('SELECT auto_remember FROM fc_settings WHERE id=1').get() as {auto_remember:number}|undefined)?.auto_remember??1)===1;}
 setAutoRemember(on:boolean){this.db.prepare('INSERT INTO fc_settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET auto_remember=excluded.auto_remember').run(on?1:0);}
 setBasic(nickname:string,grade:string){this.db.prepare('INSERT INTO fc_basic VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,grade=excluded.grade,updated_at=excluded.updated_at').run(nickname,grade,this.clock.now());}
 /** 学生在档案页的操作。学生加的、改过的条目都标记 editedByStudent，整理时只能给它记一次“又提到了”。 */
 studentEdit(req:ProfileItemRequest){
  const now=this.clock.now();
  if(req.action==='add'){
   this.applyRules();
   const count=(this.db.prepare('SELECT count(*) AS n FROM fc_items WHERE kind=?').get(req.kind) as {n:number}).n;
   if(count>=ITEMS_PER_KIND_MAX)throw new RuntimeError('invalid_state','这一类已经记了很多条，先删掉一些再加吧');
   this.insert({kind:req.kind,text:req.text,source:'student',editedByStudent:true});return;
  }
  const row=this.db.prepare('SELECT * FROM fc_items WHERE id=?').get(req.id) as ItemRow|undefined;
  if(!row)throw new RuntimeError('not_found','这一条已经不在了');
  if(req.action==='update')this.db.prepare('UPDATE fc_items SET text=?,edited_by_student=1,updated_at=? WHERE id=?').run(req.text,now,req.id);
  else if(req.action==='status')this.db.prepare('UPDATE fc_items SET status=?,edited_by_student=1,updated_at=? WHERE id=?').run(req.status,now,req.id);
  else{
   this.db.prepare('DELETE FROM fc_items WHERE id=?').run(req.id);
   this.db.prepare('INSERT INTO fc_forgotten VALUES(?,?,?,?)').run(randomBytes(9).toString('base64url'),row.kind,row.text,now);
  }
 }
 /** 新增一条。近况默认 RECENT_DAYS 天后自动删除。整理（第 4 步）也走这里，source 为 chat。 */
 insert(input:{kind:ProfileKind;text:string;source:'chat'|'student';editedByStudent:boolean;expiresAt?:string|null}){
  const now=this.clock.now(),id=randomBytes(9).toString('base64url');
  const expiresAt=input.kind==='recent'?input.expiresAt??plusDays(now,RECENT_DAYS):null;
  this.db.prepare('INSERT INTO fc_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,input.kind,input.text,'active',input.source,now,now,1,expiresAt,input.editedByStudent?1:0,now,now);
  return id;
 }
 forgotten(){return this.db.prepare('SELECT kind,text,deleted_at AS deletedAt FROM fc_forgotten ORDER BY deleted_at DESC').all() as {kind:ProfileKind;text:string;deletedAt:string}[];}
 /** 「重置整个演示」：清空自由聊的全部数据。 */
 reset(){this.db.exec('DELETE FROM fc_items; DELETE FROM fc_forgotten; DELETE FROM fc_basic; DELETE FROM fc_settings;');}
 close(){if(this.db.isOpen)this.db.close();}
}
