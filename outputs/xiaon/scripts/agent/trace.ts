import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';
import { SyntheticProvider } from '../../server/providers/synthetic';
const f=temporaryRepository();const provider=new SyntheticProvider();const r=createRuntime({...f,provider});
try{
 const s=r.events.startSession({operationId:'trace-start',mode:'support'});
 r.events.expose({operationId:'trace-open',sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});
 r.events.submit({operationId:'trace-attempt',sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'});
 const reply=await r.agent.reply({operationId:'trace-chat',history:[{role:'user',content:'合成测试：请查询我的已保存记录'}]});
 const trace={evidenceLevel:'synthetic_model_real_sqlite_handlers_self_test',run:reply.run,calls:r.repository.list('toolCalls'),modelReceivedToolResults:provider.receivedResults.map(result=>({ok:result.ok,callId:result.callId,evidenceIds:result.evidenceIds,dataVersion:result.dataVersion})),studentRawTextIncluded:false,credentialsIncluded:false};
 const output=resolve('../../任务书/2026-10-21-Agent升级/交付/A/evidence/synthetic-tool-trace.json');writeFileSync(output,JSON.stringify(trace,null,2)+'\n');console.log('Saved sanitized synthetic trace; status='+reply.run.status);
}finally{f.dispose();}
