import type { ModelProvider } from '../../shared/learning-contracts';
/** 模型偶尔一卡几十秒，而同样的请求重发常常几秒就回。超过 hedgeMs 还没回，就再发一次同样的请求，
 * 用先成功的那个、取消另一个。最多两路；第一路在重发前就出错时直接报错，不拿重发掩盖真实失败。hedgeMs<=0 关闭。 */
export class HedgedProvider implements ModelProvider {
 constructor(private inner:ModelProvider,private hedgeMs:number){}
 get kind(){return this.inner.kind;}
 get supportsTools(){return this.inner.supportsTools;}
 complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  if(this.hedgeMs<=0)return this.inner.complete(input);
  return new Promise((resolve,reject)=>{
   if(input.signal.aborted){reject(input.signal.reason);return;}
   const lanes:AbortController[]=[];let settled=false,running=0,firstError:unknown,timer:ReturnType<typeof setTimeout>|undefined;
   const finish=(done:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);input.signal.removeEventListener('abort',onAbort);lanes.forEach(c=>c.abort());done();};
   const onAbort=()=>finish(()=>reject(input.signal.reason));
   const launch=()=>{
    const lane=new AbortController();lanes.push(lane);running++;
    this.inner.complete({...input,signal:AbortSignal.any([input.signal,lane.signal])}).then(
     out=>finish(()=>resolve(out)),
     error=>{running--;firstError??=error;if(running===0)finish(()=>reject(firstError));});
   };
   input.signal.addEventListener('abort',onAbort,{once:true});
   launch();
   timer=setTimeout(()=>{if(!settled)launch();},this.hedgeMs);
  });
 }
}
