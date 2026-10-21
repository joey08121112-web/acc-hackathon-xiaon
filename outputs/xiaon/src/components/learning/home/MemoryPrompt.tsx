/** 所有者：zCode（改造五：记忆草稿确认）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { MemoryDraft } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
/** draft = ChatReply.memoryDraft；确认调用 learning/memory/confirm-draft。 */
export type MemoryPromptProps={draft:MemoryDraft|null;sessionId:string|null;memoryEnabled:boolean;l:LearningUI};
export function MemoryPrompt(props:MemoryPromptProps){void props;return null;}
