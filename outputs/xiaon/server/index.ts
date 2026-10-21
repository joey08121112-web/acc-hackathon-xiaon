import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { installLearning } from './agents/learning';
import { runtimeFromEnvironment } from './bootstrap';
import { readGenerationConfig } from './plugins/generation';
import { createHttpServer } from './http/server';
import { ttsFromEnvironment } from './voice/tts';
import { asrFromEnvironment } from './voice/asr';
// PaaS hosts inject PORT; XIAON_API_PORT stays the local default.
const port=Number(process.env.PORT??process.env.XIAON_API_PORT??18920);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid XIAON_API_PORT/PORT');
const bindHost=process.env.XIAON_API_HOST?.trim()||'127.0.0.1';
if(!['127.0.0.1','localhost','::1','0.0.0.0','::'].includes(bindHost))throw new Error('XIAON_API_HOST must be a loopback or wildcard address');
const wildcard=bindHost==='0.0.0.0'||bindHost==='::';
const origins=(process.env.XIAON_ALLOWED_ORIGINS??'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5191,http://127.0.0.1:5191,http://127.0.0.1:5194,http://localhost:5194').split(',');
for(const s of origins){const u=new URL(s);if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.origin!==s)throw new Error('Only exact loopback HTTP origins are supported in XIAON_ALLOWED_ORIGINS');}
// Public HTTPS origins are opt-in; without them the server stays loopback-only exactly as before.
const publicOrigins=(process.env.XIAON_PUBLIC_ORIGIN??'').split(',').map(s=>s.trim()).filter(Boolean);
for(const s of publicOrigins){const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.origin!==s)throw new Error('XIAON_PUBLIC_ORIGIN entries must be exact HTTPS origins');}
const staticEnv=process.env.XIAON_STATIC_DIR?.trim();const staticDir=staticEnv?resolve(staticEnv):undefined;
if(staticDir&&!existsSync(resolve(staticDir,'index.html')))throw new Error(`XIAON_STATIC_DIR has no index.html (run npm run build first): ${staticDir}`);
const runtime=runtimeFromEnvironment();installLearning(runtime,{generation:readGenerationConfig()});
const server=createHttpServer(runtime,{allowedOrigins:origins,host:`127.0.0.1:${port}`,extraHosts:wildcard?[`localhost:${port}`,`0.0.0.0:${port}`]:[],publicOrigins,staticDir,tts:ttsFromEnvironment(),asr:asrFromEnvironment()});
const mode=runtime.provider.kind==='offline'?'local_rules':'model';
server.listen(port,bindHost,()=>console.log(publicOrigins.length
 ?`学伴小N ${staticDir?'静态站+API':'API'} ${bindHost}:${port} → ${publicOrigins.join(', ')} (${mode})；合成材料、单用户演示`
 :`学伴小N 本地 API http://127.0.0.1:${port} (${mode}); 合成材料模式，仅本机使用`));
function shutdown(){server.close(()=>{runtime.repository.close();process.exit(0);});server.closeAllConnections();}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
