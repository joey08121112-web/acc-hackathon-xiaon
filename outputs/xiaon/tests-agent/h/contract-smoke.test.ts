/** 所有者：ChatGPT（阶段 0 由 Claude 写的契约冒烟，可整体替换）。首页综合模式的入口：ChatRequest/ChatReply 契约、home 流程经 HTTP 可用、小结路由是桩。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas } from '../../shared/learning-contracts';
const port=Number(process.env.XIAON_H_HTTP_PORT??18972),origin='http://127.0.0.1:5212',base=`http://127.0.0.1:${port}`,id=()=>crypto.randomUUID();

test('ChatRequest stays backward compatible; intent/flow are optional and closed enums',()=>{
 const legacy={operationId:'op-1',history:[{role:'user',content:'你好'}]};
 assert.ok(schemas.ChatRequest.safeParse(legacy).success);
 assert.ok(schemas.ChatRequest.safeParse({...legacy,flow:'home',intent:'formal_test'}).success);
 assert.equal(schemas.ChatRequest.safeParse({...legacy,stage:'probe'}).success,false,'the client can never pick a stage');
 assert.equal(schemas.ChatRequest.safeParse({...legacy,intent:'skip_listening'}).success,false);
 assert.equal(schemas.ModeSuggestion.safeParse({mode:'professional',reason:'想看清楚自己的情况'}).success,true);
});

test('home flow over HTTP returns the full ChatReply; needs-check after 2 listen turns; conversation/end returns a summary',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const history:{role:'user'|'assistant';content:string}[]=[];const replies=[];
  for(const text of ['今天考砸了','数学']){history.push({role:'user',content:text});const res=await post('learning/chat',{operationId:id(),history,flow:'home'});assert.equal(res.status,200);const reply=schemas.ChatReply.parse(await res.json());replies.push(reply);history.push({role:'assistant',content:reply.text});}
  assert.deepEqual(replies.map(x=>x.stage),['listen','listen']);assert.deepEqual(replies.map(x=>x.needsCheck),[false,true]);assert.ok(replies[0].sessionId);
  const legacy=schemas.ChatReply.parse(await(await post('learning/chat',{operationId:id(),history:[{role:'user',content:'你好'}]})).json());assert.equal(legacy.stage,'listen');assert.equal(legacy.sessionId,null);
  assert.equal((await post('learning/chat',{operationId:id(),history:[{role:'user',content:'你好'}],intent:'study'})).status,400);
  // Claude phase 1 implemented conversation/end (was a 501 stub in G0).
  const end=await post('learning/conversation/end',{operationId:id(),sessionId:replies[0].sessionId,history});assert.equal(end.status,200);assert.equal(schemas.ConversationSummary.parse(await end.json()).sessionId,replies[0].sessionId);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
