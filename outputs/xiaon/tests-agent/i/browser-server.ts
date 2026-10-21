/** 真实协调器/插件 + 合成模型/报告 + TestClock；只操作临时库，不读取环境密钥文件。 */
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { INTERVIEW_MODULE_ORDER,schemas,type ModelProvider } from '../../shared/learning-contracts';
const api=Number(process.env.XIAON_I_API_PORT??18954),ui=Number(process.env.XIAON_I_UI_PORT??5214);
class Synthetic implements ModelProvider{
 readonly kind='synthetic' as const;readonly supportsTools=true;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const version=input.messages.find(m=>m.role==='system')!.content.split('\n')[0];
  const data=JSON.parse(input.messages.find(m=>m.role==='user')!.content),out=(x:unknown)=>({content:JSON.stringify(x),toolCalls:[]});
  if(version.startsWith('greeting-'))return out({text:'今天想说什么？'});
  if(version.startsWith('stage-goal-'))return out({goal:'用反例检查每一步的条件'});
  if(version.startsWith('problem-solve-'))return out({answer:''});
  const last=(data.history??[]).filter((h:{role:string})=>h.role==='user').at(-1)?.content??'';
  const extra=last.includes('负号括号总错')?{problemDraft:{source:'spoken',questionText:'化简 3x − (2x − 5)',studentWork:'x − 5',knowledgePointId:'negative-brackets',stuckQuote:'负号括号总错',stuckPointId:null,catalogTask:{taskId:'bracket',taskVersion:2}}}:last.includes('篮球赛')?{memoryDraft:{text:'下周有班级篮球赛',kind:'event'}}:{};
  return out({message:'我们慢慢想，一起看清每一步。',taskIds:[],...extra});
 }
}
const clock=new TestClock('2026-10-05T01:00:00.000Z'),f=temporaryRepository(clock),r=createRuntime({...f,provider:new Synthetic()});installLearning(r);
const server=createHttpServer(r,{host:`127.0.0.1:${api}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.url?.startsWith('/__i/')&&req.method==='POST'&&req.headers['x-xiaon-test']==='synthetic-i-only'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text||'{}');
  if(req.url.endsWith('/reset')){r.repository.reset!();clock.set('2026-10-05T01:00:00.000Z');}
  if(req.url.endsWith('/clock'))clock.set(body.at);
  if(req.url.endsWith('/report'))r.repository.append('professionalReports',schemas.ProfessionalReport.parse({schemaVersion:'1.0.0',id:'i-report',operationId:'i-report-op',evidenceRevision:r.repository.evidenceRevision(),interviewId:'synthetic-i-interview',version:1,supersedesReportId:null,comparedWithReportId:null,modules:INTERVIEW_MODULE_ORDER.map(module=>({module,level:module==='逻辑'?'partial':'good',basis:module==='逻辑'?'correct_on_transfer':'correct_with_reason',evidenceIds:[],attemptIds:[],turnIds:[],quotes:[],wording:null,suggestions:module==='逻辑'?['用反例检查条件']:[],scope:'this_interview'})),observationChecks:[],changes:[],mode:'local_rules',createdAt:clock.now()}));
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({now:clock.now()}));return;
 }
 listener.call(server,req,res);
});
server.listen(api,'127.0.0.1',()=>console.log('I synthetic browser API; temporary database',f.databasePath));
process.once('SIGTERM',()=>{server.close(()=>{f.dispose();process.exit(0);});server.closeAllConnections();});
