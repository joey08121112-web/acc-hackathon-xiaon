import { SCHEMA_VERSION,type ChatRequest,type AgentReply,type SubmitAttempt,type TaskPublicView } from '../../shared/learning-contracts';
import { isLegacyHomePath,LEGACY_HOME_DISABLED_MESSAGE } from '../../shared/legacy-home';
import { ApiError,fetchBlob,fetchJson } from './http';
/** Same origin only; credentials never live in VITE_ variables or browser storage. */
let csrfToken='';let opening:Promise<void>|undefined;
export async function localSession(signal?:AbortSignal){
 if(csrfToken)return;if(opening)return opening;
 opening=(async()=>{
  const data=await fetchJson<{schemaVersion:string;csrfToken:string}>('/api/local-session',{method:'POST',body:{},signal,fallbackMessage:'本地API会话不可用'});
  if(data.schemaVersion!==SCHEMA_VERSION)throw new Error('API契约版本不一致');
  csrfToken=data.csrfToken;
 })();
 try{await opening;}finally{opening=undefined;}
}
export async function apiRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 if(isLegacyHomePath(path))throw new Error(LEGACY_HOME_DISABLED_MESSAGE);
 await localSession(signal);
 const go=()=>fetchJson<T>('/api/'+path,{method:body===undefined?'GET':'POST',body,signal,headers:body===undefined?{}:{'X-Xiaon-CSRF':csrfToken}});
 try{return await go();}
 catch(e){
  // 403 多半是本地会话的 CSRF 令牌过期：重开一次会话再重试。
  // 只重试一次 —— 真的是「没权限」的话，第二次会照旧失败。
  if(!(e instanceof ApiError)||e.status!==403)throw e;
  csrfToken='';await localSession(signal);
  return go();
 }
}
/** POST JSON, receive binary (speech audio). Same session/CSRF handling as apiRequest. */
export async function apiBlob(path:string,body:unknown,signal?:AbortSignal):Promise<Blob>{
 await localSession(signal);
 const go=()=>fetchBlob('/api/'+path,{method:'POST',body,signal,headers:{'X-Xiaon-CSRF':csrfToken},fallbackMessage:'语音服务暂时不可用'});
 try{return await go();}
 catch(e){
  if(!(e instanceof ApiError)||e.status!==403)throw e;
  csrfToken='';await localSession(signal);
  return go();
 }
}
export const chat=(input:ChatRequest,signal?:AbortSignal)=>apiRequest<AgentReply>('chat',input,signal);
export const submitAttempt=(input:SubmitAttempt,signal?:AbortSignal)=>apiRequest<import('../../shared/learning-contracts').Attempt>('attempts',input,signal);
export const publicTask=(taskId:string,taskVersion:number,signal?:AbortSignal)=>apiRequest<TaskPublicView>(`tasks/${encodeURIComponent(taskId)}/${taskVersion}`,undefined,signal);
/** 本地可用的唯一 id。
 *
 *  2026-11-21 实测（Playwright 红/绿对照）：`crypto.randomUUID` 只在**安全上下文**里存在。
 *  局域网用 `http://192.168.x.x:5173` 打开时它不在 → `newOperationId()` 抛 TypeError
 *  → 首次引导的第一次写请求根本没发出去 → 页面停在引导页并提示「这次没有保存好，请连接后再试」，
 *  **整个应用进不去**。localhost 与 https 不受影响。
 *  所以凡是生成 id 的地方都必须有兜底，不是可选项。 */
export const localId=()=>
  globalThis.crypto?.randomUUID?.() ??
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const newOperationId=()=>localId();
export async function serviceStatus(signal?:AbortSignal):Promise<{mode:'model'|'local_rules';providerKind:'real_http'|'synthetic'|'offline';disclosure:string}>{
 return fetchJson('/api/health',{signal,fallbackMessage:'本地服务未连接'});
}
