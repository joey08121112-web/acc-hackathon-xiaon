/** 所有者：ChatGPT。首页综合模式与冻结契约组件的挂载位。 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ArrowRight, AudioLines, Keyboard, Loader2, Volume2, VolumeX } from 'lucide-react';
import type { LearningUI } from '../../agents/useLearning';
import { apiRequest, newOperationId } from '../../agent-client';
import { useDevMode } from '../../agents/devMode';
import type { ChatIntent, ChatReply, ConversationSummary, Greeting, ModeSuggestion } from '../../../shared/learning-contracts';
import { SAFETY_PATTERN } from '../../../server/agents/stages';
import { PetHero, useThinkingText } from './PetStage';
import { useVoice } from '../../voice/voice';
import { useMic } from '../../voice/mic';
import { usePetReactions, type PetBusy } from '../../voice/pet';
import { HomeChat } from './home/HomeChat';
import { NeedsCheckCard } from './home/NeedsCheckCard';
import { ModeSwitchCard } from './home/ModeSwitchCard';
import { ConversationSummaryView, summaryBubbleText } from './home/ConversationSummaryView';
import { MemoryPrompt } from './home/MemoryPrompt';
import { MemoryOffNotice } from './home/MemoryOffNotice';
import { ProblemCapture } from './home/ProblemCapture';
import { ProblemConfirmCard } from './home/ProblemConfirmCard';
import { ProgressCardView } from './home/ProgressCardView';
import { RetestReminder } from '../plan/RetestReminder';
const HOME_FLOW = true;
const OPENER = '嗨，我是小N。今天过得怎么样？想跟我说说吗？';
const CHIPS: {text:string;intent?:ChatIntent}[] = [
 {text:'我考砸了，不想说话'}, {text:'我怕爸妈问成绩'}, {text:'我明明努力了，还是没考好'},
 {text:'陪我看看这张卷子吧',intent:'study'}, {text:'不想聊学习了，聊点别的吧',intent:'life'},
];
const STALE_MS = 6 * 3600_000;
// 输入栏像微信：左边切换语音/打字，记住上次用的那一种。
const TALK_MODE_KEY = 'xiaon-talk-mode';
const HOLD_MS = 450;
const readTyping = () => { try { return localStorage.getItem(TALK_MODE_KEY) !== 'voice'; } catch { return true; } };
const swallow = (p: Promise<unknown>) => { void p.catch(() => {}); };
/** active=false: the home page is hidden but kept mounted (cards and pending replies survive); stay silent until the student comes back. */
export function ChatPanel({ l, paused, safety, navigate, trace, active = true }: { l: LearningUI; paused: boolean; safety: boolean; navigate: (page: string, tab?: string) => void; trace: ReactNode; active?: boolean }) {
 const dev=useDevMode();
 const [message,setMessage]=useState(''),[reply,setReply]=useState<ChatReply|null>(null),[awaiting,setAwaiting]=useState(false),[typing,setTyping]=useState(readTyping),[holding,setHolding]=useState(false);
 const [greeting,setGreeting]=useState(OPENER),[notice,setNotice]=useState(''),[summary,setSummary]=useState<ConversationSummary|null>(null),[manualSuggestion,setManualSuggestion]=useState<ModeSuggestion|null>(null);
 const [needsSeen,setNeedsSeen]=useState(false),[keyboard,setKeyboard]=useState(false);
 const requestLock=useRef(false),sent=useRef(false),greetingAbort=useRef<AbortController|null>(null),composer=useRef<HTMLFormElement>(null);
 const v=useVoice(),mic=useMic(),chat=l.cache.chat;
 const activeRef=useRef(active);activeRef.current=active;
 useEffect(()=>{if(!active){v.actions.stop();mic.actions.cancel();}},[active]); // eslint-disable-line react-hooks/exhaustive-deps
 const latestTurn=l.view?.chatTurns.at(-1);
 const sessionId=reply?.sessionId??(chat.length?latestTurn?.sessionId??null:null);
 const savedSummary=l.view?.summaries.find(s=>s.sessionId===sessionId)??null;
 const shownSummary=summary??reply?.summary??savedSummary;
 const blocked=safety||!!reply?.safety||SAFETY_PATTERN.test([...chat].reverse().find(m=>m.role==='user')?.content??'');
 const memoryEnabled=l.view?.optionalMemory??false;
 const busy:PetBusy=mic.phase==='listening'?'listening':v.phase==='playing'?'speaking':awaiting||v.phase==='loading'||mic.phase==='transcribing'?'thinking':null;
 const pet=usePetReactions({busy,resting:paused}),thinkingText=useThinkingText(awaiting&&active);
 useEffect(()=>{
  if(!l.connected)return;
  if(chat.length&&l.cache.chatAt&&Date.now()-l.cache.chatAt>STALE_MS)l.update({chat:[],chatAt:0});
  const c=new AbortController();greetingAbort.current=c;
  void apiRequest<Greeting>('learning/greeting',{operationId:newOperationId()},c.signal).then(g=>{if(!c.signal.aborted&&!sent.current)setGreeting(g.text);}).catch(()=>{/* greeting is optional; use the default */});
  return()=>{c.abort();v.actions.stop();mic.actions.cancel();};
 },[l.connected]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  const viewport=window.visualViewport;
  const resize=()=>{
   const focused=!!composer.current?.contains(document.activeElement);
   const open=focused&&!!viewport&&window.innerHeight-viewport.height>100;
   setKeyboard(open);
   if(focused)composer.current?.scrollIntoView({block:'nearest',behavior:'instant'});
  };
  viewport?.addEventListener('resize',resize);window.addEventListener('focusout',resize);
  return()=>{viewport?.removeEventListener('resize',resize);window.removeEventListener('focusout',resize);};
 },[]);
 const bubble=pet.line||(mic.phase==='listening'?mic.interim||'我在听，你慢慢说…':mic.phase==='transcribing'?'我听一听你说了什么…':mic.phase==='requesting'?'请允许使用麦克风…':awaiting?thinkingText:(summary??reply?.summary)?summaryBubbleText((summary??reply?.summary)!):reply?.text??greeting);
 const send=(raw:string,extra:{intent?:ChatIntent;problemId?:string}={})=>{
  const text=raw.trim();if(!text||l.busy||requestLock.current||!l.connected)return;
  requestLock.current=true;sent.current=true;greetingAbort.current?.abort();v.actions.unlock();v.actions.stop();
  // Ending a conversation is immutable. The next student turn starts a fresh history.
  const history=[...(shownSummary||latestTurn?.ended?[]:chat),{role:'user' as const,content:text}].slice(-20);
  l.update({chat:history,chatAt:Date.now()});setMessage('');setNotice('');setSummary(null);setManualSuggestion(null);setAwaiting(true);
  if(shownSummary||latestTurn?.ended)setNeedsSeen(false);
  l.run<ChatReply>('learning/chat',HOME_FLOW?{history,flow:'home',...extra}:{history}).then(next=>{
   setReply(next);if(next.summary)setSummary(next.summary);
   l.update({chat:[...history,{role:'assistant',content:next.text}],chatAt:Date.now()});
   if(next.suggestions.length&&!next.safety)l.choose(next.suggestions[0]);
   if(v.enabled&&activeRef.current)void v.actions.speak(next.text);
  }).catch(()=>setNotice('刚才没能收到回复，你的话还在。可以重新发送。')).finally(()=>{requestLock.current=false;setAwaiting(false);});
 };
 const chooseNeed=(intent:ChatIntent,label:string)=>{
  setNeedsSeen(true);
  if(intent==='formal_test'){send(label,{intent});setManualSuggestion({mode:'professional',reason:'你想做个正式测试。先了解一下，再决定要不要开始。'});return;}
  send(label,{intent});
 };
 // H2: entry only opens the explanation. The student's Start click owns interview/start.
 const startProfessional=(page:string,tab?:string)=>{
  if(blocked||l.busy||requestLock.current)return;
  navigate(page,tab);
 };
 const end=()=>{
  if(!sessionId||blocked||l.busy||requestLock.current||shownSummary)return;
  requestLock.current=true;setAwaiting(true);setNotice('');v.actions.stop();mic.actions.cancel();
  // chatTurns stores metadata, not dialogue text. Keep the schema-bounded recent history;
  // the server also includes all saved observations, problems and progress from this session.
  l.run<ConversationSummary>('learning/conversation/end',{sessionId,history:chat.slice(-20)}).then(next=>{setSummary(next);if(v.enabled&&activeRef.current)void v.actions.speak(summaryBubbleText(next));}).catch(()=>setNotice('这次的小结还没整理好，对话已保留，可以再试一次。')).finally(()=>{requestLock.current=false;setAwaiting(false);});
 };
 const pause=async()=>{
  if(l.busy||requestLock.current)return;
  requestLock.current=true;setAwaiting(true);v.actions.stop();mic.actions.cancel();
  try{await l.pause();}finally{requestLock.current=false;setAwaiting(false);}
 };
 const onMic=()=>{
  if(mic.phase==='idle'){v.actions.unlock();void mic.actions.start(text=>send(text),()=>pet.say('idle','retry'));}
  else if(mic.phase==='listening')mic.actions.stop();else mic.actions.cancel();
 };
 // 按住说话、松开发送；轻点一下也行（再点一下结束），键盘回车/空格走 onClick。
 const pressedAt=useRef(0);
 const holdDown=(e:PointerEvent<HTMLButtonElement>)=>{
  if(e.button!==0||(disabled&&mic.phase==='idle'))return;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  pressedAt.current=mic.phase==='idle'?Date.now():0;setHolding(mic.phase==='idle');onMic();
 };
 const holdUp=()=>{
  const held=pressedAt.current&&Date.now()-pressedAt.current>=HOLD_MS;
  pressedAt.current=0;setHolding(false);
  if(held&&mic.phase==='listening')mic.actions.stop();
 };
 const setMode=(next:boolean)=>{
  setTyping(next);try{localStorage.setItem(TALK_MODE_KEY,next?'typing':'voice');}catch{/* remembering is optional */}
  if(!next)mic.actions.cancel();
 };
 const disabled=l.busy||awaiting||!l.connected;
 const micLabel=mic.phase==='listening'?(holding?'松开 发送':'我在听，说完点一下'):mic.phase==='requesting'?'请允许使用麦克风':mic.phase==='transcribing'?'识别中…':disabled?'小N在想…':'按住 说话';
 const showComposer=typing||mic.engine==='none';
 const note=mic.engine==='server'?'你的声音会发送到火山引擎豆包识别成文字，服务端不保存录音。':mic.engine==='browser'?'语音由浏览器自带的识别服务转成文字，可能由浏览器厂商处理。':'';
 return <div className={'home-chat'+(keyboard?' keyboard-open':'')} aria-busy={awaiting||l.busy}>
  <span className="eyebrow">先听你说</span>
  <PetHero mood={pet.mood} bubble={bubble} thinking={awaiting&&!pet.line} onTouch={pet.onTouch}/>
  <p className="small muted pet-hint">摸摸小N，也可以直接说说今天的事。</p>
  {!blocked&&<RetestReminder reminder={l.view?.retestReminder??null} where="home" l={l} navigate={navigate}/>}
  {!l.connected&&<p className="notice">暂时连不上，之前的话还在。<button onClick={()=>swallow(l.connect())}>重新连接</button></p>}
  {blocked&&<p className="safety-link" role="alert"><button className="text-button" onClick={()=>navigate('help')}>查看求助与安全支持</button></p>}
  {(notice||l.error)&&<p className="notice" role="status">{notice|| (dev?l.error:'这次没有完成，请稍后重试。')}</p>}
  <form className="talk-bar" ref={composer} onSubmit={e=>{e.preventDefault();send(message);}}>
   {mic.engine!=='none'&&<button type="button" className="talk-icon" aria-label={showComposer?'切换到语音':'切换到打字'} onClick={()=>setMode(!showComposer)}>{showComposer?<AudioLines size={22}/>:<Keyboard size={22}/>}</button>}
   {showComposer?<>
    <textarea className="talk-input" aria-label="对小N说" rows={1} value={message} maxLength={2000} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} onFocus={()=>requestAnimationFrame(()=>composer.current?.scrollIntoView({block:'nearest'}))} placeholder={shownSummary?'想接着聊，随时告诉我…':'想说什么，慢慢说…'} enterKeyHint="send"/>
    {message.trim()&&<button className="talk-send" disabled={disabled}>发送</button>}
   </>:<button type="button" className="talk-hold" data-phase={mic.phase} data-holding={holding||undefined} disabled={disabled&&mic.phase==='idle'} aria-label={micLabel} onPointerDown={holdDown} onPointerUp={holdUp} onPointerCancel={holdUp} onClick={e=>{if(e.detail===0)onMic();}} onContextMenu={e=>e.preventDefault()}>{mic.phase==='transcribing'||mic.phase==='requesting'?<Loader2 size={18} className="spin"/>:null}<span role="status">{micLabel}</span></button>}
   {v.available&&<button type="button" className="talk-icon" aria-pressed={v.enabled} aria-label={v.enabled?'声音：开':'声音：关'} title={v.enabled?'小N的回复会读出来':'小N的回复不读出来'} onClick={()=>{v.actions.unlock();v.actions.setEnabled(!v.enabled);}}>{v.enabled?<Volume2 size={22}/>:<VolumeX size={22}/>}</button>}
  </form>
  {v.phase==='playing'&&<button className="text-button" onClick={()=>v.actions.stop()}>停止朗读</button>}
  {(mic.error||v.error)&&<p className="notice" role="status">{mic.error||v.error}</p>}
  {(note||(v.available&&v.enabled))&&<p className="small muted mic-note">{note}{v.available&&v.enabled?' 朗读时，小N的回复会发送到火山引擎豆包合成语音。':''}</p>}
  {!blocked&&!shownSummary&&<>
   <div className="quick-replies home-quick" aria-label="可以点一下回答">{CHIPS.map(c=><button key={c.text} disabled={disabled} onClick={()=>{if(c.intent!=='life')pet.feel('concerned');send(c.text,c.intent?{intent:c.intent}:{});}}>{c.text}</button>)}</div>
   <NeedsCheckCard key={sessionId??'new'} open={!!reply?.needsCheck&&!needsSeen} disabled={disabled} onChoose={chooseNeed}/>
   <HomeChat l={l} reply={reply} send={send} navigate={navigate}/>
   <fieldset className="home-mode-actions" disabled={disabled}><ModeSwitchCard key={`${sessionId}-${manualSuggestion?'manual':reply?.modeSuggestion?.reason}`} suggestion={manualSuggestion??reply?.modeSuggestion??null} navigate={startProfessional}/></fieldset>
   <div className="home-slots">
    <ProblemCapture open={!!reply?.askProblem} sessionId={sessionId} l={l} navigate={navigate} onConfirmed={problem=>send('就看这道题吧',{intent:'start_together',problemId:problem.id})}/>
    <ProblemConfirmCard draft={reply?.problemDraft??null} sessionId={sessionId} l={l} navigate={navigate} onConfirmed={problem=>send('就看这道题吧',{intent:'start_together',problemId:problem.id})}/>
    <ProgressCardView draft={reply?.progressCardDraft??null} sessionId={sessionId} memoryEnabled={memoryEnabled} l={l} navigate={navigate}/>
    <MemoryPrompt draft={reply?.memoryDraft??null} sessionId={sessionId} memoryEnabled={memoryEnabled} l={l}/>
   </div>
  </>}
  <MemoryOffNotice memoryEnabled={memoryEnabled} where="home" navigate={navigate}/>
  <ConversationSummaryView key={`${shownSummary?.id}`} summary={blocked?null:shownSummary} l={l} navigate={startProfessional}/>
  {chat.length>0&&<details className="chat-log" open><summary>聊天记录（{chat.length}）</summary><div className="messages">{chat.map((m,i)=><div className={'message '+(m.role==='user'?'user':'ai')} key={i}><div>{m.content}</div>{m.role==='assistant'&&v.available&&<button className="text-button say-button" onClick={()=>void v.actions.speak(m.content)}><Volume2 size={13}/>朗读</button>}</div>)}</div></details>}
  <div className="home-composer-wrap">
   <div className="home-card-actions"><button className="secondary" disabled={disabled||blocked||!sessionId||!!shownSummary} onClick={end}>今天先聊到这</button><button className="text-button" disabled={disabled} onClick={()=>void pause()}>今天先休息</button></div>
  </div>
  {l.candidate&&!paused&&!blocked&&<button className="learning-choice" onClick={()=>navigate('task')}>小N建议：{l.candidate.title}，由我确认 <ArrowRight size={17}/></button>}
  {dev&&(trace??<details className="evidence-details"><summary>查看 Agent 与工具轨迹</summary>{l.view?.runs.slice(-10).map(run=><p className="small" key={run.id}>{run.role} · {run.providerKind} · {run.status}</p>)}</details>)}
 </div>;
}
