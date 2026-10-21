/** 所有者：ChatGPT。H2 专业模式；只消费冻结契约，不在客户端判级。 */
import { useEffect, useRef, useState } from 'react';
import { INTERVIEW_MODULE_ORDER, INTERVIEW_REQUIRED_MODULES, type InterviewStep, type ProfessionalReport, type ToolResult } from '../../../shared/learning-contracts';
import type { LearningUI } from '../../agents/useLearning';
import { useDevMode } from '../../agents/devMode';
import { ProfessionalAnswer } from './ProfessionalAnswer';
export type ProfessionalModeViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean};
export function ProfessionalModeView({l,navigate,safety}:ProfessionalModeViewProps){
 const dev=useDevMode(),[step,setStep]=useState<InterviewStep|null>(null),[notice,setNotice]=useState(''),[working,setWorking]=useState(false);
 const lock=useRef(false),mounted=useRef(true),pauseAfter=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const interview=[...(l.view?.interviews??[])].filter(i=>i.status!=='completed').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]??null;
 const latest=interview??[...(l.view?.interviews??[])].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const blocked=safety||!!step?.safety,disabled=l.busy||working||!l.connected;
 const ready=!!latest&&INTERVIEW_REQUIRED_MODULES.every(m=>latest.completedModules.includes(m));
 const pending=interview?.status==='in_progress'?interview.pending:null;
 const task=pending?(step?.interview?.id===interview?.id&&step.task?.id===pending.task.taskId&&step.task.version===pending.task.taskVersion?step.task:l.view?.tasks.find(t=>t.id===pending.task.taskId&&t.version===pending.task.taskVersion)):null;
 const turns=(l.view?.interviewTurns??[]).filter(t=>t.interviewId===interview?.id).sort((a,b)=>a.seq-b.seq);
 useEffect(()=>{if(pauseAfter.current&&!working&&!l.busy){pauseAfter.current=false;void act('pause');}},[working,l.busy]);
 const pause=()=>{if(working||l.busy){pauseAfter.current=true;l.cancel();setNotice('正在保存暂停位置…');}else void act('pause');};
 async function act(kind:'start'|'resume'|'pause'|'answer'|'report'|'hint',text?:string){
  if(lock.current||disabled||blocked)return false;
  lock.current=true;setWorking(true);setNotice('');
  try{
   const ref=interview??latest;
   if(kind==='report'){
    if(!ref)return false;
    await l.run<ProfessionalReport>('learning/interview/report',{interviewId:ref.id});
    if(mounted.current&&!pauseAfter.current)navigate('report','成长');return true;
   }
   if(kind==='pause'){
    if(!interview){navigate('home','小N');return true;}
    await l.run('learning/interview/pause',{interviewId:interview.id});
    if(mounted.current)navigate('home','小N');return true;
   }
   if(kind==='hint'){
    if(!interview||!pending)return false;
    const hint=await l.run<ToolResult>('learning/hint',{sessionId:interview.learningSessionId,...pending.task,level:1});
    if(!hint.ok)throw new Error(hint.error.message);
    if(mounted.current)setNotice('需要提示也没关系，这次会如实记下。');return true;
   }
   const body=kind==='start'?{}:kind==='answer'?{interviewId:interview!.id,expectedRevision:interview!.revision,text}:{interviewId:interview!.id};
   const next=await l.run<InterviewStep>('learning/interview/'+kind,body);
   if(mounted.current){setStep(next);if(next.interview?.status==='paused'&&!next.safety)navigate('home','小N');}
   return !next.safety;
  }catch(e){
   if(mounted.current){l.setError('');setNotice(dev?(e as Error).message:'这一步暂时没完成，已有记录和作答草稿还在。可以稍后重试；功能尚未接通时也会显示这条提醒。');}
   return false;
  }finally{lock.current=false;if(mounted.current)setWorking(false);}
 }
 return <section className="professional professional-mode" aria-label="专业模式测评" aria-busy={working}>
  <div className="professional-heading"><span className="eyebrow">跟着小N，一站一站来</span><h2>一起看看你的思考方式</h2><p>本次观察，不打总分，不排名。</p></div>
  <ol className="professional-progress" aria-label="五模块进度">{INTERVIEW_MODULE_ORDER.map((m,i)=><li key={m} data-state={latest?.completedModules.includes(m)?'done':interview?.currentModule===m?'current':'waiting'} aria-current={interview?.currentModule===m?'step':undefined}><span>{latest?.completedModules.includes(m)?'✓':i+1}</span><strong>{m}</strong><small>{latest?.completedModules.includes(m)?'已完成':interview?.currentModule===m?'在这里':'待探索'}</small></li>)}</ol>
  {blocked?<div className="notice" role="alert"><p>{step?.safety?step.text:'学习先暂停，先照顾好自己。'}</p><button className="primary" onClick={()=>navigate('help')}>查看求助与安全支持</button><button className="text-button" onClick={()=>navigate('home','小N')}>先暂停</button></div>:<>
   {!interview&&<div className="professional-intro"><p>先用约 10–15 分钟试试，实际时间按你的节奏。理解 → 逻辑 → 计算 → 建模 → 空间想象，五个模块依次进行，可以随时暂停。</p><p>先完成理解和逻辑，就能看看本次报告。还没测的模块会如实标记。</p><div className="home-card-actions"><button className="primary" disabled={disabled} onClick={()=>void act('start')}>开始</button><button className="secondary" disabled={disabled} onClick={()=>navigate('home','小N')}>先回首页</button></div></div>}
   {interview?.status==='paused'&&<div className="professional-intro"><h3>上次停在：{interview.currentModule??'整理报告'}</h3><p>已完成的部分留着，我们从停下的地方继续。</p><button className="primary" disabled={disabled} onClick={()=>void act('resume')}>继续测评</button></div>}
   {interview&&<div className="professional-controls"><button className="secondary" disabled={!l.connected} onClick={pause}>先暂停</button><span className="small">不用赶进度，想休息就停一停。</span></div>}
   {interview?.status==='in_progress'&&<>
    {turns.length>0&&<details className="professional-history"><summary>回看刚才的对话（{turns.length}）</summary>{turns.map(t=><div key={t.id}><p className="professional-bubble">小N：{t.prompt}</p><p className="professional-bubble student">我：{t.answer}</p></div>)}</details>}
    {pending?<div className="professional-question"><span className="tag">{pending.module} · {pending.kind==='follow_up'?'再说说你的想法':pending.kind==='transfer'?'换个同类的小问题':'这一站的小问题'}</span><p className="professional-bubble" aria-live="polite">{step?.interview?.revision===interview.revision&&step.text?step.text:pending.prompt}</p>
     {task&&pending.kind!=='follow_up'&&task.question!==pending.prompt&&<p className="professional-task">{task.question}</p>}
     <ProfessionalAnswer key={interview.id+':'+pending.askedAt+':'+pending.kind} l={l} interview={interview} task={task??null} disabled={disabled} onAnswer={text=>act('answer',text)} onHint={()=>void act('hint')}/>
    </div>:<p className="notice">这一站暂时没有待答的问题。<button disabled={disabled} onClick={()=>void act('resume')}>接着看看</button></p>}
   </>}
   {!interview&&latest?.status==='completed'&&<p className="notice">这次五个模块都走过了，辛苦啦。</p>}
   {ready&&<button className="secondary wide" disabled={disabled} onClick={()=>void act('report')}>看看本次报告</button>}
   {(l.view?.professionalReports.length??0)>0&&<button className="text-button" onClick={()=>navigate('report','成长')}>查看已有评测报告</button>}
  </>}
  {notice&&<p className="notice" role="status">{notice}</p>}
  {dev&&latest&&<p className="small">测评 {latest.id} · 修订 {latest.revision} · {pending?.mode??latest.status}</p>}
 </section>;
}
