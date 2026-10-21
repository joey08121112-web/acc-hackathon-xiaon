/** 所有者：zCode（第二期：月阶段目标）。挂在 LearningPages page==='plan'，标题之下、原有计划草案之上。
 * 数据：l.view.monthStages（最新修订）、l.view.professionalReports；路由 learning/stage/{draft,confirm,retest-decline}。
 * 不确认不生效；模块由服务端程序按等级选（需要加强优先），前端不替程序选模块。 */
import { useState } from 'react';
import type { LearningUI } from '../../agents/useLearning';
import { MODULE_LEVEL_LABELS,type MonthStage } from '../../../shared/learning-contracts';
import { shanghaiDate } from '../../learning/review';
import { weekLabel } from './calendar';
const swallow=(p:Promise<unknown>)=>{void p.catch(()=>{});};
const STATUS_LABELS:Record<MonthStage['status'],string>={draft:'待你确认',confirmed:'已定下',deferred:'本月暂不开始',superseded:'已有新草案'};
export type MonthStageViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean};
export function MonthStageView({l,navigate,safety}:MonthStageViewProps){
 const v=l.view;const [edited,setEdited]=useState<string|null>(null);
 if(!v)return null;
 const month=shanghaiDate(v.now).slice(0,7);
 const stage=v.monthStages.filter(s=>s.month===month&&s.status!=='superseded').at(-1)??null;
 const busy=l.busy||safety;
 if(!stage){
  const report=v.professionalReports.at(-1)??null;
  if(!report)return null;
  const canFocus=report.modules.some(m=>m.level==='needs_work'||m.level==='partial');
  return <section className="info-paper month-stage" aria-label="本月目标">
   <span className="tag">本月目标</span>
   {canFocus?<>
    <p>最近一次专业模式评测出来了。可以根据它定一个这个月的小目标：从需要加强的模块里选一件具体的事，月底再做一次复测看看变化。</p>
    <button className="primary wide" disabled={busy} onClick={()=>swallow(l.run('learning/stage/draft',{reportId:report.id}))}>根据最近的评测定一个本月目标</button>
   </>:<p className="small">最近一次评测里测到的模块都掌握得不错，本月不用定加强目标。想看看变化，可以随时再做一次专业模式。</p>}
  </section>;
 }
 const level=v.professionalReports.find(r=>r.id===stage.sourceReportId)?.modules.find(m=>m.module===stage.module)?.level??null;
 const text=edited??stage.goal;
 const confirm=(action:'accept'|'defer')=>swallow(l.run('learning/stage/confirm',{stageId:stage.id,expectedRevision:stage.revision,action,goal:text.trim()||stage.goal}).then(()=>setEdited(null)));
 return <section className="info-paper month-stage" aria-label="本月目标">
  <span className="tag">本月目标 · {STATUS_LABELS[stage.status]}</span>
  <h2>{stage.module}{level?` · ${MODULE_LEVEL_LABELS[level]}`:''}</h2>
  {stage.status==='confirmed'
   ?<p className="month-stage-goal">{stage.goal}</p>
   :<label className="field">目标文字（可以改成你自己的话）<textarea aria-label="本月目标" rows={2} maxLength={200} value={text} onChange={e=>setEdited(e.target.value)}/></label>}
  <p className="small">月底（{stage.retestSuggestedAt}）建议做一次专业模式复测，和这次比一比。</p>
  {stage.status==='confirmed'&&<div className="month-stage-weeks">{stage.weeks.map(w=>{
   const planned=w.proposalId&&(v.plans.some(p=>p.snapshot.proposalId===w.proposalId)||v.proposal?.id===w.proposalId);
   return <p className="small" key={w.weekStart}>{weekLabel(w.weekStart)}：{planned?'已安排周任务':'还没安排任务'}</p>;
  })}</div>}
  {stage.status!=='confirmed'&&<div className="quick-replies">
   <button className="primary" disabled={busy||!text.trim()} onClick={()=>confirm('accept')}>定下这个目标</button>
   {stage.status==='draft'&&<button disabled={busy} onClick={()=>confirm('defer')}>暂不开始</button>}
  </div>}
  <button className="text-button" onClick={()=>navigate('report','成长')}>看看评测依据</button>
 </section>;
}
