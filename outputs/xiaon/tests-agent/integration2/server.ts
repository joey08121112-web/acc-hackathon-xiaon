/** 仅测试：不替换协调器或业务插件，不读模型配置；测试控制只改临时库与注入的时钟。 */
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { ASSESSOR_PROMPT } from '../../server/plugins/assessment';
import type { ModelProvider } from '../../shared/learning-contracts';
class Synthetic implements ModelProvider{
 readonly kind='synthetic' as const;readonly supportsTools=true;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const version=input.messages.find(m=>m.role==='system')!.content.split('\n')[0];
  const out=(x:unknown)=>({content:JSON.stringify(x),toolCalls:[]});
  const raw=input.messages.find(m=>m.role==='user')!.content;
  let data:Record<string,unknown>={};try{data=JSON.parse(raw);}catch{/* no JSON */}
  if(input.messages.some(m=>m.role==='system'&&m.content===ASSESSOR_PROMPT)){
   const {task,value}=data as {task:{rubric:{id:string}[]};value:string};const start=value.indexOf('\n')+1;
   return out({points:task.rubric.map(p=>({pointId:p.id,status:'supported',quote:p.id==='result'?value.split('\n')[0]:value.slice(start),location:p.id==='result'?{start:0,end:value.split('\n')[0].length}:{start,end:value.length},explanation:'合成模型核对理由；结果仍由程序核对'}))});
  }
  if(version==='interviewer-g2')return out({prompt:'慢慢想，说说你的做法。'});
  if(version==='report-wording-g2')return out({wordings:{理解:'这次把条件读清楚了。'},levels:{理解:'needs_work'}});
  if(version.startsWith('summary-'))return out({topics:['应用题里的条件'],planSuggestions:['先圈出题目里的条件']});
  if(version.startsWith('greeting-'))return out({text:'又见面了，今天想聊什么？'});
  const history=(data.history??[]) as {role:string;content:string}[],last=history.filter(h=>h.role==='user').at(-1)?.content??'';
  if(version.includes('observe-answer'))return out({message:'你说清楚了这个条件，我们可以去专业模式看看。',taskIds:[],observation:{dimension:'理解',signal:'clear',quote:last,note:'能解释题目里每本的含义'}});
  if(version.includes('observe'))return out({message:'题目中的“每本”，你觉得是什么意思？',taskIds:[]});
  return out({message:version.includes('listen')?'我在听，你慢慢说。':'我们一起看看题目里的条件。',taskIds:[]});
 }
}
const clock=new TestClock('2026-10-21T01:00:00.000Z'),f=temporaryRepository(clock),r=createRuntime({...f,provider:new Synthetic()});installLearning(r);
const server=createHttpServer(r,{host:'127.0.0.1:18954',allowedOrigins:['http://127.0.0.1:5214']});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.url?.startsWith('/__integration2/')&&req.method==='POST'&&req.headers['x-xiaon-test']==='synthetic-integration2-only'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text||'{}');
  if(req.url.endsWith('/reset')){r.repository.reset!();clock.set('2026-10-21T01:00:00.000Z');}
  if(req.url.endsWith('/clock'))clock.set(body.at);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({now:clock.now()}));return;
 }
 listener.call(server,req,res);
});
server.listen(18954,'127.0.0.1',()=>console.log('Integration2 synthetic model + real plugins + TestClock; temporary database',f.databasePath));
process.once('SIGTERM',()=>{server.close(()=>{f.dispose();process.exit(0);});server.closeAllConnections();});
