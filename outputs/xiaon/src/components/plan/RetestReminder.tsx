/** 所有者：zCode（第二期：月底复测提醒）。挂在首页（ChatPanel，安全拦截命中时不渲染）和 LearningPages page==='today' 顶部。
 * reminder = l.view.retestReminder（服务端 stages.retestReminder 算出、协调器复查，只指向已确认、未拒绝的月阶段）；只在 app 内提醒。
 * 「本月先不做」调 learning/stage/retest-decline，之后本月不再提；去复测用 navigate('explore','探索')（专业模式）。 */
import type { RetestReminder as RetestReminderData } from '../../../shared/learning-contracts';
import type { LearningUI } from '../../agents/useLearning';
const swallow=(p:Promise<unknown>)=>{void p.catch(()=>{});};
export type RetestReminderProps={reminder:RetestReminderData|null;where:'home'|'today';l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function RetestReminder({reminder,where,l,navigate}:RetestReminderProps){
 if(!reminder)return null;
 const text=where==='home'
  ?'这个月的目标快到期了。可以做一次专业模式复测，看看这个月的变化。'
  :`本月目标到 ${reminder.retestSuggestedAt} 结束。可以做一次专业模式复测，看看这个月的变化。`;
 return <div className="notice retest-reminder" role="status" aria-label="复测提醒">
  <p>{text}</p>
  <div className="quick-replies">
   <button className="primary" disabled={l.busy} onClick={()=>navigate('explore','探索')}>去做专业模式复测</button>
   <button disabled={l.busy} onClick={()=>swallow(l.run('learning/stage/retest-decline',{stageId:reminder.stageId}))}>本月先不做</button>
  </div>
 </div>;
}
