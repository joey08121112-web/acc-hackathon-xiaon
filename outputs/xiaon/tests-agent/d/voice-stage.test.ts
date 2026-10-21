import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning,SAFETY_REPLY } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,freePort } from '../../server/storage/testing';
import { DoubaoTts,NoTts,jsonObjects,readTtsConfig,type TtsProvider } from '../../server/voice/tts';
import { RuntimeError } from '../../server/core/errors';
import type { ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
class Recorder implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;fail=false;systems:string[]=[];users:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.systems.push(input.messages.find(m=>m.role==='system')!.content);this.users.push(input.messages.find(m=>m.role==='user')!.content);
  if(this.fail)throw new RuntimeError('provider_error','synthetic failure');
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[]}),toolCalls:[]};
 }
}
const setup=(p:Recorder)=>{const f=temporaryRepository(),r=createRuntime({...f,provider:p}),d=installLearning(r,{timeoutMs:200});return{...f,r,d};};
const turns=(n:number)=>Array.from({length:n},(_,i)=>({role:i%2===0?'user' as const:'assistant' as const,content:'第'+i+'句'}));

test('step 1 listens on the first student turn, step 2 probes afterwards; the program, not the client, picks the stage',async()=>{
 const p=new Recorder(),f=setup(p);try{
  const first=await f.d.chat({operationId:id(),history:[{role:'user',content:'今天考砸了'}]}) as {stage:string;quickReplies:string[]};
  assert.equal(first.stage,'listen');assert.match(p.systems[0],/tutor-d3-listen/);assert.match(p.systems[0],/接住情绪/);assert.ok(first.quickReplies.includes('不想说'));
  const second=await f.d.chat({operationId:id(),history:[{role:'user',content:'考砸了'},{role:'assistant',content:'听起来挺难受的'},{role:'user',content:'我就是不会'}]}) as {stage:string;quickReplies:string[]};
  assert.equal(second.stage,'probe');assert.match(p.systems[1],/tutor-d3-probe/);assert.match(p.systems[1],/找到真正卡点/);assert.ok(second.quickReplies.includes('不知道从哪下手'));
  await assert.rejects(f.d.chat({operationId:id(),history:[{role:'user',content:'你好'}],stage:'probe'} as never),{code:'invalid_params'});
 }finally{f.dispose();}
});

test('Tutor sees the recent conversation (8 turns), not only the last sentence',async()=>{
 const p=new Recorder(),f=setup(p);try{
  await f.d.chat({operationId:id(),history:[...turns(11),{role:'user',content:'最后一句'}]});
  const sent=JSON.parse(p.users[0]) as {history:{content:string}[]};
  assert.equal(sent.history.length,8);assert.equal(sent.history.at(-1)?.content,'最后一句');assert.ok(sent.history.length>1);
 }finally{f.dispose();}
});

test('self-harm wording is answered by a fixed program message: no model call, nothing stored',async()=>{
 const p=new Recorder(),f=setup(p);try{
  const reply=await f.d.chat({operationId:id(),history:[{role:'user',content:'我真的不想活了'}]}) as {text:string;safety:boolean;run:unknown};
  assert.equal(reply.safety,true);assert.equal(reply.text,SAFETY_REPLY);assert.equal(reply.run,null);assert.match(reply.text,/110/);
  assert.equal(p.systems.length,0);assert.equal(f.r.repository.list('runs').length,0);assert.equal(f.r.repository.list('exposures').length,0);
 }finally{f.dispose();}
});

test('chat only counts as task help after the Tutor really answered',async()=>{
 const p=new Recorder(),f=setup(p);try{
  const s=await f.d.start({operationId:id(),mode:'support'});await f.d.open({operationId:id(),sessionId:s.id,taskId:'model',taskVersion:2});
  const helps=()=>f.r.repository.list('exposures').filter(e=>e.kind==='chat_help').length;
  p.fail=true;const failed=await f.d.chat({operationId:id(),history:[{role:'user',content:'这题怎么办'}]});assert.equal(failed.run?.status,'failed');assert.equal(helps(),0);
  p.fail=false;const ok=await f.d.chat({operationId:id(),history:[{role:'user',content:'这题怎么办'}]});assert.equal(ok.run?.status,'completed');assert.equal(helps(),1);
 }finally{f.dispose();}
});

test('TTS stream parser survives any chunk boundary, braces inside strings and concatenated objects',()=>{
 const text='{"code":0,"message":"a}{b","data":"AAEC"}{"code":0,"data":"AwQ="}\n{"code":20000000,"data":null}';
 for(let cut=1;cut<text.length;cut++){
  let pending='',codes:number[]=[];
  for(const piece of [text.slice(0,cut),text.slice(cut)]){pending+=piece;let consumed=pending;for(const {value,rest} of jsonObjects(pending)){consumed=rest;codes.push((value as {code:number}).code);}pending=consumed;}
  assert.deepEqual(codes,[0,0,20000000],'cut at '+cut);
 }
});
const streamOf=(parts:string[])=>new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(new TextEncoder().encode(p));c.close();}}),{status:200});
const config={apiKey:'sentinel-key',resourceId:'seed-tts-2.0',speaker:'zh_test',timeoutMs:2000};
test('Doubao TTS assembles audio, sends only server config + text, caches repeats, rejects vendor errors and empty audio',async()=>{
 const calls:{url:string;headers:Record<string,string>;body:string}[]=[];
 const ok=(async(url:string,init:RequestInit)=>{calls.push({url,headers:init.headers as Record<string,string>,body:String(init.body)});return streamOf(['{"code":0,"data":"AAEC"}{"code":0,"da','ta":"AwQ="}','{"code":20000000,"data":null}']);}) as unknown as typeof fetch;
 const tts=new DoubaoTts(config,ok);const audio=await tts.synthesize('你好，小N',AbortSignal.timeout(2000));
 assert.deepEqual([...audio],[0,1,2,3,4]);assert.equal(calls[0].url,'https://openspeech.bytedance.com/api/v3/tts/unidirectional');
 assert.equal(calls[0].headers['X-Api-Key'],'sentinel-key');assert.equal(calls[0].headers['X-Api-Resource-Id'],'seed-tts-2.0');assert.match(calls[0].headers['X-Api-Request-Id'],/^[0-9a-f-]{36}$/);
 const body=JSON.parse(calls[0].body);assert.deepEqual(Object.keys(body),['req_params']);assert.equal(body.req_params.speaker,'zh_test');assert.equal(body.req_params.text,'你好，小N');
 await tts.synthesize('你好，小N',AbortSignal.timeout(2000));assert.equal(calls.length,1,'repeat text is served from cache');
 await assert.rejects(new DoubaoTts(config,(async()=>streamOf(['{"code":45000001,"message":"bad"}'])) as unknown as typeof fetch).synthesize('x',AbortSignal.timeout(2000)),{code:'provider_error'});
 await assert.rejects(new DoubaoTts(config,(async()=>streamOf(['{"code":20000000,"data":null}'])) as unknown as typeof fetch).synthesize('x',AbortSignal.timeout(2000)),{code:'provider_error'});
 await assert.rejects(new DoubaoTts(config,(async()=>new Response('no',{status:401})) as unknown as typeof fetch).synthesize('x',AbortSignal.timeout(2000)),{code:'provider_auth'});
 await assert.rejects(tts.synthesize('字'.repeat(301),AbortSignal.timeout(2000)),{code:'invalid_params'});
});
test('TTS is off unless provider, key and speaker are all configured',()=>{
 assert.equal(readTtsConfig({}),null);assert.equal(readTtsConfig({XIAON_TTS_PROVIDER:'doubao',XIAON_DOUBAO_TTS_API_KEY:'k'}),null);
 assert.equal(readTtsConfig({XIAON_TTS_PROVIDER:'doubao',XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_DOUBAO_TTS_SPEAKER:'s'})?.resourceId,'seed-tts-2.0');
 assert.throws(()=>readTtsConfig({XIAON_TTS_PROVIDER:'doubao',XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_DOUBAO_TTS_SPEAKER:'bad speaker!'}),{code:'invalid_params'});
});

// Integration phase 1: the fixed 18950/18951 overlapped the lanes' dev ports; the OS now assigns free ports unless overridden.
const [port,port2]=process.env.XIAON_D_VOICE_PORT?[Number(process.env.XIAON_D_VOICE_PORT),Number(process.env.XIAON_D_VOICE_PORT)+1]:[await freePort(),await freePort()],origin='http://127.0.0.1:5194',base=`http://127.0.0.1:${port}`,base2=`http://127.0.0.1:${port2}`;
test('/api/voice/tts needs a local session + CSRF, accepts only {text}, reports availability and returns audio',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);
 const fake:TtsProvider={enabled:true,async synthesize(text){if(text.length>300)throw new RuntimeError('invalid_params');return Buffer.from('ID3-fake-'+text);}};
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin],tts:fake});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  assert.equal((await(await fetch(base+'/api/health')).json()).voice.tts,true);
  const noSession=await fetch(base+'/api/voice/tts',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"text":"hi"}'});assert.equal(noSession.status,403);
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(body:unknown,csrf=token)=>fetch(base+'/api/voice/tts',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({text:'hi'},'wrong')).status,403);
  assert.equal((await post({text:'hi',speaker:'other'})).status,400);assert.equal((await post({text:5})).status,400);
  const good=await post({text:'你好'});assert.equal(good.status,200);assert.equal(good.headers.get('content-type'),'audio/mpeg');assert.match(Buffer.from(await good.arrayBuffer()).toString(),/^ID3-fake-你好/);
  assert.equal((await post({text:'字'.repeat(301)})).status,400);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
 const g=temporaryRepository(),q=createRuntime(g);installLearning(q);const off=createHttpServer(q,{host:`127.0.0.1:${port2}`,allowedOrigins:[origin],tts:new NoTts()});await new Promise<void>(resolve=>off.listen(port2,'127.0.0.1',resolve));
 try{
  assert.equal((await(await fetch(base2+'/api/health')).json()).voice.tts,false);
  const login=await fetch(base2+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const res=await fetch(base2+'/api/voice/tts',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:'{"text":"hi"}'});assert.equal(res.status,503);
 }finally{off.closeAllConnections();await new Promise<void>(resolve=>off.close(()=>resolve()));g.dispose();}
});
