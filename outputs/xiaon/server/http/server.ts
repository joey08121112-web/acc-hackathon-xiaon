import { createServer,type IncomingMessage } from 'node:http';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { schemas,SCHEMA_VERSION } from '../../shared/learning-contracts';
import type { LearningRuntime } from '../bootstrap';
import { failure,RuntimeError } from '../core/errors';
import { learningFor } from '../agents/learning';
import { MODEL_DISCLOSURE } from '../core/agent';
import { createStaticHandler } from './static';
const statusCodes:Record<string,number>={invalid_params:400,forbidden:403,not_found:404,conflict:409,invalid_state:409,not_implemented:501,unavailable:503};
export interface HttpServerConfig {
 allowedOrigins:string[];host:string;
 /** Exact HTTPS origins reached through a reverse proxy or PaaS. Empty keeps the server loopback-only. */
 publicOrigins?:string[];
 /** Extra Host values to accept, e.g. localhost:<port> for in-container health checks. */
 extraHosts?:string[];
 /** Built SPA directory served on the same origin; without it non-/api paths are not served. */
 staticDir?:string;
}
export function createHttpServer(runtime:LearningRuntime,config:HttpServerConfig){
 const publicOrigins=config.publicOrigins??[];const publicMode=publicOrigins.length>0;
 const allowed=new Set([...config.allowedOrigins,...publicOrigins]);const hosts=new Set([config.host,...(config.extraHosts??[]),...[...allowed].map(s=>new URL(s).host)]);
 const serveStatic=config.staticDir?createStaticHandler(config.staticDir):undefined;
 const localSessions=new Map<string,{csrf:string;expires:number}>();let activeChat=false;
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
   if(req.method==='GET'&&path==='/api/health'){send({schemaVersion:SCHEMA_VERSION,status:'ok',mode:runtime.provider.kind==='offline'?'local_rules':'model',providerKind:runtime.provider.kind,learning:!!learningFor(runtime),disclosure:MODEL_DISCLOSURE});return;}
   if(req.method==='POST'){
    if(!allowed.has(req.headers.origin??'')||req.headers['sec-fetch-site']==='cross-site')throw new RuntimeError('forbidden','写操作需要允许的 Origin');
    if(!req.headers['content-type']?.startsWith('application/json'))throw new RuntimeError('invalid_params','需要 application/json');
   }else if(req.method!=='GET')throw new RuntimeError('not_found');
   if(req.method==='POST'&&path==='/api/local-session'){
    const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new RuntimeError('invalid_params');
    for(const[k,v]of localSessions)if(v.expires<Date.now())localSessions.delete(k);
    if(localSessions.size>=128)throw new RuntimeError('unavailable','本机临时会话过多');
    const sid=randomBytes(32).toString('hex');const csrf=randomBytes(32).toString('hex');localSessions.set(sid,{csrf,expires:Date.now()+8*3600000});
    res.setHeader('Set-Cookie',`xiaon_session=${sid}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${publicMode?'; Secure':''}`);send({schemaVersion:SCHEMA_VERSION,csrfToken:csrf});return;
   }
   const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('xiaon_session='))?.slice(14);
   const session=cookie?localSessions.get(cookie):undefined;
   if(!session||session.expires<Date.now())throw new RuntimeError('forbidden','本机会话缺失或已过期');
   if(req.method==='POST'&&!equalToken(String(req.headers['x-xiaon-csrf']??''),session.csrf))throw new RuntimeError('forbidden','缺少本地会话防护令牌');
   if(req.method==='GET'){
    if(path==='/api/learning'){const d=learningFor(runtime);if(!d)throw new RuntimeError('not_implemented');send(await d.view());return;}
    if(path==='/api/context'){send(runtime.context());return;}
    const match=path.match(/^\/api\/tasks\/([A-Za-z0-9_.:-]+)\/([1-9]\d*)$/);
    if(match){const task=runtime.catalog.publicTask(match[1],Number(match[2]));if(!task)throw new RuntimeError('not_found');send(task);return;}
    throw new RuntimeError('not_found');
   }
   const raw=await readBody(req);
   const d=learningFor(runtime);
   if(path.startsWith('/api/learning/')){
    if(!d)throw new RuntimeError('not_implemented');
    const c=new AbortController(),cancel=()=>{if(!res.writableEnded)c.abort();};res.once('close',cancel);
    try{switch(path){
     case '/api/learning/activate':send(await d.activate(raw as never));break;
     case '/api/learning/start':send(await d.start(raw as never));break;
     case '/api/learning/open':send(await d.open(raw as never));break;
     case '/api/learning/hint':send(await d.hint(raw as never));break;
     case '/api/learning/submit':send(await d.submit(raw as never,c.signal));break;
     case '/api/learning/grade':send(await d.grade(raw as never,c.signal));break;
     case '/api/learning/generate':send(await d.generate(raw as never,c.signal));break;
     case '/api/learning/confirm':send(await d.confirm(raw as never));break;
     case '/api/learning/preference':send(await d.preference(raw as never));break;
     case '/api/learning/chat':send(await d.chat(raw as never,c.signal));break;
     case '/api/learning/memory-correct':send(await d.memoryCorrect(raw as never));break;
     case '/api/learning/reset':send(await d.reset(raw as never));break;
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
function equalToken(actual:string,expected:string){const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
async function readBody(req:IncomingMessage):Promise<unknown>{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>550000)throw new RuntimeError('invalid_params','请求超出大小限制');chunks.push(Buffer.from(chunk));}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RuntimeError('invalid_params','无效JSON');}}
