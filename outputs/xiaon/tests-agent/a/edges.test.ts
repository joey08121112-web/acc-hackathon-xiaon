import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';
import { SyntheticProvider } from '../../server/providers/synthetic';
import { GlmProvider } from '../../server/providers/glm';
import type { ModelProvider,ModelMessage } from '../../shared/learning-contracts';

function fixture(provider?:ModelProvider){const f=temporaryRepository();return{...createRuntime({...f,provider}),dispose:f.dispose};}

test('refresh cannot create fake sessions; persisted exploration prerequisites, pause and 10-task budget enforced',()=>{
 const r=fixture();try{
  const s=r.events.startSession({operationId:'s',mode:'exploration'});
  assert.equal(r.events.startSession({operationId:'s2',mode:'exploration'}).id,s.id);
  const open=(id:string)=>r.events.expose({operationId:'e-'+id,sessionId:s.id,taskId:id,taskVersion:1,kind:'task',hintId:null});
  assert.throws(()=>open('bracket'),{code:'invalid_state'});
  for(const id of ['understand','logic']){open(id);r.events.submit({operationId:'a-'+id,sessionId:s.id,taskId:id,taskVersion:1,value:'synthetic wrong'});}
  open('bracket');open('transfer');for(let n=0;n<8;n++)open('calc-'+n);
  assert.throws(()=>open('calc-8'),{code:'invalid_state'});
  assert.equal(r.events.startSession({operationId:'s3',mode:'exploration'}).id,s.id);
  r.events.sessionState({operationId:'pause',sessionId:s.id,status:'paused'});
  assert.throws(()=>r.events.submit({operationId:'late',sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'}),{code:'invalid_state'});
  r.events.sessionState({operationId:'resume',sessionId:s.id,status:'active'});assert.throws(()=>open('calc-8'),{code:'invalid_state'});
 }finally{r.dispose();}
});

test('later hints preserve original attempts; consent writes leave evidenceRevision stable',()=>{
 const r=fixture();try{
  const before=r.repository.evidenceRevision();r.events.consent({operationId:'off',optionalMemory:false});assert.equal(r.repository.evidenceRevision(),before);
  const s=r.events.startSession({operationId:'s',mode:'support'});r.events.expose({operationId:'e',sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});
  const a=r.events.submit({operationId:'a',sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'});const snapshot=structuredClone(a);
  r.events.expose({operationId:'late-hint',sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'hint',hintId:'legacy-hint'});
  assert.deepEqual(r.repository.get('attempts',a.id),snapshot);assert.equal(a.hintSnapshot.length,0);
 }finally{r.dispose();}
});

test('revocation stops the run before replaying prior provider context and invalidates reply replay',async()=>{
 let runtime:ReturnType<typeof fixture>;const outbound:ModelMessage[][]=[];
 const provider:ModelProvider={kind:'synthetic',supportsTools:true,async complete(input){outbound.push(structuredClone(input.messages));if(outbound.length===1)return{content:'',toolCalls:[{id:'ctx',name:'get_learning_context',arguments:'{}'}]};if(outbound.length===2){runtime.events.consent({operationId:'revoke',optionalMemory:false});return{content:'',toolCalls:[{id:'ctx2',name:'get_learning_context',arguments:'{}'}]};}return{content:'synthetic done',toolCalls:[]};}};
 runtime=fixture(provider);try{
  runtime.events.consent({operationId:'on',optionalMemory:true});runtime.events.remember({operationId:'memory',text:'MEMORY_SYNTHETIC_SENTINEL',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
  const input={operationId:'chat',history:[{role:'user' as const,content:'合成隐私测试'}]};const reply=await runtime.agent.reply(input);assert.equal(reply.run.status,'cancelled');
  assert.ok(JSON.stringify(outbound[0]).includes('MEMORY_SYNTHETIC_SENTINEL'));assert.equal(outbound.length,2);
  await assert.rejects(()=>runtime.agent.reply(input),{code:'conflict'});
 }finally{runtime.dispose();}
});

test('deleted memory retry cannot resurrect it; expiry and review deadline suppress future requests',async()=>{
 const provider=new SyntheticProvider();const r=fixture(provider);try{
  r.events.consent({operationId:'on',optionalMemory:true});
  const input={operationId:'m',text:'DELETED_SYNTHETIC_SENTINEL',source:'student_explicit' as const,purpose:'tutoring' as const,expiresAt:null,reviewAt:null};const m=r.events.remember(input);r.events.memoryState({operationId:'del',memoryId:m.id,action:'delete'});
  assert.throws(()=>r.events.remember(input),{code:'not_found'});
  r.events.remember({...input,operationId:'due-review',text:'REVIEW_DUE_SENTINEL',reviewAt:'2026-10-20T00:00:00.000Z'});
  await r.agent.run({operationId:'chat',history:[{role:'user',content:'test'}]});
  assert.equal(JSON.stringify(provider.receivedMessages).includes('DELETED_SYNTHETIC_SENTINEL'),false);assert.equal(JSON.stringify(provider.receivedMessages).includes('REVIEW_DUE_SENTINEL'),false);
 }finally{r.dispose();}
});

test('six tool executions are a hard bound even within one parallel-call model response',async()=>{
 const provider:ModelProvider={kind:'synthetic',supportsTools:true,async complete(){return{content:'',toolCalls:Array.from({length:9},(_,i)=>({id:'parallel-'+i,name:'get_learning_context',arguments:'{}'}))};}};
 const r=fixture(provider);try{const run=await r.agent.run({operationId:'budget',history:[{role:'user',content:'test'}]});assert.equal(run.status,'budget_exhausted');assert.equal(run.rounds,1);assert.equal(run.toolExecutions,6);assert.equal(r.repository.list('toolCalls').length,6);}finally{r.dispose();}
});

test('GLM HTTP adapter serializes native protocol and categorizes auth/rate/malformed responses without leaking credentials',async()=>{
 let sent:Record<string,unknown>={};
 const mock:typeof fetch=async(_url,options)=>{sent=JSON.parse(String(options?.body));return new Response(JSON.stringify({choices:[{message:{content:null,tool_calls:[{id:'native-call',type:'function',function:{name:'get_learning_context',arguments:'{}'}}]}}]}),{status:200});};
 const p=new GlmProvider('SYNTHETIC_HTTP_KEY','synthetic-model',mock);const response=await p.complete({messages:[{role:'tool',content:'{}',toolCallId:'prior'}],tools:[],signal:new AbortController().signal});
 assert.equal(response.toolCalls[0].id,'native-call');assert.equal((sent.messages as {tool_call_id:string}[])[0].tool_call_id,'prior');assert.equal(sent.tool_choice,'auto');
 for(const status of [401,403,429,500]){
  const p=new GlmProvider('SYNTHETIC_HTTP_KEY','synthetic',async()=>new Response('Authorization SYNTHETIC_HTTP_KEY raw body',{status}));
  await assert.rejects(()=>p.complete({messages:[],tools:[],signal:new AbortController().signal}),e=>{assert.equal(String(e).includes('SYNTHETIC_HTTP_KEY'),false);return (e as {code:string}).code===(status===401||status===403?'provider_auth':status===429?'provider_rate_limit':'provider_error');});
 }
 const malformed=new GlmProvider('SYNTHETIC_HTTP_KEY','synthetic',async()=>new Response('{"choices":[]}'));
 await assert.rejects(()=>malformed.complete({messages:[],tools:[],signal:new AbortController().signal}),{code:'provider_error'});
});
