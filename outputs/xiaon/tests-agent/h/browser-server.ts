/** H 浏览器专用：真 HTTP/SQLite/阶段机 + 合成 Tutor；问候/小结插件以显式夹具替代。 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { schemas, type ModelProvider } from '../../shared/learning-contracts';
const port=18952,ui=5212;
class HomeProvider implements ModelProvider{
 readonly kind='synthetic' as const;readonly supportsTools=true;
 async complete():ReturnType<ModelProvider['complete']>{return{content:JSON.stringify({message:'听起来这次让你有点累，我在这里听你说。',taskIds:[]}),toolCalls:[]};}
}
// This is this route's own database. Never open .env.server or the user's learning.sqlite.
mkdirSync('.local',{recursive:true});
const r=createRuntime({databasePath:resolve('.local/h.sqlite'),provider:new HomeProvider()}),d=installLearning(r);
const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 const json=(value:unknown,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(req.url==='/__h/reset'&&req.method==='POST'&&req.headers['x-xiaon-test']==='synthetic-h-only'){r.repository.reset!();json({reset:true});return;}
 if(req.url==='/api/learning/greeting'){
  const summary=r.repository.list('summaries').at(-1);
  json({text:summary?'上次我们聊了应用题的条件，这几天怎么样？':'嗨，我是小N。今天过得怎么样？想跟我说说吗？',memoryId:null,summaryId:summary?.id??null,memoryOff:!r.events.memoryEnabled()});return;
 }
 if(req.url==='/api/learning/conversation/end'){
  try{
   let text='';for await(const chunk of req)text+=chunk;
   const input=schemas.EndConversation.parse(JSON.parse(text)),now=r.clock.now();
   const obs=schemas.ChatObservation.parse({schemaVersion:'1.0.0',id:'obs-'+input.operationId,sessionId:input.sessionId,dimension:'理解',signal:'partial',quote:'每本是什么意思',note:'可以再核对单位与条件',status:'unverified',at:now});
   r.repository.append('observations',obs);
   const summary=schemas.ConversationSummary.parse({schemaVersion:'1.0.0',id:'summary-'+input.operationId,operationId:input.operationId,sessionId:input.sessionId,trigger:'student_end',topics:['应用题的条件'],observationIds:[obs.id],comparedWithSummaryId:r.repository.list('summaries').at(-1)?.id??null,changes:[],planSuggestions:['明天圈出题目的单位'],suggestProfessionalMode:true,progressCardId:null,mode:'model',createdAt:now});
   r.repository.append('summaries',summary);json(summary);
  }catch{json({error:{message:'合成小结夹具请求无效'}},400);}return;
 }
 listener.call(server,req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('H synthetic API 18952; greeting/summary are fixtures; database .local/h.sqlite'));
process.once('SIGTERM',()=>{server.close(()=>{r.repository.close();process.exit(0);});server.closeAllConnections();});
void d;
