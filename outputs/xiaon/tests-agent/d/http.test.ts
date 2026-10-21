import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
const port=Number(process.env.XIAON_D_HTTP_PORT??18932),origin='http://127.0.0.1:5194',base=`http://127.0.0.1:${port}`,id=()=>crypto.randomUUID();
test('protected D HTTP routes reject self-granted roles, bypasses, clock input and malicious import atomically',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
 const anon=await fetch(base+'/api/learning');assert.equal(anon.status,403);
 const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken;const cookie=login.headers.get('set-cookie')!.split(';')[0];
 const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const s=await post('learning/start',{operationId:id(),mode:'support'});assert.equal(s.status,200);const session=await s.json();
 assert.equal((await post('learning/start',{operationId:id(),mode:'support',role:'assessor'})).status,400);
 assert.equal((await post('learning/start',{operationId:id(),mode:'support',at:'2040-01-01T00:00:00Z'})).status,400);
 assert.equal((await post('exposures',{operationId:id(),sessionId:session.id,taskId:'bracket',taskVersion:2,kind:'task',hintId:null})).status,409);
 assert.equal((await post('learning/open',{operationId:id(),sessionId:session.id,taskId:'bracket',taskVersion:2,answer:'x+5'})).status,400);
 assert.equal((await post('learning/grade',{operationId:id(),attemptId:'not-saved'})).status,404);
 const publicView=await(await fetch(base+'/api/tasks/bracket/2',{headers:{Cookie:cookie}})).json();assert.equal('answer'in publicView,false);assert.equal('rubric'in publicView,false);assert.equal('hints'in publicView,false);
 const source=JSON.stringify({version:1,records:{bracket:{attempts:[{id:'old',value:'x+5',hinted:false,time:'昨天'}]},unknown:{attempts:[{id:'bad',value:'1',hinted:false,time:'昨天'}]}}});
 const preview=await(await post('import/preview',{source})).json();const imported=await post('import',{operationId:id(),source,previewHash:preview.hash,scope:'attempts_only'});assert.equal(imported.status,404);assert.equal(r.repository.list('attempts').length,0);
 assert.equal((await post('learning/confirm',{operationId:id(),proposalId:'invented',expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'fake'})).status,404);
 assert.equal((await fetch(base+'/__test/advance?days=5',{headers:{Cookie:cookie}})).status,404);
 const noCsrf=await fetch(base+'/api/learning/reset',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({operationId:id(),confirmation:'清除本机学习记录与偏好'})});assert.equal(noCsrf.status,403);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
