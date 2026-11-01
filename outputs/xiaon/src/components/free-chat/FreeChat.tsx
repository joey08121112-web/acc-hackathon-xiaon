/** 首页小N：语音和文字共用自由聊的同一会话、同一档案，不走旧学习协调器或阶段提示词。 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Volume2, VolumeX } from 'lucide-react';
import { apiRequest } from '../../agent-client';
import { MESSAGE_TEXT_MAX, type Digest, type DigestResponse, type FreeChatExchange, type FreeChatPage, type FreeChatHistory, type FreeChatThread } from '../../../shared/free-chat';
import { useVoice, getVoiceState } from '../../voice/voice';
import { useMic } from '../../voice/mic';
import { useVoiceConversation } from '../../voice/conversation';
import type { LearningUI } from '../../agents/useLearning';
import { ChatHistory } from '../learning/home/ChatHistory';
import { CompanionStage } from './CompanionStage';
import { FreeChatArchive } from './FreeChatArchive';
const OPENER='嗨，我是小N。想聊什么都可以：一道题、一个怪问题，或者一个脑洞。你先说？';
try{localStorage.removeItem('xiaon-free-chat');}catch{/* 旧版浏览器副本不再使用 */}
export function FreeChat({active,home=false,legacy,navigate,safety=false}:{active:boolean;home?:boolean;legacy?:LearningUI;navigate?:(page:string,tab?:string)=>void;safety?:boolean}){
 const [page,setPage]=useState<FreeChatPage>({threadId:null,messages:[],hasMore:false,before:null}),[threads,setThreads]=useState<FreeChatThread[]>([]);
 const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(false),[draft,setDraft]=useState(''),[waiting,setWaiting]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<string|null>(null),[typing,setTyping]=useState(false),[micMuted,setMicMuted]=useState(false),[notice,setNotice]=useState(''),[earlier,setEarlier]=useState(false);
 const busy=useRef(false),alive=useRef(true),current=useRef({active,home,safety,threadId:page.threadId});current.current={active,home,safety,threadId:page.threadId};
 const [digest,setDigest]=useState<Digest|null>(null),[forgetError,setForgetError]=useState(''),[deleting,setDeleting]=useState(false);
 const poll=useRef<ReturnType<typeof setTimeout>|null>(null),end=useRef<HTMLDivElement>(null),greeted=useRef(false),scrollReply=useRef(false),entryGeneration=useRef(0);
 const input=useRef<HTMLTextAreaElement>(null);
 const v=useVoice(),mic=useMic();
 const voiceError=v.error.includes('自动发声')?'浏览器需要你点一下「开始语音对话」才能发声，文字都在。':v.error;
 const conversation=useVoiceConversation({allowed:active&&home&&!safety&&loaded,busy:waiting,muted:micMuted,onText:text=>send(text,true),onNotice:setNotice});
 const refreshThreads=()=>apiRequest<{threads:FreeChatThread[]}>('free-chat/threads').then(r=>{if(alive.current)setThreads(r.threads);}).catch(()=>{});
 const loadDigest=(tries=0)=>{
  if(poll.current)clearTimeout(poll.current);
  apiRequest<DigestResponse>('free-chat/digest').then(r=>{
   if(!alive.current)return;setDigest(r.digest);
   if(r.consolidating&&tries<24)poll.current=setTimeout(()=>loadDigest(tries+1),5000);
  }).catch(()=>{});
 };
 const load=()=>{
  if(busy.current)return;
  apiRequest<FreeChatPage>('free-chat/messages').then(h=>{if(alive.current&&!busy.current){setPage(h);setLoaded(true);setLoadError(false);}}).catch(()=>{if(alive.current)setLoadError(true);});
  void refreshThreads();
 };
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(poll.current)clearTimeout(poll.current);};},[]);
 useEffect(()=>{if(active){load();loadDigest();}},[active]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!active||!home){conversation.stop();}},[active,home]); // eslint-disable-line react-hooks/exhaustive-deps
 // 进入首页先说开场白。已授予麦克风权限才自动接着听，首次授权始终由可见按钮触发。
 useEffect(()=>{
  if(!active||!home||!loaded||!v.available||!v.enabled||safety||greeted.current)return;
  greeted.current=true;let cancelled=false;const generation=entryGeneration.current;
  void(async()=>{
   await v.actions.speak(OPENER);
   if(cancelled||document.hidden||generation!==entryGeneration.current||getVoiceState().error||!navigator.permissions)return;
   try{const permission=await navigator.permissions.query({name:'microphone' as PermissionName});if(!cancelled&&!document.hidden&&generation===entryGeneration.current&&permission.state==='granted'&&!busy.current)conversation.start();}catch{/* 某些浏览器不支持查询麦克风权限，使用开始按钮 */}
  })();
  return()=>{cancelled=true;};
 },[active,home,loaded,v.available,v.enabled,safety]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(typing&&active&&home)input.current?.focus();},[typing,active,home]);
 useEffect(()=>{if(active&&scrollReply.current){scrollReply.current=false;end.current?.scrollIntoView({block:'nearest'});}},[page.messages,pending,active]);
 async function send(raw:string,fromVoice=false){
  const text=raw.trim();if(!text||busy.current||safety)return;
  busy.current=true;scrollReply.current=true;setPending(text);setDraft('');setError('');setWaiting(true);
  try{
   const r=await apiRequest<FreeChatExchange>('free-chat',{text});if(!alive.current)return;
   setPage(old=>({...old,threadId:r.threadId,messages:[...old.messages,r.user,r.reply]}));setPending(null);void refreshThreads();
   if(current.current.active&&current.current.home&&!document.hidden&&getVoiceState().enabled&&(!fromVoice||conversation.isRunning()))await v.actions.speak(r.reply.content);
   return r;
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'这次没收到回复');throw e;}
  finally{busy.current=false;if(alive.current)setWaiting(false);}
 }
 const restart=async()=>{
  if(busy.current)return;conversation.stop();busy.current=true;setError('');
  try{const h=await apiRequest<FreeChatHistory>('free-chat/new-thread',{});if(!alive.current)return;setPage({...h,hasMore:false,before:null});setPending(null);void refreshThreads();}
  catch{if(alive.current)setError('没能重新开始，请再试一次');}finally{busy.current=false;}
 };
 const loadEarlier=async()=>{
  if(earlier||!page.threadId||!page.before)return;setEarlier(true);const thread=page.threadId;
  try{const next=await apiRequest<FreeChatPage>('free-chat/messages?'+new URLSearchParams({threadId:thread,before:page.before}));if(alive.current&&current.current.threadId===thread)setPage(old=>({...next,messages:[...next.messages,...old.messages]}));}
  catch{setError('更早的消息暂时取不到，请再试一次');}finally{setEarlier(false);}
 };
 const seen=()=>{if(!digest)return;const runId=digest.runId;setDigest(null);void apiRequest('free-chat/digest/seen',{runId}).catch(()=>{});};
 const forget=async(itemId:string)=>{
  if(!digest||deleting)return;setDeleting(true);const batch=digest;
  try{await apiRequest('free-chat/profile/item',{action:'delete',id:itemId});if(!alive.current)return;setForgetError('');
   setDigest(old=>{if(old?.runId!==batch.runId)return old;const changes=old.changes.filter(c=>c.itemId!==itemId);return changes.length?{...old,changes}:null;});
   if(batch.changes.length===1)void apiRequest('free-chat/digest/seen',{runId:batch.runId}).catch(()=>{});
  }catch{if(alive.current)setForgetError('这条暂时没删掉，请再点一次');}finally{if(alive.current)setDeleting(false);}
 };
  const status=micMuted&&conversation.running?'麦克风已静音':waiting?(v.phase==='playing'?'小N正在说话':'小N在想你说的话…'):mic.phase==='requesting'?'正在打开麦克风…':mic.phase==='listening'?'我在听，你慢慢说':mic.phase==='transcribing'?'正在听清你说的话…':v.phase==='playing'?'小N正在说话':conversation.running?'语音对话进行中':'想到什么，都可以聊';
 const transcript=<>
  <div className="free-chat-head">{home?<h2>正在聊的内容</h2>:<h1>随便聊聊</h1>}{(page.messages.length>0||pending)&&<button className="text-button" disabled={waiting} onClick={()=>void restart()}>重新开始</button>}</div>
  <div className="free-chat-list" aria-live="polite" aria-busy={waiting}>
   <p className="free-bubble assistant">{OPENER}</p>
   {digest&&<div className="free-digest" role="status"><p>我把上次聊的整理了一下：</p><ul>{digest.changes.map(c=><li key={c.itemId}><span>{c.op==='update'?'更新了':'记住了'}「{c.text}」</span><button className="text-button" disabled={deleting} onClick={()=>void forget(c.itemId)}>不对，删掉</button></li>)}</ul>{forgetError&&<p role="status">{forgetError}</p>}<p className="small muted">在「成长 · 我的档案」里随时可以改。<button className="text-button" onClick={seen}>知道了</button></p></div>}
   {loadError&&<p className="notice" role="status">之前的对话暂时取不到。<button className="text-button" onClick={load}>再试一次</button></p>}
   {page.hasMore&&<button className="text-button" disabled={earlier} onClick={()=>void loadEarlier()}>{earlier?'正在翻开…':'查看这一段更早的消息'}</button>}
   {page.messages.map(m=><p key={m.id} className={'free-bubble '+m.role}>{m.content}</p>)}
   {pending&&<p className="free-bubble user">{pending}</p>}
   {mic.interim&&<p className="free-bubble user interim">{mic.interim}</p>}
   {waiting&&v.phase!=='playing'&&<p className="free-bubble assistant thinking">小N在想…</p>}
   {error&&<p className="notice" role="status">{error}{pending&&<button className="text-button" disabled={waiting} onClick={()=>void send(pending).catch(()=>{})}>再发一次</button>}</p>}
   <div ref={end}/>
  </div>
  <FreeChatArchive threads={threads} currentThreadId={page.threadId}/>
  {legacy&&navigate&&<ChatHistory l={legacy} navigate={navigate} includeCurrent={false}/>}
 </>;
 const noticeContent=<>
  {(notice||voiceError||mic.error)&&<p className="talk-dock-line" role="status">{notice||voiceError||mic.error}</p>}
  {safety&&<p className="talk-dock-line">可以先找身边信任的大人聊聊。{navigate&&<button className="text-button" onClick={()=>navigate('help')}>查看支持</button>}</p>}
 </>;
 const composer=<>
  {!home&&noticeContent}
  <form className="talk-bar" onSubmit={e=>{e.preventDefault();if(document.activeElement instanceof HTMLButtonElement)document.activeElement.blur();void send(draft).catch(()=>{});}}>
   <textarea ref={input} className="talk-input" aria-label="对小N说" rows={1} value={draft} maxLength={MESSAGE_TEXT_MAX} onFocus={()=>{if(home&&conversation.isRunning())setMicMuted(true);}} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} placeholder="想到什么就说什么…" enterKeyHint="send"/>
   <button className="talk-send" aria-label="发送" disabled={waiting||!loaded||safety||!draft.trim()}>{home?<ArrowUp size={18}/>:"发送"}</button>
   {home&&<button type="button" className="talk-icon" aria-label={v.enabled?'关闭声音':'开启声音'} aria-pressed={v.enabled} onClick={()=>{entryGeneration.current++;conversation.stop();v.actions.setEnabled(!v.enabled);}}>{v.enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>}
  </form>
 </>;
 const toggleConversation=()=>{entryGeneration.current++;if(conversation.running)conversation.stop();else{setMicMuted(false);conversation.start();}};
 const latestReply=[...page.messages].reverse().find(m=>m.role==='assistant')?.content??OPENER;
 const subtitle=mic.interim||pending||(waiting&&v.phase!=='playing'?'让我想想…':latestReply);
 return <div className={'free-chat'+(home?' free-chat-home':'')} data-voice-phase={v.phase} data-voice-running={conversation.running} data-mic-phase={mic.phase} data-mic-muted={micMuted}>
  <CompanionStage visible={home} mood={mic.phase==='listening'?'listening':v.phase==='playing'?'speaking':waiting?'thinking':'idle'} status={status} subtitle={subtitle}
   running={conversation.running} muted={micMuted} disabled={!loaded||safety} micPhase={mic.phase} composer={composer} notice={noticeContent}
   onToggleConversation={toggleConversation} onToggleMute={()=>{entryGeneration.current++;setMicMuted(on=>!on);}}
   onTyping={()=>{entryGeneration.current++;setTyping(false);requestAnimationFrame(()=>{setTyping(true);});}}
   onFinish={()=>mic.actions.stop()} onSettings={()=>navigate?.('settings')}>
   {transcript}
  </CompanionStage>
 </div>;
}
