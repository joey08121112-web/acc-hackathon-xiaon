/** 所有者：zCode（改造二：错题记录与拍照识题）。阶段 0 只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用。 */
import type { ConfirmProblem,ProblemDraft,ProblemRecord,Recognize,RecognizeResult,Validation } from '../../../shared/learning-contracts';
import { notImplemented,type FieldCheck,type RevampContext } from '../context';
/** probe 阶段模型提议的 problemDraft；程序校验（如 stuckPoint 必须逐字出自学生）。不通过就丢弃。 */
export function validateProblemDraft(candidate:unknown,check:FieldCheck):Validation<ProblemDraft>{void candidate;void check;throw notImplemented('validateProblemDraft');}
/** 学生确认后写入 problems；referenceAnswer 只写 problemSecrets，answerStatus 由程序决定。 */
export async function confirmProblem(input:ConfirmProblem,ctx:RevampContext):Promise<ProblemRecord>{void input;void ctx;throw notImplemented('confirmProblem');}
/** 遮挡后的 JPEG 只转发一次，不存图、不记日志；没有模型时改为手动输入。 */
export async function recognize(input:Recognize,ctx:RevampContext,signal?:AbortSignal):Promise<RecognizeResult>{void input;void ctx;void signal;throw notImplemented('recognize');}
