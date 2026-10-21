/** 所有者：ChatGPT。真实规则服务进程 + 临时合成库的在线备份冒烟；不加载 .env.server。 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backupDatabase } from '../../scripts/agent/backup';
import { restoreDatabase } from '../../scripts/agent/restore';
const directory=mkdtempSync(join(tmpdir(),'xiaon-h-live-backup-')),databasePath=join(directory,'h.sqlite');
const port=18952,origin='http://127.0.0.1:5212',base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:String(port),XIAON_API_PORT:String(port),XIAON_DB_PATH:databasePath,XIAON_ALLOWED_ORIGINS:origin,XIAON_API_HOST:'127.0.0.1',XIAON_STATIC_DIR:'',XIAON_PUBLIC_ORIGIN:'',XIAON_GLM_API_KEY:''},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>output+=String(b));child.stderr.on('data',b=>output+=String(b));
const stopped=once(child,'exit');
async function stop(){if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');await stopped;}
const count=(path:string)=>{const db=new DatabaseSync(path,{readOnly:true});try{assert.equal(Object.values(db.prepare('PRAGMA quick_check').get()!)[0],'ok');return Number(db.prepare('SELECT count(*) AS n FROM consents').get()!.n);}finally{db.close();}};
try{
 let ready=false;
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw new Error('服务启动失败：'+output);
  try{const health=await fetch(base+'/api/health');if(health.ok){const data=await health.json();assert.equal(data.mode,'local_rules');ready=true;break;}}catch{/* startup only */}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(ready,'service started on the H port');
 const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(login.status,200);const {csrfToken}=await login.json(),cookie=login.headers.get('set-cookie')!.split(';')[0];
 const post=async(path:string,body:Record<string,unknown>)=>{
  const response=await fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Xiaon-CSRF':csrfToken},body:JSON.stringify({operationId:crypto.randomUUID(),...body})});
  assert.equal(response.status,200);return response.json();
 };
 await post('consent',{optionalMemory:false});assert.equal(count(databasePath),1);
 // The real service remains live and processes another write while the online snapshot is made.
 const [snapshot]=await Promise.all([backupDatabase({databasePath,directory:join(directory,'backups')}),post('consent',{optionalMemory:true})]);
 assert.equal(count(databasePath),2);const snapshotCount=count(snapshot);assert.ok(snapshotCount===1||snapshotCount===2);
 const view=await fetch(base+'/api/learning',{headers:{Cookie:cookie}});assert.equal(view.status,200);assert.equal((await view.json()).optionalMemory,true);
 await post('learning/reset',{confirmation:'清除本机学习记录与偏好'});assert.equal(count(databasePath),0);
 await stop();const result=await restoreDatabase({databasePath,backupPath:snapshot,serviceStopped:true});
 assert.equal(count(databasePath),snapshotCount);assert.ok(result.previousBackup);assert.equal(count(result.previousBackup!),0);
 console.log(JSON.stringify({mode:'real service process, local rules, synthetic records',liveCountBeforeReset:2,snapshotCount,restoredCount:count(databasePath),integrity:'ok',previousBackupCount:0,externalModelCalls:0}));
}finally{await stop();rmSync(directory,{recursive:true,force:true});}
