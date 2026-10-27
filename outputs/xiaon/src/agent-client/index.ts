import { SCHEMA_VERSION,type ChatRequest,type AgentReply,type SubmitAttempt,type TaskPublicView } from '../../shared/learning-contracts';
/** Same origin only; credentials never live in VITE_ variables or browser storage. */
let csrfToken='';let opening:Promise<void>|undefined;
export async function localSession(signal?:AbortSignal){
 if(csrfToken)return;if(opening)return opening;
 opening=(async()=>{const res=await fetch('/api/local-session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',signal});if(!res.ok){const e=await res.json().catch(()=>null);throw new Error(e?.error?.message??'本地API会话不可用');}const data=await res.json();if(data.schemaVersion!==SCHEMA_VERSION)throw new Error('API契约版本不一致');csrfToken=data.csrfToken;})();
 try{await opening;}finally{opening=undefined;}
}
export async function apiRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 await localSession(signal);const res=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Xiaon-CSRF':csrfToken},...(body===undefined?{}:{body:JSON.stringify(body)}),signal});
 if(!res.ok){if(res.status===403){csrfToken='';await localSession(signal);const retry=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Xiaon-CSRF':csrfToken},...(body===undefined?{}:{body:JSON.stringify(body)}),signal});if(retry.ok)return retry.json() as Promise<T>;const error=await retry.json();throw new Error(error.error?.message??`本地 API ${retry.status}`);}const error=await res.json();throw new Error(error.error?.message??`本地 API ${res.status}`);}return res.json() as Promise<T>;
}
/** POST JSON, receive binary (speech audio). Same session/CSRF handling as apiRequest. */
export async function apiBlob(path:string,body:unknown,signal?:AbortSignal):Promise<Blob>{
 await localSession(signal);
 const go=()=>fetch('/api/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Xiaon-CSRF':csrfToken},body:JSON.stringify(body),signal});
 let res=await go();
 if(res.status===403){csrfToken='';await localSession(signal);res=await go();}
 if(!res.ok)throw new Error('语音服务暂时不可用');
 return res.blob();
}
export const chat=(input:ChatRequest,signal?:AbortSignal)=>apiRequest<AgentReply>('chat',input,signal);
export const submitAttempt=(input:SubmitAttempt,signal?:AbortSignal)=>apiRequest<import('../../shared/learning-contracts').Attempt>('attempts',input,signal);
export const publicTask=(taskId:string,taskVersion:number,signal?:AbortSignal)=>apiRequest<TaskPublicView>(`tasks/${encodeURIComponent(taskId)}/${taskVersion}`,undefined,signal);
export const newOperationId=()=>crypto.randomUUID();
export async function serviceStatus(signal?:AbortSignal):Promise<{mode:'model'|'local_rules';providerKind:'real_http'|'synthetic'|'offline';disclosure:string}>{
 const res=await fetch('/api/health',{signal});if(!res.ok)throw new Error('本地服务未连接');return res.json();
}
