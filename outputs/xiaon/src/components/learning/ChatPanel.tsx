import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Keyboard, Loader2, Mic, Send, Square, Volume2, VolumeX } from 'lucide-react';
import type { LearningUI } from '../../agents/useLearning';
import type { ChatIntent, ChatReply } from '../../../shared/learning-contracts';
import { PetHero, useThinkingText } from './PetStage';
import { useVoice } from '../../voice/voice';
import { useMic } from '../../voice/mic';
import { usePetReactions, type PetBusy } from '../../voice/pet';
import { HomeChat } from './home/HomeChat';
import { NeedsCheckCard } from './home/NeedsCheckCard';
import { ModeSwitchCard } from './home/ModeSwitchCard';
import { ConversationSummaryView } from './home/ConversationSummaryView';
import { MemoryPrompt } from './home/MemoryPrompt';
import { MemoryOffNotice } from './home/MemoryOffNotice';
import { ProblemCapture } from './home/ProblemCapture';
import { ProblemConfirmCard } from './home/ProblemConfirmCard';
import { ProgressCardView } from './home/ProgressCardView';
// G0: false keeps the legacy two-step Tutor. ChatGPT turns this on in phase 1; then every message carries flow:'home'.
const HOME_FLOW = false;
const OPENER = '嗨，我是小N。今天过得怎么样？想跟我说说吗？';
const FALLBACK_CHIPS = { opener: ['今天有点烦', '还行', '不想学了', '不想说'], listen: ['考试没考好', '有题不会做', '就是不想学', '不想说'], probe: ['概念不太清楚', '公式不会用', '不知道从哪下手', '说不清楚'] };
// Only buttons the student explicitly pressed change the pet's face; free text is never read for feelings.
const CONCERNED = new Set(['今天有点烦', '不想学了', '考试没考好', '有题不会做', '就是不想学']);
const STALE_MS = 6 * 3600_000;
const swallow = (p: Promise<unknown>) => { void p.catch(() => {}); };
export function ChatPanel({ l, paused, safety, navigate, trace }: { l: LearningUI; paused: boolean; safety: boolean; navigate: (page: string, tab?: string) => void; trace: ReactNode }) {
 const [message, setMessage] = useState(''), [reply, setReply] = useState<ChatReply | null>(null), [awaiting, setAwaiting] = useState(false), [chips, setChips] = useState<string[] | null>(null), [typing, setTyping] = useState(false);
 const v = useVoice(), mic = useMic(), chat = l.cache.chat;
 // A conversation older than a few hours starts again at step 1 instead of resuming mid-probe.
 useEffect(() => { if (chat.length && l.cache.chatAt && Date.now() - l.cache.chatAt > STALE_MS) l.update({ chat: [], chatAt: 0 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
 const busy: PetBusy = mic.phase === 'listening' ? 'listening' : v.phase === 'playing' ? 'speaking' : awaiting || v.phase === 'loading' || mic.phase === 'transcribing' ? 'thinking' : null;
 const pet = usePetReactions({ busy, resting: false });
 const thinkingText = useThinkingText(awaiting);
 const lastReply = [...chat].reverse().find(m => m.role === 'assistant')?.content;
 const userTurns = chat.filter(m => m.role === 'user').length;
 const shownChips = awaiting || l.busy || mic.phase !== 'idle' ? [] : chips ?? (chat.length === 0 ? FALLBACK_CHIPS.opener : userTurns <= 1 ? FALLBACK_CHIPS.listen : FALLBACK_CHIPS.probe);
 const bubble = pet.line
  || (mic.phase === 'listening' ? mic.interim || '我在听，你慢慢说…' : mic.phase === 'transcribing' ? '我听一听你说了什么…' : mic.phase === 'requesting' ? '请允许使用麦克风…' : awaiting ? thinkingText : lastReply ?? OPENER);
 const send = (raw: string, extra: { intent?: ChatIntent; problemId?: string } = {}) => {
  const text = raw.trim();
  if (!text || l.busy || awaiting) return;
  v.actions.unlock(); v.actions.stop(); // the click unlocks sound; talking over the student is never allowed
  const history = [...chat, { role: 'user' as const, content: text }].slice(-20);
  l.update({ chat: history, chatAt: Date.now() }); setMessage(''); setChips([]); setAwaiting(true);
  l.run<ChatReply>('learning/chat', HOME_FLOW ? { history, flow: 'home', ...extra } : { history })
   .then(reply => {
    setReply(reply);
    l.update({ chat: [...history, { role: 'assistant', content: reply.text }], chatAt: Date.now() });
    setChips(reply.quickReplies ?? []);
    if (reply.suggestions.length) l.choose(reply.suggestions[0]);
    if (v.enabled) void v.actions.speak(reply.text);
   })
   .catch(() => { void v.actions.playClipIfEnabled('error'); })
   .finally(() => setAwaiting(false));
 };
 const pickChip = (text: string) => { if (CONCERNED.has(text)) pet.feel('concerned'); else if (text === '还行') pet.feel('happy'); send(text); };
 const onMic = () => {
  if (mic.phase === 'idle') { v.actions.unlock(); mic.actions.start(text => send(text), () => pet.say('idle', 'retry')); }
  else if (mic.phase === 'listening') mic.actions.stop();
  else mic.actions.cancel();
 };
 const micDisabled = l.busy || awaiting;
 const micLabel = mic.phase === 'listening' ? '我在听，说完点一下（停顿也会自动发送）' : mic.phase === 'requesting' ? '请允许使用麦克风' : mic.phase === 'transcribing' ? '识别中…' : micDisabled ? '小N在想…' : '点一下，直接对小N说话';
 const showComposer = typing || mic.engine === 'none';
 const note = mic.engine === 'server' ? '你的声音会发送到火山引擎豆包识别成文字，服务端不保存录音。' : mic.engine === 'browser' ? '语音由浏览器自带的识别服务转成文字（可能由浏览器厂商处理）。' : '';
 const sessionId = reply?.sessionId ?? null, memoryEnabled = l.view?.optionalMemory ?? false;
 return <>
  <span className="eyebrow">TUTOR · 先听你说</span>
  <HomeChat l={l} reply={reply} send={send} navigate={navigate} />
  <PetHero mood={pet.mood} bubble={bubble} thinking={awaiting && !pet.line} onTouch={pet.onTouch} />
  <p className="small muted pet-hint">戳一戳、摸一摸小N，它会有反应。也可以直接对它说话。</p>
  <div className="talk-row">
   {mic.engine !== 'none' && <button className="mic-button" data-phase={mic.phase} disabled={micDisabled && mic.phase === 'idle'} onClick={onMic} aria-label={micLabel}>
    {mic.phase === 'listening' ? <Square size={26} fill="currentColor" /> : mic.phase === 'transcribing' || mic.phase === 'requesting' ? <Loader2 size={28} className="spin" /> : <Mic size={30} />}
   </button>}
   <div className="talk-side">
    <button className="secondary kbd-button" aria-pressed={showComposer} disabled={mic.engine === 'none'} onClick={() => setTyping(t => !t)}><Keyboard size={16} />打字</button>
    {v.available && <button className="secondary voice-toggle" aria-pressed={v.enabled} onClick={() => { v.actions.unlock(); v.actions.setEnabled(!v.enabled); if (!v.enabled) void v.actions.playClip('greet'); }}>
     {v.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}{v.enabled ? '声音：开' : '声音：关'}
    </button>}
   </div>
  </div>
  {mic.engine !== 'none' && <p className="mic-label" role="status">{micLabel}</p>}
  {v.phase === 'playing' && <p className="center"><button className="text-button" onClick={() => v.actions.stop()}>停止朗读</button></p>}
  {(mic.error || v.error) && <p className="notice" role="status">{mic.error || v.error}</p>}
  {note && <p className="small muted center mic-note">{note}{v.available && v.enabled ? ' 小N说话时，它的回复文字会发送到火山引擎豆包语音合成，不会发送你输入的话。' : ''}</p>}
  {shownChips.length > 0 && <div className="quick-replies" aria-label="可以点一下回答">{shownChips.map(c => <button key={c} onClick={() => pickChip(c)}>{c}</button>)}</div>}
  {/* G0 mount points: each owner fills its component; props come straight from the latest ChatReply. */}
  <NeedsCheckCard open={!!reply?.needsCheck} disabled={l.busy || awaiting} onChoose={(intent, label) => send(label, { intent })} />
  <ModeSwitchCard suggestion={reply?.modeSuggestion ?? null} navigate={navigate} />
  <ProblemCapture open={!!reply?.askProblem} sessionId={sessionId} l={l} onConfirmed={problem => send('就看这道题吧', { intent: 'start_together', problemId: problem.id })} />
  <ProblemConfirmCard draft={reply?.problemDraft ?? null} sessionId={sessionId} l={l} onConfirmed={problem => send('就看这道题吧', { intent: 'start_together', problemId: problem.id })} />
  <ProgressCardView draft={reply?.progressCardDraft ?? null} sessionId={sessionId} memoryEnabled={memoryEnabled} l={l} navigate={navigate} />
  <MemoryPrompt draft={reply?.memoryDraft ?? null} sessionId={sessionId} memoryEnabled={memoryEnabled} l={l} />
  <MemoryOffNotice memoryEnabled={memoryEnabled} where="home" navigate={navigate} />
  <ConversationSummaryView summary={reply?.summary ?? null} l={l} navigate={navigate} />
  {showComposer && <form className="learning-composer" onSubmit={e => { e.preventDefault(); send(message); }}>
   <label className="field">对小N说<textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="想说什么，慢慢说…" /></label>
   <button className="primary" disabled={l.busy || awaiting || !message.trim()}><Send size={17} />发送</button>
  </form>}
  {chat.length > 0 && <details className="chat-log" open><summary>聊天记录（{chat.length}）</summary><div className="messages">{chat.map((m, i) => <div className={'message ' + (m.role === 'user' ? 'user' : 'ai')} key={i}><div>{m.content}</div>
   {m.role === 'assistant' && v.available && <button className="text-button say-button" onClick={() => void v.actions.speak(m.content)}><Volume2 size={13} />朗读</button>}
  </div>)}</div></details>}
  {l.candidate && !paused && <button className="learning-choice" onClick={() => navigate('task')}>小N建议：{l.candidate.title}，由我确认 <ArrowRight size={17} /></button>}
  {!paused && !safety ? <button className="secondary wide" onClick={() => navigate('explore', '探索')}>我想选择一道题</button> : <p className="notice">先聊聊，暂不邀请看题。<button onClick={() => navigate('explore', '探索')}>我想主动恢复看题</button></p>}
  <button className="text-button" onClick={() => swallow(l.pause())}>今天先休息</button>{trace}
 </>;
}
