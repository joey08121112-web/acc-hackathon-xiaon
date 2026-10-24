import { useCallback,useEffect,useRef,useState } from 'react';
import { useMic } from './mic';
import { useVoice } from './voice';

/** A user-started session: listen → recognize → reply → finish playback → listen again. */
export function useVoiceConversation(options:{allowed:boolean;busy:boolean;onText:(text:string)=>Promise<unknown>|undefined;onNotice:(text:string)=>void}){
 const mic=useMic(),v=useVoice();
 const [running,setRunning]=useState(false),[turn,setTurn]=useState(0);
 const current=useRef(options);current.current=options;
 const enabled=useRef(false),generation=useRef(0),pending=useRef(false);
 const stop=useCallback(()=>{
  enabled.current=false;generation.current++;pending.current=false;setRunning(false);
  mic.actions.cancel();v.actions.stop();
 },[mic.actions,v.actions]);
 const listen=()=>{
  const gen=generation.current;
  void mic.actions.start(text=>{
   if(!enabled.current||gen!==generation.current)return;
   pending.current=true;
   void Promise.resolve(current.current.onText(text)).catch(()=>stop()).finally(()=>{
    if(gen!==generation.current)return;
    pending.current=false;setTurn(n=>n+1);
   });
  },()=>{
   if(!enabled.current||gen!==generation.current)return;
   stop();current.current.onNotice('这次没听清，点一下可重新开始语音对话，也可以打字。');
  });
 };
 const start=()=>{
  if(enabled.current||!current.current.allowed||current.current.busy)return;
  v.actions.unlock();v.actions.setEnabled(true);enabled.current=true;generation.current++;setRunning(true);
  current.current.onNotice('');listen();
 };
 useEffect(()=>{
  if(!running)return;
  if(!options.allowed||mic.error||v.error){if(mic.error||v.error)current.current.onNotice(mic.error||v.error);stop();return;}
  if(!options.busy&&!pending.current&&mic.phase==='idle'&&v.phase==='idle')listen();
 },[running,options.allowed,options.busy,mic.phase,mic.error,v.phase,v.error,turn]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hidden);
  return()=>{document.removeEventListener('visibilitychange',hidden);stop();};
 },[stop]);
 return{running,start,stop,isRunning:()=>enabled.current};
}
