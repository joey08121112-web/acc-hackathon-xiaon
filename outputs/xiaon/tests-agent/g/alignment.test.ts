/** 所有者：Claude。G0 与 P0 卡点补丁（8a97be9）对齐：卡点确认由程序判定、错题记录引用卡点、记忆选择上限、Tutor 回复长度门控。合成材料。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning,capMemorySelection } from '../../server/agents/learning';
import { fitReply,replyLength } from '../../server/agents/stages';
import { temporaryRepository } from '../../server/storage/testing';
import { SCHEMA_VERSION,TUTOR_REPLY_MAX_CHARS,MEMORY_CONTEXT_MAX_ITEMS,MEMORY_CONTEXT_MAX_CHARS,type MemoryItem,type ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const at='2026-10-21T08:00:00.000Z';
const LONG='听起来你今天在数学课上遇到了不少麻烦，尤其是去括号的时候总是把负号弄丢，这种情况其实很多同学都会遇到。我们可以先从最简单的一步开始看，你愿意把那道题读给我听吗？然后我们一起慢慢找到卡住的地方。';
class Scripted implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;calls=0;constructor(private messages:string[]){}
 async complete():ReturnType<ModelProvider['complete']>{const message=this.messages[Math.min(this.calls,this.messages.length-1)];this.calls++;return{content:JSON.stringify({message,taskIds:[]}),toolCalls:[]};}
}
const setup=(p?:ModelProvider)=>{const f=temporaryRepository(),r=createRuntime({...f,...(p?{provider:p}:{})}),d=installLearning(r,{timeoutMs:2000});return{...f,r,d};};

test('fitReply keeps short replies and cuts long ones at a sentence end, else a comma, else the limit',()=>{
 assert.equal(fitReply('嗯，我在听。',80),'嗯，我在听。');
 assert.ok(replyLength(LONG)>TUTOR_REPLY_MAX_CHARS);
 const cut=fitReply(LONG,TUTOR_REPLY_MAX_CHARS);assert.ok(replyLength(cut)<=TUTOR_REPLY_MAX_CHARS);assert.match(cut,/[。！？!?…]$/);assert.ok(LONG.startsWith(cut));
 assert.equal(fitReply('一二三，四五六七八九十',8),'一二三。');
 assert.equal(fitReply('一二三四五六七八九十',8),'一二三四五六七八');
});

test('Tutor reply above the limit: one rewrite, then a sentence-end cut; recorded on the home turn',async()=>{
 const rewrite=new Scripted([LONG,'听起来挺难的，愿意说说是哪道题吗？']),f=setup(rewrite);try{
  const r=await f.d.chat({operationId:id(),history:[{role:'user',content:'今天考砸了'}],flow:'home'});
  assert.equal(rewrite.calls,2);assert.equal(r.text,'听起来挺难的，愿意说说是哪道题吗？');assert.equal(f.r.repository.list('chatTurns')[0].replyFit,'retried');
 }finally{f.dispose();}
 const stubborn=new Scripted([LONG]),g=setup(stubborn);try{
  const r=await g.d.chat({operationId:id(),history:[{role:'user',content:'今天考砸了'}],flow:'home'});
  assert.equal(stubborn.calls,2,'exactly one rewrite attempt');assert.ok(replyLength(r.text)<=TUTOR_REPLY_MAX_CHARS);assert.match(r.text,/[。！？!?…]$/);
  assert.equal(g.r.repository.list('chatTurns')[0].replyFit,'truncated');
  const legacy=await g.d.chat({operationId:id(),history:[{role:'user',content:'今天考砸了'}]});assert.ok(replyLength(legacy.text)<=TUTOR_REPLY_MAX_CHARS,'the legacy flow is gated too');
 }finally{g.dispose();}
});

test('record_stuck_point ignores the model\'s studentConfirmed; only a confirmed ProblemRecord linking it confirms it',async()=>{
 const f=setup();try{
  await f.d.start({operationId:id(),mode:'support'});
  const res=await f.r.tools.execute({id:'call-1',name:'record_stuck_point',arguments:JSON.stringify({knowledgePointId:'like-terms',kind:'method',studentQuote:'不知道x和常数能不能加',summary:'分不清哪些项能合并',studentConfirmed:true})},{role:'tutor',runId:'run-1',signal:new AbortController().signal,studentTexts:['我不知道x和常数能不能加']});
  assert.equal(res.ok,true);const stuck=f.r.repository.list('stuckPoints')[0];assert.equal(stuck.studentConfirmed,false,'a model argument can never confirm');
  assert.equal((await f.d.view()).stuckPoints[0].studentConfirmed,false);
  // Program gate on the student's confirm event: the link must exist and match the knowledge point (checked before the zCode stub runs).
  const draft={source:'spoken' as const,questionText:null,studentWork:null,knowledgePointId:'like-terms' as const,stuckQuote:'不知道x和常数能不能加',stuckPointId:'stuck-missing',catalogTask:null};
  await assert.rejects(f.d.confirmProblem({operationId:id(),sessionId:null,draft,referenceAnswer:null}),{code:'invalid_params'});
  await assert.rejects(f.d.confirmProblem({operationId:id(),sessionId:null,draft:{...draft,stuckPointId:stuck.id,knowledgePointId:'negative-brackets'},referenceAnswer:null}),{code:'invalid_params'});
  await assert.rejects(f.d.confirmProblem({operationId:id(),sessionId:null,draft:{...draft,stuckPointId:stuck.id},referenceAnswer:null}),{code:'not_implemented'});
  // What zCode's confirmProblem will append once the student clicks confirm:
  f.r.repository.append('problems',{schemaVersion:SCHEMA_VERSION,id:'problem-1',operationId:'op-p1',...draft,stuckPointId:stuck.id,sessionId:null,answerStatus:'unknown',confirmedAt:at});
  assert.equal((await f.d.view()).stuckPoints[0].studentConfirmed,true);
 }finally{f.dispose();}
});

test('Tutor memory context: the program keeps only active ids, no repeats, at most N items and M characters',()=>{
 const mem=(n:number,text:string):MemoryItem=>({schemaVersion:SCHEMA_VERSION,id:'m'+n,operationId:'op-m'+n,text,source:'student_explicit',purpose:'tutoring',createdAt:at,expiresAt:null,reviewAt:null,active:true});
 const active=Array.from({length:8},(_,i)=>mem(i,'喜欢打篮球'+i));
 const picked=capMemorySelection([{id:'m1'},{id:'m1'},{id:'ghost'},...active.slice(2)],active);
 assert.deepEqual(picked.map(m=>m.id),['m1','m2','m3','m4','m5']);assert.equal(picked.length,MEMORY_CONTEXT_MAX_ITEMS);
 const big=[mem(0,'长'.repeat(MEMORY_CONTEXT_MAX_CHARS-10)),mem(1,'这一条放不下了还有更多'),mem(2,'短')];
 assert.deepEqual(capMemorySelection(big,big).map(m=>m.id),['m0','m2']);
 assert.equal(capMemorySelection([{id:'m0',text:'被插件改写的文字'} as unknown as MemoryItem],active)[0].text,'喜欢打篮球0','the program uses its own copy of the memory text');
});

test('while selectMemoriesForContext is a stub, the Tutor still receives all active memories (unchanged behaviour)',async()=>{
 const seen:string[]=[];const p:ModelProvider={kind:'synthetic',supportsTools:true,async complete(input){seen.push(input.messages.find(m=>m.role==='user')!.content);return{content:JSON.stringify({message:'嗯。',taskIds:[]}),toolCalls:[]};}};
 const f=setup(p);try{
  f.r.events.consent({operationId:id(),optionalMemory:true});
  for(let i=0;i<7;i++)f.r.events.remember({operationId:id(),text:'合成偏好'+i,source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
  await f.d.chat({operationId:id(),history:[{role:'user',content:'你好'}]});
  assert.equal((JSON.parse(seen[0]) as {context:{memories:unknown[]}}).context.memories.length,7);
 }finally{f.dispose();}
});
