import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,freePort } from '../../server/storage/testing';
import { DoubaoAsr,NoAsr,isWav,readAsrConfig,silentWav,type AsrProvider } from '../../server/voice/asr';
import { EndpointDetector } from '../../src/voice/vad';
import { bytesToBase64,encodeWav } from '../../src/voice/wav';
import { RuntimeError } from '../../server/core/errors';

// ---- end-of-speech detection (pure, clock injected) ----
const run=(d:EndpointDetector,plan:[number,number,number][])=>{ // [fromMs,toMs,rms]
 let t=1000,result='continue';
 for(const [from,to,rms] of plan)for(t=1000+from;t<1000+to;t+=50){result=d.push(rms,t);if(result!=='continue')return {result,at:t-1000};}
 return {result,at:t-1000};
};
test('speech ends after a pause; a steady noisy room is not speech; a click is not speech; silence times out',()=>{
 assert.deepEqual(run(new EndpointDetector(),[[0,400,0.004],[400,1300,0.12],[1300,6000,0.004]]),{result:'end',at:2650});
 assert.equal(run(new EndpointDetector(),[[0,8000,0.03]]).result,'no-speech','constant loud room (calibrated as noise)');
 assert.equal(run(new EndpointDetector(),[[0,500,0.004],[500,600,0.2],[600,8000,0.004]]).result,'no-speech','100 ms click');
 assert.equal(run(new EndpointDetector(),[[0,8000,0.004]]).result,'no-speech');
 assert.equal(run(new EndpointDetector(),[[0,400,0.004],[400,40000,0.12]]).result,'max','never-ending speech is cut at 30 s');
 const d=new EndpointDetector();run(d,[[0,400,0.004],[400,1000,0.1]]);assert.equal(d.hasSpeech,true);
 assert.deepEqual(run(new EndpointDetector(),[[0,1200,0.12],[1200,5000,0.004]]),{result:'end',at:2550},'a student who starts speaking at once is still heard (own voice is not calibrated away)');
});

// ---- WAV ----
test('encodeWav writes a valid 16 kHz mono 16-bit file and clips out-of-range samples',()=>{
 const wav=Buffer.from(encodeWav(new Float32Array([0,0.5,-0.5,2,-2])));
 assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.subarray(8,12).toString(),'WAVE');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt16LE(34),16);assert.equal(wav.readUInt32LE(40),10);
 assert.equal(wav.readInt16LE(46),16383);assert.equal(wav.readInt16LE(50),32767);assert.equal(wav.readInt16LE(52),-32768);assert.equal(isWav(Buffer.from(encodeWav(new Float32Array(0)))),false,'a header with no samples is not accepted as speech');
 const big=Buffer.from(encodeWav(new Float32Array(16000)));assert.equal(isWav(big),true);assert.deepEqual(Buffer.from(bytesToBase64(big),'base64'),big);
 assert.equal(bytesToBase64(new Uint8Array(100_000)).length,Math.ceil(100_000/3)*4,'large buffers encode without a call-stack blow-up');
});

// ---- Doubao ASR provider ----
const respond=(code:string,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'X-Api-Status-Code':code}});
const config={apiKey:'sentinel-key',resourceId:'volc.bigasr.auc_turbo',timeoutMs:2000};
const sig=()=>AbortSignal.timeout(2000);
test('Doubao ASR sends one request with server-side config, returns text, and maps vendor outcomes',async()=>{
 const calls:{url:string;headers:Record<string,string>;body:{audio:{data:string};request:{model_name:string}}}[]=[];
 const ok=(async(url:string,init:RequestInit)=>{calls.push({url,headers:init.headers as Record<string,string>,body:JSON.parse(String(init.body))});return respond('20000000',{result:{text:' 我今天有点烦 '}});}) as unknown as typeof fetch;
 const asr=new DoubaoAsr(config,ok);const wav=Buffer.from(encodeWav(new Float32Array(8000)));
 assert.equal(await asr.transcribe(wav,sig()),'我今天有点烦');
 assert.equal(calls[0].url,'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash');assert.equal(calls[0].headers['X-Api-Key'],'sentinel-key');assert.equal(calls[0].headers['X-Api-Resource-Id'],'volc.bigasr.auc_turbo');assert.equal(calls[0].headers['X-Api-Sequence'],'-1');
 assert.equal(calls[0].body.audio.data,wav.toString('base64'));assert.equal(calls[0].body.request.model_name,'bigmodel');
 assert.equal(await new DoubaoAsr(config,(async()=>respond('20000003',{})) as unknown as typeof fetch).transcribe(wav,sig()),'','no speech is an empty result, not an error');
 await assert.rejects(new DoubaoAsr(config,(async()=>respond('45000030',{header:{code:45000030}},403)) as unknown as typeof fetch).transcribe(wav,sig()),{code:'provider_auth'});
 await assert.rejects(new DoubaoAsr(config,(async()=>respond('55000000',{})) as unknown as typeof fetch).transcribe(wav,sig()),{code:'provider_error'});
 await assert.rejects(new DoubaoAsr(config,(async()=>new Response('x',{status:429})) as unknown as typeof fetch).transcribe(wav,sig()),{code:'provider_rate_limit'});
 await assert.rejects(new DoubaoAsr(config,(async()=>{throw new Error('down');}) as unknown as typeof fetch).transcribe(wav,sig()),{code:'provider_error'});
 await assert.rejects(asr.transcribe(Buffer.from('not a wav at all, definitely longer than forty-four bytes of text'),sig()),{code:'invalid_params'});
 await assert.rejects(asr.transcribe(Buffer.concat([wav,Buffer.alloc(1_700_000)]),sig()),{code:'invalid_params'});
});
test('available() asks the vendor with silence once, caches the answer, and re-checks a refusal later',async()=>{
 let t=0,calls=0,granted=false;
 const f=(async()=>{calls++;return granted?respond('20000003',{}):respond('45000030',{},403);}) as unknown as typeof fetch;
 const asr=new DoubaoAsr(config,f,()=>t);
 assert.equal(await asr.available(),false);assert.equal(await asr.available(),false);assert.equal(calls,1,'refusal cached for a minute');
 granted=true;t+=61_000;assert.equal(await asr.available(),true);assert.equal(await asr.available(),true);assert.equal(calls,2,'grant cached');
 assert.equal(isWav(silentWav()),true);
});
test('ASR config: shares the TTS key unless a separate one is set, and can be switched off',()=>{
 assert.equal(readAsrConfig({}),null);
 assert.equal(readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k'})?.apiKey,'k');assert.equal(readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_DOUBAO_ASR_API_KEY:'a'})?.apiKey,'a');
 assert.equal(readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k'})?.resourceId,'volc.bigasr.auc_turbo');assert.equal(readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_ASR_PROVIDER:'off'}),null);
 assert.throws(()=>readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_DOUBAO_ASR_RESOURCE_ID:'bad id!'}),{code:'invalid_params'});
});

// ---- HTTP route ----
// Integration phase 1: the fixed 18952/18953 collided with the lanes' dev ports; the OS now assigns free ports unless overridden.
const [port,port2]=process.env.XIAON_D_ASR_PORT?[Number(process.env.XIAON_D_ASR_PORT),Number(process.env.XIAON_D_ASR_PORT)+1]:[await freePort(),await freePort()],origin='http://127.0.0.1:5194',base=`http://127.0.0.1:${port}`;
test('/api/voice/asr needs a session + CSRF, accepts only a base64 WAV, and health reports whether recognition is really available',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);
 let granted=false;const heard:Buffer[]=[];
 const fake:AsrProvider={configured:true,async available(){return granted;},async transcribe(wav){heard.push(wav);if(!granted)throw new RuntimeError('provider_auth','尚未开通');return '我听到了';}};
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin],asr:fake});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  assert.equal((await(await fetch(base+'/api/health')).json()).voice.asr,false,'configured but not granted is reported as unavailable');
  granted=true;assert.equal((await(await fetch(base+'/api/health')).json()).voice.asr,true);
  const wav=Buffer.from(encodeWav(new Float32Array(16000))).toString('base64');
  const noSession=await fetch(base+'/api/voice/asr',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({audio:wav})});assert.equal(noSession.status,403);
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(body:unknown,csrf=token)=>fetch(base+'/api/voice/asr',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({audio:wav},'wrong')).status,403);
  assert.equal((await post({audio:wav,language:'en'})).status,400);assert.equal((await post({audio:'not base64!!'})).status,400);assert.equal((await post({audio:Buffer.from('plain text, not audio, but long enough to pass a size check....').toString('base64')})).status,400);
  assert.equal(heard.length,0,'nothing invalid reached the vendor');
  const good=await post({audio:wav});assert.equal(good.status,200);assert.deepEqual(await good.json(),{text:'我听到了'});assert.equal(heard.length,1);assert.deepEqual(heard[0],Buffer.from(wav,'base64'));
  assert.match(good.headers.get('x-xiaon-voice-request-id')??'',/^[a-f0-9-]{36}$/);
  assert.match(good.headers.get('server-timing')??'',/^asr;dur=\d+/);
  const huge=await post({audio:Buffer.alloc(1_700_000,1).toString('base64')});assert.equal(huge.status,400);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
 const g=temporaryRepository(),q=createRuntime(g);installLearning(q);const off=createHttpServer(q,{host:`127.0.0.1:${port2}`,allowedOrigins:[origin],asr:new NoAsr()});await new Promise<void>(resolve=>off.listen(port2,'127.0.0.1',resolve));
 try{
  const b2=`http://127.0.0.1:${port2}`;assert.equal((await(await fetch(b2+'/api/health')).json()).voice.asr,false);
  const login=await fetch(b2+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const res=await fetch(b2+'/api/voice/asr',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify({audio:Buffer.from(encodeWav(new Float32Array(16000))).toString('base64')})});assert.equal(res.status,503);
 }finally{off.closeAllConnections();await new Promise<void>(resolve=>off.close(()=>resolve()));g.dispose();}
});
