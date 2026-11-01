/** 旧首页契约留档；2026-11-01 起 HTTP 首页流程停用，冒烟检查改为确认无法执行。 */
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

test('旧首页 home 与 legacy 对话请求均被拒绝，不能重新启用旧阶段提示词',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  for(const flow of [undefined,'home']){
   const res=await post('learning/chat',{operationId:id(),history:[{role:'user',content:'你好'}],...(flow?{flow}:{})});
   assert.equal(res.status,409);assert.equal((await res.json()).error.code,'invalid_state');
  }
  assert.equal((await post('learning/conversation/end',{operationId:id(),sessionId:'old',history:[]})).status,409);
  assert.equal(r.repository.list('runs').length+r.repository.list('summaries').length,0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
