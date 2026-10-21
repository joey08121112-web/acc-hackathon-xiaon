/** 所有者：zCode。第一期 B：记忆提议校验、确认、提议上限、问候优先级与冷却、Tutor 上下文按需取用。合成材料，TestClock 推进日期。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, type LearningRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { validateMemoryDraft,confirmMemoryDraft,greeting,shouldOfferMemory,selectMemoriesForContext,MEMORY_DRAFT_MAX_CHARS,MEMORY_MENTION_COOLDOWN_DAYS } from '../../server/plugins/memory-flow';
import type { RevampContext } from '../../server/plugins/context';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { SCHEMA_VERSION,type MemoryItem,type ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const DAY=86_400_000;
class LaneProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;phrases:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  if(system.includes('greeting-i1'))return{content:JSON.stringify({text:this.phrases.shift()??'嗨，又见面啦。'}),toolCalls:[]};
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[]}),toolCalls:[]};
 }
}
const setup=(provider?:ModelProvider,clock:TestClock=new TestClock())=>{
 const f=temporaryRepository(clock),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r,{timeoutMs:2000});
 return{...f,r,d};
};
/** 直接构造插件用的 RevampContext（离线模型）：单测绕开协调器私有方法。 */
const offlineContext=(r:LearningRuntime):RevampContext=>({...r.engineContext(),events:r.events,providerKind:'offline',memoryEnabled:()=>r.events.memoryEnabled(),model:()=>{throw new Error('本测试不调用模型');}});
const remember=(f:ReturnType<typeof setup>,text:string)=>f.r.events.remember({operationId:id(),text,source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
const mem=(n:number,text:string):MemoryItem=>({schemaVersion:SCHEMA_VERSION,id:'m'+n,operationId:'op-m'+n,text,source:'student_explicit',purpose:'tutoring',createdAt:'2026-10-20T08:00:00.000Z',expiresAt:null,reviewAt:null,active:true});

test('validateMemoryDraft: 关闭即拒、情绪与评价丢弃、40 字上限、origin 由程序决定',()=>{
 const on={sessionId:'chat-x',stage:'companion' as const,studentTexts:['下周有篮球赛'],memoryEnabled:true,origin:'chat' as const};
 const good=validateMemoryDraft({text:'下周有篮球赛',kind:'event',origin:'progress_card'},on);
 assert.equal(good.ok,true);if(good.ok)assert.equal(good.value.origin,'chat','origin 只认程序给的调用方');
 assert.equal(validateMemoryDraft({text:'下周有篮球赛',kind:'event'},{...on,memoryEnabled:false}).ok,false,'记忆关闭一律拒绝');
 assert.equal(validateMemoryDraft({text:'他最近很焦虑',kind:'event'},on).ok,false,'情绪不记');
 assert.equal(validateMemoryDraft({text:'数学差，要多练',kind:'method'},on).ok,false,'评价不记');
 assert.equal(validateMemoryDraft({text:'下'.repeat(MEMORY_DRAFT_MAX_CHARS+1),kind:'event'},on).ok,false,'超过 40 字丢弃');
 assert.equal(validateMemoryDraft({text:'下周有篮球赛',kind:'feeling'},on).ok,false,'种类只能是事件/兴趣/方法');
 assert.equal(validateMemoryDraft({text:'先抄题再化简，一步一步来',kind:'method'},on).ok,true,'有用的方法可以记');
});

test('shouldOfferMemory: 同一场次最多两次提议机会；新场次重新计',()=>{
 const f=setup();try{
  const ctx=offlineContext(f.r);
  assert.equal(shouldOfferMemory({sessionId:'chat-a',stage:'companion',turn:1},ctx),true);
  assert.equal(shouldOfferMemory({sessionId:'chat-a',stage:'companion',turn:4},ctx),true);
  assert.equal(shouldOfferMemory({sessionId:'chat-a',stage:'reflect',turn:7},ctx),false,'第三次不再提议');
  assert.equal(shouldOfferMemory({sessionId:'chat-b',stage:'companion',turn:1},ctx),true,'新场次重新计');
 }finally{f.dispose();}
});

test('confirmMemoryDraft: 只有学生确认才写入；写 chat 提起与 30 天复核；关闭时拒绝',async()=>{
 const f=setup();try{
  f.r.events.consent({operationId:id(),optionalMemory:true});
  const item=await confirmMemoryDraft({operationId:id(),sessionId:'chat-x',draft:{text:'下周有篮球赛',kind:'event',origin:'chat'},text:'下周有班级篮球赛'},offlineContext(f.r));
  assert.equal(item.text,'下周有班级篮球赛','保存学生改后的文字');
  const stored=f.r.repository.list('memories')[0];
  assert.ok(stored.reviewAt,'长期记忆带 30 天复核时间');
  assert.equal(Date.parse(stored.reviewAt!)-Date.parse(stored.createdAt),30*DAY);
  assert.equal(f.r.repository.list('memoryMentions').filter(m=>m.via==='chat').length,1,'确认即记一条 chat 提起');
  await assert.rejects(confirmMemoryDraft({operationId:id(),sessionId:null,draft:{text:'x',kind:'event',origin:'chat'},text:'x'},{...offlineContext(f.r),memoryEnabled:()=>false}),{code:'forbidden'});
 }finally{f.dispose();}
});

test('greeting: 优先接上次小结（记忆关闭也可以）；没有小结才提记忆',async()=>{
 const p=new LaneProvider();p.phrases=['上次说的应用题，这几天感觉怎么样？'];
 const f=setup(p);try{
  f.r.events.consent({operationId:id(),optionalMemory:false});
  // 没有小结、记忆关闭 → 默认问候并标 memoryOff
  const off=await f.d.greeting({operationId:id()});
  assert.equal(off.memoryOff,true);assert.equal(off.memoryId,null);assert.match(off.text,/又见面/);
  // 有小结 → 即使记忆关闭也接上次话题
  f.r.repository.append('summaries',{schemaVersion:SCHEMA_VERSION,id:'sum-1',operationId:'op-s1',sessionId:'chat-old',trigger:'farewell',topics:['应用题读着绕'],observationIds:[],comparedWithSummaryId:null,changes:[],planSuggestions:['每天读一道应用题'],suggestProfessionalMode:false,progressCardId:null,mode:'model',createdAt:f.clock.now()});
  const withSummary=await f.d.greeting({operationId:id()});
  assert.equal(withSummary.summaryId,'sum-1');assert.equal(withSummary.memoryId,null);
  assert.ok(withSummary.text.includes('应用题'),'问候接上次话题');
  assert.equal(withSummary.memoryOff,true,'小结是学习记录，记忆状态如实标注');
 }finally{f.dispose();}
 const g=setup(new LaneProvider());try{
  g.r.events.consent({operationId:id(),optionalMemory:true});
  remember(g,'喜欢打篮球');
  const pick=await g.d.greeting({operationId:id()});
  assert.equal(pick.memoryId,g.r.repository.list('memories')[0].id,'没提过的记忆被主动提起');
  assert.equal(g.r.repository.list('memoryMentions').filter(m=>m.via==='greeting').length,1);
  // 3 天内同一条不再提：再问一次没有可提的，回默认问候
  const again=await g.d.greeting({operationId:id()});
  assert.equal(again.memoryId,null,'冷却期内不重复提起');
  (g.clock as TestClock).advance(MEMORY_MENTION_COOLDOWN_DAYS*DAY);
  const cooled=await g.d.greeting({operationId:id()});
  assert.equal(cooled.memoryId,pick.memoryId,'冷却后可以再提');
 }finally{g.dispose();}
});

test('greeting: 离线（无模型）返回默认文字；刚确认的记忆不会被马上提起',async()=>{
 const f=setup();try{
  f.r.events.consent({operationId:id(),optionalMemory:true});
  await confirmMemoryDraft({operationId:id(),sessionId:null,draft:{text:'喜欢打篮球',kind:'interest',origin:'chat'},text:'喜欢打篮球'},offlineContext(f.r));
  const g=await greeting({operationId:id()},offlineContext(f.r));
  assert.equal(g.memoryId,null,'刚确认的事不马上提起');
  assert.ok(g.text.length>0,'离线问候仍有默认文字');
 }finally{f.dispose();}
});

test('selectMemoriesForContext: 只取与当前话题相关的记忆，按相关度排序',()=>{
 const items=[mem(0,'喜欢打篮球'),mem(1,'下周有班级篮球赛'),mem(2,'解释时一次只讲一步'),mem(3,'喜欢下围棋')];
 const picked=selectMemoriesForContext({sessionId:'chat-x',stage:'probe',studentTexts:['上次说的篮球赛怎么样了'],memories:items},null as never);
 assert.deepEqual(picked.map(m=>m.id),['m1','m0'],'更相关的排前面');
 assert.deepEqual(selectMemoriesForContext({sessionId:null,stage:null,studentTexts:['你好'],memories:items},null as never),[],'没有相关记忆时不带');
});

test('Tutor 上下文经协调器按需取用：相关记忆才进上下文',async()=>{
 const seen:string[]=[];
 const p:ModelProvider={kind:'synthetic',supportsTools:true,async complete(input){seen.push(input.messages.find(m=>m.role==='user')!.content);return{content:JSON.stringify({message:'嗯。',taskIds:[]}),toolCalls:[]};}};
 const f=setup(p);try{
  f.r.events.consent({operationId:id(),optionalMemory:true});
  for(let i=0;i<6;i++)remember(f,'合成偏好'+i);
  remember(f,'喜欢打篮球');
  await f.d.chat({operationId:id(),history:[{role:'user',content:'上次说的篮球赛怎么样了'}]});
  const context=JSON.parse(seen[0]) as {context:{memories:{text:string}[]}};
  assert.equal(context.context.memories.length,1,'只有相关记忆进入上下文');
  assert.equal(context.context.memories[0].text,'喜欢打篮球');
 }finally{f.dispose();}
});
