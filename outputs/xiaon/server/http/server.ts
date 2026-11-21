import { createServer,type IncomingMessage } from 'node:http';
import { randomBytes,randomUUID,timingSafeEqual } from 'node:crypto';
import { schemas,SCHEMA_VERSION } from '../../shared/learning-contracts';
import { isLegacyHomePath,LEGACY_HOME_DISABLED_MESSAGE } from '../../shared/legacy-home';
import { maskPhone,type AuthStatus } from '../../shared/auth';
import type { LearningRuntime } from '../bootstrap';
import { failure,RuntimeError } from '../core/errors';
import { learningFor } from '../agents/learning';
import { MODEL_DISCLOSURE } from '../core/agent';
import { createStaticHandler } from './static';
import { NoTts,TTS_MAX_CHARS,type TtsProvider } from '../voice/tts';
import { NoAsr,ASR_MAX_WAV_BYTES,isWav,type AsrProvider } from '../voice/asr';
import { UserRuntimes,LOGIN_COOKIE_MAX_AGE } from '../storage/users';
import { RateLimiter } from '../core/rate-limit';
import { freeChat,FREE_CHAT_DISCLOSURE } from '../free-chat/chat';
import { profilePost } from '../free-chat/profile';
import { consolidate,idleMsFromEnv,shouldConsolidate } from '../free-chat/consolidate';
import { chatRequests,type DigestResponse } from '../../shared/free-chat';
import { exportFreeChat } from '../free-chat/export';
import { exportLearning } from '../core/export';
// 错误码 → HTTP 状态。2026-11-21 补全：契约里 16 个错误码原来只映射了 7 个，其余全落 500。
// 落 500 的后果不只是数字难看：unknown_tool / budget_exhausted 是客户端能自己解决的问题，
// 却让前端和监控以为服务端坏了；provider_* 应该是 502/503，不是内部错误。
const statusCodes:Record<string,number>={
 invalid_params:400,forbidden:403,not_found:404,conflict:409,invalid_state:409,
 not_implemented:501,unavailable:503,internal_error:500,
 unknown_tool:404,unsupported_tools:501,
 timeout:504,cancelled:499,budget_exhausted:429,
 provider_auth:502,provider_rate_limit:503,provider_error:502,
};
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
 /** 自由聊空闲多久后在后台整理记忆；不给就读 XIAON_FC_IDLE_MIN（默认 3 小时）。 */
 freeChatIdleMs?:number;
 /** 要先用手机号+密码登录才能开会话（只对 UserRuntimes 生效）；不给就保持匿名身份。 */
 requireLogin?:boolean;
}
/** A single runtime is one shared student (local tools and tests); UserRuntimes gives every anonymous identity its own database. */
export function createHttpServer(source:LearningRuntime|UserRuntimes,config:HttpServerConfig){
 const users=source instanceof UserRuntimes?source:undefined;const single=users?undefined:source as LearningRuntime;
 const publicOrigins=config.publicOrigins??[];const publicMode=publicOrigins.length>0;
 const allowed=new Set([...config.allowedOrigins,...publicOrigins]);const hosts=new Set([config.host,...(config.extraHosts??[]),...[...allowed].map(s=>new URL(s).host)]);
 const serveStatic=config.staticDir?createStaticHandler(config.staticDir):undefined;
 const localSessions=new Map<string,{csrf:string;expires:number;userId:string}>();const freeChatting=new Set<string>(),consolidating=new Set<string>();const freeChatIdleMs=config.freeChatIdleMs??idleMsFromEnv();
 // Voice limits are per user; the global caps protect the shared upstream services.
 const tts=config.tts??new NoTts();let ttsInFlight=0;const asr=config.asr??new NoAsr();let asrInFlight=0;
 const voice=new Map<string,{tts:number;ttsStarts:number[];asr:boolean;asrStarts:number[]}>();
 const voiceOf=(userId:string)=>{let v=voice.get(userId);if(!v){v={tts:0,ttsStarts:[],asr:false,asrStarts:[]};voice.set(userId,v);}return v;};
 // 2026-11-21：模型调用按人限流。语音侧本来就有（ASR 20/分、TTS 30/分），
 // 但自由聊和学习接口此前完全没有上限——注册只要手机号+自设密码，可以直接刷爆模型额度。
 const chatPerMinute=new RateLimiter(20,60000),chatPerDay=new RateLimiter(300,86400000);
 const learnPerMinute=new RateLimiter(60,60000),learnPerDay=new RateLimiter(800,86400000);
 const manualConsolidate=new RateLimiter(5,60000);
 // 认证接口按来源限流：手机号是不是注册过这件事本身会泄露信息，
 // 枚举必须付出代价。原来的全局 120 次/分是所有学生共享的，一个人就能把所有人挡在门外。
 const authPerMinute=new RateLimiter(30,60000),authPerDay=new RateLimiter(300,86400000);
 const checkPerMinute=new RateLimiter(20,60000),checkPerDay=new RateLimiter(200,86400000);
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
   const loginRequired=!!users&&!!config.requireLogin,secure=publicMode?'; Secure':'';
   if(req.method==='POST'&&path.startsWith('/api/auth/')){
    const body=await readBody(req,4000) as Record<string,unknown>;if(!body||typeof body!=='object'||Array.isArray(body))throw new RuntimeError('invalid_params');
    const loginToken=cookieValue(req,'xiaon_login')??'';
    if(path==='/api/auth/status'){const who=loginRequired?users!.identities.resolveLogin(loginToken):undefined;send({required:loginRequired,phone:who?maskPhone(who.phone):null} satisfies AuthStatus);return;}
    if(!loginRequired)throw new RuntimeError('not_found');
    const identities=users!.identities,sid=cookieValue(req,'xiaon_session');
    // 登录、注册、退出都作废这个浏览器手上的旧会话，下一次 local-session 按新身份重开。
    if(sid)localSessions.delete(sid);
    if(path==='/api/auth/logout'){identities.logout(loginToken);res.setHeader('Set-Cookie',[`xiaon_login=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`,`xiaon_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`]);send({ok:true});return;}
    // 改密（2026-11-21 新增）：验旧密码 → 换哈希 → 作废这个手机号的全部登录令牌 → 给当前设备发一个新的。
    // 家长改完密码，别处登录的旧令牌立刻失效——这是之前没有的能力。
    if(path==='/api/auth/password'){
     const oldPassword=body.oldPassword,newPassword=body.newPassword;
     if(typeof oldPassword!=='string'||typeof newPassword!=='string')throw new RuntimeError('invalid_params','请填写原密码和新密码');
     const who=identities.resolveLogin(loginToken);
     if(!who)throw new RuntimeError('forbidden','请先登录');
     const changed=identities.changePassword(who.phone,oldPassword,newPassword);
     res.setHeader('Set-Cookie',`xiaon_login=${changed.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${LOGIN_COOKIE_MAX_AGE}${secure}`);
     send({ok:true,phone:maskPhone(who.phone)});return;
    }
    // 退出其他设备（2026-11-21 新增）：保留当前这个令牌，作废同手机号的其余全部。
    if(path==='/api/auth/logout-all'){
     const who=identities.resolveLogin(loginToken);
     if(!who)throw new RuntimeError('forbidden','请先登录');
     send({ok:true,revoked:identities.revokeOtherLogins(who.phone,loginToken)});return;
    }
    // 「这个手机号注册过吗」本身会泄露信息：手机号是不是某个未成年人的账号。
    // 枚举必须付出代价，所以这条单独限流（比登录更严）。
    if(path==='/api/auth/check'){
     if(!allowAll(clientKeys(req,'auth-check'),checkPerMinute,checkPerDay))throw new RuntimeError('unavailable','查询太频繁，请稍后再试');
     send({registered:identities.isRegistered(body.phone)});return;
    }
    if(!allowAll(clientKeys(req,'auth'),authPerMinute,authPerDay))throw new RuntimeError('unavailable','登录的人太多，请稍后再试');
    const issued=path==='/api/auth/register'?identities.register(body.phone,body.password,cookieValue(req,'xiaon_user')??''):path==='/api/auth/login'?identities.login(body.phone,body.password):undefined;
    if(!issued)throw new RuntimeError('not_found');
    res.setHeader('Set-Cookie',`xiaon_login=${issued.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${LOGIN_COOKIE_MAX_AGE}${secure}`);send({phone:maskPhone(String(body.phone))});return;
   }
   if(req.method==='POST'&&path==='/api/local-session'){
    const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new RuntimeError('invalid_params');
    for(const[k,v]of localSessions)if(v.expires<Date.now())localSessions.delete(k);
    if(localSessions.size>=4096)throw new RuntimeError('unavailable','临时会话过多');
    // The long-lived identity cookie is the user boundary; an unknown or forged one gets a new, empty identity.
    const cookies:string[]=[];let userId='local';
    if(loginRequired){
     const who=users!.identities.resolveLogin(cookieValue(req,'xiaon_login')??'');if(!who)throw new RuntimeError('forbidden','请先登录');userId=who.userId;
     const own=[...localSessions].filter(([,v])=>v.userId===userId);for(const[k]of own.slice(0,Math.max(0,own.length-7)))localSessions.delete(k);
    }else if(users){
     const known=users.identities.resolve(cookieValue(req,'xiaon_user')??'');
     if(known){userId=known;}else{const created=users.identities.create();userId=created.userId;cookies.push(`xiaon_user=${created.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=31536000${publicMode?'; Secure':''}`);}
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
   // 服务端封住旧链接、旧客户端和遗留重试；在获取运行时及任何模型/工具执行之前拒绝。
   if(isLegacyHomePath(path))throw new RuntimeError('invalid_state',LEGACY_HOME_DISABLED_MESSAGE);
   // Everything below runs against this user's own runtime and database only.
   const lease=users?users.acquire(session.userId):{runtime:single!,release(){}};res.once('close',lease.release);
   const runtime=lease.runtime;const limits=voiceOf(session.userId);
   // 自由聊的记忆整理在后台跑：自己持有一份运行时租约，请求结束也不会被回收；每人同一时间只跑一次。日志只记状态和数量。
   const kickConsolidation=()=>{
    const userId=session.userId;if(consolidating.has(userId)||!shouldConsolidate(runtime.freeChat,runtime.clock.now(),freeChatIdleMs))return;
    const bg=users?users.acquire(userId):{runtime,release(){}};consolidating.add(userId);const started=Date.now();
    consolidate(bg.runtime.freeChat,bg.runtime.provider,()=>bg.runtime.clock.now(),AbortSignal.timeout(180000))
     .then(r=>console.info('[free-chat/consolidate]',JSON.stringify({stage:r.status,changes:r.changes.length,ms:Date.now()-started})))
     .catch(e=>console.info('[free-chat/consolidate]',JSON.stringify({stage:'error',code:e instanceof RuntimeError?e.code:'unknown',ms:Date.now()-started})))
     .finally(()=>{consolidating.delete(userId);bg.release();});
   };
   if(req.method==='GET'){
    if(path==='/api/learning'){const d=learningFor(runtime);if(!d)throw new RuntimeError('not_implemented');send(await d.view());return;}
    if(path==='/api/context'){send(runtime.context());return;}
    if(path==='/api/free-chat/profile'){kickConsolidation();send({...runtime.freeChat.profile(),disclosure:FREE_CHAT_DISCLOSURE});return;}
    // 导出（2026-11-21）：「知道存在」不等于「拿得走」。档案、学习记录、账号信息一次给全。
    if(path==='/api/free-chat/profile/export'){send(exportFreeChat(runtime.freeChat));return;}
    // 监护人同意流水（2026-11-21）：家长可查「什么时候、按哪一版、谁同意的」。
    if(path==='/api/guardian/consents'){send({consents:runtime.repository.list('guardianConsents')});return;}
    if(path==='/api/account/export'){
     const account=users?users.identities.exportAccount(session.userId):null;
     send({exportedAt:new Date().toISOString(),scope:'account',account,learning:exportLearning(runtime.repository),freeChat:exportFreeChat(runtime.freeChat),
      excluded:['learning.problemSecrets（判题用的参考答案，不是关于学生的记录）']});
     return;
    }
    if(path==='/api/free-chat/digest'){kickConsolidation();send({digest:runtime.freeChat.digest(),consolidating:consolidating.has(session.userId)} satisfies DigestResponse);return;}
    if(path==='/api/free-chat/history'){send(runtime.freeChat.history());return;}
    if(path==='/api/free-chat/threads'){send({threads:runtime.freeChat.threads()});return;}
    if(path==='/api/free-chat/messages'){
     const query=Object.fromEntries(new URL(req.url!,'http://127.0.0.1').searchParams),p=chatRequests.history.safeParse(query);
     if(!p.success)throw new RuntimeError('invalid_params','无效的对话分页');
     send(runtime.freeChat.historyPage(p.data.threadId,p.data.before));return;
    }
    // G2: long-term trend (tracking plugin, zCode), derived from stored professional reports.
    if(path==='/api/learning/trend'){const d=learningFor(runtime);if(!d)throw new RuntimeError('not_implemented');send(await d.trend());return;}
    const match=path.match(/^\/api\/tasks\/([A-Za-z0-9_.:-]+)\/([1-9]\d*)$/);
    if(match){const task=runtime.catalog.publicTask(match[1],Number(match[2]));if(!task)throw new RuntimeError('not_found');send(task);return;}
    throw new RuntimeError('not_found');
   }
   const raw=await readBody(req,path==='/api/voice/asr'?Math.ceil(ASR_MAX_WAV_BYTES*4/3)+2000:550000);
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
    // 每次自由聊都要调一次模型：没有上限就能直接刷爆额度。
    if(!chatPerMinute.take(session.userId)||!chatPerDay.take(session.userId))throw new RuntimeError('budget_exhausted','今天聊得有点多啦，歇一会儿再聊');
    freeChatting.add(session.userId);
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{send(await freeChat(runtime.freeChat,runtime.provider,raw,c.signal));}finally{freeChatting.delete(session.userId);res.off('close',cancel);}
    return;
   }
   if(path==='/api/free-chat/digest/seen'){const p=chatRequests.digestSeen.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params');runtime.freeChat.markDigestSeen(p.data.runId);send({digest:runtime.freeChat.digest(),consolidating:consolidating.has(session.userId)} satisfies DigestResponse);return;}
   if(path==='/api/free-chat/consolidate'){
    // 「现在整理」（开发者模式里的按钮）：不等空闲，立刻整理一次。这条也要调模型，单独限流。
    if(!chatRequests.consolidate.safeParse(raw).success)throw new RuntimeError('invalid_params');
    if(!manualConsolidate.take(session.userId))throw new RuntimeError('budget_exhausted','整理得太频繁了，歇一会儿');
    if(consolidating.has(session.userId))throw new RuntimeError('invalid_state','正在整理，请稍等');
    consolidating.add(session.userId);
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{const r=await consolidate(runtime.freeChat,runtime.provider,()=>runtime.clock.now(),c.signal);send({...r,profile:{...runtime.freeChat.profile(),disclosure:FREE_CHAT_DISCLOSURE}});}
    finally{consolidating.delete(session.userId);res.off('close',cancel);}
    return;
   }
   if(path==='/api/free-chat/new-thread'){if(!chatRequests.newThread.safeParse(raw).success)throw new RuntimeError('invalid_params');send(runtime.freeChat.newThread());return;}
   // 删除账号与全部数据（2026-11-21）。不可逆，所以要明文确认 + 验密码。
   if(path==='/api/account/delete'){
    // 正文已经在 POST 分支开头读过了（raw），这里不能再读一次流。
    const body=(raw??{}) as Record<string,unknown>;
    if(body.confirmation!=='删除我的账号和全部数据')throw new RuntimeError('invalid_params','请先确认要删除的内容');
    if(!users)throw new RuntimeError('not_found','这个服务没有账号体系');
    const account=users.identities.exportAccount(session.userId);
    // 手机号账号要验密码：别让孩子一键把家长的账号删了。
    if(account.phone&&!users.identities.verifyPassword(session.userId,body.password))throw new RuntimeError('forbidden','手机号或密码不对');
    const removed=users.identities.deleteAccount(session.userId);
    users.deleteUserData(session.userId);
    const sid=cookieValue(req,'xiaon_session');if(sid)localSessions.delete(sid);
    res.setHeader('Set-Cookie',[`xiaon_login=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`,`xiaon_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`]);
    send({deleted:true,account:{phone:removed.phone?maskPhone(removed.phone):null},records:removed.deleted});
    return;
   }
   // 监护人同意留痕（2026-11-21）：追加式记录，撤回另记一条，不改旧记录。
   if(path==='/api/guardian/consent'){
    const body=(raw??{}) as Record<string,unknown>;
    const agreementVersion=body.agreementVersion,actor=body.actor,decision=body.decision,scope=body.scope,note=body.note??null;
    if(typeof agreementVersion!=='string'||!agreementVersion)throw new RuntimeError('invalid_params','缺少同意书版本');
    if(actor!=='student'&&actor!=='guardian')throw new RuntimeError('invalid_params','缺少操作者');
    if(decision!=='granted'&&decision!=='declined'&&decision!=='revoked')throw new RuntimeError('invalid_params','缺少同意结果');
    if(!Array.isArray(scope)||!scope.length)throw new RuntimeError('invalid_params','缺少授权范围');
    send(runtime.events.guardianConsent({operationId:String(body.operationId??randomUUID()),agreementVersion,actor,decision,scope:scope as ('learning_overview'|'memory_use'|'chat_replay')[],note:typeof note==='string'?note:null}));
    return;
   }
   if(path.startsWith('/api/free-chat/')){const profile=profilePost(runtime.freeChat,path,raw);if(!profile)throw new RuntimeError('not_found');send(profile);return;}
   const d=learningFor(runtime);
   if(path.startsWith('/api/learning/')){
    if(!d)throw new RuntimeError('not_implemented');
    // 学习接口里有多条会调模型的路径（提交、判题、生成、访谈、阶段草案）。统一按人限流。
    if(!learnPerMinute.take(session.userId)||!learnPerDay.take(session.userId))throw new RuntimeError('budget_exhausted','今天用得有点多啦，歇一会儿再试');
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{switch(path){
     case '/api/learning/activate':send(await d.activate(raw as never));break;
     case '/api/learning/start':send(await d.start(raw as never));break;
     case '/api/learning/open':send(await d.open(raw as never));break;
     case '/api/learning/hint':send(await d.hint(raw as never));break;
     case '/api/learning/submit':send(await d.submit(raw as never,c.signal));break;
     case '/api/learning/grade':send(await d.grade(raw as never,c.signal));break;
     case '/api/learning/generate':send(await d.generate(raw as never,c.signal));break;
     case '/api/learning/generate-task':send(await d.generateTask(raw as never,c.signal));break;
     case '/api/learning/confirm':send(await d.confirm(raw as never));break;
     case '/api/learning/preference':send(await d.preference(raw as never));break;
     case '/api/learning/memory-correct':send(await d.memoryCorrect(raw as never));break;
     case '/api/learning/reset':{const cleared=await d.reset(raw as never);runtime.freeChat.reset();send(cleared);break;}
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
    case '/api/planning/due':if(!d)throw new RuntimeError('not_implemented');send(await runtime.planning().due({at:runtime.clock.now(),includePaused:true},runtime.engineContext()));break;
    default:throw new RuntimeError('not_found');
   }
  }catch(error){const f=failure(error);if(!res.writableEnded&&!res.destroyed)send({schemaVersion:SCHEMA_VERSION,ok:false,error:f},statusCodes[f.code]??500);}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 return server;
}
function cookieValue(req:IncomingMessage,name:string){return req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);}
/** 来源标识：连接地址 + 反向代理带来的第一个 X-Forwarded-For。
 * 两个桶都要过——伪造 XFF 也绕不开「连接地址」那个桶；代理后面则能把真实来源分开算。 */
function clientKeys(req:IncomingMessage,scope:string){
 const keys=[`${scope}:conn:${req.socket.remoteAddress??'unknown'}`];
 const fwd=String(req.headers['x-forwarded-for']??'').split(',')[0]?.trim();
 if(fwd)keys.push(`${scope}:fwd:${fwd}`);
 return keys;
}
/** 所有限流器、每个键都放行才算放行。 */
function allowAll(keys:string[],...limiters:RateLimiter[]){for(const l of limiters)for(const k of keys)if(!l.take(k))return false;return true;}
function equalToken(actual:string,expected:string){const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
async function readBody(req:IncomingMessage,limit=550000):Promise<unknown>{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>limit)throw new RuntimeError('invalid_params','请求超出大小限制');chunks.push(Buffer.from(chunk));}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RuntimeError('invalid_params','无效JSON');}}
