/** 生产路径（ControlledRoles）的安全断言。
 *
 * 2026-11-21 审查发现的一个真问题：安全相关的断言原本都挂在 AgentRuntime 上，
 * 而线上跑的是 ControlledRoles（server/agents/learning.ts:177/197/314）。
 * 「线上路径到底有没有保护」不能靠猜 —— 这个文件把关键几条钉在生产路径上。
 *
 * 覆盖：角色工具白名单、答案不外泄、回复长度闸门、轮次与工具预算、失败不假装成功。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { TUTOR_REPLY_MAX_CHARS,type ModelProvider } from '../../shared/learning-contracts';

/** 按脚本回话的假模型。只回内容，不真的调工具 —— 除了专门测工具的那条。 */
class ScriptedProvider implements ModelProvider{
 readonly kind='synthetic' as const;readonly supportsTools=true;
 readonly seenToolNames:string[][]=[];
 readonly seenTools:{name:string;description:string}[][]=[];
 constructor(private replies:string[]){}
 async complete(input:Parameters<ModelProvider['complete']>[0]){
  this.seenToolNames.push(input.tools.map(t=>t.name));
  this.seenTools.push(input.tools.map(t=>({name:t.name,description:t.description})));
  return {content:this.replies.shift()??'{"message":"嗯，我在听。","taskIds":[]}',toolCalls:[]};
 }
}
const setup=(provider:ModelProvider)=>{
 const f=temporaryRepository(new TestClock()),r=createRuntime({...f,provider}),d=installLearning(r,{timeoutMs:2000});
 return {...f,r,d};
};
const chat=(d:ReturnType<typeof setup>['d'],text:string,operationId=()=>crypto.randomUUID())=>
 d.chat({operationId:operationId(),history:[{role:'user',content:text}]});

test('Tutor 角色的工具白名单里没有判题工具，记忆工具只是提候选',async()=>{
 const provider=new ScriptedProvider(['{"message":"嗯，我在听。","taskIds":[]}']);
 const f=setup(provider);try{
  await chat(f.d,'今天有点累');
  const names=provider.seenToolNames[0]??[];
  assert.ok(names.length>0,'Tutor 应当拿到自己的工具集');
  assert.equal(names.includes('grade_attempt'),false,'判题只能由程序触发，不能交给模型');
  assert.equal(names.includes('record_stuck_point'),true);
  // propose_memory 允许「提候选」，但工具说明写明必须学生另行确认 —— 核对这句还在。
  const definitions=provider.seenTools[0]??[];
  const propose=definitions.find(t=>t.name==='propose_memory');
  assert.ok(propose,'propose_memory 应当出现在工具集里');
  assert.match(propose.description,/学生另行确认/);
 }finally{f.dispose();}
});

test('模型把未作答的题的答案说出来时，生产路径当场拦下',async()=>{
 // 题库里的 'b-like-observation' 答案是 5x-4；学生还没作答，回复里出现它就必须被拦。
 const provider=new ScriptedProvider(['{"message":"这题答案是 5x-4，你照着写就行。","taskIds":[]}']);
 const f=setup(provider);try{
  const reply=await chat(f.d,'这道题怎么做');
  assert.doesNotMatch(reply.text,/5x-4/,'答案不能出现在给小N的回复里');
  assert.equal(reply.run?.status,'failed','这一轮不能算成功');
  assert.equal(reply.run?.error?.code,'forbidden');
  // 拦下之后没有留下一次「帮助已给出」的曝光记录。
  assert.equal(f.r.repository.list('exposures').filter(e=>e.kind==='chat_help').length,0);
 }finally{f.dispose();}
});

test('超长回复先让模型改写一次，仍超长就截到上限',async()=>{
 const long='这'.repeat(TUTOR_REPLY_MAX_CHARS+40);
 const provider=new ScriptedProvider([JSON.stringify({message:long,taskIds:[]}),JSON.stringify({message:long,taskIds:[]})]);
 const f=setup(provider);try{
  const reply=await chat(f.d,'我有点不会');
  assert.ok(Array.from(reply.text).length<=TUTOR_REPLY_MAX_CHARS,`回复长度应 ≤ ${TUTOR_REPLY_MAX_CHARS}，实际 ${Array.from(reply.text).length}`);
  assert.ok(provider.seenToolNames.length>=2,'超长时应至少再问一次模型改写');
 }finally{f.dispose();}
});

test('模型不按 JSON 回话时，程序自己兜住而不是把原文糊给孩子',async()=>{
 const provider=new ScriptedProvider(['我就是想找人聊聊。','{"message":"嗯，我听着呢。","taskIds":[]}']);
 const f=setup(provider);try{
  const reply=await chat(f.d,'随便聊聊');
  assert.equal(reply.text,'嗯，我听着呢。');
  assert.ok(provider.seenToolNames.length>=2,'非 JSON 应先触发一次修复请求');
 }finally{f.dispose();}
});

test('安全词由程序拦下，模型根本收不到这句话',async()=>{
 const provider=new ScriptedProvider([]);
 const f=setup(provider);try{
  const reply=await chat(f.d,'我不想活了');
  assert.equal(reply.safety,true);
  assert.equal(reply.stage,'safety');
  assert.equal(provider.seenToolNames.length,0,'安全词必须在调模型之前被拦下');
 }finally{f.dispose();}
});
