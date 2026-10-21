/** 所有者：Claude。第二期顺带修正 REPORT-1 的遗留：试探之后的下一轮，可以记下学生对试探问题的回答（只能引用这一句原话，不再试探）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { decideStage,type ChatStageState } from '../../server/agents/stages';
import { temporaryRepository } from '../../server/storage/testing';
import type { ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
function play(texts:string[]){let state:ChatStageState|null=null;return texts.map(text=>{const d=decideStage(state,{sessionId:'chat-1',text,intent:null,hasProblem:false,hasActiveTask:false,solved:false,progressCardDone:false,memoryEnabled:false});state=d.state;return d;});}

test('the turn right after a probe may record the answer, without probing again; the gap after it may not',()=>{
 const d=play(['数学考砸了','错题好多','这道题我做错了','每份就是平均分的一份吧','嗯','我想想','崩溃了','再看看']);
 assert.equal(d[2].probeAllowed,true);
 assert.deepEqual([d[3].probeAllowed,d[3].answerTurn],[false,true]);assert.ok(d[3].allowed.includes('observation'));
 assert.deepEqual([d[4].probeAllowed,d[4].answerTurn],[false,false]);assert.ok(!d[4].allowed.includes('observation'));
 assert.equal(d[5].probeAllowed,true);
 assert.equal(d[6].intense,true);assert.deepEqual([d[6].answerTurn,d[6].allowed.includes('observation')],[false,false],'no recording while upset');
});

class Script implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;tutor:Record<string,unknown>[]=[];versions:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.versions.push(input.messages[0].content.split('\n')[0]);
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[],...(this.tutor.shift()??{})}),toolCalls:[]};
 }
}
test('chat: the answer turn stores an observation quoting that answer only; an older quote is refused there',async()=>{
 const p=new Script(),f=temporaryRepository(),r=createRuntime({...f,provider:p}),d=installLearning(r,{timeoutMs:2000});
 const history:{role:'user'|'assistant';content:string}[]=[];
 const say=async(text:string)=>{history.push({role:'user',content:text});const reply=await d.chat({operationId:id(),history:history.slice(-20),flow:'home'});history.push({role:'assistant',content:reply.text});return reply;};
 const obs=(quote:string)=>({observation:{dimension:'理解',signal:'partial',quote,note:'合成观察'}});
 try{
  p.tutor=[{},{},{},obs('每份就是平均分的一份'),{},{},obs('我做错了')];
  await say('数学考砸了');await say('错题好多');await say('这道题我做错了');
  assert.equal(p.versions.at(-1),'tutor-g0-probe-observe');
  await say('每份就是平均分的一份吧');
  assert.equal(p.versions.at(-1),'tutor-g0-probe-observe-answer','the answer turn gets its own block: record, do not probe again');
  assert.deepEqual(r.repository.list('observations').map(o=>o.quote),['每份就是平均分的一份']);
  // Next probe at turn 6, answer turn 7: a quote from an earlier turn is not the answer and is dropped as invalid.
  await say('嗯');await say('我再想想这道题');await say('好像是这样');
  assert.equal(r.repository.list('observations').length,1);
  assert.deepEqual(r.repository.list('chatTurns').at(-1)!.dropped.find(x=>x.field==='observation'),{field:'observation',reason:'invalid'});
 }finally{f.dispose();}
});
