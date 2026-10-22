import { useEffect,useRef,useState } from 'react';
import type { LearningUI } from '../../../agents/useLearning';
import type { ProgressCardDraft } from '../../../../shared/learning-contracts';
import { ProgressCardView } from './ProgressCardView';
type Props={l:LearningUI;blocked:boolean;navigate:(page:string,tab?:string)=>void};
/** One current learning fragment. All state and conclusions come from the server; local cache is an input draft. */
export function LearningLoopCard({l,blocked,navigate}:Props){
 const [opening,setOpening]=useState(false),[quote,setQuote]=useState(''),[correction,setCorrection]=useState(''),[editing,setEditing]=useState(false),[value,setValue]=useState(''),[draft,setDraft]=useState<ProgressCardDraft|null>(null);
 const v=l.view?.learningLoops?.at(-1),e=v?.episode,loop=e?.loop;
 const taskKey=e&&v?.task?`loop-${e.id}-${v.task.id}`:'';
 const keyRef=useRef(taskKey);keyRef.current=taskKey;
 useEffect(()=>{setValue(l.cache.drafts[taskKey]??v?.draft??'');setDraft(null);},[taskKey]); // eslint-disable-line react-hooks/exhaustive-deps
 // Save to the same episode after a typing pause. The immediate local cache also survives refresh while a request is pending.
 useEffect(()=>{
  if(!e||!loop||e.status==='closed'||l.busy||l.cache.pending||blocked||l.view?.paused||value===loop.draft)return;
  const timer=setTimeout(()=>{void l.run('learning/loop',{action:'draft',episodeId:e.id,expectedRevision:e.revision,value}).catch(()=>{});},800);
  return()=>clearTimeout(timer);
 },[value,e?.revision,l.busy,l.cache.pending,blocked,l.view?.paused]); // eslint-disable-line react-hooks/exhaustive-deps
 const act=(action:string,extra:Record<string,unknown>={})=>e?l.run<{progressCardDraft?:ProgressCardDraft}>('learning/loop',{action,episodeId:e.id,expectedRevision:e.revision,...extra}):Promise.reject();
 const attempt=()=>{const key=taskKey;void act('submit',{value}).then(()=>{l.update({drafts:{...l.cache.drafts,[key]:''}});if(keyRef.current===key)setValue('');}).catch(()=>{});};
 if(blocked||!l.connected)return null;
 if(l.error.includes('请先查看求助与安全支持'))return <p className="safety-link" role="alert"><button onClick={()=>navigate('help')}>查看求助与安全支持</button></p>;
 if(!loop||e?.status==='closed')return <section className="home-card learning-loop-entry" aria-label="一起看负号">
  {e?.status==='closed'&&<p className="small">这次已收好。{v?.summary}</p>}
  <button className="secondary" disabled={l.busy||l.view?.paused} onClick={()=>setOpening(x=>!x)}>一起看看去括号的负号</button>
  {opening&&<div className="loop-start"><label className="field">你卡在哪一步？<textarea maxLength={200} rows={2} value={quote} onChange={ev=>setQuote(ev.target.value)} placeholder="比如：第二项总忘记变号"/></label>
   <p className="small muted">先试一步，再决定要不要提示或新题核对，随时可结束。</p>
   {!l.view?.attempts.some(a=>l.view?.tasks.find(t=>t.id===a.taskId)?.knowledgePoints.includes('like-terms'))?<><p className="small">先用一道小题看看合并同类项；不需要重新测评。</p><button disabled={l.busy} onClick={()=>{const t=l.view?.tasks.find(t=>t.id==='b-like-observation');if(t){l.choose(t);navigate('task');}}}>先试合并同类项</button></>:
    <button className="primary" disabled={l.busy||!quote.trim()} onClick={()=>void l.run('learning/loop',{action:'start',quote:quote.trim()}).then(()=>setOpening(false)).catch(()=>{})}>从这一步开始</button>}
   <button className="text-button" onClick={()=>setOpening(false)}>今天先不做</button>
  </div>}
 </section>;
 const hypothesis=loop.hypotheses.at(-1)!;
 const confirmed=hypothesis.status!=='proposed';
 const disabled=l.busy||l.view?.paused;
 const feedback=v?.currentGrade;
 return <section className="home-card learning-loop" aria-label="去括号负号学习片段" aria-busy={l.busy}>
  <div className="loop-title"><span className="eyebrow">{loop.phase==='verification'?'同类新题核对':'一起试一步'}</span><span className="small muted">去括号负号处理</span></div>
  <p className="small muted">你说：{loop.hypotheses[0].quote}</p>
  <div className="loop-hypothesis"><p>{hypothesis.text}</p><span className="small muted">{hypothesis.status==='proposed'?`${hypothesis.source==='model'?'AI':'规则'}提出 · 待你核实`:hypothesis.status==='corrected'?'你已更正 · 按这一步提供帮助':'你已确认'}</span></div>
  {!confirmed&&<div className="home-card-actions"><button disabled={disabled} onClick={()=>void act('confirm').catch(()=>{})}>是这个卡点</button><button disabled={disabled} onClick={()=>setEditing(x=>!x)}>我想纠正</button></div>}
  {confirmed&&<button className="text-button" disabled={disabled} onClick={()=>setEditing(x=>!x)}>修改卡点</button>}
  {editing&&<form onSubmit={ev=>{ev.preventDefault();void act('correct',{text:correction.trim()}).then(()=>setEditing(false)).catch(()=>{});}}><label className="field">实际卡点<textarea rows={2} maxLength={200} value={correction} onChange={ev=>setCorrection(ev.target.value)}/></label><button disabled={disabled||!correction.trim()}>按我的更正继续</button></form>}
  {l.view?.paused?<div role="status"><p>已暂停，题目、尝试和草稿都保留。</p><button className="primary" disabled={l.busy} onClick={()=>void l.resume().catch(()=>{})}>继续这次学习</button></div>:<>
   <p className="loop-question">{v?.task?.question}</p>
   {confirmed&&e.stage==='think'&&<form className="loop-answer" onSubmit={ev=>{ev.preventDefault();attempt();}}>
    <label className="field">{loop.phase==='verification'?'新题的首次尝试':'我的一步尝试'}<textarea rows={2} maxLength={2000} value={value} onChange={ev=>{setValue(ev.target.value);l.update({drafts:{...l.cache.drafts,[taskKey]:ev.target.value}});}} placeholder="写现在的想法或一步算式"/></label>
    <button className="primary" disabled={disabled||!value.trim()}>保存尝试并核对</button>
   </form>}
   {feedback&&<p className="notice" role="status">{feedback.verdict==='correct'?'结果正确。':feedback.verdict==='incorrect'?'这一步还不等价，原始尝试已保存。':'作答已保存，结果待核查；不据此判断你不会。'}</p>}
   {v?.help.map((h,i)=><div className="loop-help" key={h.exposureId}><span className="small muted">{h.representation==='dialogue'?'本轮对话 · 保守计为帮助':h.representation==='sign_table'?'换种表示':`第${h.level}级帮助`} · 已记录</span><p>{h.text}</p>{i===v.help.length-1&&<span className="small">可以继续当前题，也可以结束。</span>}</div>)}
   {confirmed&&<div className="home-card-actions"><button className="secondary" disabled={disabled} onClick={()=>void act('help').catch(()=>{})}>{v!.help.filter(h=>h.level>0).length>=3?'换种表示帮我':'给这一步一点提示'}</button>{e.stage==='reflect'&&<button disabled={disabled} onClick={()=>void act('continue').then(()=>setDraft(null)).catch(()=>{})}>继续当前题</button>}</div>}
   <p className="loop-summary" role="status">{v?.summary}</p>
   {loop.phase==='practice'&&<div className="home-card-actions"><button className="primary" disabled={disabled||!confirmed} onClick={()=>void act('verify').then(()=>setDraft(null)).catch(()=>{})}>用一道未见同类题核对</button><button className="text-button" disabled={disabled} onClick={()=>void act('skip').catch(()=>{})}>这次不核对，先回顾</button></div>}
   {loop.phase==='verification'&&<p className="small muted">这只是同子技能的换数题，不代表跨情境迁移或长期掌握。求助和修改都会保留。</p>}
   {e.stage==='think'?<button className="text-button" disabled={disabled} onClick={()=>void act('end').catch(()=>{})}>先结束，看看做到哪里</button>:<>
    {loop.ending==='budget'&&<p>这次先到这里。可以换种方法、回顾或休息。</p>}
    <button className="secondary" disabled={disabled} onClick={()=>void act('draft_card').then(out=>setDraft(out.progressCardDraft??null)).catch(()=>{})}>写回顾，也可以跳过</button>
    {draft&&<p className="small muted">小N草稿已按本次记录核对；你编辑的感受是学生自述，不改变评分。</p>}
    <ProgressCardView draft={draft} sessionId={e.sessionId} memoryEnabled={l.view?.optionalMemory??false} l={l} navigate={navigate}/>
    <button className="text-button" disabled={disabled} onClick={()=>void l.run('learning/progress-card/confirm',{sessionId:e.sessionId,episodeId:e.id,aiDraft:null,breakthrough:null,method:null,nextTry:null,confidence:null}).catch(()=>{})}>跳过总结和信心</button>
    <button className="text-button" disabled={disabled} onClick={()=>void l.run('learning/generate',{timeBudgetMinutes:6,knowledgePointId:'negative-brackets'}).then(()=>navigate('plan')).catch(()=>{})}>看看复习建议，由我确认</button>
   </>}
  </>}
  {v!.attempts.length>0&&<details><summary>查看已保存的尝试（{v!.attempts.length}）</summary>{v!.attempts.map((a,i)=><p className="loop-saved" key={a.id}>{i===0?'首次':'修改'}：{a.value}</p>)}</details>}
  {l.cache.pending?.path==='learning/loop'&&!l.busy&&<button className="text-button" onClick={()=>void l.retry().catch(()=>{})}>重试刚才的操作</button>}
 </section>;
}
