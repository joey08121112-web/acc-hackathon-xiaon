import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';
import { GlmProvider } from '../../server/providers/glm';
import { readGlmConfig } from '../../server/providers/config';
const config=readGlmConfig();const {apiKey:key,model}=config;
if(!key){console.log(JSON.stringify({evidenceLevel:'real_model_api',status:'NOT_RUN',reason:'No server-side GLM key configured. No chat credentials requested.',model,baseUrl:config.baseUrl,timeoutMs:config.timeoutMs,maxTokens:config.maxTokens}));process.exit(2);}
const f=temporaryRepository();const r=createRuntime({...f,provider:new GlmProvider(key,model,fetch,config),modelTimeoutMs:config.timeoutMs});
try{
 const s=r.events.startSession({operationId:'real-synthetic-session',mode:'support'});r.events.expose({operationId:'real-open',sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});r.events.submit({operationId:'real-attempt',sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'});
 const run=await r.agent.run({operationId:'real-synthetic-chat',history:[{role:'user',content:'这是合成验收数据。请先调用 query_learning_evidence 工具查看已保存作答，再只告诉我已保存尝试数量。不要根据聊天猜测记录。'}]});
 const calls=r.repository.list('toolCalls');const verified=run.status==='completed'&&calls.some(c=>c.name==='query_learning_evidence'&&c.status==='succeeded');
 console.log(JSON.stringify({evidenceLevel:'real_model_api_synthetic_material',status:verified?'VERIFIED':'NOT_VERIFIED',model,requestMode:'non_streaming_native_tools',run,calls,rawModelTextExcluded:true}));if(!verified)process.exitCode=1;
}finally{f.dispose();}
