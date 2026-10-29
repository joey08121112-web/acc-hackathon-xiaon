import { createServer,type IncomingMessage } from 'node:http';
import { randomBytes,randomUUID,timingSafeEqual } from 'node:crypto';
import { schemas,SCHEMA_VERSION,RECOGNIZE_MAX_IMAGE_BYTES } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { failure,RuntimeError } from '../core/errors';
import { learningFor } from '../agents/learning';
import { MODEL_DISCLOSURE } from '../core/agent';
import { createStaticHandler } from './static';
import { NoTts,TTS_MAX_CHARS,type TtsProvider } from '../voice/tts';
import { NoAsr,ASR_MAX_WAV_BYTES,isWav,type AsrProvider } from '../voice/asr';
import { UserRuntimes } from '../storage/users';
import { freeChat } from '../free-chat/chat';
import { profilePost } from '../free-chat/profile';
import { chatRequests } from '../../shared/free-chat';
// G0: masked JPEG as base64 inside JSON; only this route gets a larger body, like /api/voice/asr.
const RECOGNIZE_BODY_LIMIT=Math.ceil(RECOGNIZE_MAX_IMAGE_BYTES*4/3)+2000;
const statusCodes:Record<string,number>={invalid_params:400,forbidden:403,not_found:404,conflict:409,invalid_state:409,not_implemented:501,unavailable:503};
export interface HttpServerConfig {
 allowedOrigins:string[];host:string;
 /** Exact HTTPS origins reached through a reverse proxy or PaaS. Empty keeps the server loopback-only. */
 publicOrigins?:string[];
 /** Extra Host values to accept, e.g. localhost:<port> for in-container health checks. */
 extraHosts?:string[];
 /** Built SPA directory served on the same origin; without it non-/api paths are not served. */
 staticDir?:string;
 /** Server-side speech synthesis; absent or unconfigured means the voice feature is reported unavailable. */
 tts?:TtsProvider;
 /** Server-side speech recognition; the client falls back to the browser's own when this is unavailable. */
 asr?:AsrProvider;
 /** Per-identity trial window counted server-side from first visit; 0 or absent disables the limit. */
 trialMs?:number;
}
/** A single runtime is one shared student (local tools and tests); UserRuntimes gives every anonymous identity its own database. */
export function createHttpServer(source:LearningRuntime|UserRuntimes,config:HttpServerConfig){
 const users=source instanceof UserRuntimes?source:undefined;const single=users?undefined:source as LearningRuntime;
 const publicOrigins=config.publicOrigins??[];const publicMode=publicOrigins.length>0;
 const allowed=new Set([...config.allowedOrigins,...publicOrigins]);const hosts=new Set([config.host,...(config.extraHosts??[]),...[...allowed].map(s=>new URL(s).host)]);
 const serveStatic=config.staticDir?createStaticHandler(config.staticDir):undefined;
 const localSessions=new Map<string,{csrf:string;expires:number;userId:string}>();let activeChat=false;const freeChatting=new Set<string>();
 // Voice limits are per user; the global caps protect the shared upstream services.
 const tts=config.tts??new NoTts();let ttsInFlight=0;const asr=config.asr??new NoAsr();let asrInFlight=0;
 const voice=new Map<string,{tts:number;ttsStarts:number[];asr:boolean;asrStarts:number[]}>();
 const voiceOf=(userId:string)=>{let v=voice.get(userId);if(!v){v={tts:0,ttsStarts:[],asr:false,asrStarts:[]};voice.set(userId,v);}return v;};
 // The trial window is server-side state tied to the identity itself, so refreshing or a new session cookie cannot extend it.
 const trialMs=config.trialMs??0;const trialGuard=(userId:string)=>{if(!users||!trialMs)return;const created=users.identities.createdAtOf(userId);if(!created||Date.parse(created)+trialMs<Date.now())throw new RuntimeError('unavailable','本轮体验时长已用完，感谢试用学伴小N！');};
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(body:unknown,status=200)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  try{
   const path=new URL(req.url??'/','http://127.0.0.1').pathname;
   // Behind a proxy the original host arrives in X-Forwarded-Host and a trailing :443 is the same HTTPS origin.
   // Platform health probes may carry an internal Host, so /api/health is exempt in public mode only.
   const rawHost=publicMode?String(req.headers['x-forwarded-host']??req.headers.host??'').split(',')[0].trim():(req.headers.host??'');
   const hostOk=hosts.has(rawHost)||(publicMode&&rawHost.endsWith(':443')&&hosts.has(rawHost.slice(0,-4)));
   if(!hostOk&&!(publicMode&&req.method==='GET'&&path==='/api/health'))throw new RuntimeError('forbidden','不接受此 Host');
   if(serveStatic&&path!=='/api'&&!path.startsWith('/api/')){if(!serveStatic(req,res,path))throw new RuntimeError('not_found');return;}
   if(req.method==='GET'&&path==='/api/health'){const kind=(users??single!).provider.kind;send({schemaVersion:SCHEMA_VERSION,status:'ok',voice:{tts:tts.enabled,asr:await asr.available()},mode:kind==='offline'?'local_rules':'model',providerKind:kind,learning:users?users.learning:!!learningFor(single!),disclosure:MODEL_DISCLOSURE});return;}
   if(req.method==='POST'){
    if(!allowed.has(req.headers.origin??'')||req.headers['sec-fetch-site']==='cross-site')throw new RuntimeError('forbidden','写操作需要允许的 Origin');
    if(!req.headers['content-type']?.startsWith('application/json'))throw new RuntimeError('invalid_params','需要 application/json');
   }else if(req.method!=='GET')throw new RuntimeError('not_found');
   if(req.method==='POST'&&path==='/api/local-session'){
    const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new RuntimeError('invalid_params');
    for(const[k,v]of localSessions)if(v.expires<Date.now())localSessions.delete(k);
    if(localSessions.size>=4096)throw new RuntimeError('unavailable','临时会话过多');
    // The long-lived identity cookie is the user boundary; an unknown or forged one gets a new, empty identity.
    const cookies:string[]=[];let userId='local';
    if(users){
     const known=users.identities.resolve(cookieValue(req,'xiaon_user')??'');
     if(known){trialGuard(known);userId=known;}else{const created=users.identities.create();userId=created.userId;cookies.push(`xiaon_user=${created.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=31536000${publicMode?'; Secure':''}`);}
     const own=[...localSessions].filter(([,v])=>v.userId===userId);for(const[k]of own.slice(0,Math.max(0,own.length-7)))localSessions.delete(k);
    }
    const sid=randomBytes(32).toString('hex');const csrf=randomBytes(32).toString('hex');localSessions.set(sid,{csrf,expires:Date.now()+8*3600000,userId});
    cookies.unshift(`xiaon_session=${sid}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${publicMode?'; Secure':''}`);
    res.setHeader('Set-Cookie',cookies);send({schemaVersion:SCHEMA_VERSION,csrfToken:csrf});return;
   }
   const cookie=cookieValue(req,'xiaon_session');
   const session=cookie?localSessions.get(cookie):undefined;
   if(!session||session.expires<Date.now())throw new RuntimeError('forbidden','本机会话缺失或已过期');
   if(req.method==='POST'&&!equalToken(String(req.headers['x-xiaon-csrf']??''),session.csrf))throw new RuntimeError('forbidden','缺少本地会话防护令牌');
   trialGuard(session.userId);
   // Everything below runs against this user's own runtime and database only.
   const lease=users?users.acquire(session.userId):{runtime:single!,release(){}};res.once('close',lease.release);
   const runtime=lease.runtime;const limits=voiceOf(session.userId);
   if(req.method==='GET'){
    if(path==='/api/learning'){const d=learningFor(runtime);if(!d)throw new RuntimeError('not_implemented');send(await d.view());return;}
    if(path==='/api/context'){send(runtime.context());return;}
    if(path==='/api/free-chat/profile'){send(runtime.freeChat.profile());return;}
    if(path==='/api/free-chat/history'){send(runtime.freeChat.history());return;}
    // G2: long-term trend (tracking plugin, zCode), derived from stored professional reports.
    if(path==='/api/learning/trend'){const d=learningFor(runtime);if(!d)throw new RuntimeError('not_implemented');send(await d.trend());return;}
    const match=path.match(/^\/api\/tasks\/([A-Za-z0-9_.:-]+)\/([1-9]\d*)$/);
    if(match){const task=runtime.catalog.publicTask(match[1],Number(match[2]));if(!task)throw new RuntimeError('not_found');send(task);return;}
    throw new RuntimeError('not_found');
   }
   const raw=await readBody(req,path==='/api/voice/asr'?Math.ceil(ASR_MAX_WAV_BYTES*4/3)+2000:path==='/api/learning/recognize'?RECOGNIZE_BODY_LIMIT:550000);
   if(path==='/api/voice/asr'){
    // Audio arrives as base64 WAV in JSON, is forwarded once, and is never stored or logged.
    const body=raw as {audio?:unknown};if(!body||typeof body!=='object'||Object.keys(body).some(k=>k!=='audio')||typeof body.audio!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.audio))throw new RuntimeError('invalid_params','需要 {audio: base64 WAV}');
    const wav=Buffer.from(body.audio,'base64');if(!isWav(wav)||wav.length>ASR_MAX_WAV_BYTES)throw new RuntimeError('invalid_params','需要不超过约50秒的 WAV 音频');
    if(!asr.configured)throw new RuntimeError('unavailable','尚未配置语音识别');
    const now=Date.now();while(limits.asrStarts.length&&now-limits.asrStarts[0]>60000)limits.asrStarts.shift();
    if(limits.asr||limits.asrStarts.length>=20||asrInFlight>=6)throw new RuntimeError('invalid_state','语音识别请求太频繁，请稍后再试');
    limits.asrStarts.push(now);limits.asr=true;asrInFlight++;
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    const requestId=randomUUID(),started=performance.now();res.setHeader('X-Xiaon-Voice-Request-Id',requestId);
    // Metadata only: neither audio nor recognized text is written to logs.
    console.info('[voice/asr]',JSON.stringify({requestId,stage:'received',bytes:wav.length}));
    try{
     const text=await asr.transcribe(wav,c.signal),ms=Math.round(performance.now()-started);
     res.setHeader('Server-Timing',`asr;dur=${ms}`);send({text});
     console.info('[voice/asr]',JSON.stringify({requestId,stage:'completed',ms,hasText:!!text.trim()}));
    }catch(e){
     console.info('[voice/asr]',JSON.stringify({requestId,stage:c.signal.aborted?'cancelled':'failed',ms:Math.round(performance.now()-started),code:e instanceof RuntimeError?e.code:'unknown'}));throw e;
    }finally{limits.asr=false;asrInFlight--;res.off('close',cancel);}
    return;
   }
   if(path==='/api/voice/tts'){
    // Browser sends text only. Speaker/resource/key are server configuration; at most 2 concurrent and 30 per minute.
    const body=raw as {text?:unknown};if(!body||typeof body!=='object'||Object.keys(body).some(k=>k!=='text')||typeof body.text!=='string')throw new RuntimeError('invalid_params','需要 {text}');
    if(!tts.enabled)throw new RuntimeError('unavailable','尚未配置语音合成');
    const now=Date.now();while(limits.ttsStarts.length&&now-limits.ttsStarts[0]>60000)limits.ttsStarts.shift();
    if(limits.tts>=2||limits.ttsStarts.length>=30||ttsInFlight>=8)throw new RuntimeError('invalid_state','朗读请求太频繁，请稍后再试');
    limits.ttsStarts.push(now);limits.tts++;ttsInFlight++;
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{const audio=await tts.synthesize(body.text.slice(0,TTS_MAX_CHARS+1),c.signal);res.setHeader('Content-Type','audio/mpeg');res.setHeader('Content-Length',String(audio.length));res.writeHead(200);res.end(audio);}
    finally{limits.tts--;ttsInFlight--;res.off('close',cancel);}
    return;
   }
   if(path==='/api/free-chat'){
    // 自由聊：一段提示词直连模型，不进学习记录；每人同一时间一条请求。
    if(freeChatting.has(session.userId))throw new RuntimeError('invalid_state','上一句还在回复中，请稍等');
    freeChatting.add(session.userId);
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{send(await freeChat(runtime.freeChat,runtime.provider,raw,c.signal));}finally{freeChatting.delete(session.userId);res.off('close',cancel);}
    return;
   }
   if(path==='/api/free-chat/new-thread'){if(!chatRequests.newThread.safeParse(raw).success)throw new RuntimeError('invalid_params');send(runtime.freeChat.newThread());return;}
   if(path.startsWith('/api/free-chat/')){const profile=profilePost(runtime.freeChat,path,raw);if(!profile)throw new RuntimeError('not_found');send(profile);return;}
   const d=learningFor(runtime);
   if(path.startsWith('/api/learning/')){
    if(!d)throw new RuntimeError('not_implemented');
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{switch(path){
     case '/api/learning/activate':send(await d.activate(raw as never));break;
     case '/api/learning/loop':send(await d.loopEvent(raw as never,c.signal));break;
     case '/api/learning/start':send(await d.start(raw as never));break;
     case '/api/learning/open':send(await d.open(raw as never));break;
     case '/api/learning/hint':send(await d.hint(raw as never));break;
     case '/api/learning/submit':send(await d.submit(raw as never,c.signal));break;
     case '/api/learning/grade':send(await d.grade(raw as never,c.signal));break;
     case '/api/learning/generate':send(await d.generate(raw as never,c.signal));break;
     case '/api/learning/generate-task':send(await d.generateTask(raw as never,c.signal));break;
     case '/api/learning/confirm':send(await d.confirm(raw as never));break;
     case '/api/learning/preference':send(await d.preference(raw as never));break;
     case '/api/learning/chat':send(await d.chat(raw as never,c.signal));break;
     case '/api/learning/memory-correct':send(await d.memoryCorrect(raw as never));break;
     case '/api/learning/reset':{const cleared=await d.reset(raw as never);runtime.freeChat.reset();send(cleared);break;}
     // G0 首页改版: thin delegations; the coordinator validates and calls the owning plugin. The image is never logged.
     case '/api/learning/problem/confirm':send(await d.confirmProblem(raw as never));break;
     case '/api/learning/recognize':send(await d.recognize(raw as never,c.signal));break;
     case '/api/learning/progress-card/confirm':send(await d.confirmProgressCard(raw as never));break;
     case '/api/learning/memory/confirm-draft':send(await d.confirmMemoryDraft(raw as never));break;
     case '/api/learning/greeting':send(await d.greeting(raw as never,c.signal));break;
     case '/api/learning/conversation/end':send(await d.endConversation(raw as never,c.signal));break;
     // G2 第二期：专业模式（interview 归 Claude；stage 归 zCode）。
     case '/api/learning/interview/start':send(await d.interviewStart(raw as never,c.signal));break;
     case '/api/learning/interview/answer':send(await d.interviewAnswer(raw as never,c.signal));break;
     case '/api/learning/interview/pause':send(await d.interviewPause(raw as never));break;
     case '/api/learning/interview/resume':send(await d.interviewResume(raw as never,c.signal));break;
     case '/api/learning/interview/report':send(await d.interviewReport(raw as never,c.signal));break;
     case '/api/learning/stage/draft':send(await d.stageDraft(raw as never,c.signal));break;
     case '/api/learning/stage/week-draft':send(await d.stageWeekDraft(raw as never));break;
     case '/api/learning/stage/confirm':send(await d.stageConfirm(raw as never));break;
     case '/api/learning/stage/retest-decline':send(await d.retestDecline(raw as never));break;
     default:throw new RuntimeError('not_found');
    }}finally{res.off('close',cancel);}return;
   }
   if(d&&['/api/sessions','/api/sessions/state','/api/attempts','/api/exposures','/api/chat'].includes(path))throw new RuntimeError('invalid_state','新版学习已启用，请使用受控 learning 学生事件入口');
   switch(path){
    case '/api/sessions':send(runtime.events.startSession(raw as never));break;
    case '/api/sessions/state':send(runtime.events.sessionState(raw as never));break;
    case '/api/attempts':send(runtime.events.submit(raw as never));break;
    case '/api/exposures':send(runtime.events.expose(raw as never));break;
    case '/api/consent':send(runtime.events.consent(raw as never));break;
    case '/api/memories':send(runtime.events.remember(raw as never));break;
    case '/api/memories/state':send(runtime.events.memoryState(raw as never));break;
    case '/api/import/preview':{const p=schemas.ImportPreviewRequest.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params');send(runtime.importer.preview(p.data.source));break;}
    case '/api/import':send(runtime.importer.import(raw as never));break;
    case '/api/chat':{
     const p=schemas.ChatRequest.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params');
     if(activeChat)throw new RuntimeError('invalid_state','已有模型请求正在执行，请先取消或等待');activeChat=true;
     const controller=new AbortController();const cancel=()=>{if(!res.writableEnded)controller.abort();};res.once('close',cancel);
     try{send(await runtime.agent.reply(p.data,{signal:controller.signal}));}finally{activeChat=false;res.off('close',cancel);}break;
    }
    case '/api/planning/due':if(!d)throw new RuntimeError('not_implemented');send(await runtime.planning().due({at:runtime.clock.now(),includePaused:true},runtime.engineContext()));break;
    default:throw new RuntimeError('not_found');
   }
  }catch(error){const f=failure(error);if(!res.writableEnded&&!res.destroyed)send({schemaVersion:SCHEMA_VERSION,ok:false,error:f},statusCodes[f.code]??500);}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 return server;
}
function cookieValue(req:IncomingMessage,name:string){return req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);}
function equalToken(actual:string,expected:string){const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
async function readBody(req:IncomingMessage,limit=550000):Promise<unknown>{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>limit)throw new RuntimeError('invalid_params','请求超出大小限制');chunks.push(Buffer.from(chunk));}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RuntimeError('invalid_params','无效JSON');}}
