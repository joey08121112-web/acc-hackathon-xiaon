/** 首页往下拉的对话记录：这轮对话实时显示（浏览器缓存）；往期对话从本地服务的 chatLog 回放完整原文。
 * chatLog 是学习记录：每轮两条（学生 + 小N），重置演示时清除；安全轮在服务端入口被拦截，永不落库。
 * chatLog 上线前的旧库只有小结、没有原文——这些老场次照旧按小结展示，不虚构原文。 */
import { useState } from 'react';
import type { LearningUI } from '../../../agents/useLearning';
import type { ChatLog, ConversationSummary } from '../../../../shared/learning-contracts';
const date=(s:string)=>new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
/** 按场次分组（chatLog 追加有序），最新一场在前；当前正在聊的场次不算“更早”。 */
const groupReplays=(log:ChatLog[],currentSessionId:string|null):{sessionId:string;messages:ChatLog[]}[]=>{
 const by=new Map<string,ChatLog[]>();
 for(const m of log){
  if(m.sessionId===currentSessionId)continue;
  const list=by.get(m.sessionId)??[];if(!list.length)by.set(m.sessionId,list);list.push(m);
 }
 return [...by.entries()].map(([sessionId,messages])=>({sessionId,messages}))
  .sort((a,b)=>Date.parse(b.messages[0].at)-Date.parse(a.messages[0].at));
};
export function ChatHistory({l,currentSessionId=null,excludeSummaryId=null,includeCurrent=true,onlyWithoutSummary=false}:{l:LearningUI;navigate:(page:string,tab?:string)=>void;currentSessionId?:string|null;excludeSummaryId?:string|null;includeCurrent?:boolean;onlyWithoutSummary?:boolean}){
 const [visible,setVisible]=useState(8);
 const chat=includeCurrent?l.cache.chat:[];
 const summaries=(l.view?.summaries??[]).filter(s=>s.id!==excludeSummaryId);
 const replays=groupReplays(l.view?.chatLog??[],currentSessionId).filter(r=>!onlyWithoutSummary||!summaries.some(s=>s.sessionId===r.sessionId));
 // 只有小结、没有原文回放的旧场次：和回放场次合成一张按时间排的列表，不丢入口。
 const summaryOnly=onlyWithoutSummary?[]:summaries.filter(s=>!replays.some(r=>r.sessionId===s.sessionId));
 if(!chat.length&&!replays.length&&!summaryOnly.length)return null;
 const replayNode=(r:{sessionId:string;messages:ChatLog[]})=>{
  const summary=summaries.find(s=>s.sessionId===r.sessionId)??null;
  return <details className="chat-history-item" key={r.sessionId}>
   <summary>{date(r.messages[0].at)} · {summary?.topics.join('、')||'聊了聊'}</summary>
   <div className="messages chat-history-messages">
    {r.messages.map(m=><div className={`message${m.role==='user'?' user':''}`} key={m.id}>
     {m.role==='assistant'&&<span className="message-label">小N</span>}
     <div>{m.content}</div>
    </div>)}
   </div>
   {summary&&<><p className="small muted">下次可以试试</p>{summary.planSuggestions.map((p,i)=><p key={i}>{p}</p>)}</>}
  </details>;
 };
 const summaryNode=(s:ConversationSummary)=>(
  <details className="chat-history-item" key={s.id}>
   <summary>{date(s.createdAt)} · {s.topics.join('、')||'聊了聊'}</summary>
   <p className="small muted">那次只留下了小结，没有对话原文</p>
   <p className="small muted">下次可以试试</p>
   {s.planSuggestions.map((p,i)=><p key={i}>{p}</p>)}
  </details>
 );
 return <section className="chat-history">
  <div className="chat-history-head"><span className="eyebrow">LOOKING BACK</span><h2>对话记录</h2></div>
  {chat.length>0&&<div className="chat-history-block">
   <h3>这轮对话<small>还在聊的这轮</small></h3>
   <div className="messages chat-history-messages">
    {chat.map((m,i)=><div className={`message${m.role==='user'?' user':''}`} key={i}>
     {m.role==='assistant'&&<span className="message-label">小N</span>}
     <div>{m.content}</div>
    </div>)}
   </div>
  </div>}
  {(replays.length>0||summaryOnly.length>0)&&<div className="chat-history-block">
   <h3>更早的对话<small>点开看当时聊了什么</small></h3>
   {[
    ...replays.map(r=>({at:Date.parse(r.messages[0].at),node:replayNode(r)})),
    ...summaryOnly.map(s=>({at:Date.parse(s.createdAt),node:summaryNode(s)})),
   ].sort((a,b)=>b.at-a.at).slice(0,visible).map(e=>e.node)}
   {replays.length+summaryOnly.length>visible&&<button className="text-button" onClick={()=>setVisible(n=>n+8)}>再看更早的对话</button>}
  </div>}
 </section>;
}
