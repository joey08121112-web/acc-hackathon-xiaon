/** Synthetic model output only. All event persistence, scoring, evidence, selection and recovery use production implementations. */
import { appendFileSync,mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import type { ModelProvider } from '../../shared/learning-contracts';
const api=Number(process.env.XIAON_LOOP_API_PORT??18968),ui=Number(process.env.XIAON_LOOP_UI_PORT??5318),out=process.env.XIAON_LOOP_BROWSER_OUT!;
if(out)mkdirSync(out,{recursive:true});
class Synthetic implements ModelProvider{
 readonly kind='synthetic' as const;readonly supportsTools=true;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
 const prompt=input.messages.find(m=>m.role==='system')!.content.split('\n')[0],data=JSON.parse(input.messages.find(m=>m.role==='user')!.content);
 if(out)appendFileSync(join(out,'synthetic-model.ndjson'),JSON.stringify({prompt,data})+'\n');
 const payload=prompt==='loop-hypothesis-1'?{hypothesis:'规则你知道，但括号里第二项容易漏变号，是这样吗？'}:prompt.startsWith('progress-card-')?{episodeId:null,breakthrough:'已经独立掌握了所有负号题',method:'完全靠自己想出来',nextTry:'以后一定都会'}:prompt.startsWith('greeting-')?{text:'今天想从哪一步开始？'}:{message:'规则明白了，题目还卡着，我们留在这一步。你想先试一笔，还是要一点提示？',taskIds:[]};
 return {content:JSON.stringify(payload),toolCalls:[]};
 }
}
const clock=new TestClock('2026-10-22T01:00:00.000Z'),f=temporaryRepository(clock),r=createRuntime({...f,provider:new Synthetic()}),d=installLearning(r);
async function seed(){
 r.repository.reset!();clock.set('2026-10-22T01:00:00.000Z');r.events.consent({operationId:crypto.randomUUID(),optionalMemory:false});
 const s=await d.start({operationId:crypto.randomUUID(),mode:'support'});
 await d.open({operationId:crypto.randomUUID(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});
 await d.submit({operationId:crypto.randomUUID(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});
}
await seed();
const server=createHttpServer(r,{host:`127.0.0.1:${api}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.url==='/__loop/reset'&&req.method==='POST'&&req.headers['x-xiaon-test']==='synthetic-loop-only'){await seed();res.setHeader('Content-Type','application/json');res.end('{}');return;}
 listener.call(server,req,res);
});
server.listen(api,'127.0.0.1',()=>console.log('loop synthetic HTTP; temporary SQLite',f.databasePath));
process.once('SIGTERM',()=>{server.close(()=>{f.dispose();process.exit(0);});server.closeAllConnections();});
