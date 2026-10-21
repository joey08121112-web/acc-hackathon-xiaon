/** 所有者：zCode（改造二：成长页错题列表）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { LearningUI } from '../../../agents/useLearning';
/** 挂在成长页（LearningPages page==='growth'）；数据来自 l.view.problems。 */
export type ProblemListProps={l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function ProblemList(props:ProblemListProps){void props;return null;}
