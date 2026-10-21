/** 所有者：Claude。第一期 A：综合模式的对话观察与对话小结（合成模型 + 本地规则）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { validateObservation,latestSummary } from '../../server/plugins/conversation';
import { temporaryRepository } from '../../server/storage/testing';
import { SCHEMA_VERSION,type ChatIntent,type ChatObservation,type ChatReply,type ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const at='2026-10-21T08:00:00.000Z';
type Tutor={observation?:unknown};
/** Synthetic model: Tutor turns take the next scripted extra fields; the summary call returns a fixed draft. */
class Script implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;tutor:Tutor[]=[];summary:unknown={topics:['数学单元测验','去括号'],planSuggestions:['明天找一道去括号的小题，先说第一步']};systems:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.find(m=>m.role==='system')!.content;this.systems.push(system);
  if(system.startsWith('summary-'))return{content:JSON.stringify(this.summary),toolCalls:[]};
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[],...(this.tutor.shift()??{})}),toolCalls:[]};
 }
}
function setup(provider?:ModelProvider){
 const f=temporaryRepository(),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r,{timeoutMs:2000});
 const history:{role:'user'|'assistant';content:string}[]=[];
 const say=async(text:string,extra:{intent?:ChatIntent}={}):Promise<ChatReply>=>{history.push({role:'user',content:text});const reply=await d.chat({operationId:id(),history:history.slice(-20),flow:'home',...extra});history.push({role:'assistant',content:reply.text});return reply;};
 const end=(sessionId:string)=>d.endConversation({operationId:id(),sessionId,history:history.slice(-20)});
 return{...f,r,d,say,end,history,turns:()=>r.repository.list('chatTurns'),obs:()=>r.repository.list('observations')};
}
const obs=(quote:string,dimension:'理解'|'逻辑'='理解',signal:'clear'|'partial'|'confused'='partial')=>({dimension,signal,quote,note:'合成观察'});

test('validateObservation: only 理解/逻辑, only on an allowed probe turn, verbatim quote, at most 3 per dimension',()=>{
 const check={sessionId:'chat-1',stage:'probe' as const,studentTexts:['题目说的每份是什么意思我不懂'],probeAllowed:true,existing:[] as ChatObservation[]};
 const ok=validateObservation(obs('每份是什么意思'),check);assert.equal(ok.ok,true);
 assert.equal(validateObservation({...obs('每份是什么意思'),dimension:'计算'},check).ok,false);
 assert.equal(validateObservation(obs('我完全不懂分数'),check).ok,false,'not something the student said');
 assert.equal(validateObservation(obs('每份是什么意思'),{...check,probeAllowed:false}).ok,false);
 assert.equal(validateObservation(obs('每份是什么意思'),{...check,stage:'listen'}).ok,false);
 const three=[1,2,3].map(n=>({schemaVersion:SCHEMA_VERSION,id:'o'+n,sessionId:'chat-1',...obs('每份'),status:'unverified' as const,at}));
 assert.equal(validateObservation(obs('每份是什么意思'),{...check,existing:three}).ok,false,'4th 理解 observation in a session');
 assert.equal(validateObservation(obs('每份是什么意思','逻辑'),{...check,existing:three}).ok,true);
 assert.equal(validateObservation({...obs('每份'),extra:1},check).ok,false);
});

test('chat: an allowed probe turn stores an unverified observation; listen, gap turns and foreign quotes store nothing',async()=>{
 const p=new Script(),f=setup(p);try{
  p.tutor=[{observation:obs('今天考砸了')},{},{observation:obs('每份是什么意思')},{observation:obs('每份是什么意思')}];
  await f.say('今天考砸了');assert.equal(f.obs().length,0,'listen never observes');
  await f.say('数学');
  const c=await f.say('第3题我做错了，每份是什么意思我不懂');
  assert.equal(c.stage,'probe');assert.equal(f.obs().length,1);
  const o=f.obs()[0];assert.equal(o.status,'unverified');assert.equal(o.sessionId,c.sessionId);assert.equal(o.quote,'每份是什么意思');
  // G2: the turn after a probe may record the answer, but only by quoting that answer; an older quote is invalid there.
  await f.say('嗯');assert.equal(f.obs().length,1,'answer turn: only this message may be quoted');
  assert.deepEqual(f.turns().at(-1)!.dropped.find(x=>x.field==='observation'),{field:'observation',reason:'invalid'});
  // Observations never touch scoring evidence or skill state.
  assert.equal(f.r.repository.list('evidence').length,0);assert.equal(f.r.repository.list('skills').length,0);
 }finally{f.dispose();}
});

test('chat: a quote from an earlier session does not count as this session\'s words',async()=>{
 const p=new Script(),f=setup(p);try{
  await f.say('上次那道题每份是什么意思我不懂');await f.say('今天先聊到这，拜拜');
  p.tutor=[{},{},{observation:obs('每份是什么意思我不懂')}];
  await f.say('我又来了');await f.say('还行');const c=await f.say('这道题我又做错了');
  assert.equal(c.stage,'probe');assert.equal(f.obs().length,0);
  assert.deepEqual(f.turns().at(-1)!.dropped.find(x=>x.field==='observation'),{field:'observation',reason:'invalid'});
 }finally{f.dispose();}
});

test('summary: emotion labels are dropped, no previous summary means no changes, the summary is a learning record even with memory off',async()=>{
 const p=new Script(),f=setup(p);try{
  p.summary={topics:['数学单元测验','他很焦虑','去括号'],planSuggestions:['明天做一道去括号小题','心情不好就多休息','先说出第一步','再多一条']};
  p.tutor=[{},{},{observation:obs('每份是什么意思')}];
  await f.say('今天考砸了');await f.say('数学');const c=await f.say('第3题做错了，每份是什么意思');
  assert.equal(f.r.events.memoryEnabled(),false);
  const s=await f.end(c.sessionId!);
  assert.deepEqual(s.topics,['数学单元测验','去括号']);assert.ok(s.planSuggestions.length>=1&&s.planSuggestions.length<=3);assert.ok(s.planSuggestions.every(x=>!/心情/.test(x)));
  assert.deepEqual(s.changes,[]);assert.equal(s.comparedWithSummaryId,null);assert.deepEqual(s.observationIds,f.obs().map(o=>o.id));
  assert.equal(s.trigger,'student_end');assert.equal(s.mode,'model');assert.equal(s.suggestProfessionalMode,true,'has an observation, calm');
  assert.deepEqual((await f.d.view()).summaries.map(x=>x.id),[s.id]);
  assert.equal((await f.end(c.sessionId!)).id,s.id,'one summary per chat session');
  assert.equal(latestSummary({...f.r.engineContext()} as never)?.id,s.id);
  const next=await f.say('我回来了');assert.notEqual(next.sessionId,c.sessionId,'an ended session is not continued');
 }finally{f.dispose();}
});

test('summary: no professional-mode suggestion while the last 2 turns are intense; nothing to suggest without observations or stuck points',async()=>{
 const f=setup(new Script());try{
  await f.say('今天考砸了');await f.say('数学');await f.say('这道题我做错了');const d=await f.say('烦死了，真的受不了');
  assert.equal((await f.end(d.sessionId!)).suggestProfessionalMode,false);
 }finally{f.dispose();}
 const g=setup(new Script());try{
  await g.say('今天去打球了');const b=await g.say('挺开心的');
  assert.equal((await g.end(b.sessionId!)).suggestProfessionalMode,false);
 }finally{g.dispose();}
});

test('summary: changes compare same-dimension observations with both quotes; farewell triggers the summary in the chat reply',async()=>{
 const p=new Script(),f=setup(p);try{
  p.tutor=[{},{},{observation:obs('每份是什么意思','理解','confused')}];
  await f.say('今天考砸了');await f.say('数学');const first=await f.say('第3题做错了，每份是什么意思');
  const s1=await f.end(first.sessionId!);
  p.tutor=[{},{},{observation:obs('每份就是平均分后的一份','理解','clear')}];
  await f.say('我又来了');await f.say('还行');await f.say('那道题我想明白了，每份就是平均分后的一份');
  const bye=await f.say('今天先聊到这，拜拜');
  assert.ok(bye.summary);assert.equal(bye.summary!.trigger,'farewell');assert.equal(bye.summary!.comparedWithSummaryId,s1.id);
  assert.equal(bye.summary!.changes.length,1);assert.match(bye.summary!.changes[0],/理解/);
  assert.match(bye.summary!.changes[0],/每份是什么意思/);assert.match(bye.summary!.changes[0],/每份就是平均分后的一份/);
 }finally{f.dispose();}
});

test('summary without a model: assembled by the program (topics + plan only), still saved; safety sessions get no summary',async()=>{
 const f=setup();try{
  await f.say('今天考砸了');await f.say('数学');const c=await f.say('这道题我做错了');
  const s=await f.end(c.sessionId!);assert.equal(s.mode,'local_rules');assert.ok(s.topics.length>=1);assert.ok(s.planSuggestions.length>=1&&s.planSuggestions.length<=3);
  assert.deepEqual(s.changes,[]);
 }finally{f.dispose();}
 const g=setup();try{
  await g.say('今天考砸了');const b=await g.say('数学');await g.say('我真的不想活了');
  await assert.rejects(g.end(b.sessionId!),{code:'invalid_state'});assert.equal(g.r.repository.list('summaries').length,0);
  await assert.rejects(g.end('chat-unknown'),{code:'not_found'});
 }finally{g.dispose();}
});
