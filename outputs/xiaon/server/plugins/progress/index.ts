/** 所有者：Claude（改造三：一起思考 + 进步卡）。阶段 0 只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用。 */
import type { ConfirmProgressCard,MemoryDraft,ProgressCard,ProgressCardDraft } from '../../../shared/learning-contracts';
import { notImplemented,type ProgressDraftInput,type RevampContext } from '../context';
/** reflect 阶段：三栏草稿 + 一句记忆草稿（记忆关闭时为 null）。candidate 是模型本轮提议的 progressCardDraft（可能为空）。 */
export async function draftProgressCard(input:ProgressDraftInput,ctx:RevampContext,signal?:AbortSignal):Promise<{draft:ProgressCardDraft;memoryDraft:MemoryDraft|null}>{void input;void ctx;void signal;throw notImplemented('draftProgressCard');}
/** 学生点确认才保存；AI 草稿与学生文本分开存，空栏记为 skipped。 */
export async function confirmProgressCard(input:ConfirmProgressCard,ctx:RevampContext):Promise<ProgressCard>{void input;void ctx;throw notImplemented('confirmProgressCard');}
