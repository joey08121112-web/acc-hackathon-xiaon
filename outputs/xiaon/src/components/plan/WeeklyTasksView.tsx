/** 所有者：zCode（第二期：今日页的本月目标与本周任务）。挂在 LearningPages page==='today'，复测提醒之下、原有当前目标之上。
 * 数据：l.view.monthStages（本月已确认的阶段）、weeks 里的 proposalId 对应 l.view.plans / l.view.proposal；周计划草案与确认都走现有计划流程。
 * 只显示本周：错过的任务不扣分、不堆积，沿用现有规则。 */
import type { LearningUI } from '../../agents/useLearning';
import { shanghaiDate } from '../../learning/review';
import { mondayOf,weekLabel } from './calendar';
import { MONTH_PLAN_POINT_NAMES } from './pointNames';
const swallow=(p:Promise<unknown>)=>{void p.catch(()=>{});};
export type WeeklyTasksViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean};
export function WeeklyTasksView({l,navigate,safety}:WeeklyTasksViewProps){
 const v=l.view;if(!v)return null;
 const today=shanghaiDate(v.now);
 const stage=v.monthStages.find(s=>s.month===today.slice(0,7)&&s.status==='confirmed')??null;
 if(!stage)return null;
 const weekStart=mondayOf(today);
 const week=stage.weeks.find(w=>w.weekStart===weekStart)??null;
 const plan=week?.proposalId?v.plans.map(p=>p.snapshot).filter(p=>p.proposalId===week.proposalId).at(-1)??null:null;
 const proposal=!plan&&week?.proposalId&&v.proposal?.id===week.proposalId?v.proposal:null;
 const items=plan?.items??proposal?.items??[];
 const since=plan?.confirmation.confirmedAt??proposal?.createdAt??v.now;
 const done=(taskId:string|null)=>!!taskId&&v.attempts.some(a=>a.taskId===taskId&&a.sourceTime.recordedAt>=since);
 return <section className="info-paper weekly-tasks" aria-label="本月目标与本周任务">
  <span className="tag">本月目标 · {stage.module}</span>
  <h2>{stage.goal}</h2>
  <h3>本周任务（{weekLabel(weekStart)}）</h3>
  {!week?.proposalId&&<p className="small">这一周还没有安排任务。<button className="text-button" disabled={l.busy||safety} onClick={()=>navigate('plan','成长')}>去计划页看看</button></p>}
  {proposal&&<p className="notice">本周任务的草案还没确认，确认后才算数。<button disabled={l.busy||safety} onClick={()=>navigate('plan','成长')}>去确认（接受 / 减量 / 改期 / 暂不开始）</button></p>}
  {items.map(i=><div className="learning-statement" key={i.id}>
   <h3>{i.goal}</h3>
   <p>{MONTH_PLAN_POINT_NAMES[i.knowledgePointId]??i.knowledgePointId} · {i.scheduledDate} · {i.estimatedMinutes}分钟 · {done(i.task?.taskId??null)?'已有真实尝试':plan?(v.paused||i.status==='paused'?'已暂停':'等待自主开始'):'待确认'}</p>
  </div>)}
  {plan&&items.length>0&&<p className="small">{items.filter(i=>done(i.task?.taskId??null)).length} / {items.length} 已有尝试。错过的安排不扣分，也不集中堆积。</p>}
 </section>;
}
