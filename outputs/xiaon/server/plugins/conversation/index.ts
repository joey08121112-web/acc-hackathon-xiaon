/** 所有者：Claude（综合模式：对话观察与对话小结）。阶段 0 只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用。 */
import type { ConversationSummary,ObservationDraft,Validation } from '../../../shared/learning-contracts';
import { notImplemented,type EndConversationInput,type ObservationCheck,type RevampContext } from '../context';
/** 只允许理解/逻辑；quote 逐字出自学生本场次原话；每维每场次最多 3 条；试探轮次以外一律拒绝。 */
export function validateObservation(candidate:unknown,check:ObservationCheck):Validation<ObservationDraft>{void candidate;void check;throw notImplemented('validateObservation');}
/** 学生点「今天先聊到这」或道别时生成小结并写入 summaries；不受记忆开关影响。 */
export async function endConversation(input:EndConversationInput,ctx:RevampContext,signal?:AbortSignal):Promise<ConversationSummary>{void input;void ctx;void signal;throw notImplemented('endConversation');}
/** 最近一份对话小结；问候用它做对比开场。 */
export function latestSummary(ctx:RevampContext):ConversationSummary|null{void ctx;throw notImplemented('latestSummary');}
