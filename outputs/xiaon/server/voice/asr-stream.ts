import WebSocket from 'ws';
import { gzipSync,gunzipSync } from 'node:zlib';
import { RuntimeError } from '../core/errors';
import { ASR_MAX_WAV_BYTES,isWav,silentWav,type AsrConfig,type AsrProvider } from './asr';

// Official single-utterance mode of Streaming ASR 2.0; credentials stay on the server.
export const ASR_STREAM_ENDPOINT='wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';
function packet(type:number,seq:number,payload:Buffer,last=false){
 const data=gzipSync(payload),header=Buffer.from([0x11,(type<<4)|(last?3:1),type===1?0x11:0x01,0]),meta=Buffer.alloc(8);
 meta.writeInt32BE(last?-seq:seq);meta.writeUInt32BE(data.length,4);return Buffer.concat([header,meta,data]);
}
function pcm(wav:Buffer):Buffer{
 if(!isWav(wav)||wav.length>ASR_MAX_WAV_BYTES)throw new RuntimeError('invalid_params','需要不超过约50秒的 WAV 音频');
 let valid=false;
 for(let at=12;at+8<=wav.length;){
  const size=wav.readUInt32LE(at+4),start=at+8,end=start+size;
  if(end>wav.length)break;
  const kind=wav.toString('ascii',at,at+4);
  if(kind==='fmt '&&size>=16)valid=wav.readUInt16LE(start)===1&&wav.readUInt16LE(start+2)===1&&wav.readUInt32LE(start+4)===16000&&wav.readUInt16LE(start+14)===16;
  if(kind==='data'&&valid&&size>0&&size%2===0)return wav.subarray(start,end);
  at=end+(size%2);
 }
 throw new RuntimeError('invalid_params','语音需要16kHz单声道16位PCM WAV');
}
function decode(data:Buffer){
 if(data.length<8||(data[0]>>4)!==1)throw new Error('invalid frame');
 const type=data[1]>>4,flags=data[1]&15,compression=data[2]&15,serialization=data[2]>>4;
 let at=(data[0]&15)*4;
 if(at<4||at>data.length-4)throw new Error('invalid header');
 if(flags&1)at+=4;
 if(flags&4)at+=4;
 let code=0;
 if(type===15){if(at+8>data.length)throw new Error('invalid error frame');code=data.readUInt32BE(at);at+=4;}
 else if(type!==9)throw new Error('unexpected frame');
 if(at+4>data.length)throw new Error('missing size');
 const size=data.readUInt32BE(at);at+=4;
 if(size>2_000_000||at+size!==data.length)throw new Error('invalid payload size');
 let body=data.subarray(at);
 if(compression===1)body=gunzipSync(body,{maxOutputLength:2_000_000});else if(compression!==0)throw new Error('unsupported compression');
 const value=body.length&&serialization===1?JSON.parse(body.toString('utf8')):{};
 return{code,last:!!(flags&2),value};
}
export class DoubaoStreamingAsr implements AsrProvider{
 readonly configured=true;
 private granted:{value:boolean;until:number}|null=null;
 private probing:Promise<boolean>|null=null;
 constructor(private config:AsrConfig,private endpoint=ASR_STREAM_ENDPOINT){}
 async transcribe(wav:Buffer,signal:AbortSignal):Promise<string>{
  const audio=pcm(wav);signal.throwIfAborted();
  return new Promise<string>((resolve,reject)=>{
   const ws=new WebSocket(this.endpoint,{headers:{'X-Api-Key':this.config.apiKey,'X-Api-Resource-Id':this.config.resourceId,'X-Api-Request-Id':crypto.randomUUID(),'X-Api-Connect-Id':crypto.randomUUID()},handshakeTimeout:this.config.timeoutMs,maxPayload:2_000_000,followRedirects:false});
   let settled=false,audioSent=false,latest='';
   const finish=(error:unknown,text='')=>{
    if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
    ws.terminate();
    if(error){if(error instanceof RuntimeError&&error.code==='provider_auth')this.granted={value:false,until:Date.now()+60_000};reject(error);}
    else{this.granted={value:true,until:Date.now()+300_000};resolve(text);}
   };
   const timer=setTimeout(()=>finish(new RuntimeError('timeout','语音识别超时')),this.config.timeoutMs);
   const abort=()=>finish(signal.reason);signal.addEventListener('abort',abort,{once:true});
   ws.on('open',()=>{
    const body={user:{uid:'xiaon'},audio:{format:'pcm',rate:16000,bits:16,channel:1},request:{model_name:'bigmodel',enable_itn:true,enable_punc:true,result_type:'full'}};
    ws.send(packet(1,1,Buffer.from(JSON.stringify(body))));
   });
   ws.on('message',raw=>{
    if(settled)return;
    try{
     const frame=decode(Buffer.from(raw as Buffer));
     if(frame.code===20000003){finish(null,'');return;}
     if(frame.code){finish(new RuntimeError(frame.code===45000030?'provider_auth':'provider_error',`语音识别返回 ${frame.code}`));return;}
     if(typeof frame.value.result?.text==='string')latest=frame.value.result.text.trim();
     if(frame.last){finish(null,latest);return;}
     if(!audioSent){
      audioSent=true;
      // The browser already ended this utterance. Send 200ms PCM packets, marking the final one.
      for(let offset=0,seq=2;offset<audio.length;offset+=6400,seq++)ws.send(packet(2,seq,audio.subarray(offset,offset+6400),offset+6400>=audio.length));
     }
    }catch{finish(new RuntimeError('provider_error','语音识别返回了无法解析的内容'));}
   });
   ws.on('unexpected-response',(_req,res)=>{res.resume();finish(new RuntimeError(res.statusCode===401||res.statusCode===403?'provider_auth':res.statusCode===429?'provider_rate_limit':'provider_error',`语音识别连接被拒绝（HTTP ${res.statusCode}）`));});
   ws.on('error',()=>finish(new RuntimeError('provider_error','语音识别连接失败')));
   ws.on('close',()=>{if(!settled)finish(new RuntimeError('provider_error','语音识别连接提前结束，请重试'));});
  });
 }
 async available():Promise<boolean>{
  if(this.granted&&this.granted.until>Date.now())return this.granted.value;
  if(this.probing)return this.probing;
  this.probing=this.transcribe(silentWav(),AbortSignal.timeout(8000)).then(()=>true).catch(()=>{
   if(!this.granted||this.granted.until<Date.now())this.granted={value:false,until:Date.now()+15_000};return false;
  }).finally(()=>{this.probing=null;});
  return this.probing;
 }
}
