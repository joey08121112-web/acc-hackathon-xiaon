/** 所有者：Claude。首页倾听、陪聊阶段不给 Tutor 工具（少一轮模型调用）；找卡点阶段照常给工具。合成模型。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import type { ModelProvider } from '../../shared/learning-contracts';
class Recorder implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;tools:number[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.tools.push(input.tools.length);
  // Invents a task id on purpose: without tools it must be dropped, not turned into a provider error.
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:input.tools.length?[]:['made-up-task']}),toolCalls:[]};
 }
}
test('listen and companion turns send no tools and need one model call; probe still gets tools',async()=>{
 const p=new Recorder(),f=temporaryRepository(new TestClock('2026-10-21T00:00:00.000Z'));
 try{
  const d=installLearning(createRuntime({...f,provider:p}),{timeoutMs:2000});
  const history:{role:'user'|'assistant';content:string}[]=[];const stages:string[]=[];
  for(const text of ['今天考砸了','数学，好多错题','周末去看了电影','第3题我做错了']){
   history.push({role:'user',content:text});const before=p.tools.length;
   const reply=await d.chat({operationId:crypto.randomUUID(),history:history.slice(-20),flow:'home'});
   history.push({role:'assistant',content:reply.text});stages.push(reply.stage);
   if(reply.stage==='listen'||reply.stage==='companion'){assert.deepEqual(p.tools.slice(before),[0],`${reply.stage}: one call, no tools`);assert.deepEqual(reply.suggestions,[]);}
   else assert.ok(p.tools.slice(before).every(n=>n>0),`${reply.stage} keeps its tools`);
  }
  assert.deepEqual(stages,['listen','listen','companion','probe']);
 }finally{f.dispose();}
});
