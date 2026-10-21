/** 所有者：Claude。g 路浏览器用例与第一期集成走查的 API：真 HTTP / SQLite / 阶段机 / 三路真实插件，只有模型是按阶段写好台词的合成模型。
 * 不读 .env.server，不碰用户的 learning.sqlite；数据库在 .local/g-walkthrough-<端口>.sqlite，可经 /__g/reset 清空。 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import type { ModelProvider } from '../../shared/learning-contracts';
const port=Number(process.env.XIAON_G_API_PORT??18951),ui=Number(process.env.XIAON_G_UI_PORT??5211);
type Data={history?:{role:string;content:string}[];helpLevel?:number;kind?:string};
const BRACKET='化简：3x − (2x − 5)。可写一次式或以等号相连的完整等价步骤。';
/** Scripted synthetic model. It reads only the program-chosen prompt version and the data the coordinator sends. */
class Walkthrough implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.find(m=>m.role==='system')!.content,version=system.split('\n')[0];
  let data:Data={};try{data=JSON.parse(input.messages.find(m=>m.role==='user')!.content);}catch{/* not JSON */}
  const out=(v:unknown)=>({content:JSON.stringify(v),toolCalls:[]});
  if(version.startsWith('summary-'))return out({topics:['数学考试没考好','应用题里的条件','去括号的负号'],planSuggestions:['读应用题时先圈出“每”字后面的量','明天做一道去括号的小题，先说第一步']});
  if(version.startsWith('greeting-'))return out({text:data.kind==='summary'?'上次我们聊到应用题的条件和去括号，这两天怎么样？':'又见面啦，今天过得怎么样？'});
  if(version.startsWith('progress-card-'))return out({});
  if(version.startsWith('problem-solve-'))return out({answer:''});
  const students=(data.history??[]).filter(h=>h.role==='user').map(h=>h.content),last=students.at(-1)??'';
  const stage=version.replace(/^tutor-(?:g0|d3)-/,'').replace('-observe','');
  const say=(message:string,extra:Record<string,unknown>={})=>out({message,taskIds:[],...extra});
  if(stage==='listen')return say('听起来这次真的挺难受的。愿意说说发生了什么吗？');
  if(stage==='companion')return say('嗯，我在听，你慢慢说。');
  if(stage==='probe'){
   if(version.endsWith('-observe')){
    const said=[...students].reverse().find(t=>t.includes('每本'));
    if(said)return say('你说的“每本”，你觉得在这道题里指的是什么？',{observation:{dimension:'理解',signal:/不知道|搞不清|不懂|不明白/.test(said)?'confused':'clear',quote:said,note:/不知道|搞不清|不懂|不明白/.test(said)?'对“每本”这个条件的意思还不确定':'能说出“每本”指一本的价钱'}});
    return say('哪一类题让你最难受？');
   }
   if(/负号括号总错/.test(last))return say('我帮你把这道题记下来了，你看看对不对？',{problemDraft:{source:'spoken',questionText:BRACKET,studentWork:'x − 5',knowledgePointId:'negative-brackets',stuckQuote:'负号括号总错',stuckPointId:null,catalogTask:{taskId:'bracket',taskVersion:2}}});
   return say('嗯，能说说是哪一步让你卡住了吗？');
  }
  if(stage==='think')return say([
   '你先说说，括号前面的负号会影响括号里的哪些项？',
   '你用自己的话说说，这道题要你做什么？',
   '注意括号前的负号，它管着括号里的每一项。',
   '比如 −(2x − 5)，先写 −2x，后面的 −5 会变成什么？'][data.helpLevel??0]);
  if(stage==='reflect')return say('你算出来了。这次你发现了什么？下次你会先做哪一步？');
  return say('我在这里，按你的节奏来。');
 }
}
mkdirSync('.local',{recursive:true});
const r=createRuntime({databasePath:resolve(`.local/g-walkthrough-${port}.sqlite`),provider:new Walkthrough()});installLearning(r);
const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(req.url==='/__g/reset'&&req.method==='POST'&&req.headers['x-xiaon-test']==='synthetic-g-only'){r.repository.reset!();res.setHeader('Content-Type','application/json');res.end('{"reset":true}');return;}
 listener.call(server,req,res);
});
server.listen(port,'127.0.0.1',()=>console.log(`G walkthrough synthetic API ${port}; UI origin ${ui}; real plugins, scripted model`));
process.once('SIGTERM',()=>{server.close(()=>{r.repository.close();process.exit(0);});server.closeAllConnections();});
