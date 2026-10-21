/** 所有者：ChatGPT。仅在所有服务进程停止后恢复；先保存当前库，再原子替换。 */
import { DatabaseSync, backup } from 'node:sqlite';
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync, openSync, closeSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { backupDatabase, validateDatabase } from './backup';
export async function restoreDatabase({databasePath,backupPath,serviceStopped=false}:{databasePath:string;backupPath:string;serviceStopped?:boolean}):Promise<{previousBackup:string|null}>{
 if(!serviceStopped)throw new Error('请先停止所有使用此数据库的服务，再传 --stopped 确认');
 const target=resolve(databasePath),source=resolve(backupPath);
 if(!existsSync(source))throw new Error('指定的备份不存在');
 if(existsSync(target)&&realpathSync(target)===realpathSync(source))throw new Error('不能将数据库自身作为恢复备份');
 validateDatabase(source); // Invalid backups never change the current database.
 mkdirSync(dirname(target),{recursive:true,mode:0o700});
 const previousBackup=existsSync(target)?await backupDatabase({databasePath:target,directory:join(dirname(target),'backups','before-restore'),keep:10}):null;
 const temporary=target+'.restore-'+randomUUID();closeSync(openSync(temporary,'wx',0o600));
 const db=new DatabaseSync(source,{readOnly:true});
 try{
  await backup(db,temporary);validateDatabase(temporary);chmodSync(temporary,0o600);
  if(existsSync(target)){
   const current=new DatabaseSync(target);
   try{const result=current.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();if(result?.busy)throw new Error('数据库仍被占用，请停止全部服务后恢复');}finally{current.close();}
  }
  for(const suffix of ['-wal','-shm'])rmSync(target+suffix,{force:true});
  renameSync(temporary,target);
  return{previousBackup};
 }finally{db.close();rmSync(temporary,{force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{db:{type:'string'},from:{type:'string'},stopped:{type:'boolean'}}});
 try{
  if(!values.from)throw new Error('请用 --from 指定备份文件');
  const result=await restoreDatabase({databasePath:values.db??process.env.XIAON_DB_PATH??'.local/learning.sqlite',backupPath:values.from,serviceStopped:values.stopped});
  console.log('恢复完成；原库备份：'+(result.previousBackup??'原库不存在'));
 }catch(e){console.error((e as Error).message);process.exitCode=1;}
}
