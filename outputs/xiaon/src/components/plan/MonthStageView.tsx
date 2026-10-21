/** 所有者：zCode（第二期：月阶段目标）。挂载位与 props 由 Claude 第二期契约补丁定（见 交付/claude/CONTRACT-PHASE2.md）；桩阶段返回 null，计划页照旧。
 * 数据：l.view.monthStages（每个月阶段的最新修订）、l.view.professionalReports；路由 learning/stage/{draft,confirm}；周计划沿用 learning/confirm。不确认不生效。 */
import type { LearningUI } from '../../agents/useLearning';
/** 挂在 LearningPages page==='plan'，标题之下、原有计划草案之上。 */
export type MonthStageViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean};
export function MonthStageView(props:MonthStageViewProps){void props;return null;}
