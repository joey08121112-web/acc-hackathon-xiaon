/** 所有者：ChatGPT（第二期：评测报告页）。挂载位与 props 由 Claude 第二期契约补丁定（见 交付/claude/CONTRACT-PHASE2.md）；桩阶段返回 null，报告页照旧。
 * 数据：l.view.professionalReports（版本化快照，历史可切换）、l.view.observations；等级文字用 MODULE_LEVEL_LABELS；不显示总分或排名。进入月阶段规划用 navigate('plan','成长')。 */
import type { LearningUI } from '../../agents/useLearning';
/** 挂在 LearningPages page==='report'，标题之下、原有观察快照之上。 */
export type ProfessionalReportViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function ProfessionalReportView(props:ProfessionalReportViewProps){void props;return null;}
