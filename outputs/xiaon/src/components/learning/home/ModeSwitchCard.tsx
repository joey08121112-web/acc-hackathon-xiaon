/** 所有者：ChatGPT（改造一：切到专业模式）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
import type { ModeSuggestion } from '../../../../shared/learning-contracts';
/** 学生点确认才切换；切换即 navigate('explore','探索')。 */
export type ModeSwitchCardProps={suggestion:ModeSuggestion|null;navigate:(page:string,tab?:string)=>void};
export function ModeSwitchCard(props:ModeSwitchCardProps){void props;return null;}
