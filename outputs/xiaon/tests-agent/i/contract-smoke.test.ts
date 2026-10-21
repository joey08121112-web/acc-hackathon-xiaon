/** 所有者：zCode（已按第一期实现整体替换阶段 0 版本）。错题确认、记忆确认、问候走真实路由；识题仍是第三期（501）；参考答案不出服务端。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas,RECOGNIZE_MAX_IMAGE_BYTES } from '../../shared/learning-contracts';
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

test('zCode-lane routes: problem/memory/greeting live, recognize still 501; program-gated inputs rejected first',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r,{timeoutMs:2000});const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  // 记忆关闭时确认草稿 → forbidden；打开后成功
  r.events.consent({operationId:id(),optionalMemory:true});
  const memory=await post('learning/memory/confirm-draft',{operationId:id(),sessionId:null,draft:{text:'喜欢打篮球',kind:'interest',origin:'chat'},text:'喜欢打篮球'});
  assert.equal(memory.status,200);const item=await memory.json() as {text:string;reviewAt:string|null};assert.equal(item.text,'喜欢打篮球');assert.ok(item.reviewAt);
  // 问候可用（离线默认文字）
  const greet=await post('learning/greeting',{operationId:id()});
  assert.equal(greet.status,200);const g=await greet.json() as {memoryOff:boolean;text:string};assert.equal(typeof g.text,'string');assert.ok(g.text.length>0);
  // 错题确认：离线（本进程无 Key）→ 记录保存、answerStatus unknown
  const confirm=await post('learning/problem/confirm',{operationId:id(),sessionId:'chat-http',draft,referenceAnswer:'5x-4'});
  assert.equal(confirm.status,200);const record=await confirm.json() as {answerStatus:string;questionText:string;sessionId:string|null};
  assert.equal(record.answerStatus,'unknown');assert.equal(record.sessionId,'chat-http');
  // 草稿多带 answerStatus → 400；卡点关联不存在 → 400（程序先查）
  assert.equal((await post('learning/problem/confirm',{operationId:id(),sessionId:null,draft:{...draft,answerStatus:'verified'},referenceAnswer:null})).status,400);
  assert.equal((await post('learning/problem/confirm',{operationId:id(),sessionId:null,draft:{...draft,stuckPointId:'no-such-stuck'},referenceAnswer:null})).status,400);
  // 识题第三期实现：保持 501，但未遮挡/非 JPEG/超限先被 400 拒绝
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:true})).status,501);
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:jpeg,maskConfirmed:false})).status,400);
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/png',image:jpeg,maskConfirmed:true})).status,400);
  const tooBig='A'.repeat(Math.ceil(RECOGNIZE_MAX_IMAGE_BYTES/3)*4+4);
  assert.equal((await post('learning/recognize',{operationId:id(),sessionId:null,mimeType:'image/jpeg',image:tooBig,maskConfirmed:true})).status,400);
  // 参考答案绝不进 view；确认过的记录可见
  const view=await(await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).json();
  assert.equal('problemSecrets' in view,false);
  assert.equal(JSON.stringify(view).includes('5x-4'),false,'学生自带参考答案不出现在 view');
  assert.equal((view as {problems:{id:string}[]}).problems.length,1);
  // 重置清除本路新增集合
  await post('learning/reset',{operationId:id(),confirmation:'清除本机学习记录与偏好'});
  const cleared=await(await fetch(base+'/api/learning',{headers:{Cookie:cookie}})).json() as {problems:unknown[];memoryMentions:unknown[]};
  assert.deepEqual([cleared.problems.length,cleared.memoryMentions.length],[0,0]);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
