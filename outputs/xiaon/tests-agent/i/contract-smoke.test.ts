/** 旧首页草稿与问候契约留档；2026-11-01 起相关 HTTP 入口屏蔽，既有数据仍可读。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas } from '../../shared/learning-contracts';
const port=Number(process.env.XIAON_I_HTTP_PORT??18973),origin='http://127.0.0.1:5213',base=`http://127.0.0.1:${port}`,id=()=>crypto.randomUUID();
const draft={source:'spoken',questionText:'化简 3x+2x-4',studentWork:'5x+4',knowledgePointId:'like-terms',stuckQuote:'常数项的符号我弄反了',stuckPointId:null,catalogTask:null} as const;
const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,0xff,0xd9]).toString('base64');

test('G0 zCode-lane schemas: drafts carry no answer status, secrets are separate, recognition needs mask confirmation',()=>{
 assert.ok(schemas.ProblemDraft.safeParse(draft).success);
 assert.equal(schemas.ProblemDraft.safeParse({...draft,answerStatus:'verified'}).success,false,'answerStatus is program-decided, never part of a draft');
 assert.equal(schemas.ProblemDraft.safeParse({...draft,knowledgePointId:'quadratics'}).success,false);
 assert.ok(schemas.MemoryDraft.safeParse({text:'喜欢打篮球',kind:'interest',origin:'chat'}).success);
 assert.ok(schemas.Greeting.safeParse({text:'又见面啦',memoryId:null,summaryId:null,memoryOff:true}).success);
 const rec={operationId:'op-r',sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:true};
 assert.ok(schemas.Recognize.safeParse(rec).success);
 assert.equal(schemas.Recognize.safeParse({...rec,maskConfirmed:false}).success,false);
 assert.equal(schemas.Recognize.safeParse({...rec,mimeType:'image/png'}).success,false);
});

test('旧首页错题、记忆草稿、问候及识题入口已停用，既有记录仍可读与清除',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r,{timeoutMs:2000});const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const revision=r.repository.revision();
  for(const [path,body] of [
   ['learning/memory/confirm-draft',{operationId:id(),sessionId:null,draft:{text:'喜欢打篮球',kind:'interest',origin:'chat'},text:'喜欢打篮球'}],
   ['learning/greeting',{operationId:id()}],
   ['learning/problem/confirm',{operationId:id(),sessionId:'chat-http',draft,referenceAnswer:'5x-4'}],
   ['learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:true}],
  ] as const){
   const res=await post(path,body);assert.equal(res.status,409,path);assert.equal((await res.json()).error.code,'invalid_state');
  }
  assert.equal(r.repository.revision(),revision);
  const view=await(await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).json();
  assert.equal('problemSecrets' in view,false);assert.equal(JSON.stringify(view).includes('5x-4'),false);
  assert.equal(view.problems.length,0);
  // 重置清除本路新增集合
  await post('learning/reset',{operationId:id(),confirmation:'清除本机学习记录与偏好'});
  const cleared=await(await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).json() as {problems:unknown[];memoryMentions:unknown[]};
  assert.deepEqual([cleared.problems.length,cleared.memoryMentions.length],[0,0]);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
