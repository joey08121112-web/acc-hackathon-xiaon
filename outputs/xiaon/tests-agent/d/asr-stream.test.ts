import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync,gunzipSync } from 'node:zlib';
import { WebSocketServer } from 'ws';
import { DoubaoStreamingAsr } from '../../server/voice/asr-stream';
import { silentWav,readAsrConfig } from '../../server/voice/asr';

const response=(text:string,last=false)=>{
 const payload=gzipSync(JSON.stringify({result:{text}})),header=Buffer.from([0x11,last?0x93:0x91,0x11,0]),meta=Buffer.alloc(8);
 meta.writeInt32BE(last?-2:1);meta.writeUInt32BE(payload.length,4);return Buffer.concat([header,meta,payload]);
};
async function fixture(mode:'ok'|'drop'|'wait'='ok'){
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise<void>(r=>server.once('listening',r));
 const headers:Record<string,string|undefined>[]=[],audio:Buffer[]=[];
 server.on('connection',(ws,req)=>{
  headers.push({'key':req.headers['x-api-key'] as string,'resource':req.headers['x-api-resource-id'] as string});
  ws.on('message',raw=>{
   const b=Buffer.from(raw as Buffer),type=b[1]>>4,flags=b[1]&15;
   if(type===1){ws.send(response(''));return;}
   assert.equal(type,2);audio.push(gunzipSync(b.subarray(12)));
   if(flags&2){
    ws.send(response('中间结果'));
    if(mode==='ok')ws.send(response('最终识别文字',true));else if(mode==='drop')ws.close();
   }
  });
 });
 const url=`ws://127.0.0.1:${(server.address() as {port:number}).port}`;
 return{server,url,headers,audio,close:async()=>{for(const c of server.clients)c.terminate();await new Promise<void>(r=>server.close(()=>r()));}};
}
const config={apiKey:'sentinel-key',resourceId:'volc.seedasr.sauc.duration',timeoutMs:1000};

test('stream ASR uses its enabled resource, preserves PCM, waits for final result and caches a real availability probe',async()=>{
 const f=await fixture();try{
  const asr=new DoubaoStreamingAsr(config,f.url),wav=silentWav(0.5);
  assert.equal(await asr.transcribe(wav,AbortSignal.timeout(2000)),'最终识别文字');
  assert.deepEqual(f.headers[0],{key:'sentinel-key',resource:'volc.seedasr.sauc.duration'});
  assert.deepEqual(Buffer.concat(f.audio),wav.subarray(44));
  assert.equal(await asr.available(),true);const n=f.headers.length;assert.equal(await asr.available(),true);assert.equal(f.headers.length,n);
 }finally{await f.close();}
});
test('stream ASR never returns a partial result on disconnect; timeout and cancellation close the socket',async()=>{
 for(const mode of ['drop','wait'] as const){const f=await fixture(mode);try{
  const asr=new DoubaoStreamingAsr({...config,timeoutMs:80},f.url);
  await assert.rejects(asr.transcribe(silentWav(),AbortSignal.timeout(2000)),{code:mode==='drop'?'provider_error':'timeout'});
  const c=new AbortController(),pending=asr.transcribe(silentWav(),c.signal);c.abort(new Error('student stopped'));
  await assert.rejects(pending,/student stopped/);
 }finally{await f.close();}}
});
test('ASR config explicitly selects stream mode without changing the existing flash default',()=>{
 assert.equal(readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_ASR_MODE:'stream'})?.resourceId,'volc.seedasr.sauc.duration');
 assert.equal(readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k'})?.resourceId,'volc.bigasr.auc_turbo');
 assert.throws(()=>readAsrConfig({XIAON_DOUBAO_TTS_API_KEY:'k',XIAON_ASR_MODE:'guess'}),{code:'invalid_params'});
});
