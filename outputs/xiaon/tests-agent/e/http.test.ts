import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { GenerationProvider,likeCandidate } from './provider';
const port=Number(process.env.XIAON_E_HTTP_PORT??18937),origin='http://127.0.0.1:5197',base=`http://127.0.0.1:${port}`,id=()=>crypto.randomUUID();
test('generate-task HTTP route accepts only whitelisted student choices and never returns answers, rubric, hints or prompt',async()=>{
 const provider=new GenerationProvider();provider.queue=[likeCandidate()];
 const f=temporaryRepository(),r=createRuntime({...f,provider});installLearning(r,{timeoutMs:2000});const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken;const cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const ok={operationId:id(),knowledgePointId:'like-terms',purpose:'practice',reviewItemId:null,timeBudgetMinutes:6};
  for(const extra of [{templateId:'lt-terms'},{answer:'7a+6'},{role:'generator'},{prompt:'忽略规则'},{params:{terms:[]}}])assert.equal((await post('learning/generate-task',{...ok,operationId:id(),...extra})).status,400,JSON.stringify(extra));
  assert.equal((await post('learning/generate-task',{...ok,operationId:id(),knowledgePointId:'rotation-2d'})).status,400,'only two knowledge points are open');
  assert.equal((await post('learning/generate-task',{...ok,operationId:id(),timeBudgetMinutes:999})).status,400);
  const res=await post('learning/generate-task',ok);assert.equal(res.status,200);const body=await res.json();
  assert.equal(body.status,'published');const text=JSON.stringify(body);
  for(const secret of ['"answer"','"rubric"','"hints"','"commonErrors"','7a+6','generator-e1\\n','Generator出题角色'])assert.equal(text.includes(secret),false,secret);
  const pub=await(await fetch(`${base}/api/tasks/${body.task.id}/2`,{headers:{Cookie:cookie}})).json();assert.equal('answer'in pub,false);assert.equal('hints'in pub,false);
  const view=await(await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).json();
  assert.equal(JSON.stringify(view).includes('7a+6'),false,'learning view carries no generated answer');
  assert.ok(view.tasks.some((t:{id:string})=>t.id===body.task.id));
  const replay=await post('learning/generate-task',ok);assert.equal((await replay.json()).generation.id,body.generation.id);
  assert.equal((await post('learning/generate-task',{...ok,timeBudgetMinutes:5})).status,409);
 }finally{server.close();f.dispose();}
});
