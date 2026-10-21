/** 所有者：zCode（第二期：长期趋势）。契约补丁只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用（GET /api/learning/trend）。
 * TrendPoint 由报告推导、不单独存库：每个点的等级必须与来源报告一致（协调器校验）。 */
import type { TrendQuery } from '../../../shared/learning-contracts';
import { notImplemented,type ProfessionalContext,type TrendInput } from '../context';
/** latest：每月每模块一点，同月多次测评取最近一次；history：全部报告的点，按时间排列。只读。 */
export function trend(input:TrendInput,ctx:ProfessionalContext):TrendQuery{void input;void ctx;throw notImplemented('trend');}
