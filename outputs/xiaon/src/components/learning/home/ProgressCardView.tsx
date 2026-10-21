/** 所有者：Claude（改造三：进步卡）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ProgressCardDraft } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
/** draft = ChatReply.progressCardDraft；三栏可编辑、可跳过，确认调用 learning/progress-card/confirm。 */
export type ProgressCardViewProps={draft:ProgressCardDraft|null;sessionId:string|null;memoryEnabled:boolean;l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function ProgressCardView(props:ProgressCardViewProps){void props;return null;}
