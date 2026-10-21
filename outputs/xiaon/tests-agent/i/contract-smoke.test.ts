/** 所有者：zCode（阶段 0 由 Claude 写的契约冒烟，可整体替换）。错题记录、识题、记忆草稿、问候：schema 可解析，路由是桩，参考答案不出服务端。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION,RECOGNIZE_MAX_IMAGE_BYTES } from '../../shared/learning-contracts';
const port=Number(process.env.XIAON_I_HTTP_PORT??18973),origin='http://127.0.0.1:5213',base=`http://127.0.0.1:${port}`,id=()=>crypto.randomUUID();
const at='2026-10-21T08:00:00.000Z';
const draft={source:'spoken',questionText:'化简 3x+2x-4',studentWork:'5x+4',knowledgePointId:'like-terms',stuckPoint:'常数项的符号我弄反了',catalogTask:null} as const;
const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,0xff,0xd9]).toString('base64');

test('G0 zCode-lane schemas: drafts carry no answer status, secrets are separate, recognition needs mask confirmation',()=>{
 assert.ok(schemas.ProblemDraft.safeParse(draft).success);
 assert.equal(schemas.ProblemDraft.safeParse({...draft,answerStatus:'verified'}).success,false,'answerStatus is program-decided, never part of a draft');
 assert.equal(schemas.ProblemDraft.safeParse({...draft,knowledgePointId:'quadratics'}).success,false);
 assert.ok(schemas.ProblemRecord.safeParse({schemaVersion:SCHEMA_VERSION,id:'problem-1',operationId:'op-1',...draft,sessionId:null,answerStatus:'unknown',confirmedAt:at}).success);
 assert.ok(schemas.ProblemSecret.safeParse({schemaVersion:SCHEMA_VERSION,id:'secret-1',problemId:'problem-1',answer:['5x-4'],origin:'student_provided',createdAt:at}).success);
 const rec={operationId:'op-r',sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:true};
 assert.ok(schemas.Recognize.safeParse(rec).success);
 assert.equal(schemas.Recognize.safeParse({...rec,maskConfirmed:false}).success,false);
 assert.equal(schemas.Recognize.safeParse({...rec,mimeType:'image/png'}).success,false);
 assert.ok(schemas.MemoryDraft.safeParse({text:'喜欢打篮球',kind:'interest',origin:'chat'}).success);
 assert.ok(schemas.Greeting.safeParse({text:'又见面啦',memoryId:null,summaryId:null,memoryOff:true}).success);
});

test('G0 zCode-lane routes are stubs (501); recognize rejects unmasked, non-JPEG and oversize input first',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  for(const [path,body] of [
   ['learning/problem/confirm',{operationId:id(),sessionId:null,draft,referenceAnswer:'5x-4'}],
   ['learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:true}],
   ['learning/memory/confirm-draft',{operationId:id(),sessionId:null,draft:{text:'喜欢打篮球',kind:'interest',origin:'chat'},text:'喜欢打篮球'}],
   ['learning/greeting',{operationId:id()}],
  ] as const){const res=await post(path,body);assert.equal(res.status,501,path);assert.equal((await res.json()).error.code,'not_implemented');}
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:false})).status,400);
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/png',image:jpeg,maskConfirmed:true})).status,400);
  const tooBig='A'.repeat(Math.ceil(RECOGNIZE_MAX_IMAGE_BYTES/3)*4+4);
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:tooBig,maskConfirmed:true})).status,400);
  assert.equal((await post('learning/problem/confirm',{operationId:id(),sessionId:null,draft:{...draft,answerStatus:'verified'},referenceAnswer:null})).status,400);
  assert.equal(r.repository.list('problems').length+r.repository.list('problemSecrets').length,0);
  const view=await(await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).json();assert.equal('problemSecrets' in view,false);assert.deepEqual(view.problems,[]);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
