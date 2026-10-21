/** 所有者：zCode（第二期：月阶段目标、拆周任务、月底复测提醒）。契约补丁只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用。
 * 周计划通过 ctx.planning()（现有计划引擎）生成和确认，不绕开现有版本与历史。月阶段是学习记录，不受记忆开关影响。 */
import type { MonthStage,RetestReminder } from '../../../shared/learning-contracts';
import { notImplemented,type MonthStageConfirmInput,type MonthStageDraftInput,type ProfessionalContext,type RetestDeclineInput,type RetestReminderInput } from '../context';
/** 由程序按等级选模块（需要加强优先，其次部分掌握），模型只负责措辞；返回 status 'draft'、revision 1 的草案，不自己写库（协调器过门控后写 monthStages）。 */
export async function draftMonthStage(input:MonthStageDraftInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<MonthStage>{void input;void ctx;void signal;throw notImplemented('draftMonthStage');}
/** 学生点「确认」或「暂不开始」后的新修订（revision+1，confirmation 由程序写 actor:'student'）；不自己写库。 */
export async function confirmMonthStage(input:MonthStageConfirmInput,ctx:ProfessionalContext):Promise<MonthStage>{void input;void ctx;throw notImplemented('confirmMonthStage');}
/** 学生拒绝复测：新修订写 retestDeclinedAt，本月不再提；不自己写库。 */
export async function declineRetest(input:RetestDeclineInput,ctx:ProfessionalContext):Promise<MonthStage>{void input;void ctx;throw notImplemented('declineRetest');}
/** 到期前 RETEST_REMIND_DAYS_BEFORE 天起提醒；没有已确认的本月阶段、或已拒绝时返回 null。只读。 */
export function retestReminder(input:RetestReminderInput,ctx:ProfessionalContext):RetestReminder|null{void input;void ctx;throw notImplemented('retestReminder');}
