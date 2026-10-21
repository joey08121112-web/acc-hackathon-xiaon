/** 所有者：Claude。G0 首页综合模式经协调器的端到端（合成模型）：阶段由程序定、不允许的字段被丢弃并记入轨迹、安全优先、旧流程不变。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning,SAFETY_REPLY } from '../../server/agents/learning';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION,type ChatIntent,type ChatReply,type ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
/** Synthetic Tutor that always over-proposes every optional field; the program must keep only what the stage allows. */
class Greedy implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;systems:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.systems.push(input.messages.find(m=>m.role==='system')!.content);
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[],
   memoryDraft:{text:'喜欢打篮球',kind:'interest',origin:'chat'},
   problemDraft:{source:'spoken',questionText:null,studentWork:null,knowledgePointId:'like-terms',stuckQuote:'这道题我做错了',stuckPointId:null,catalogTask:null},
   observation:{dimension:'理解',signal:'partial',quote:'这道题我做错了',note:'合成观察'},
   progressCardDraft:{episodeId:null,breakthrough:'合成',method:null,nextTry:null}}),toolCalls:[]};
 }
}
function setup(provider?:ModelProvider){
 const f=temporaryRepository(),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r,{timeoutMs:2000});
 const history:{role:'user'|'assistant';content:string}[]=[];
 const say=async(text:string,extra:{intent?:ChatIntent;problemId?:string}={}):Promise<ChatReply>=>{
  history.push({role:'user',content:text});const reply=await d.chat({operationId:id(),history:history.slice(-20),flow:'home',...extra});
  history.push({role:'assistant',content:reply.text});assert.ok(schemas.ChatReply.safeParse(reply).success,'reply matches the frozen ChatReply contract');return reply;
 };
 return{...f,r,d,say,history,turns:()=>r.repository.list('chatTurns')};
}

test('home flow: listen 2 turns, needs-check once, every field outside the stage is dropped and traced',async()=>{
 const p=new Greedy(),f=setup(p);try{
  const a=await f.say('今天考砸了'),b=await f.say('数学，好多错题');
  assert.deepEqual([a.stage,b.stage],['listen','listen']);assert.equal(a.needsCheck,false);assert.equal(b.needsCheck,true);
  assert.equal(a.sessionId,b.sessionId);assert.match(p.systems[0],/^tutor-g0-listen/);
  // Memory is off by default: the memory draft is dropped as memory_off, the rest as stage_not_allowed.
  assert.deepEqual(f.turns()[0].dropped.map(x=>x.field+':'+x.reason).sort(),['memoryDraft:memory_off','observation:stage_not_allowed','problemDraft:stage_not_allowed','progressCardDraft:stage_not_allowed']);
  assert.equal(a.memoryDraft??a.problemDraft??a.progressCardDraft,null);
  const c=await f.say('第3题我做错了');
  assert.equal(c.stage,'probe');assert.equal(c.askProblem,true);assert.equal(c.needsCheck,false);
  assert.match(p.systems[2],/^tutor-g0-probe-observe/);assert.match(p.systems[2],/本轮程序允许一次轻轻的试探/);assert.doesNotMatch(p.systems[2],/禁止：讲解知识/);
  // Stage allows problemDraft + observation, but the G0 plugin validators are stubs: dropped as not_implemented, nothing stored.
  assert.deepEqual(f.turns()[2].dropped.map(x=>x.field+':'+x.reason).sort(),['memoryDraft:stage_not_allowed','observation:not_implemented','problemDraft:not_implemented','progressCardDraft:stage_not_allowed']);
  assert.equal(c.problemDraft,null);assert.equal(f.r.repository.list('observations').length,0);
  const d=await f.say('嗯');assert.equal(d.stage,'probe');assert.match(p.systems[3],/^tutor-g0-probe$/m);
  assert.deepEqual(f.turns().map(t=>t.turn),[1,2,3,4]);
  for(const t of f.turns())assert.doesNotMatch(JSON.stringify(t),/考砸|错题|第3题/,'chat turns never store student text');
 }finally{f.dispose();}
});

test('home flow: safety first (nothing stored), rest pauses, intent without the home flow is rejected',async()=>{
 const p=new Greedy(),f=setup(p);try{
  await f.say('你好');
  const s=await f.say('我真的不想活了');assert.equal(s.stage,'safety');assert.equal(s.safety,true);assert.equal(s.text,SAFETY_REPLY);assert.equal(s.run,null);
  assert.equal(f.turns().length,1);assert.equal(p.systems.length,1);
  const r=await f.say('我想休息一下');assert.equal(r.stage,'rest');assert.equal(f.turns().at(-1)!.studyDeclined,true);assert.equal((await f.d.view()).paused,true);
  await assert.rejects(f.d.chat({operationId:id(),history:[{role:'user',content:'你好'}],intent:'study'}),{code:'invalid_params'});
  await assert.rejects(f.d.chat({operationId:id(),history:[{role:'user',content:'你好'}],flow:'home',problemId:'no-such-problem'}),{code:'not_found'});
 }finally{f.dispose();}
});

test('home flow: memory on still drops memory drafts while memory-flow is a stub; farewell ends the session',async()=>{
 const f=setup(new Greedy());try{
  f.r.events.consent({operationId:id(),optionalMemory:true});
  const a=await f.say('今天去打球了');assert.equal(a.memoryDraft,null);
  assert.deepEqual(f.turns()[0].dropped.find(x=>x.field==='memoryDraft'),{field:'memoryDraft',reason:'not_implemented'});
  const bye=await f.say('今天先聊到这，拜拜');assert.equal(bye.summary,null,'endConversation is a stub in G0');assert.equal(f.turns().at(-1)!.ended,true);
  const next=await f.say('我又来了');assert.notEqual(next.sessionId,a.sessionId);assert.equal(f.turns().at(-1)!.turn,1);
 }finally{f.dispose();}
});

test('home flow: probe → think (active task + start_together) → reflect when the program matches the answer → companion after a card',async()=>{
 const f=setup(new Greedy());try{
  const session=await f.d.start({operationId:id(),mode:'support'});await f.d.open({operationId:id(),sessionId:session.id,taskId:'model',taskVersion:2});
  await f.say('考砸了');await f.say('还好');await f.say('这道题我不会做');
  const t=await f.say('好，一起看',{intent:'start_together'});assert.equal(t.stage,'think');
  const ep=f.r.repository.list('episodes');assert.equal(ep.length,1);assert.deepEqual(ep[0].task,{taskId:'model',taskVersion:2});assert.equal(ep[0].status,'active');
  assert.deepEqual(f.turns().at(-1)!.dropped.map(x=>x.reason),['stage_not_allowed','stage_not_allowed','stage_not_allowed','stage_not_allowed']);
  const answer=f.r.catalog.definition('model',2)!.answer[0];
  const r=await f.say(answer);assert.equal(r.stage,'reflect');assert.equal(r.progressCardDraft,null,'draftProgressCard is a stub in G0');
  const revised=f.r.repository.get('episodes',ep[0].id)!;assert.equal(revised.revision,2);assert.equal(revised.endReason,'solved');assert.ok(revised.studentSolvedAt);
  assert.equal((await f.say('嗯')).stage,'reflect');
  f.r.repository.append('progressCards',{schemaVersion:SCHEMA_VERSION,id:'card-1',operationId:'card-op-1',sessionId:t.sessionId!,episodeId:ep[0].id,aiDraft:null,breakthrough:null,method:null,nextTry:null,skipped:['breakthrough','method','nextTry'],confidence:null,confirmedAt:f.clock.now()});
  assert.equal((await f.say('好了')).stage,'companion');assert.equal(f.r.repository.get('episodes',ep[0].id)!.status,'closed');
 }finally{f.dispose();}
});

test('home flow without a model: fixed gentle reply, no observation, contract still holds',async()=>{
 const f=setup();try{
  await f.say('今天考砸了');await f.say('数学');const c=await f.say('这道题我做错了');
  assert.equal(c.stage,'probe');assert.equal(c.run?.status,'unavailable');assert.ok(c.text.length>0);assert.equal(f.r.repository.list('observations').length,0);
 }finally{f.dispose();}
});
