/** 所有者：ChatGPT（改造一：对话小结界面）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ConversationSummary } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
/** summary = ChatReply.summary（道别时）或 /api/learning/conversation/end 的返回。 */
export type ConversationSummaryViewProps={summary:ConversationSummary|null;l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function ConversationSummaryView(props:ConversationSummaryViewProps){void props;return null;}
