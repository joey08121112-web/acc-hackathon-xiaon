/** 所有者：ChatGPT（改造一：首页综合模式）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ChatIntent,ChatReply } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
export type HomeChatProps={l:LearningUI;reply:ChatReply|null;send:(text:string,extra?:{intent?:ChatIntent;problemId?:string})=>void;navigate:(page:string,tab?:string)=>void};
export function HomeChat(props:HomeChatProps){void props;return null;}
