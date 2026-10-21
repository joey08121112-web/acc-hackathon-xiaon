import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGlmConfig } from '../../server/providers/config';
import { GlmProvider } from '../../server/providers/glm';
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';

test('05 config defaults personal Coding Plan GLM Flash, one server-side variable namespace, and validates budgets',()=>{
 const defaults=readGlmConfig({});assert.equal(defaults.model,'glm-5.3-flash');assert.equal(defaults.baseUrl,'https://open.bigmodel.cn/api/coding/paas/v4');assert.equal(defaults.apiKey,'');assert.ok(defaults.timeoutMs>20000);assert.ok(defaults.maxTokens>800);
 const custom=readGlmConfig({XIAON_GLM_API_KEY:'SYNTHETIC_KEY',XIAON_GLM_MODEL:'future-model',XIAON_GLM_BASE_URL:'https://official.example.test/v5/',XIAON_GLM_TIMEOUT_MS:'45000',XIAON_GLM_MAX_TOKENS:'4096'});
 assert.equal(custom.model,'future-model');assert.equal(custom.baseUrl,'https://official.example.test/v5');assert.equal(custom.timeoutMs,45000);assert.equal(custom.maxTokens,4096);
 for(const env of [{XIAON_GLM_TIMEOUT_MS:'0'},{XIAON_GLM_MAX_TOKENS:'NaN'},{XIAON_GLM_BASE_URL:'http://unsafe.invalid'},{XIAON_GLM_BASE_URL:'https://user:secret@unsafe.invalid'}])assert.throws(()=>readGlmConfig(env),{code:'invalid_params'});
});

test('GLM configured endpoint/token budget and native thinking fields roundtrip without leaking private thought',async()=>{
 let calls=0;let sent:Record<string,unknown>={};let target='';
 const provider=new GlmProvider('SYNTHETIC_KEY','glm-5.3-flash',async(url,options)=>{
  target=String(url);sent=JSON.parse(String(options?.body));calls++;
  return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message:calls===1?{content:null,reasoning_content:'SYNTHETIC_PRIVATE_THOUGHT',tool_calls:[{id:'native-thinking-call',type:'function',function:{name:'get_learning_context',arguments:'{}'}}]}:{content:'合成回复',reasoning_content:'SYNTHETIC_FINAL_THOUGHT'}}]}));
 },{baseUrl:'https://official.example.test/v5',maxTokens:4096,timeoutMs:45000});
 const signal=new AbortController().signal;const first=await provider.complete({messages:[{role:'user',content:'合成测试'}],tools:[],signal});assert.equal(JSON.stringify(first).includes('SYNTHETIC_PRIVATE_THOUGHT'),false);
 const second=await provider.complete({messages:[{role:'assistant',content:'',toolCalls:first.toolCalls},{role:'tool',toolCallId:first.toolCalls[0].id,content:'{}'}],tools:[],signal});
 assert.equal(target,'https://official.example.test/v5/chat/completions');assert.equal(sent.max_tokens,4096);assert.equal((sent.messages as {reasoning_content?:string}[])[0].reasoning_content,'SYNTHETIC_PRIVATE_THOUGHT');assert.equal(JSON.stringify(second).includes('THOUGHT'),false);assert.notEqual((sent.thinking as {type?:string}|undefined)?.type,'disabled');
});

test('truncation refuses tool execution; configured provider timeout reports timeout',async()=>{
 const f=temporaryRepository();const provider=new GlmProvider('SYNTHETIC_KEY','glm-5.3-flash',async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'partial',tool_calls:[{id:'partial',type:'function',function:{name:'query_learning_evidence',arguments:'{}'}}]}}]})));
 const r=createRuntime({...f,provider});try{const run=await r.agent.run({operationId:'truncated',history:[{role:'user',content:'synthetic'}]});assert.equal(run.status,'failed');assert.equal(run.error?.code,'provider_error');assert.equal(run.toolExecutions,0);assert.equal(f.repository.list('gradings').length,0);}finally{f.dispose();}
 const timeout=new GlmProvider('SYNTHETIC_KEY','glm-5.3-flash',async(_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(options.signal?.reason),{once:true})),{timeoutMs:10});
 await assert.rejects(()=>timeout.complete({messages:[],tools:[],signal:new AbortController().signal}),{code:'timeout'});
});

test('configured whole-run timeout reaches runtime without browser timeout overriding it',async()=>{
 const f=temporaryRepository();const config=readGlmConfig({XIAON_GLM_TIMEOUT_MS:'10'});
 const r=createRuntime({...f,modelTimeoutMs:config.timeoutMs,provider:{kind:'synthetic',supportsTools:true,async complete({signal}){return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}});
 try{const run=await r.agent.run({operationId:'configured-runtime-timeout',history:[{role:'user',content:'synthetic'}]});assert.equal(run.status,'timeout');}finally{f.dispose();}
});


test('default Coding Plan provider sends the complete chat endpoint while an explicit base still overrides it',async()=>{
 const targets:string[]=[];const mock:typeof fetch=async(url)=>{targets.push(String(url));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'合成回复'}}]}));};
 const defaults=new GlmProvider('SYNTHETIC_KEY',undefined,mock);
 await defaults.complete({messages:[],tools:[],signal:new AbortController().signal});
 assert.equal(targets[0],'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions');
 const config=readGlmConfig({XIAON_GLM_BASE_URL:'https://open.bigmodel.cn/api/paas/v4'});
 const standard=new GlmProvider('SYNTHETIC_KEY',config.model,mock,config);
 await standard.complete({messages:[],tools:[],signal:new AbortController().signal});
 assert.equal(targets[1],'https://open.bigmodel.cn/api/paas/v4/chat/completions');
});
