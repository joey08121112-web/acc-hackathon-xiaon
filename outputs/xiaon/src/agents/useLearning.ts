import { useCallback,useEffect,useRef,useState } from 'react';
import { apiRequest,serviceStatus,newOperationId } from '../agent-client';
import type { LearningView } from '../../server/agents/learning';
import type { TaskPublicView } from '../../shared/learning-contracts';
export const WORKSPACE_KEY='xiaon-workspace-v2';
const ACTIVATED='xiaon-sqlite-active';
export const isOfflineArtifact=()=>!!document.querySelector('meta[name="xiaon-offline"]')||location.protocol==='file:';
type Cache={reviewLink:{id:string;revision:number}|null;activeTaskId:string|null;drafts:Record<string,string>;chat:{role:'user'|'assistant';content:string}[];pending:{path:string;body:Record<string,unknown>}|null};
const fresh=():Cache=>({reviewLink:null,activeTaskId:null,drafts:{},chat:[],pending:null});
export function useLearning(){
 const [cache,setCache]=useState<Cache>(()=>{try{return {...fresh(),...JSON.parse(localStorage.getItem(WORKSPACE_KEY)||'{}')};}catch{return fresh();}});
 const cacheRef=useRef(cache);cacheRef.current=cache;
 const [view,setView]=useState<LearningView|null>(null),[connected,setConnected]=useState(false),[mode,setMode]=useState('连接本地服务中'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[candidate,setCandidate]=useState<TaskPublicView|null>(null),[candidateMode,setCandidateMode]=useState<'support'|'exploration'|'review'>('support');
 const [activated,setActivated]=useState(()=>!isOfflineArtifact()&&localStorage.getItem(ACTIVATED)==='true');
 const lock=useRef(false),abort=useRef<AbortController|null>(null);
 const update=useCallback((next:Partial<Cache>)=>{setCache(old=>{const value={...old,...next};cacheRef.current=value;localStorage.setItem(WORKSPACE_KEY,JSON.stringify(value));return value;});},[]);
 const reload=useCallback(async()=>{const v=await apiRequest<LearningView>('learning');setView(v);return v;},[]);
 const connect=useCallback(async()=>{if(isOfflineArtifact()){setMode('离线规则版 · 无后台Agent');return;}
  try{const s=await serviceStatus();if(!(s as typeof s&{learning?:boolean}).learning)throw new Error('当前API尚未启用D集成');await reload();setConnected(true);setActivated(true);localStorage.setItem(ACTIVATED,'true');setMode(s.providerKind==='synthetic'?'模拟模型 · 真实工具 / SQLite':s.mode==='model'?'真实模型配置 · 调用结果见轨迹':'本地规则 · 真实工具 / SQLite');setError('');}
  catch(e){setConnected(false);setMode('本地服务未连接 · 原规则离线模式');setError((e as Error).message);}
 },[reload]);
 useEffect(()=>{void connect();return()=>abort.current?.abort();},[connect]);
 async function run<T=unknown>(path:string,body:Record<string,unknown>={},options:{retry?:boolean;persist?:boolean}={}):Promise<T>{
  if(lock.current)throw new Error('请先等待或取消当前操作');lock.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
  const request=options.retry&&cacheRef.current.pending?cacheRef.current.pending:{path,body:path==='import/preview'?body:{operationId:newOperationId(),...body}};
  if(options.persist!==false)update({pending:request});
  try{const result=await apiRequest<T>(request.path,request.body,controller.signal);if(options.persist!==false)update({pending:null});await reload();return result;}
  catch(e){setError(controller.signal.aborted?'已取消等待。已经保存的作答仍在，可用原请求重试核对。':(e as Error).message);try{await reload();}catch{/* keep last view and local draft */}throw e;}
  finally{setBusy(false);lock.current=false;abort.current=null;}
 }
 async function confirmCandidate(){if(!candidate)return;const task=candidate;update({activeTaskId:task.id});setCandidate(null);await run('learning/activate',{taskId:task.id,taskVersion:task.version,mode:candidateMode});}

 function choose(task:TaskPublicView,mode:'support'|'exploration'|'review'='support'){setCandidateMode(mode);setCandidate(task);}
 const activeTask=view?.tasks.find(t=>t.id===cache.activeTaskId)??null;
 const enabled=connected||activated;
 return {view,connected,enabled,mode,error,busy,cache,candidate,activeTask,update,choose,setCandidate,confirmCandidate,run,reload,connect,cancel:()=>abort.current?.abort(),setError,
  retry:()=>cache.pending?run(cache.pending.path,cache.pending.body,{retry:true}):Promise.resolve(),
  async pause(){abort.current?.abort();try{await apiRequest('learning/preference',{operationId:newOperationId(),rest:true,questionInvitePaused:true});await reload();}catch(e){setError((e as Error).message);}},
  async reset(){await run('learning/reset',{confirmation:'清除本机学习记录与偏好'},{persist:false});localStorage.removeItem(WORKSPACE_KEY);localStorage.removeItem(ACTIVATED);setCache(fresh());setView(null);setCandidate(null);setActivated(false);},
 };
}
export type LearningUI=ReturnType<typeof useLearning>;
