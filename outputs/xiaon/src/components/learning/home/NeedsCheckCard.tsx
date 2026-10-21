/** 所有者：ChatGPT（改造一：确定需求）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ChatIntent } from '../../../../shared/learning-contracts';
/** open = ChatReply.needsCheck。三个选项：继续聊聊 → life，看看哪里没考好 → study，做个正式测试 → formal_test。 */
export type NeedsCheckCardProps={open:boolean;disabled:boolean;onChoose:(intent:ChatIntent,label:string)=>void};
export function NeedsCheckCard(props:NeedsCheckCardProps){void props;return null;}
