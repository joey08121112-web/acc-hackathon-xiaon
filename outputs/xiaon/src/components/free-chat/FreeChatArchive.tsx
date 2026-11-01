/** 历史线程只读回放，不会把正在聊的会话切走。 */
import { useState } from 'react';
import { apiRequest } from '../../agent-client';
import type { FreeChatPage, FreeChatThread } from '../../../shared/free-chat';
const date=(s:string)=>new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
function ThreadReplay({thread}:{thread:FreeChatThread}){
 const [page,setPage]=useState<FreeChatPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const load=(earlier=false)=>{
  if(loading)return;setLoading(true);setError('');
  const query=new URLSearchParams({threadId:thread.threadId});if(earlier&&page?.before)query.set('before',page.before);
  apiRequest<FreeChatPage>('free-chat/messages?'+query).then(next=>setPage(old=>earlier&&old?{...next,messages:[...next.messages,...old.messages]}:next))
   .catch(()=>setError('这段对话暂时取不到，请再试一次')).finally(()=>setLoading(false));
 };
 return <details className="chat-history-item" onToggle={e=>{if(e.currentTarget.open&&!page&&!loading)load();}}>
  <summary>{date(thread.startedAt)} · {thread.preview.slice(0,36)}</summary>
  {error&&<p role="status">{error}<button className="text-button" onClick={()=>load()}>重试</button></p>}
  {page?.hasMore&&<button className="text-button" disabled={loading} onClick={()=>load(true)}>再看这一段更早的消息</button>}
  {loading&&<p role="status">正在翻开对话…</p>}
  <div className="free-chat-list">{page?.messages.map(m=><p className={'free-bubble '+m.role} key={m.id}>{m.content}</p>)}</div>
 </details>;
}
export function FreeChatArchive({threads,currentThreadId}:{threads:FreeChatThread[];currentThreadId:string|null}){
 const [visible,setVisible]=useState(8),older=threads.filter(t=>t.threadId!==currentThreadId);
 if(!older.length)return null;
 return <section className="chat-history" aria-label="以前的聊天">
  <div className="chat-history-head"><span className="eyebrow">LOOKING BACK</span><h2>以前的聊天</h2></div>
  {older.slice(0,visible).map(t=><ThreadReplay key={t.threadId} thread={t}/>)}
  {older.length>visible&&<button className="text-button" onClick={()=>setVisible(n=>n+8)}>再看更早的聊天</button>}
 </section>;
}
