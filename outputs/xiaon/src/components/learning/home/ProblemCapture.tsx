/** 所有者：zCode（改造二：说出卡点的三个入口）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ProblemRecord } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
/** open = ChatReply.askProblem。拍照 / 口述 / 从题库挑，确认后回调 onConfirmed。 */
export type ProblemCaptureProps={open:boolean;sessionId:string|null;l:LearningUI;onConfirmed:(problem:ProblemRecord)=>void};
export function ProblemCapture(props:ProblemCaptureProps){void props;return null;}
