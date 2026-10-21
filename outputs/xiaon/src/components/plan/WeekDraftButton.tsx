/** Student-only entry for this week's missing draft. Uses the normal proposal confirmation controls. */
import type { MonthStage } from '../../../shared/learning-contracts';
import type { LearningUI } from '../../agents/useLearning';
import { shanghaiDate } from '../../learning/review';
import { mondayOf } from './calendar';
export function WeekDraftButton({stage,l,navigate,safety}:{stage:MonthStage;l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean}){
 const today=l.view?shanghaiDate(l.view.now):null;
 const week=stage.weeks.find(w=>w.weekStart===(today?mondayOf(today):null));
 if(stage.status!=='confirmed'||stage.retestDeclinedAt||!today||stage.month!==today.slice(0,7)||!week||week.proposalId)return null;
 const draft=()=>{void l.run('learning/stage/week-draft',{stageId:stage.id,expectedRevision:stage.revision}).then(()=>navigate('plan','成长')).catch(()=>{});};
 return <button className="primary" disabled={l.busy||safety} onClick={draft}>生成这一周的任务</button>;
}
