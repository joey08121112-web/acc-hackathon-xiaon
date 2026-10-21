/** 所有者：Claude。第一期 B：一起思考（逐级帮助、答案拦截、接续）与进步卡。合成材料；错题记录用合成夹具，不依赖 zCode 分支。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { SqliteRepository } from '../../server/storage/repository';
import { temporaryRepository } from '../../server/storage/testing';
import { OfflineProvider } from '../../server/providers/glm';
import { SCHEMA_VERSION,type ChatIntent,type ChatReply,type ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
/** Synthetic model. Tutor turns: next scripted message/fields (default a short neutral line). Card call: this.card. */
class Script implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;tutor:Record<string,unknown>[]=[];card:unknown={};users:Record<string,unknown>[]=[];systems:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.find(m=>m.role==='system')!.content;this.systems.push(system);
  if(system.startsWith('progress-card-'))return{content:JSON.stringify(this.card),toolCalls:[]};
  if(system.startsWith('summary-'))return{content:JSON.stringify({topics:['一起想了一道题'],planSuggestions:['明天再试一道']}),toolCalls:[]};
  this.users.push(JSON.parse(input.messages.find(m=>m.role==='user')!.content));
  return{content:JSON.stringify({message:'嗯，你再想想下一步？',taskIds:[],...(this.tutor.shift()??{})}),toolCalls:[]};
 }
}
function setup(provider:ModelProvider=new Script(),databasePath?:string){
 const f=temporaryRepository();const repository=databasePath?new SqliteRepository(databasePath):f.repository;
 const r=createRuntime({repository,clock:f.clock,provider}),d=installLearning(r,{timeoutMs:2000});
 const history:{role:'user'|'assistant';content:string}[]=[];
 const say=async(text:string,extra:{intent?:ChatIntent;problemId?:string}={}):Promise<ChatReply>=>{history.push({role:'user',content:text});const reply=await d.chat({operationId:id(),history:history.slice(-20),flow:'home',...extra});history.push({role:'assistant',content:reply.text});return reply;};
 const episode=()=>{const all=r.repository.list('episodes');return all.length?r.repository.get('episodes',all.at(-1)!.id)!:undefined;};
 return{...f,r,d,say,history,episode,dispose(){if(databasePath)repository.close();f.dispose();}};
}
/** listen ×2 → probe → think on the exposed catalog task 'model'. */
async function intoThink(f:ReturnType<typeof setup>){
 const s=await f.d.start({operationId:id(),mode:'support'});await f.d.open({operationId:id(),sessionId:s.id,taskId:'model',taskVersion:2});
 await f.say('考砸了');await f.say('还好');await f.say('这道题我不会做');
 const t=await f.say('好，一起看',{intent:'start_together'});assert.equal(t.stage,'think');return {session:s,reply:t};
}
const answerOf=(f:ReturnType<typeof setup>)=>f.r.catalog.definition('model',2)!.answer[0];

test('think: help is given level by level only on request, each level is recorded on the episode and as an exposure',async()=>{
 const p=new Script(),f=setup(p);try{
  await intoThink(f);
  const helps=()=>f.r.repository.list('exposures').filter(e=>e.kind==='chat_help').length;
  const before=helps();
  await f.say('我想想');assert.equal(p.users.at(-1)!.helpLevel,0,'no help unless asked');assert.deepEqual(f.episode()!.helpLevelsUsed,[]);
  await f.say('给我一点提示');assert.equal(p.users.at(-1)!.helpLevel,1);
  await f.say('还是不会，再给点提示');assert.equal(p.users.at(-1)!.helpLevel,2);
  await f.say('再给我一点提示');await f.say('还要提示');
  assert.deepEqual(f.episode()!.helpLevelsUsed,[1,2,3,3],'the ladder stops at level 3');
  assert.ok(helps()-before>=4,'every help level is an exposure event');
  assert.match(p.systems.at(-1)!,/^tutor-g0-think/);
 }finally{f.dispose();}
});

test('think: a reply containing the reference answer is held back until the student has said it; then reflect',async()=>{
 const p=new Script(),f=setup(p);try{
  await intoThink(f);const answer=answerOf(f);
  p.tutor=[{message:'答案是'+answer+'，懂了吗？'}];
  const held=await f.say('直接告诉我答案吧');assert.doesNotMatch(held.text,new RegExp(answer.replace(/[+]/g,'\\+')));assert.equal(held.run?.status,'failed');assert.equal(held.stage,'think');
  const solved=await f.say(answer);assert.equal(solved.stage,'reflect');assert.equal(f.episode()!.endReason,'solved');assert.ok(f.episode()!.studentSolvedAt);
  p.tutor=[{message:'对，就是'+answer+'。'}];
  const open=await f.say('我算出来了');assert.match(open.text,/就是/,'after the student solved it, the answer may be discussed');
 }finally{f.dispose();}
});

test('think on a confirmed problem record: ProblemSecret answers are intercepted the same way (synthetic fixture; the answer matches no catalog answer)',async()=>{
 const p=new Script(),f=setup(p);try{
  await f.say('考砸了');await f.say('还好');const probe=await f.say('第3题我做错了');assert.equal(probe.stage,'probe');
  f.r.repository.append('problems',{schemaVersion:SCHEMA_VERSION,id:'problem-1',operationId:'op-problem-1',source:'spoken',questionText:'化简 -(11-7y)',studentWork:'-11-7y',knowledgePointId:'negative-brackets',stuckQuote:'负号不知道管谁',stuckPointId:null,catalogTask:null,sessionId:probe.sessionId,answerStatus:'verified',confirmedAt:f.clock.now()});
  f.r.repository.append('problemSecrets',{schemaVersion:SCHEMA_VERSION,id:'secret-1',problemId:'problem-1',answer:['7y-11'],origin:'student_provided',createdAt:f.clock.now()});
  const think=await f.say('就看这道题吧',{intent:'start_together',problemId:'problem-1'});assert.equal(think.stage,'think');assert.equal(f.episode()!.problemId,'problem-1');
  assert.equal(JSON.stringify(p.users.at(-1)).includes('7y-11'),false,'the secret never reaches the model');
  p.tutor=[{message:'结果是 7y - 11'}];const held=await f.say('还是不会');assert.doesNotMatch(held.text,/7y\s*-\s*11/);
  assert.equal((await f.say('7y-11')).stage,'reflect');
 }finally{f.dispose();}
});

test('reflect: the card is drafted after the student reflects, is not saved until confirmed, and is honest about hints',async()=>{
 const p=new Script(),f=setup(p);try{
  await intoThink(f);await f.say('给我一点提示');
  p.tutor=[{},{progressCardDraft:{episodeId:null,breakthrough:'完全靠自己推出来了',method:'「我先把括号前的负号圈出来」',nextTry:'下次先圈负号'}}];
  const enter=await f.say(answerOf(f));assert.equal(enter.stage,'reflect');assert.equal(enter.progressCardDraft,null,'first ask the student');
  const card=await f.say('我学会了先看清负号');
  assert.ok(card.progressCardDraft);const d=card.progressCardDraft!;
  assert.equal(d.episodeId,f.episode()!.id);assert.doesNotMatch(d.breakthrough??'',/完全靠自己/);assert.match(d.breakthrough??'',/提示/);
  assert.equal(d.method?.includes('我先把括号前的负号圈出来'),false,'a quote the student never said is not kept');
  assert.equal(d.nextTry,'下次先圈负号');
  assert.equal(card.memoryDraft,null,'memory off: no memory draft');
  assert.equal(f.r.repository.list('progressCards').length,0,'a draft is not a saved card');
 }finally{f.dispose();}
});

test('reflect with memory on: a method memory draft from the progress card; without a model the card is assembled by the program',async()=>{
 const f=setup(new OfflineProvider());try{
  f.r.events.consent({operationId:id(),optionalMemory:true});
  await intoThink(f);await f.say(answerOf(f));const card=await f.say('拆开来看就清楚了');
  assert.ok(card.progressCardDraft);assert.match(card.progressCardDraft!.breakthrough??'',/算出/);assert.match(card.progressCardDraft!.method??'',/拆开来看就清楚了/);
  assert.deepEqual(card.memoryDraft&&{kind:card.memoryDraft.kind,origin:card.memoryDraft.origin},{kind:'method',origin:'progress_card'});
  assert.match(card.memoryDraft!.text,/拆开来看/);
 }finally{f.dispose();}
});

test('confirmProgressCard: student text and AI draft stored apart, empty columns skipped, then back to companion',async()=>{
 const p=new Script(),f=setup(p);try{
  await intoThink(f);await f.say(answerOf(f));const r=await f.say('先跳过');const draft=r.progressCardDraft!;
  assert.ok(draft);
  await assert.rejects(f.d.confirmProgressCard({operationId:id(),sessionId:'chat-nope',episodeId:null,aiDraft:null,breakthrough:null,method:null,nextTry:null,confidence:null}),{code:'not_found'});
  const saved=await f.d.confirmProgressCard({operationId:id(),sessionId:r.sessionId!,episodeId:draft.episodeId,aiDraft:draft,breakthrough:'我自己改的：看清负号',method:null,nextTry:null,confidence:'about_same'});
  assert.equal(saved.breakthrough,'我自己改的：看清负号');assert.deepEqual(saved.skipped,['method','nextTry']);assert.equal(saved.confidence,'about_same');assert.deepEqual(saved.aiDraft,draft);
  await assert.rejects(f.d.confirmProgressCard({operationId:id(),sessionId:r.sessionId!,episodeId:draft.episodeId,aiDraft:null,breakthrough:null,method:null,nextTry:null,confidence:null}),{code:'conflict'});
  assert.equal(f.r.repository.list('evidence').length,0,'a progress card is never scoring evidence');
  const next=await f.say('好了');assert.equal(next.stage,'companion');assert.equal(f.episode()!.status,'closed');
 }finally{f.dispose();}
});

test('a card cannot be confirmed before reflect; the episode resumes after a restart',async()=>{
 const f=setup();let path='';try{
  const {reply}=await intoThink(f);path=f.databasePath;
  await assert.rejects(f.d.confirmProgressCard({operationId:id(),sessionId:reply.sessionId!,episodeId:f.episode()!.id,aiDraft:null,breakthrough:null,method:null,nextTry:null,confidence:null}),{code:'invalid_state'});
  await f.say('给我一点提示');
  // Restart: a new runtime and coordinator on the same SQLite file continue the same think episode.
  const g=setup(new Script(),path);try{
   g.history.push(...f.history);const again=await g.say('我想想');
   assert.equal(again.stage,'think');assert.equal(again.sessionId,reply.sessionId);assert.deepEqual(g.episode()!.helpLevelsUsed,[1]);
  }finally{g.dispose();}
 }finally{f.dispose();}
});
