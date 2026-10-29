/** 底栏「自由聊」：纯文字聊天，直连 /api/free-chat。没有语音、选择卡或学习流程；对话存在服务器上这个学生自己的库里。 */
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../agent-client';
import { MESSAGE_TEXT_MAX, type Digest, type DigestResponse, type FreeChatExchange, type FreeChatHistory, type FreeChatMessage } from '../../../shared/free-chat';
const OPENER = '嗨，我是小N。想聊什么都可以：一道题、一个怪问题，或者一个脑洞。你先说？';
// 第 1 版把对话存在浏览器里；对话改存服务器后清掉这份旧副本。
try { localStorage.removeItem('xiaon-free-chat'); } catch { /* 清不掉也不影响 */ }
export function FreeChat({ active }: { active: boolean }) {
 const [messages, setMessages] = useState<FreeChatMessage[]>([]), [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState(false);
 const [draft, setDraft] = useState(''), [waiting, setWaiting] = useState(false), [error, setError] = useState('');
 // 正在发、或者没发出去的那句话：回复成功前服务器上没有它，先在本地显示，失败了可以原样重发。
 const [pending, setPending] = useState<string | null>(null);
 const end = useRef<HTMLDivElement>(null), busy = useRef(false);
 // 上次聊完后小N 整理记下的东西：说一声，并且每条都能马上删掉。
 const [digest, setDigest] = useState<Digest | null>(null), poll = useRef<ReturnType<typeof setTimeout> | null>(null);
 const loadDigest = (tries = 0) => {
  if (poll.current) clearTimeout(poll.current);
  apiRequest<DigestResponse>('free-chat/digest').then(r => {
   setDigest(r.digest);
   // 刚打开时整理才开始跑：隔几秒再看一次，最多等两分钟。
   if (r.consolidating && tries < 24) poll.current = setTimeout(() => loadDigest(tries + 1), 5000);
  }).catch(() => { /* 没有整理结果也照常聊 */ });
 };
 useEffect(() => () => { if (poll.current) clearTimeout(poll.current); }, []);
 const seen = () => { if (!digest) return; const runId = digest.runId; setDigest(null); apiRequest('free-chat/digest/seen', { runId }).catch(() => {}); };
 const forget = (itemId: string) => {
  if (!digest) return;
  const rest = digest.changes.filter(c => c.itemId !== itemId);
  setDigest(rest.length ? { ...digest, changes: rest } : null);
  if (!rest.length) apiRequest('free-chat/digest/seen', { runId: digest.runId }).catch(() => {});
  apiRequest('free-chat/profile/item', { action: 'delete', id: itemId }).catch(() => {});
 };
 const load = () => {
  if (busy.current) return;
  apiRequest<FreeChatHistory>('free-chat/history').then(h => { if (!busy.current) { setMessages(h.messages); setLoaded(true); setLoadError(false); } }).catch(() => setLoadError(true));
 };
 // 每次切到这个 Tab 都从服务器取一次，换了标签页或设备聊过的也能接上。
 useEffect(() => { if (active) { load(); loadDigest(); } }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
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
   {digest && <div className="free-digest" role="status">
    <p>我把上次聊的整理了一下：</p>
    <ul>{digest.changes.map(c => <li key={c.itemId}><span>{c.op === 'update' ? '更新了' : '记住了'}「{c.text}」</span><button className="text-button" onClick={() => forget(c.itemId)}>不对，删掉</button></li>)}</ul>
    <p className="small muted">在「成长 · 我的档案」里随时可以改。<button className="text-button" onClick={seen}>知道了</button></p>
   </div>}
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
