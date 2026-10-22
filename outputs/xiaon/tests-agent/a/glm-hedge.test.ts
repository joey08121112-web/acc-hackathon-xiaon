/** 模型卡住时自动重发一次：超过 hedgeMs 才发第二路，先成功的赢、另一路被取消；第一路先出错就直接报错；外部取消照常生效。合成 provider。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HedgedProvider } from '../../server/providers/hedge';
import { readGlmConfig } from '../../server/providers/config';
import type { ModelProvider } from '../../shared/learning-contracts';
type Lane={ms:number;fail?:boolean;content:string};
class Scripted implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;calls=0;aborted=0;
 constructor(private lanes:Lane[]){}
 complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const lane=this.lanes[this.calls++]??this.lanes.at(-1)!;
  return new Promise((resolve,reject)=>{
   let done=false;
   const t=setTimeout(()=>{done=true;if(lane.fail)reject(new Error('provider_error '+lane.content));else resolve({content:lane.content,toolCalls:[]});},lane.ms);
   input.signal.addEventListener('abort',()=>{if(done)return;done=true;clearTimeout(t);this.aborted++;reject(input.signal.reason);},{once:true});
  });
 }
}
const ask=(p:ModelProvider,signal=new AbortController().signal)=>p.complete({messages:[{role:'user',content:'合成'}],tools:[],signal});

test('a reply before the hedge time is used as is, with one request',async()=>{
 const inner=new Scripted([{ms:5,content:'first'}]);
 assert.equal((await ask(new HedgedProvider(inner,40))).content,'first');assert.equal(inner.calls,1);
});
test('a stalled request is sent once more; the quicker answer wins and the slow one is cancelled',async()=>{
 const inner=new Scripted([{ms:400,content:'slow'},{ms:10,content:'resent'}]);
 const t=Date.now();const out=await ask(new HedgedProvider(inner,30));
 assert.equal(out.content,'resent');assert.equal(inner.calls,2);assert.equal(inner.aborted,1);assert.ok(Date.now()-t<300);
});
test('the first request still wins if it answers before the resent one',async()=>{
 const inner=new Scripted([{ms:50,content:'first'},{ms:400,content:'resent'}]);
 assert.equal((await ask(new HedgedProvider(inner,30))).content,'first');assert.equal(inner.calls,2);
});
test('an error before the hedge time is reported, not hidden by a resend',async()=>{
 const inner=new Scripted([{ms:5,fail:true,content:'a'},{ms:5,content:'never'}]);
 await assert.rejects(ask(new HedgedProvider(inner,40)),/provider_error a/);
 await new Promise(r=>setTimeout(r,60));assert.equal(inner.calls,1);
});
test('if one lane fails after the resend, the other lane can still answer; both failing reports the first error',async()=>{
 assert.equal((await ask(new HedgedProvider(new Scripted([{ms:60,fail:true,content:'a'},{ms:80,content:'ok'}]),30))).content,'ok');
 await assert.rejects(ask(new HedgedProvider(new Scripted([{ms:60,fail:true,content:'a'},{ms:70,fail:true,content:'b'}]),30)),/provider_error a/);
});
test('cancelling from outside stops both lanes; 0 turns hedging off',async()=>{
 const inner=new Scripted([{ms:400,content:'slow'},{ms:400,content:'slow'}]);const c=new AbortController();
 const pending=ask(new HedgedProvider(inner,20),c.signal);setTimeout(()=>c.abort(new Error('cancelled by student')),50);
 await assert.rejects(pending,/cancelled by student/);assert.equal(inner.calls,2);assert.equal(inner.aborted,2);
 const off=new Scripted([{ms:80,content:'only'}]);assert.equal((await ask(new HedgedProvider(off,0))).content,'only');assert.equal(off.calls,1);
});
test('XIAON_GLM_HEDGE_MS: default 20s, 0 allowed, invalid rejected',()=>{
 assert.equal(readGlmConfig({}).hedgeMs,20000);assert.equal(readGlmConfig({XIAON_GLM_HEDGE_MS:'0'}).hedgeMs,0);
 for(const v of ['-1','1.5','abc','700000'])assert.throws(()=>readGlmConfig({XIAON_GLM_HEDGE_MS:v}));
});
