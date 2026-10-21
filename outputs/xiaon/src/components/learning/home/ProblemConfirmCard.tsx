/** 所有者：zCode（改造二：错题记录确认）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ProblemDraft,ProblemRecord } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
/** draft = ChatReply.problemDraft 或识题结果；确认调用 learning/problem/confirm。 */
export type ProblemConfirmCardProps={draft:ProblemDraft|null;sessionId:string|null;l:LearningUI;onConfirmed:(problem:ProblemRecord)=>void};
export function ProblemConfirmCard(props:ProblemConfirmCardProps){void props;return null;}
