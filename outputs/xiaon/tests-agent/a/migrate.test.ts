/** 迁移框架（2026-11-21 加）。
 *
 * 之前 migrations 表只写不读：版本号纯给人看，加列的 ALTER TABLE 散在两个文件里各写一遍，
 * 新增 revisioned 集合要人肉维护清单。这个文件守三件事：
 *  1. 版本真的会被读：没跑过的按顺序跑，跑过的跳过；
 *  2. 库比代码新 → 明确报错，不让旧代码静默读新库；
 *  3. 补列有唯一入口（ensureColumn），新旧库都走同一条路。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations,currentVersion,ensureColumn,type Migration } from '../../server/storage/migrate';
import { MIGRATIONS,SqliteRepository } from '../../server/storage/repository';

const withDb=(work:(db:DatabaseSync)=>void)=>{
 const dir=mkdtempSync(join(tmpdir(),'xiaon-migrate-test-')),path=join(dir,'db.sqlite');
 const db=new DatabaseSync(path);
 try{work(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
};

test('版本会被读：只跑没跑过的，按版本顺序',()=>{
 withDb(db=>{
  const ran:number[]=[];
  const list:Migration[]=[
   {version:1,note:'一',up:d=>{ran.push(1);d.exec('CREATE TABLE IF NOT EXISTS t1(x TEXT);');}},
   {version:2,note:'二',up:d=>{ran.push(2);d.exec('CREATE TABLE IF NOT EXISTS t2(x TEXT);');}},
   {version:3,note:'三',up:d=>{ran.push(3);d.exec('CREATE TABLE IF NOT EXISTS t3(x TEXT);');}},
  ];
  assert.equal(currentVersion(db),0,'还没跑过时是 0');
  assert.equal(applyMigrations(db,list),3);
  assert.deepEqual(ran,[1,2,3]);
  assert.equal(currentVersion(db),3);
  // 再开一次：已经跑过的跳过，不重复执行。
  assert.deepEqual(applyMigrations(db,list),3);
  assert.deepEqual(ran,[1,2,3],'第二次不该再跑');
 });
});

test('库比代码新时明确报错，不静默继续',()=>{
 withDb(db=>{
  db.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY); INSERT INTO migrations VALUES(99);');
  assert.throws(()=>applyMigrations(db,[{version:1,note:'一',up(){}}]),/比这份代码认识的最新版本/);
 });
});

test('补列：新库是空操作，老库补上；列名不会重复添加',()=>{
 withDb(db=>{
  db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, a TEXT);');
  assert.equal(ensureColumn(db,'t','b','TEXT'),true,'第一次真的补了');
  assert.equal(ensureColumn(db,'t','b','TEXT'),false,'第二次不再补');
  const cols=(db.prepare('PRAGMA table_info(t)').all() as {name:string}[]).map(c=>c.name);
  assert.deepEqual(cols,['id','a','b']);
 });
});

test('学习库会记录契约版本；老库第一次用新代码打开会被补上',()=>{
 const dir=mkdtempSync(join(tmpdir(),'xiaon-migrate-repo-')),path=join(dir,'learning.sqlite');
 try{
  // 先造一个「老库」：只有 v1 的表，没有 meta.contract_version。
  const old=new DatabaseSync(path);
  old.exec('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY); CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,evidence_revision INTEGER NOT NULL DEFAULT 0); INSERT INTO meta VALUES(1,0,0); CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,id TEXT NOT NULL,data TEXT NOT NULL); INSERT INTO migrations VALUES(1);');
  old.close();
  // 新代码打开：补列 + 记契约版本，老数据不动。
  const repo=new SqliteRepository(path);
  try{
   const db=(repo as unknown as {db:DatabaseSync}).db;
   const version=(db.prepare('SELECT contract_version FROM meta WHERE id=1').get() as {contract_version:string}).contract_version;
   assert.equal(version,'1.0.0','契约版本要真的写进库里');
   const cols=(db.prepare('PRAGMA table_info(meta)').all() as {name:string}[]).map(c=>c.name);
   assert.ok(cols.includes('contract_version'));
   // 版本表记到了最新。
   assert.equal(currentVersion(db),MIGRATIONS[MIGRATIONS.length-1].version);
  }finally{repo.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
