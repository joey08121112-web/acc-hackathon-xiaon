import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository } from '../../server/storage/testing';
import type { ModelMessage,ModelProvider } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
type Step=(messages:ModelMessage[])=>{content:string;toolCalls:{id:string;name:string;arguments:string}[]};
/** Synthetic Tutor that plays a fixed script of tool calls; each step can read earlier tool results. */
class ScriptProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;steps:Step[]=[];users:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.users.push(input.messages.find(m=>m.role==='user')!.content);
  const step=this.steps.shift();if(!step)return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[]}),toolCalls:[]};return step(input.messages);
 }
}
const call=(name:string,args:unknown):Step=>()=>({content:'',toolCalls:[{id:'c-'+id(),name,arguments:JSON.stringify(args)}]});
const lastTool=(m:ModelMessage[])=>JSON.parse(m.filter(x=>x.role==='tool').at(-1)!.content);
const reply=(message:string,taskIds:(m:ModelMessage[])=>string[]=()=>[]):Step=>m=>({content:JSON.stringify({message,taskIds:taskIds(m)}),toolCalls:[]});
const setup=()=>{const p=new ScriptProvider(),f=temporaryRepository(),r=createRuntime({...f,provider:p}),d=installLearning(r,{timeoutMs:2000});return{...f,p,r,d};};
const probe=(last:string)=>[{role:'user' as const,content:'我不会'},{role:'assistant' as const,content:'能说说卡在哪吗？'},{role:'user' as const,content:last}];
const access=(role:'tutor'|'assessor',studentTexts?:string[])=>({role,runId:id(),signal:new AbortController().signal,...(studentTexts?{studentTexts}:{})});

test('Tutor records a stuck point only with a verbatim student quote, once per turn, and it survives into later turns',async()=>{
 const f=setup();try{
  await f.d.start({operationId:id(),mode:'support'});
  const args={knowledgePointId:'like-terms',kind:'method',studentQuote:'不知道x和常数能不能加',summary:'合并同类项时分不清哪些项能合并',studentConfirmed:true};
  f.p.steps=[call('record_stuck_point',{...args,studentQuote:'学生没说过的话'}),call('record_stuck_point',args),call('record_stuck_point',{...args,kind:'concept'}),reply('我听到的是：你分不清哪些项能合并，对吗？')];
  const out=await f.d.chat({operationId:id(),history:probe('我不知道x和常数能不能加')});
  assert.equal(out.run?.status,'completed');
  const calls=f.r.repository.list('toolCalls').filter(c=>c.name==='record_stuck_point').map(c=>[c.status,c.errorCode]);
  assert.deepEqual(calls,[['failed','invalid_params'],['succeeded',null],['failed','invalid_state']]);
  const saved=f.r.repository.list('stuckPoints');assert.equal(saved.length,1);
  assert.equal(saved[0].knowledgePointId,'like-terms');assert.equal(saved[0].kind,'method');assert.equal(saved[0].studentQuote,'不知道x和常数能不能加');assert.ok(saved[0].sessionId);
  await f.d.chat({operationId:id(),history:probe('嗯')});
  const sent=JSON.parse(f.p.users.at(-1)!) as {stuckPoints:{knowledgePointId:string;kind:string;studentQuote?:string}[]};
  assert.deepEqual(sent.stuckPoints.map(s=>[s.knowledgePointId,s.kind]),[['like-terms','method']]);assert.equal(sent.stuckPoints[0].studentQuote,undefined);
  assert.equal((await f.d.view()).stuckPoints.length,1);
  await f.d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});assert.equal(f.r.repository.list('stuckPoints').length,0);
 }finally{f.dispose();}
});

test('record_stuck_point is Tutor-only, needs the program-supplied conversation and rejects other knowledge points',async()=>{
 const f=setup();try{
  const args=JSON.stringify({knowledgePointId:'like-terms',kind:'start',studentQuote:'不知道',summary:'不知道第一步',studentConfirmed:false});
  const asAssessor=await f.r.tools.execute({id:id(),name:'record_stuck_point',arguments:args},access('assessor',['不知道']));assert.equal(asAssessor.ok,false);if(!asAssessor.ok)assert.equal(asAssessor.error.code,'forbidden');
  const noConversation=await f.r.tools.execute({id:id(),name:'record_stuck_point',arguments:args},access('tutor'));assert.equal(noConversation.ok,false);if(!noConversation.ok)assert.equal(noConversation.error.code,'forbidden');
  const otherPoint=await f.r.tools.execute({id:id(),name:'record_stuck_point',arguments:JSON.stringify({...JSON.parse(args),knowledgePointId:'rotation-2d'})},access('tutor',['不知道']));assert.equal(otherPoint.ok,false);if(!otherPoint.ok)assert.equal(otherPoint.error.code,'invalid_params');
  assert.equal(f.r.repository.list('stuckPoints').length,0);
 }finally{f.dispose();}
});

test('select_task by knowledge point honours prerequisites and returns only that point',async()=>{
 const f=setup();try{
  const s=await f.d.start({operationId:id(),mode:'support'});
  const blocked=await f.r.tools.execute({id:id(),name:'select_task',arguments:JSON.stringify({sessionId:s.id,knowledgePointId:'negative-brackets'})},access('tutor'));
  assert.equal(blocked.ok,false);if(!blocked.ok)assert.match(blocked.error.message,/先修知识点：like-terms/);
  const like=await f.r.tools.execute({id:id(),name:'select_task',arguments:JSON.stringify({sessionId:s.id,knowledgePointId:'like-terms'})},access('tutor'));
  assert.equal(like.ok,true);if(like.ok)assert.deepEqual((like.data as {knowledgePoints:string[]}).knowledgePoints,['like-terms']);
  await f.d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});
  await f.d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});
  const neg=await f.r.tools.execute({id:id(),name:'select_task',arguments:JSON.stringify({sessionId:s.id,knowledgePointId:'negative-brackets'})},access('tutor'));
  assert.equal(neg.ok,true);if(neg.ok)assert.deepEqual((neg.data as {knowledgePoints:string[]}).knowledgePoints,['negative-brackets']);
  const outside=await f.r.tools.execute({id:id(),name:'select_task',arguments:JSON.stringify({sessionId:s.id,knowledgePointId:'rotation-2d'})},access('tutor'));assert.equal(outside.ok,false);
  // End to end: the Tutor picks by knowledge point and the chat reply carries that public task as a suggestion.
  f.p.steps=[call('select_task',{sessionId:s.id,knowledgePointId:'negative-brackets'}),reply('好，我们看一道小题。',m=>[lastTool(m).data.id])];
  const out=await f.d.chat({operationId:id(),history:probe('好，我想试试负号那种题')});
  assert.equal(out.suggestions.length,1);assert.deepEqual(out.suggestions[0].knowledgePoints,['negative-brackets']);
 }finally{f.dispose();}
});

test('Tutor receives the latest verdict without the trusted answer, both in its input and via get_latest_feedback',async()=>{
 const f=setup();try{
  const s=await f.d.start({operationId:id(),mode:'support'});
  const before=await f.r.tools.execute({id:id(),name:'get_latest_feedback',arguments:'{}'},access('tutor'));assert.equal(before.ok,true);if(before.ok)assert.deepEqual(before.data,{feedback:null});
  await f.d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});
  await f.d.hint({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,level:1});
  await f.d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'x',reviewItemId:null,reviewRevision:null});
  await f.d.chat({operationId:id(),history:[{role:'user',content:'我做错了吗'}]});
  const sent=JSON.parse(f.p.users.at(-1)!) as {latestFeedback:{taskId:string;verdict:string;studentValue:string;hintLevelsUsed:number[];errorClues:string[]}};
  assert.equal(sent.latestFeedback.taskId,'b-like-observation');assert.equal(sent.latestFeedback.verdict,'incorrect');assert.equal(sent.latestFeedback.studentValue,'x');
  assert.deepEqual(sent.latestFeedback.hintLevelsUsed,[1]);assert.equal(sent.latestFeedback.errorClues.length,1);
  const raw=JSON.stringify(sent.latestFeedback);assert.ok(!raw.includes('5x-4'),'trusted answer must not reach the Tutor');assert.ok(!raw.includes('系数相加'),'hint text must not reach the Tutor');
  const tool=await f.r.tools.execute({id:id(),name:'get_latest_feedback',arguments:'{}'},access('tutor'));assert.equal(tool.ok,true);if(tool.ok)assert.deepEqual((tool.data as {feedback:unknown}).feedback,sent.latestFeedback);
 }finally{f.dispose();}
});
