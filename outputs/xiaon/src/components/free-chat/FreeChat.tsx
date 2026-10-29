/** 底栏「自由聊」：纯文字聊天，直连 /api/free-chat。没有语音、选择卡或学习流程；对话只存在这个浏览器里。 */
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../agent-client';
type Message = { role: 'user' | 'assistant'; content: string };
const STORE_KEY = 'xiaon-free-chat';
const OPENER = '嗨，我是小N。想聊什么都可以：一道题、一个怪问题，或者一个脑洞。你先说？';
const load = (): Message[] => { try { const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; } };
const save = (messages: Message[]) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-60))); } catch { /* 只是本机便利，存不下也照常聊 */ } };
export function FreeChat({ active }: { active: boolean }) {
 const [messages, setMessages] = useState<Message[]>(load), [draft, setDraft] = useState(''), [waiting, setWaiting] = useState(false), [error, setError] = useState('');
 const end = useRef<HTMLDivElement>(null);
 useEffect(() => { if (active) end.current?.scrollIntoView({ block: 'end' }); }, [messages, waiting, active]);
 const send = (raw: string, base = messages) => {
  const text = raw.trim(); if (!text || waiting) return;
  const next = [...base, { role: 'user' as const, content: text }];
  setMessages(next); save(next); setDraft(''); setError(''); setWaiting(true);
  apiRequest<{ text: string }>('free-chat', { messages: next.slice(-20) })
   .then(r => { const done = [...next, { role: 'assistant' as const, content: r.text }]; setMessages(done); save(done); })
   .catch(e => { setError((e instanceof Error && e.message) || '这次没收到回复'); })
   .finally(() => setWaiting(false));
 };
 const retry = () => { const last = messages.at(-1); if (last?.role === 'user') send(last.content, messages.slice(0, -1)); };
 const restart = () => { setMessages([]); save([]); setError(''); };
 return <div className="free-chat">
  <div className="free-chat-head"><div><span className="eyebrow">FREE CHAT</span><h1>随便聊聊</h1></div>{messages.length > 0 && <button className="text-button" disabled={waiting} onClick={restart}>重新开始</button>}</div>
  <div className="free-chat-list" aria-live="polite">
   <p className="free-bubble assistant">{OPENER}</p>
   {messages.map((m, i) => <p key={i} className={'free-bubble ' + m.role}>{m.content}</p>)}
   {waiting && <p className="free-bubble assistant thinking">小N 在想…</p>}
   {error && <p className="notice" role="status">{error}<button className="text-button" onClick={retry}>再发一次</button></p>}
   <div ref={end} />
  </div>
  <div className="talk-dock">
   <form className="talk-bar" onSubmit={e => { e.preventDefault(); send(draft); }}>
    <textarea className="talk-input" aria-label="对小N说" rows={1} value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="想到什么就说什么…" enterKeyHint="send" />
    {draft.trim() && <button className="talk-send" disabled={waiting}>发送</button>}
   </form>
  </div>
 </div>;
}
