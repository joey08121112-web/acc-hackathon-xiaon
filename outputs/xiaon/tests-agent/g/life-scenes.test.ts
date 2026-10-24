/** 所有者：zCode（生活话题观察：场景库，2026-10-24）。合成模型验证：场景开始、逐问推进、观察落库（待核实+sceneId）、
 * 拒绝即中止、每个聊天场次最多一次；validateObservation 的 lifeScene 门；生活观察不进入做题建议。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { validateObservation } from '../../server/plugins/conversation';
import { matchLifeScene } from '../../server/plugins/life-scenes';
import { temporaryRepository } from '../../server/storage/testing';
import { SCHEMA_VERSION,type ChatIntent,type ChatObservation,type ChatReply,type ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
/** Synthetic Tutor: reads only the program-chosen blocks in the system prompt; quotes are always a prefix of the student's own last message. */
class Script implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;systems:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.find(m=>m.role==='system')!.content;this.systems.push(system);
  if(system.startsWith('summary-'))return{content:JSON.stringify({topics:['北京和故宫'],planSuggestions:['下次去故宫找找中轴线在哪']}),toolCalls:[]};
  const data=JSON.parse(input.messages.find(m=>m.role==='user')!.content) as {history?:{role:string;content:string}[]};
  const last=(data.history??[]).filter(h=>h.role==='user').at(-1)?.content??'';
  const asking=system.includes('生活话题轻轻追问');
  const observing=system.includes('上一句是生活话题的追问');
  if(observing)return{content:JSON.stringify({message:asking?'嗯，有道理。那我再问一个。':'嗯，这个话题就聊到这儿。',taskIds:[],
   observation:{dimension:system.includes('能看出逻辑的情况')?'逻辑':'理解',signal:asking?'partial':'clear',quote:last.slice(0,8),note:'合成观察'}}),toolCalls:[]};
  if(asking)return{content:JSON.stringify({message:'嗯，听着挺有意思的。',taskIds:[]}),toolCalls:[]};
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[]}),toolCalls:[]};
 }
}
function setup(provider?:ModelProvider){
 const f=temporaryRepository(),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r,{timeoutMs:2000});
 const history:{role:'user'|'assistant';content:string}[]=[];
 const say=async(text:string,extra:{intent?:ChatIntent}={}):Promise<ChatReply>=>{history.push({role:'user',content:text});const reply=await d.chat({operationId:id(),history:history.slice(-20),flow:'home',...extra});history.push({role:'assistant',content:reply.text});return reply;};
 const end=(sessionId:string)=>d.endConversation({operationId:id(),sessionId,history:history.slice(-20)});
 return{...f,r,d,say,end,turns:()=>r.repository.list('chatTurns'),obs:()=>r.repository.list('observations'),scenes:()=>r.repository.list('lifeScenes')};
}

test('matchLifeScene: 触发词命中、学习句不触发',()=>{
 assert.equal(matchLifeScene('我去北京玩了，故宫挺好玩')?.id,'gugong');
 assert.equal(matchLifeScene('北京挺好玩的')?.id,'gugong','只说北京也走故宫场景');
 assert.equal(matchLifeScene('我去西安看兵马俑了')?.id,'place','其他地方走泛化建筑场景');
 assert.equal(matchLifeScene('放假去旅游了一趟')?.id,'trip');
 assert.equal(matchLifeScene('今天数学作业好多'),null,'学习句不触发');
 assert.equal(matchLifeScene('今天没什么特别的'),null);
});

test('validateObservation: lifeScene 门放行 companion 的场景回答轮',()=>{
 const check={sessionId:'chat-1',stage:'companion' as const,studentTexts:['房子左右对称排的，中间一条大道'],probeAllowed:false,lifeScene:true,existing:[] as ChatObservation[]};
 const obs={dimension:'理解' as const,signal:'partial' as const,quote:'左右对称排的',note:'能说出布局'};
 assert.equal(validateObservation(obs,check).ok,true);
 assert.equal(validateObservation(obs,{...check,lifeScene:false}).ok,false,'没有 lifeScene 时 companion 不允许观察');
});

test('场景全流程：故宫三问，经历不记观察，两次观察带 sceneId，走完 done，同场不再开新场景',async()=>{
 const p=new Script(),f=setup(p);try{
  await f.say('今天过得还行');await f.say('没什么大事');
  const start=await f.say('我去北京玩了，故宫挺好玩');
  assert.equal(start.stage,'companion');
  assert.equal(f.scenes().length,1);assert.equal(f.scenes()[0].status,'active');assert.equal(f.scenes()[0].sceneId,'gugong');
  assert.ok(p.systems.at(-1)!.includes('你去过故宫吗'),'第一问（经历）注入');
  assert.equal(f.obs().length,0);
  await f.say('去过呀，暑假跟爸妈一起去的');
  assert.equal(f.obs().length,0,'经历问答不产生观察');
  assert.equal(f.scenes().length,2);assert.equal(f.scenes().at(-1)!.step,1);
  assert.ok(p.systems.at(-1)!.includes('怎么排的'),'第二问注入');
  await f.say('房子左右对称排的，中间一条大道直着过去');
  assert.equal(f.obs().length,1);
  const first=f.obs()[0];assert.equal(first.dimension,'理解');assert.equal(first.sceneId,'gugong');assert.equal(first.status,'unverified');assert.equal(first.sessionId,start.sessionId);
  assert.ok(p.systems.at(-1)!.includes('左右对称'),'第三问注入');
  await f.say('对称显得稳，歪一边会觉得要倒；公园里曲曲折折的走廊不对称也挺好看');
  assert.equal(f.obs().length,2);assert.equal(f.obs()[1].dimension,'逻辑');assert.equal(f.obs()[1].sceneId,'gugong');
  assert.equal(f.scenes().at(-1)!.status,'done');
  await f.say('我还想去上海迪士尼玩');
  assert.equal(f.scenes().length,4,'每场一次，不再开新场景');
  assert.ok(!p.systems.at(-1)!.includes('生活话题轻轻追问'));
 }finally{f.dispose();}
});

test('拒绝即中止：aborted，不产生观察，之后不再开场景',async()=>{
 const p=new Script(),f=setup(p);try{
  await f.say('今天看了一个电影');await f.say('挺好看的');
  await f.say('这个电影特别精彩，主角很聪明');
  assert.equal(f.scenes().length,1);assert.equal(f.scenes()[0].sceneId,'movie');
  await f.say('不想聊这个');
  assert.equal(f.scenes().at(-1)!.status,'aborted');
  assert.equal(f.obs().length,0);
  await f.say('那聊聊别的，我最近在攒零花钱');
  assert.equal(f.scenes().length,2,'同一场次拒绝后不再触发');
 }finally{f.dispose();}
});

test('小结：生活观察不生成做题建议，但保留在观察列表里',async()=>{
 const f=setup();try{
  await f.say('今天聊得挺开心');await f.say('还行吧');
  const sessionId=f.turns().at(-1)!.sessionId;
  f.r.repository.append('observations',{schemaVersion:SCHEMA_VERSION,id:'obs-life-1',dimension:'理解',signal:'confused',quote:'对称',note:'生活观察',sceneId:'gugong',sessionId,status:'unverified',at:f.r.clock.now()} as ChatObservation);
  const s=await f.end(sessionId);
  assert.equal(s.mode,'local_rules');
  assert.ok(!s.planSuggestions.some(x=>x.includes('读题时把条件')),'生活观察不引导做题');
  assert.deepEqual(s.observationIds,['obs-life-1']);
 }finally{f.dispose();}
});
