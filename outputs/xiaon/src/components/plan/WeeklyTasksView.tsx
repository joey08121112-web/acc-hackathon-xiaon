/** 所有者：zCode（第二期：今日页的本月目标与本周任务）。挂载位与 props 由 Claude 第二期契约补丁定（见 交付/claude/CONTRACT-PHASE2.md）；桩阶段返回 null，今日页照旧。
 * 数据：l.view.monthStages 的 weeks（周计划草案 / 版本）、l.view.plans、l.view.reviews；错过的任务不扣分、不堆积。 */
import type { LearningUI } from '../../agents/useLearning';
/** 挂在 LearningPages page==='today'，复测提醒之下、原有当前目标之上。 */
export type WeeklyTasksViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean};
export function WeeklyTasksView(props:WeeklyTasksViewProps){void props;return null;}
