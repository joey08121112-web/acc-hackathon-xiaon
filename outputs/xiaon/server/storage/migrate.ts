/** 迁移工具：让「版本号」真的决定做什么。
 *
 * 2026-11-21 之前：migrations 表只写不读，版本号纯给人看；补列的 ALTER TABLE 散落在
 * 两个文件里各写一遍；新增 revisioned 集合要人肉维护一份清单，漏加就静默冲突。
 *
 * 现在三件事各有唯一入口：版本会被读、补列有统一路径、清单从契约派生。
 */
import type { DatabaseSync } from 'node:sqlite';

export type Migration={version:number;note:string;up:(db:DatabaseSync)=>void};

/** 读当前版本。表还不存在当作 0。 */
export function currentVersion(db:DatabaseSync,table='migrations'):number{
 try{
  const row=db.prepare(`SELECT max(version) AS v FROM ${table}`).get() as {v:number|null}|undefined;
  return row?.v??0;
 }catch{
  // 表还不存在：等于还没迁移过。
  return 0;
 }
}

/** 补列：表存在但缺这列时才 ALTER。新库已有这列就是空操作。
 *  返回 true 表示这次真的改了表。 */
export function ensureColumn(db:DatabaseSync,table:string,column:string,declaration:string):boolean{
 const cols=(db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[]).map(c=>c.name);
 if(cols.includes(column))return false;
 db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
 return true;
}

/** 按版本顺序执行没跑过的迁移，返回最终版本。
 *
 *  库里的版本比这份代码认识的最新版本还新 → 明确报错。
 *  「用旧代码读新库」如果静默继续，表现会是莫名其妙的数据错误；
 *  这里宁可开不了库，也不要让它错着跑。 */
export function applyMigrations(db:DatabaseSync,migrations:Migration[],table='migrations'):number{
 db.exec(`CREATE TABLE IF NOT EXISTS ${table}(version INTEGER PRIMARY KEY)`);
 const current=currentVersion(db,table);
 const latest=migrations.reduce((max,m)=>Math.max(max,m.version),0);
 if(current>latest)throw new Error(`这个库的版本是 ${current}，比这份代码认识的最新版本 ${latest} 还新；请升级服务，不要用旧代码读写它`);
 for(const m of [...migrations].sort((a,b)=>a.version-b.version)){
  if(m.version<=current)continue;
  db.exec('BEGIN IMMEDIATE');
  try{
   m.up(db);
   db.prepare(`INSERT OR IGNORE INTO ${table}(version) VALUES(?)`).run(m.version);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 return latest;
}
