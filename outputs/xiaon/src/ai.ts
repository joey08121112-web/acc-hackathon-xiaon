import { chat,newOperationId,serviceStatus } from './agent-client';
export type AiMessage = { role: 'user' | 'assistant'; content: string };
// Preserve App's sync check and its existing rest/pause-aware local rules fallback.
// Availability is learned from the local API, never from a browser credential.
let modelReady=false;
if(typeof location!=='undefined'&&/^https?:$/.test(location.protocol)&&!document.querySelector('meta[name="xiaon-offline"]'))void serviceStatus(AbortSignal.timeout(2000)).then(status=>{modelReady=status.mode==='model';}).catch(()=>{modelReady=false;});
export function aiConfigured():boolean{return modelReady;}
export async function chatWithAI(history:AiMessage[],signal?:AbortSignal):Promise<string>{
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{
  const reply=await chat({operationId:newOperationId(),history:history.slice(-20)},controller.signal);
  if(reply.mode==='local_rules')return '本地规则模式：模型服务当前不可用。我们可以继续用本地题目慢慢看，也可以先聊聊或休息。';
  return reply.text;
 }finally{signal?.removeEventListener('abort',abort);}
}
