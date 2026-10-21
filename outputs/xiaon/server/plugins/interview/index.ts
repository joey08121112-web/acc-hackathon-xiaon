/** 所有者：Claude（第二期：专业模式面试引擎）。契约补丁只定签名，函数体抛 not_implemented；由 server/agents/learning.ts 委托调用。
 * 安全拦截、休息、面试是否存在、状态与 expectedRevision 由协调器先查；插件返回值出服务端前再按 schema 解析，报告另过 server/agents/professional.ts 的程序门控。 */
import type { InterviewSession,InterviewStep,ProfessionalReport } from '../../../shared/learning-contracts';
import { notImplemented,type InterviewAnswerInput,type InterviewPauseInput,type InterviewResumeInput,type InterviewStartInput,type ProfessionalContext,type ReportInput } from '../context';
/** 新建测评（理解开始），写 interviews 第 1 版并给出第一道题（pending）；题目只来自现有题库，问题打开时照常记 task 暴露。 */
export async function startInterview(input:InterviewStartInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<InterviewStep>{void input;void ctx;void signal;throw notImplemented('startInterview');}
/** 记一条 InterviewTurn；题目作答走 ctx.submitAttempt（照常判分），追问不另算一道题；答错时加问同类题；写 interviews 新修订。 */
export async function answerInterview(input:InterviewAnswerInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<InterviewStep>{void input;void ctx;void signal;throw notImplemented('answerInterview');}
/** 暂停：写 interviews 新修订（status paused，pending 保留，下次原样再问）。 */
export async function pauseInterview(input:InterviewPauseInput,ctx:ProfessionalContext):Promise<InterviewSession>{void input;void ctx;throw notImplemented('pauseInterview');}
/** 续测：从停下的模块接着测，已答的不重问；换了一天时记下新的 learningSessionId。 */
export async function resumeInterview(input:InterviewResumeInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<InterviewStep>{void input;void ctx;void signal;throw notImplemented('resumeInterview');}
/** 按作答证据由程序判定各模块等级（LEVEL_BY_BASIS），模型只负责 wording；返回报告，不自己写库（协调器过门控后写 professionalReports）。 */
export async function buildReport(input:ReportInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<ProfessionalReport>{void input;void ctx;void signal;throw notImplemented('buildReport');}
