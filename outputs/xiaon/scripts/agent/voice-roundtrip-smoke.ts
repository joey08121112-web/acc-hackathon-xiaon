/** Real providers, synthetic audio only, isolated SQLite. Never points at the live learning database. */
import { readFileSync } from 'node:fs';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,freePort } from '../../server/storage/testing';
import { GlmProvider } from '../../server/providers/glm';
import { HedgedProvider } from '../../server/providers/hedge';
import { readGlmConfig } from '../../server/providers/config';
import { asrFromEnvironment } from '../../server/voice/asr';
import { ttsFromEnvironment } from '../../server/voice/tts';
import type { ChatReply } from '../../shared/learning-contracts';
const args=process.argv.slice(2);
if(args[0]!=='--synthetic'||args.length<2)throw new Error('Usage: voice-roundtrip-smoke.ts --synthetic <synthetic-16k-mono.wav> [more WAVs]');
const files=args.slice(1),config=readGlmConfig();if(!config.apiKey)throw new Error('真实模型尚未配置');
const f=temporaryRepository(),port=await freePort(),base=`http://127.0.0.1:${port}`,origin='http://127.0.0.1:5199';
const provider=new HedgedProvider(new GlmProvider(config.apiKey,config.model,fetch,config),config.hedgeMs);
const runtime=createRuntime({...f,provider,modelTimeoutMs:config.timeoutMs});installLearning(runtime);
const server=createHttpServer(runtime,{host:`127.0.0.1:${port}`,allowedOrigins:[origin],asr:asrFromEnvironment(),tts:ttsFromEnvironment()});
await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
try{
 const session=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 const {csrfToken}=await session.json(),cookie=session.headers.get('set-cookie')!.split(';')[0];
 const headers={Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Xiaon-CSRF':csrfToken};
 const post=async(path:string,body:unknown)=>{
  const r=await fetch(base+'/api/'+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  if(!r.ok){const e=await r.json();throw new Error(`${path}: HTTP ${r.status} ${e.error?.code} ${e.error?.message}`);}return r;
 };
 const history:{role:'user'|'assistant';content:string}[]=[];
 for(let i=0;i<3;i++){
  const wav=readFileSync(files[i%files.length]),start=performance.now();
  const r=await post('voice/asr',{audio:wav.toString('base64')}),heard=await r.json() as {text:string};
  const asrDone=performance.now();if(!heard.text.trim())throw new Error('合成音频未识别出文字');
  history.push({role:'user',content:heard.text});
  const reply=await(await post('learning/chat',{operationId:crypto.randomUUID(),history,flow:'home'})).json() as ChatReply;
  if(reply.run?.status!=='completed')throw new Error(`未取得真实模型完成证据: ${reply.run?.status}`);
  const chatDone=performance.now();
  // The UI reloads the view before showing the result; include that request as well.
  const view=await fetch(base+'/api/learning',{headers:{Cookie:cookie},signal:AbortSignal.timeout(10000)});if(!view.ok)throw new Error('view reload failed');await view.json();
  const reloadDone=performance.now(),audio=await(await post('voice/tts',{text:reply.text.slice(0,300)})).arrayBuffer(),end=performance.now();
  history.push({role:'assistant',content:reply.text});
  console.log(JSON.stringify({round:i+1,asrMs:Math.round(asrDone-start),chatMs:Math.round(chatDone-asrDone),reloadMs:Math.round(reloadDone-chatDone),ttsMs:Math.round(end-reloadDone),totalMs:Math.round(end-start),recognizedText:heard.text,replyChars:reply.text.length,audioBytes:audio.byteLength,requestId:r.headers.get('x-xiaon-voice-request-id')}));
 }
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));f.dispose();}
