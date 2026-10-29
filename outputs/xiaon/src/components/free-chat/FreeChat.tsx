/** 底栏「自由聊」：纯文字聊天，直连 /api/free-chat。没有语音、选择卡或学习流程；对话存在服务器上这个学生自己的库里。 */
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../agent-client';
import { MESSAGE_TEXT_MAX, type FreeChatExchange, type FreeChatHistory, type FreeChatMessage } from '../../../shared/free-chat';
const OPENER = '嗨，我是小N。想聊什么都可以：一道题、一个怪问题，或者一个脑洞。你先说？';
// 第 1 版把对话存在浏览器里；对话改存服务器后清掉这份旧副本。
try { localStorage.removeItem('xiaon-free-chat'); } catch { /* 清不掉也不影响 */ }
export function FreeChat({ active }: { active: boolean }) {
 const [messages, setMessages] = useState<FreeChatMessage[]>([]), [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState(false);
 const [draft, setDraft] = useState(''), [waiting, setWaiting] = useState(false), [error, setError] = useState('');
 // 正在发、或者没发出去的那句话：回复成功前服务器上没有它，先在本地显示，失败了可以原样重发。
 const [pending, setPending] = useState<string | null>(null);
 const end = useRef<HTMLDivElement>(null), busy = useRef(false);
 const load = () => {
  if (busy.current) return;
  apiRequest<FreeChatHistory>('free-chat/history').then(h => { if (!busy.current) { setMessages(h.messages); setLoaded(true); setLoadError(false); } }).catch(() => setLoadError(true));
 };
 // 每次切到这个 Tab 都从服务器取一次，换了标签页或设备聊过的也能接上。
 useEffect(() => { if (active) load(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(() => { if (active) end.current?.scrollIntoView({ block: 'end' }); }, [messages, pending, waiting, active]);
 const send = (raw: string) => {
  const text = raw.trim(); if (!text || busy.current) return;
  busy.current = true; setPending(text); setDraft(''); setError(''); setWaiting(true);
  apiRequest<FreeChatExchange>('free-chat', { text })
   .then(r => { setMessages(m => [...m, r.user, r.reply]); setPending(null); })
   .catch(e => setError((e instanceof Error && e.message) || '这次没收到回复'))
   .finally(() => { busy.current = false; setWaiting(false); });
 };
 const restart = () => {
  if (busy.current) return; busy.current = true;
  apiRequest<FreeChatHistory>('free-chat/new-thread', {}).then(h => { setMessages(h.messages); setPending(null); setError(''); }).catch(() => setError('没能重新开始，请再试一次')).finally(() => { busy.current = false; });
 };
 return <div className="free-chat">
  <div className="free-chat-head"><div><span className="eyebrow">FREE CHAT</span><h1>随便聊聊</h1></div>{(messages.length > 0 || pending) && <button className="text-button" disabled={waiting} onClick={restart}>重新开始</button>}</div>
  <div className="free-chat-list" aria-live="polite">
   <p className="free-bubble assistant">{OPENER}</p>
   {loadError && !loaded && <p className="notice" role="status">之前的对话暂时取不到。<button className="text-button" onClick={load}>再试一次</button></p>}
   {messages.map(m => <p key={m.id} className={'free-bubble ' + m.role}>{m.content}</p>)}
   {pending && <p className="free-bubble user">{pending}</p>}
   {waiting && <p className="free-bubble assistant thinking">小N 在想…</p>}
   {error && <p className="notice" role="status">{error}{pending && <button className="text-button" onClick={() => send(pending)}>再发一次</button>}</p>}
   <div ref={end} />
  </div>
  <div className="talk-dock">
   <form className="talk-bar" onSubmit={e => { e.preventDefault(); send(draft); }}>
    <textarea className="talk-input" aria-label="对小N说" rows={1} value={draft} maxLength={MESSAGE_TEXT_MAX} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="想到什么就说什么…" enterKeyHint="send" />
    <button className="talk-send" disabled={waiting || !draft.trim()}>发送</button>
   </form>
  </div>
 </div>;
}
