/** 所有者：ChatGPT（第二期：专业模式面试界面）。挂载位与 props 由 Claude 第二期契约补丁定（见 交付/claude/CONTRACT-PHASE2.md）；桩阶段返回 null，探索页照旧显示五维地图。
 * 数据：l.view.interviews（每个测评的最新修订）、l.view.interviewTurns；路由 learning/interview/{start,answer,pause,resume,report}。学生点「开始」才开始。 */
import type { LearningUI } from '../../agents/useLearning';
/** 挂在 LearningPages page==='explore'，五维地图之上。safety = 本次安全拦截已命中（不开始、不作答）。 */
export type ProfessionalModeViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void;safety:boolean};
export function ProfessionalModeView(props:ProfessionalModeViewProps){void props;return null;}
