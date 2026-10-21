import { spawn } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'xiaon-service-'));const port=Number(process.env.XIAON_A_SMOKE_PORT??18922);const origin=`http://127.0.0.1:${port}`;let child;
async function start(){child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,XIAON_GLM_API_KEY:'',XIAON_GLM_MODEL:'',XIAON_API_PORT:String(port),XIAON_DB_PATH:join(dir,'smoke.sqlite'),XIAON_ALLOWED_ORIGINS:origin},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('startup timeout')),5000);child.once('error',reject);child.once('exit',code=>reject(new Error('service exited '+code)));child.stdout.once('data',()=>{clearTimeout(timeout);resolve();});});}
async function stop(){if(!child||child.exitCode!==null)return;const c=child;await new Promise(resolve=>{c.once('exit',resolve);c.kill('SIGTERM');});child=undefined;}
async function auth(){const res=await fetch(origin+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,200);return{Cookie:res.headers.get('set-cookie').split(';')[0],'X-Xiaon-CSRF':(await res.json()).csrfToken,Origin:origin,'Content-Type':'application/json'};}
async function post(path,input,headers){const res=await fetch(origin+'/api/'+path,{method:'POST',headers,body:JSON.stringify(input)});assert.equal(res.status,200);return res.json();}
try{
 await start();const headers=await auth();const s=await post('learning/start',{operationId:'smoke-s',mode:'support'},headers);
 await post('learning/open',{operationId:'smoke-e',sessionId:s.id,taskId:'b-like-observation',taskVersion:2},headers);
 const input={operationId:'smoke-a',sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null};const a=await post('learning/submit',input,headers);
 const health=await(await fetch(origin+'/api/health')).json();assert.equal(health.mode,'local_rules');await stop();await start();
 const h2=await auth();const again=await post('learning/submit',input,h2);assert.equal(again.attempt.id,a.attempt.id);
 const context=await(await fetch(origin+'/api/context',{headers:h2})).json();assert.equal(context.attemptCount,1);
 console.log(JSON.stringify({service:'actual_child_process_restart',bind:'127.0.0.1',port,attemptCount:context.attemptCount,idempotencyPreserved:true,mode:health.mode,realModel:'NOT_RUN_LOCAL_RULES_RESTART_TEST'}));
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
