/** 所有者：ChatGPT。SQLite 在线一致性备份；不读取模型配置。Node >=22.16。 */
import { DatabaseSync, backup } from 'node:sqlite';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
export function validateDatabase(path:string){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const check=db.prepare('PRAGMA quick_check').all();
  if(check.length!==1||Object.values(check[0])[0]!=='ok')throw new Error('备份完整性检查失败');
  db.prepare('SELECT version FROM migrations LIMIT 1').all();
  db.prepare('SELECT revision FROM meta WHERE id=1').get();
 }finally{db.close();}
}
export async function backupDatabase({databasePath,directory=join(dirname(databasePath),'backups'),keep=7}:{databasePath:string;directory?:string;keep?:number}):Promise<string>{
 if(!Number.isInteger(keep)||keep<1)throw new Error('keep 必须是正整数');
 const source=resolve(databasePath);if(!existsSync(source))throw new Error('数据库不存在，不会创建空备份');
 validateDatabase(source);
 mkdirSync(directory,{recursive:true,mode:0o700});
 const prefix='xiaon-'+createHash('sha256').update(source).digest('hex').slice(0,12)+'-';
 const path=join(directory,prefix+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sqlite');
 closeSync(openSync(path,'wx',0o600));
 const db=new DatabaseSync(source,{readOnly:true});
 try{
  await backup(db,path);
  // A portable snapshot must be a single file, even when the live source uses WAL.
  const snapshot=new DatabaseSync(path);
  try{snapshot.exec('PRAGMA journal_mode=DELETE');}finally{snapshot.close();}
  validateDatabase(path);chmodSync(path,0o600);
 }
 catch(e){rmSync(path,{force:true});throw e;}
 finally{db.close();}
 // Only prune this database's own snapshots after a verified new backup exists.
 const owned=readdirSync(directory).filter(n=>n.startsWith(prefix)&&n.endsWith('.sqlite')).map(n=>join(directory,n)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs);
 for(const old of owned.slice(keep))rmSync(old);
 return path;
}
/** /proc reports actual mounts. A container environment variable alone is not proof of persistence. */
export function persistentMountWarning(databasePath:string,mountinfo:string):string|null{
 const path=resolve(databasePath);
 const mounted=mountinfo.split('\n').some(line=>{
  const mount=line.split(' ')[4]?.replace(/\\([0-7]{3})/g,(_,oct:string)=>String.fromCharCode(parseInt(oct,8)));
  return mount&&mount!=='/'&&(path===mount||path.startsWith(mount+sep));
 });
 return mounted?null:'警告：数据库路径未检测到持久卷，换容器可能丢失学习记录。请将持久卷挂载到 /data，并设置 XIAON_DB_PATH=/data/learning.sqlite。';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{db:{type:'string'},out:{type:'string'},keep:{type:'string'},'check-volume':{type:'boolean'}}});
 const databasePath=resolve(values.db??process.env.XIAON_DB_PATH??'.local/learning.sqlite');
 if(values['check-volume']){
  let mounts='';try{mounts=readFileSync('/proc/self/mountinfo','utf8');}catch{/* unknown mount state warns */}
  const warning=persistentMountWarning(databasePath,mounts);if(warning)console.warn(warning);
 }else{
  try{console.log(await backupDatabase({databasePath,directory:values.out,keep:values.keep===undefined?7:Number(values.keep)}));}
  catch(e){console.error((e as Error).message);process.exitCode=1;}
 }
}
