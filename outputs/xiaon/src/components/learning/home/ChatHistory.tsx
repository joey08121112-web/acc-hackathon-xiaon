/** 首页往下拉的对话记录：这轮对话的原文只在本机浏览器缓存里；往期对话服务端按隐私口径只存小结，不存原话。 */
import type { LearningUI } from '../../../agents/useLearning';
const date=(s:string)=>new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
export function ChatHistory({l,navigate,excludeSummaryId=null}:{l:LearningUI;navigate:(page:string,tab?:string)=>void;excludeSummaryId?:string|null}){
 const chat=l.cache.chat,summaries=(l.view?.summaries??[]).filter(s=>s.id!==excludeSummaryId);
 if(!chat.length&&!summaries.length)return null;
 return <section className="chat-history">
  <div className="chat-history-head"><span className="eyebrow">LOOKING BACK</span><h2>对话记录</h2></div>
  {chat.length>0&&<div className="chat-history-block">
   <h3>这轮对话<small>原文只保存在这台设备上</small></h3>
   <div className="messages chat-history-messages">
    {chat.map((m,i)=><div className={`message${m.role==='user'?' user':''}`} key={i}>
     {m.role==='assistant'&&<span className="message-label">小N</span>}
     <div>{m.content}</div>
    </div>)}
   </div>
  </div>}
  {summaries.length>0&&<div className="chat-history-block">
   <h3>更早的对话<small>按话题留下的小结</small></h3>
   {[...summaries].reverse().slice(0,5).map(s=><details className="chat-history-item" key={s.id}>
    <summary>{date(s.createdAt)} · {s.topics.join('、')||'聊了聊'}</summary>
    <p className="small muted">下次可以试试</p>
    {s.planSuggestions.map((p,i)=><p key={i}>{p}</p>)}
   </details>)}
   {summaries.length>5&&<button className="text-button" onClick={()=>navigate('growth')}>更早的 {summaries.length-5} 次对话，去成长页看</button>}
  </div>}
 </section>;
}
