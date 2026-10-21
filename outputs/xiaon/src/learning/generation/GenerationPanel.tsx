import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { LearningUI } from '../../agents/useLearning';
import type { GenerationRecord,TaskPublicView } from '../../../shared/learning-contracts';
import { basisLabels,difficultyLabels,focusLabels,generationNotice,reasonLabels,type GenerationKnowledgePoint } from './index';
type Result={status:GenerationRecord['status'];generation:GenerationRecord;task:TaskPublicView|null};
type State={kind:'idle'}|{kind:'waiting'}|{kind:'done';result:Result}|{kind:'failed';message:string};
/** Explicit student action. Publishing never opens the task; the student confirms on the task page first. */
export function GenerationPanel({l,knowledgePointId,purpose,review=null,navigate,safety=false}:{l:LearningUI;knowledgePointId:GenerationKnowledgePoint;purpose:'practice'|'review';review?:{id:string;revision:number}|null;navigate:(page:string,tab?:string)=>void;safety?:boolean}){
 const [state,setState]=useState<State>({kind:'idle'});
 const v=l.view;if(!v)return null;
 const unseen=v.tasks.find(t=>t.knowledgePoints.includes(knowledgePointId)&&t.eligible&&!v.exposures.some(e=>e.taskId===t.id)&&!v.attempts.some(a=>a.taskId===t.id));
 const start=(task:TaskPublicView)=>{l.choose(task,purpose==='review'?'review':'support');l.update({reviewLink:review});navigate('task');};
 const generate=async()=>{
  setState({kind:'waiting'});
  try{const result=await l.run<Result>('learning/generate-task',{knowledgePointId,purpose,reviewItemId:review?.id??null,timeBudgetMinutes:6});setState({kind:'done',result});}
  catch(e){setState({kind:'failed',message:(e as Error).name==='AbortError'?'已取消出题；迟到的结果不会发布，也不会自动开题。':(e as Error).message});}
 };
 const disabled=l.busy||v.paused||safety||!v.generationAvailable;
 return <section className="info-paper generation-panel" aria-label="根据这个环节出新题">
  <span className="eyebrow"><Sparkles size={14}/> 新出一道同类题</span>
  {unseen&&<button className="secondary wide" disabled={l.busy||safety||v.paused} onClick={()=>start(unseen)}>题库里还有未做过的同类题，先做这道</button>}
  {!v.generationAvailable&&<p className="notice">未配置模型，暂时不能出新题；原题库照常可用。</p>}
  {state.kind!=='waiting'&&<button className={unseen?'text-button':'primary wide'} disabled={disabled} onClick={()=>void generate()}>根据这个环节出一道新题（约 2–4 分钟）</button>}
  {state.kind==='waiting'&&<div className="notice" role="status">小N正在出题，程序会核对题面、答案和每一步…<button onClick={l.cancel}>取消</button></div>}
  {state.kind==='failed'&&<p className="notice error" role="alert">{state.message}</p>}
  {state.kind==='done'&&state.result.status==='rejected'&&<p className="notice" role="status">这次的候选没有通过程序核对（{[...new Set(state.result.generation.candidates.flatMap(c=>c.reasons))].map(r=>reasonLabels[r]??r).join('、')}），没有发布任何题目。可以再试一次，或先用原题库。</p>}
  {state.kind==='done'&&state.result.status==='published'&&state.result.task&&(()=>{const g=state.result.generation,t=state.result.task;return <div className="learning-statement" aria-label="新出的题">
   <h3>这道题针对：{focusLabels[g.focus??'']??'这个环节'}</h3>
   <p>{basisLabels[g.basis]}{g.attemptIds.length?`（参考 ${g.attemptIds.length} 次作答记录）`:''}</p>
   <p className="small">{difficultyLabels[t.difficulty]} · 约 {t.estimatedMinutes} 分钟 · 确认后才展示题面并记录</p>
   <p className="small">{generationNotice}</p>
   <button className="primary wide" disabled={l.busy||safety||v.paused} onClick={()=>start(t)}>确认后开始这道新题</button>
  </div>;})()}
 </section>;
}
