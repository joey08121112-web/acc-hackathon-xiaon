/** 所有者：zCode（改造五：记得你说过的小事 + 开场问候）。阶段 0 只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用。 */
import type { ConfirmMemoryDraft,Greeting,GreetingRequest,MemoryDraft,MemoryItem,Validation } from '../../../shared/learning-contracts';
import { notImplemented,type MemoryDraftCheck,type MemoryOfferInput,type RevampContext } from '../context';
/** 模型或进步卡提议的 memoryDraft；记忆关闭时必须拒绝。 */
export function validateMemoryDraft(candidate:unknown,check:MemoryDraftCheck):Validation<MemoryDraft>{void candidate;void check;throw notImplemented('validateMemoryDraft');}
/** 学生点确认后写成现有 MemoryItem（source: 'student_explicit'），经 ctx.events.remember。 */
export async function confirmMemoryDraft(input:ConfirmMemoryDraft,ctx:RevampContext):Promise<MemoryItem>{void input;void ctx;throw notImplemented('confirmMemoryDraft');}
/** 小N先开口。可提起一条记忆（写 memoryMentions）或用 latestSummary 做对比；记忆关闭时 memoryOff=true。 */
export async function greeting(input:GreetingRequest,ctx:RevampContext,signal?:AbortSignal):Promise<Greeting>{void input;void ctx;void signal;throw notImplemented('greeting');}
/** 本轮是否允许模型提议记忆（在阶段机允许 memoryDraft 之后再收紧，例如频率上限）。 */
export function shouldOfferMemory(input:MemoryOfferInput,ctx:RevampContext):boolean{void input;void ctx;throw notImplemented('shouldOfferMemory');}
