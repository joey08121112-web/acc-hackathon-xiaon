import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ChevronDown, Keyboard, Maximize2, Mic, MicOff, PhoneOff, Play, Settings, X } from 'lucide-react';
import { Mascot, type PetMood } from '../../Art';
import { onMicLevel } from '../../voice/mic';
import { onVoiceLevel } from '../../voice/voice';
import './CompanionStage.css';

type Point={p:number;x:number;y:number;s:number};
type Props={
 mood:PetMood;status:string;subtitle:string;children:ReactNode;composer:ReactNode;notice:ReactNode;
 visible?:boolean;running:boolean;muted:boolean;disabled:boolean;micPhase:string;
 onToggleConversation:()=>void;onToggleMute:()=>void;onTyping:()=>void;onFinish:()=>void;onSettings:()=>void;
};
const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
/** 同一个宠物跨越展开/顶部栏两个状态。拖动只更新 transform；收起不改变语音会话。 */
export function CompanionStage({mood,status,subtitle,children,composer,notice,visible=true,running,muted,disabled,micPhase,onToggleConversation,onToggleMute,onTyping,onFinish,onSettings}:Props){
 const [compact,setCompact]=useState(false),[dragging,setDragging]=useState(false);
 const root=useRef<HTMLDivElement>(null),pet=useRef<HTMLButtonElement>(null),portrait=useRef<SVGSVGElement|null>(null),art=useRef<HTMLDivElement>(null);
 const surface=useRef<HTMLDivElement>(null),mini=useRef<HTMLDivElement>(null),body=useRef<HTMLDivElement>(null),caption=useRef<HTMLDivElement>(null),title=useRef<HTMLDivElement>(null),controls=useRef<HTMLDivElement>(null);
 const bars=useRef<HTMLDivElement>(null),swiped=useRef(false),raf=useRef(0),last=useRef(0),reduced=useRef(false),compactRef=useRef(false),enabled=useRef(visible);
 const current=useRef<Point>({p:0,x:0,y:142,s:1}),target=useRef<Point>({...current.current}),velocity=useRef<Point>({p:0,x:0,y:0,s:0});
 const drag=useRef<{id:number;x:number;y:number;lastY:number;at:number;v:number;base:Point;compact:boolean}|null>(null);
 const levels=useRef({input:0,output:0}),moodRef=useRef(mood);moodRef.current=mood;enabled.current=visible;
 const positions=()=>{const height=window.visualViewport?.height??window.innerHeight,scale=height<620?.8:1;return{x:Math.max(0,((root.current?.clientWidth??390)-240*scale)/2),y:Math.max(132,Math.min(204,height*.21)),scale,miniX:20,miniY:58};};
 const setTarget=(value:boolean)=>{const p=positions();target.current={p:value?1:0,x:value?p.miniX:p.x,y:value?p.miniY:p.y,s:value?.225:p.scale};};
 const draw=()=>{
  const c=current.current,p=clamp(c.p),fade=clamp((p-.2)/.8);
  pet.current!.style.transform=`translate(${c.x}px,${c.y}px) scale(${Math.max(.1,c.s)})`;
  surface.current!.style.transform=`translateY(${p*195}px) scale(${1-p*.08})`;surface.current!.style.opacity=String((1-p)**2);
  mini.current!.style.opacity=String(clamp((p-.4)/.6));body.current!.style.opacity=String(fade);body.current!.style.transform=`translateY(${(1-p)*38}px)`;
  caption.current!.style.opacity=String(clamp(1-p*3));title.current!.style.opacity=String(clamp(1-p*3));
  controls.current!.style.opacity=String(1-clamp(p*1.6));
  root.current!.style.setProperty('--companion-chat-opacity',String(fade));
  root.current!.setAttribute('data-progress',p.toFixed(3));
  const amp=reduced.current?0:moodRef.current==='speaking'?levels.current.output:moodRef.current==='listening'?levels.current.input:0;
  art.current!.style.transform=`scale(${1+amp*.035},${1-amp*.014}) translateY(${-amp*3}px)`;
  const mouth=portrait.current?.querySelector<SVGElement>('.pet-mouth-talk');if(mouth)mouth.style.transform=`scaleY(${.65+amp*.9})`;
  bars.current?.querySelectorAll<HTMLElement>('i').forEach((el,i)=>{el.style.transform=`scaleY(${.6+amp*(1.3+(i%3)*.55)})`;});
  portrait.current?.style.setProperty('--mic',levels.current.input.toFixed(2));
 };
 const animate=()=>{
  if(!enabled.current||!root.current)return;
  const step=(now:number)=>{
   if(!enabled.current||!root.current)return;
   const dt=Math.min((now-(last.current||now))/1000,.032);last.current=now;
   if(!drag.current)for(const key of ['p','x','y','s'] as const){
    if(reduced.current){current.current[key]=target.current[key];velocity.current[key]=0;}
    else{velocity.current[key]+=(100*(target.current[key]-current.current[key])-10*velocity.current[key])*dt;current.current[key]+=velocity.current[key]*dt;
     if(Math.abs(target.current[key]-current.current[key])<.001&&Math.abs(velocity.current[key])<.005){current.current[key]=target.current[key];velocity.current[key]=0;}}
   }
   draw();raf.current=requestAnimationFrame(step);
  };
  cancelAnimationFrame(raf.current);last.current=0;raf.current=requestAnimationFrame(step);
 };
 const change=(value:boolean,instant=false)=>{
  compactRef.current=value;setCompact(value);setTarget(value);
  if(instant||reduced.current){current.current={...target.current};velocity.current={p:0,x:0,y:0,s:0};if(visible)draw();}
 };
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');reduced.current=media.matches;
  const reduce=()=>{reduced.current=media.matches;if(media.matches){current.current={...target.current};velocity.current={p:0,x:0,y:0,s:0};}};media.addEventListener('change',reduce);
  const unmic=onMicLevel(v=>{levels.current.input=v;}),unspeak=onVoiceLevel(v=>{levels.current.output=v;});
  return()=>{media.removeEventListener('change',reduce);unmic();unspeak();cancelAnimationFrame(raf.current);};
 },[]);
 useLayoutEffect(()=>{
  if(!visible){cancelAnimationFrame(raf.current);drag.current=null;setDragging(false);return;}
  const measure=()=>{if(drag.current)return;setTarget(compactRef.current);current.current={...target.current};velocity.current={p:0,x:0,y:0,s:0};const pos=positions();if(caption.current)caption.current.style.top=pos.y+225*pos.scale+20+'px';draw();};
  measure();animate();const resize=new ResizeObserver(measure);resize.observe(root.current!);window.visualViewport?.addEventListener('resize',measure);
  return()=>{resize.disconnect();window.visualViewport?.removeEventListener('resize',measure);cancelAnimationFrame(raf.current);};
 },[visible]); // The motion lives outside React renders; controls never restart it.
 const down=(e:PointerEvent<HTMLButtonElement>)=>{
  if(e.button!==0)return;const now=performance.now();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastY:e.clientY,at:now,v:0,base:{...current.current},compact:compactRef.current};
  swiped.current=false;setDragging(true);velocity.current={p:0,x:0,y:0,s:0};e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent<HTMLButtonElement>)=>{
  const d=drag.current;if(!d||d.id!==e.pointerId)return;const dy=e.clientY-d.y,dx=e.clientX-d.x,now=performance.now();d.v=(e.clientY-d.lastY)/Math.max(1,now-d.at);d.lastY=e.clientY;d.at=now;
  if(Math.abs(dy)>6||Math.abs(dx)>6)swiped.current=true;
  const p=d.compact?clamp(1-dy/215):clamp(dy/215),pos=positions();
  current.current=d.compact?{p,x:lerp(pos.x,pos.miniX,p),y:lerp(pos.y,pos.miniY,p)+Math.max(0,dy)*.35,s:lerp(pos.scale,.225,p)}:{p,x:d.base.x+dx*.3,y:d.base.y+(dy<0?dy*.2:dy),s:d.base.s*(1-.5*p)};
 };
 const release=(e:PointerEvent<HTMLButtonElement>,cancelled=false)=>{
  const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;setDragging(false);
  const value=cancelled?d.compact:swiped.current?(current.current.p>.28||(d.v>.55&&!d.compact)):!d.compact;
  if(swiped.current&&!cancelled&&!reduced.current)velocity.current.y=clamp(d.v,-1,1)*1000;
  change(value,!swiped.current);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const hidden=!compact||dragging;
 return <div ref={root} className="companion-chat" data-compact={compact} data-home={visible} data-dragging={dragging} data-mood={mood}>
  <header className="companion-nav" hidden={!visible}>
   <button type="button" className="companion-icon" aria-label={compact?'展开小N':'缩小小N，查看对话'} onClick={e=>change(!compact,e.detail===0)}><ChevronDown size={20}/></button>
   <h1>小N</h1><button type="button" className="companion-settings" aria-label="我的与设置" onClick={onSettings}><span className="companion-dot" data-live={running}/><span>{running?'语音中':'自由聊'}</span><Settings size={15}/></button>
  </header>
  <div className="companion-mini" ref={mini} aria-hidden={hidden||!visible} inert={hidden||!visible} hidden={!visible}>
   <div className="companion-mini-copy"><strong>{status}</strong><small>{running?(muted?'麦克风已静音':'语音对话持续中'):'随时接着聊'}</small></div>
   <button type="button" className="companion-icon" aria-label={muted?'打开麦克风':'静音麦克风'} aria-pressed={muted} disabled={disabled} onClick={onToggleMute}>{muted?<MicOff size={18}/>:<Mic size={18}/>}</button>
   <button type="button" className="companion-icon" aria-label="展开语音" onClick={e=>change(false,e.detail===0)}><Maximize2 size={17}/></button>
   <button type="button" className="companion-icon" aria-label={running?'结束语音对话':'开始语音对话'} disabled={disabled&&!running} onClick={onToggleConversation}>{running?<X size={18}/>:<Play size={17}/>}</button>
  </div>
  <div className="companion-messages" ref={body} aria-hidden={visible&&hidden} inert={visible&&hidden} id="companion-transcript">{children}</div>
  <div className="companion-voice-surface" ref={surface} hidden={!visible}/>
  <div className="companion-full-title" ref={title} hidden={!visible} aria-hidden={compact}><strong>我在，慢慢聊。</strong><small role="status">{status}</small></div>
  <button ref={pet} type="button" className="companion-pet" hidden={!visible} aria-label="按住小N向下拉，切换语音与聊天" aria-expanded={!compact} aria-controls="companion-transcript"
   onPointerDown={down} onPointerMove={move} onPointerUp={e=>release(e)} onPointerCancel={e=>release(e,true)} onClick={e=>{if(e.detail===0)change(!compact,true);}}>
   <div ref={art} className="companion-pet-art"><Mascot mood={mood} look svgRef={portrait}/></div>
  </button>
  <div className="companion-full-caption" ref={caption} hidden={!visible} aria-hidden={compact} inert={compact}>
   <div className="companion-wave" ref={bars} aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i}/>)}</div>
   <p>{subtitle}</p>
   <button type="button" className="companion-pull-pill" onClick={()=>change(true)}><ChevronDown size={13}/> 下拉或点此查看聊天记录</button>
  </div>
  <div className="companion-voice-controls" ref={controls} hidden={!visible} aria-hidden={compact} inert={compact}>
   <div className="companion-ctrl-item">
    <button type="button" className="companion-icon" aria-label={muted?'打开麦克风':'静音麦克风'} aria-pressed={muted} disabled={disabled} onClick={onToggleMute}>{muted?<MicOff size={20}/>:<Mic size={20}/>}</button>
    <span>{muted?'已静音':'静音'}</span>
   </div>
   <div className="companion-ctrl-item">
    <button type="button" className={'companion-icon '+(running?'companion-end':'companion-start')} aria-label={running?'结束语音对话':'开始语音对话'} disabled={disabled&&!running} onClick={onToggleConversation}>{running?<PhoneOff size={22}/>:<Play size={22}/>}</button>
    <span>{running?'结束语音':'开始语音'}</span>
   </div>
   <div className="companion-ctrl-item">
    <button type="button" className="companion-icon" aria-label="切换到打字" onClick={()=>{change(true);onTyping();}}><Keyboard size={20}/></button>
    <span>打字</span>
   </div>
  </div>
  <div className="companion-notice" hidden={!visible}>{notice}{micPhase==='listening'&&<button className="text-button" onClick={onFinish}>这句说完了</button>}</div>
  <div className={visible?'companion-composer':'talk-dock'} aria-hidden={visible&&hidden} inert={visible&&hidden}>{composer}</div>
 </div>;
}
