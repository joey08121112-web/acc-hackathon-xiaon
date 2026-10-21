/** 所有者：ChatGPT。临时合成库，不接触日常库。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { temporaryRepository } from '../../server/storage/testing';
import { backupDatabase, persistentMountWarning } from '../../scripts/agent/backup';
import { restoreDatabase } from '../../scripts/agent/restore';
const count=(p:string)=>{const db=new DatabaseSync(p,{readOnly:true});try{return db.prepare('SELECT count(*) AS n FROM consents').get()!.n;}finally{db.close();}};

test('运行中 WAL 库一致性备份；清空后恢复，恢复前另存当前库',async()=>{
 const f=temporaryRepository();let closed=false;try{
  f.repository.append('consents',{schemaVersion:'1.0.0',id:'consent-h',operationId:'op-h',optionalMemory:false,updatedAt:f.clock.now()});
  const out=join(f.directory,'backups'),snapshot=await backupDatabase({databasePath:f.databasePath,directory:out,keep:3});
  assert.equal(count(snapshot),1);assert.equal(f.repository.list('consents').length,1);
  f.repository.reset();assert.equal(f.repository.list('consents').length,0);
  // Restore refuses to operate without explicit confirmation that all writers stopped.
  await assert.rejects(restoreDatabase({databasePath:f.databasePath,backupPath:snapshot}),/停止/);
  f.repository.close();closed=true;
  const result=await restoreDatabase({databasePath:f.databasePath,backupPath:snapshot,serviceStopped:true});
  assert.ok(result.previousBackup);assert.equal(count(result.previousBackup!),0);assert.equal(count(f.databasePath),1);
 }finally{if(!closed)f.repository.close();rmSync(f.directory,{recursive:true,force:true});}
});
test('备份保留数只作用于本库命名空间，不删除无关文件；缺失库不创建',async()=>{
 const f=temporaryRepository();try{
  const out=join(f.directory,'backups');
  await backupDatabase({databasePath:f.databasePath,directory:out,keep:2});
  writeFileSync(join(out,'user-material.sqlite'),'keep');
  for(let i=0;i<3;i++)await backupDatabase({databasePath:f.databasePath,directory:out,keep:2});
  assert.equal(readdirSync(out).filter(n=>n.startsWith('xiaon-')).length,2);
  assert.equal(readFileSync(join(out,'user-material.sqlite'),'utf8'),'keep');
  const missing=join(f.directory,'missing.sqlite');await assert.rejects(backupDatabase({databasePath:missing,directory:out}));assert.equal(existsSync(missing),false);
  const invalid=join(f.directory,'invalid.sqlite');writeFileSync(invalid,'invalid');
  const before=count(f.databasePath);await assert.rejects(restoreDatabase({databasePath:f.databasePath,backupPath:invalid,serviceStopped:true}));assert.equal(count(f.databasePath),before);
 }finally{f.dispose();}
});
test('容器数据路径没有独立挂载时给出警告；有实际挂载才通过',()=>{
 const root='24 1 0:1 / / rw - overlay overlay rw\n';
 assert.match(persistentMountWarning('/data/learning.sqlite',root)??'',/未检测到持久卷/);
 assert.equal(persistentMountWarning('/data/learning.sqlite',root+'25 24 8:1 / /data rw - ext4 disk rw\n'),null);
 assert.match(persistentMountWarning('/other/learning.sqlite',root+'25 24 8:1 / /data rw - ext4 disk rw\n')??'',/未检测到持久卷/);
});
