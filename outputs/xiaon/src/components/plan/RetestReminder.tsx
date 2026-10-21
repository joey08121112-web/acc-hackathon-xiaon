/** 所有者：zCode（第二期：月底复测提醒）。挂载位与 props 由 Claude 第二期契约补丁定（见 交付/claude/CONTRACT-PHASE2.md）；桩阶段返回 null。
 * reminder = l.view.retestReminder（服务端 stages.retestReminder 经程序复查，只指向已确认、未拒绝的月阶段）；拒绝调用 learning/stage/retest-decline；去复测用 navigate('explore','探索')。只在 app 内提醒。 */
import type { RetestReminder as RetestReminderData } from '../../../shared/learning-contracts';
import type { LearningUI } from '../../agents/useLearning';
/** 挂在首页（ChatPanel，安全拦截命中时不显示）和 LearningPages page==='today' 顶部。 */
export type RetestReminderProps={reminder:RetestReminderData|null;where:'home'|'today';l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function RetestReminder(props:RetestReminderProps){void props;return null;}
