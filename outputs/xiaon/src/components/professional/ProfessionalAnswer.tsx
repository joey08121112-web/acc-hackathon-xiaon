/** 所有者：ChatGPT。复用已有语音输入；识别后先填草稿，学生点击才提交。 */
import { useEffect, useRef } from 'react';
import type { InterviewSession, TaskPublicView } from '../../../shared/learning-contracts';
import type { LearningUI } from '../../agents/useLearning';
import { useMic } from '../../voice/mic';
export function ProfessionalAnswer({l,interview,task,disabled,onAnswer,onHint}:{l:LearningUI;interview:InterviewSession;task:TaskPublicView|null;disabled:boolean;onAnswer:(text:string)=>Promise<boolean>;onHint:()=>void}){
 const mic=useMic(),form=useRef<HTMLFormElement>(null),mounted=useRef(true),pending=interview.pending!;
 const key='interview:'+interview.id+':'+pending.askedAt+':'+pending.kind;
 const draft=l.cache.drafts[key]??'';
 const setDraft=(text:string)=>l.update({drafts:{...l.cache.drafts,[key]:text.slice(0,2000)}});
 useEffect(()=>{
  mounted.current=true;
  const viewport=window.visualViewport;
  const resize=()=>{if(form.current?.contains(document.activeElement))form.current.scrollIntoView({block:'nearest',behavior:'instant'});};
  viewport?.addEventListener('resize',resize);
  return()=>{mounted.current=false;viewport?.removeEventListener('resize',resize);mic.actions.cancel();};
 },[]); // The key remounts the composer on a different pending question.
 const recording=mic.phase!=='idle';
 const hint=l.view?.exposures.filter(e=>e.sessionId===interview.learningSessionId&&e.taskId===pending.task.taskId&&e.taskVersion===pending.task.taskVersion&&e.kind==='hint').at(-1);
 return <>
  {task?.visual&&<div className="professional-visual" aria-label="旋转题图形"><p>图形绕给定中心顺时针转 {task.visual.clockwiseDegrees}°，请选择转动后的位置。</p>{[{label:'原图',points:task.visual.points},...task.visual.options].map(v=><figure key={v.label}><svg viewBox="-4 -4 8 8" role="img" aria-label={v.label+'，坐标 '+v.points.map(p=>p.join(',')).join('；')}><g transform="scale(1,-1)"><path d="M-4 0H4M0-4V4" stroke="#c4ccbc" strokeWidth=".04"/><polygon points={v.points.map(p=>p.join(',')).join(' ')} fill="#b7c9a0" stroke="#3e624c" strokeWidth=".08"/><circle cx={task.visual!.center[0]} cy={task.visual!.center[1]} r=".1" fill="#3e624c"/></g></svg><figcaption>{v.label}</figcaption></figure>)}</div>}
  {pending.kind!=='follow_up'&&task?.choices.length? <div className="professional-choices" aria-label="选择一个想法">{task.choices.map(c=><button className="secondary" key={c} type="button" aria-pressed={draft===c.split(':')[0]} disabled={disabled||recording} onClick={()=>setDraft(c.split(':')[0])}>{c}</button>)}</div>:null}
  <form className="professional-composer" ref={form} onSubmit={e=>{e.preventDefault();if(!disabled&&!recording&&draft.trim())void onAnswer(draft.trim()).then(ok=>{if(ok&&mounted.current)setDraft('');});}}>
   <label className="field">我的回答<textarea rows={3} maxLength={2000} value={draft} disabled={disabled||recording} onChange={e=>setDraft(e.target.value)} onFocus={()=>requestAnimationFrame(()=>form.current?.scrollIntoView({block:'nearest'}))} placeholder={pending.kind==='follow_up'?'慢慢说说你是怎么想的…':'写下你的想法，也可以另起一行说说理由…'}/></label>
   <div className="home-card-actions"><button className="primary" disabled={disabled||recording||!draft.trim()}>告诉小N</button><button className="secondary" type="button" disabled={mic.engine==='none'||(disabled&&!recording)} onClick={()=>{if(mic.phase==='listening')mic.actions.stop();else if(recording)mic.actions.cancel();else void mic.actions.start(text=>{if(mounted.current)setDraft(text);});}}>{mic.phase==='listening'?'说完了':recording?'取消识别':'用话筒回答'}</button></div>
   {mic.engine==='none'?<p className="small muted">这个浏览器暂不支持语音，打字也一样。</p>:<p className="small muted">{mic.engine==='server'?'声音会发送给火山引擎豆包转成文字，服务端不保存录音。':'声音由浏览器的识别服务转成文字，可能由浏览器厂商处理。'}识别后可以修改，再点「告诉小N」。</p>}
   {(mic.interim||mic.error)&&<p role="status">{mic.interim||mic.error}</p>}
  </form>
  {task?.hintAvailable&&pending.kind!=='follow_up'&&<button className="text-button" disabled={disabled||recording} onClick={onHint}>给一点小提示</button>}
  {hint&&<p className="notice">小提示：{hint.contentSnapshot}（会如实记录提示后完成）</p>}
 </>;
}
