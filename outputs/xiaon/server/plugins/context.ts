/** 所有者：Claude（阶段 0 冻结，第二期补丁加专业模式部分）。改版插件（problems、memory-flow、progress、conversation；第二期 interview、stages、tracking）共用的上下文与输入类型。改动走契约变更申请。 */
import type { AgentRun,AssessmentSnapshot,Attempt,ChatMessage,ChatObservation,ChatStage,ConfirmMonthStage,EngineContext,GradingResult,InterviewAnswer,InterviewSession,LearningEpisode,LearningSession,MemoryItem,ModelContentPart,ModelProvider,MonthStage,PlanningEnginePort,ProfessionalReport,SubmitAttempt } from '../../shared/learning-contracts';
import type { StudentEvents } from '../core/events';
import { RuntimeError } from '../core/errors';
/** One traced, tool-less model response. Offline → throws unavailable; the coordinator records the AgentRun. */
export interface ModelCall { operationId:string;prompt:{version:string;text:string};data:unknown;parts?:ModelContentPart[];timeoutMs?:number }
export interface RevampContext extends EngineContext {
 /** remember(), memoryEnabled(), context(), sessions(): the same audited student-event entry points the A/D routes use. */
 events:StudentEvents;
 providerKind:ModelProvider['kind'];
 memoryEnabled():boolean;
 model(call:ModelCall,signal?:AbortSignal):Promise<{content:string;run:AgentRun}>;
}
/** Program check inputs for model-proposed fields. studentTexts are this chat session's student messages (verbatim). */
export interface FieldCheck { sessionId:string;stage:ChatStage;studentTexts:string[] }
export interface ObservationCheck extends FieldCheck { probeAllowed:boolean;existing:ChatObservation[] }
export interface MemoryDraftCheck extends FieldCheck { memoryEnabled:boolean;origin:'chat'|'progress_card' }
export interface ProgressDraftInput { sessionId:string;episode:LearningEpisode|null;studentTexts:string[];candidate:unknown }
export interface EndConversationInput { operationId:string;sessionId:string;trigger:'student_end'|'farewell';history:ChatMessage[] }
export interface MemoryOfferInput { sessionId:string;stage:ChatStage;turn:number }
/** sessionId/stage are null in the legacy flow. memories = the currently active tutoring memories (memory switch already applied). */
export interface MemorySelectionInput { sessionId:string|null;stage:ChatStage|null;studentTexts:string[];memories:MemoryItem[] }
// ---- G2 第二期：专业模式（interview 归 Claude；stages、tracking 归 zCode）----
/** Professional-mode plugins also reach the graded submit path and the registered planning engine (never a model tool). */
export interface ProfessionalContext extends RevampContext {
 /** Same path as learning/submit: events.submit (exposure snapshot, session checks) + Assessor grading. Runs inside the caller's operation; no receipt of its own. */
 submitAttempt(input:SubmitAttempt,signal?:AbortSignal):Promise<{attempt:Attempt;grading:GradingResult}>;
 /** The registered PlanningEngine (existing proposal/confirm/version history). */
 planning():PlanningEnginePort;
 /** Current assessment snapshot through the registered assessment engine. */
 assessment(operationId:string):Promise<AssessmentSnapshot>;
}
/** learningSession = the exploration session the coordinator entered with learning/start's switchMode; previousReport = the latest report of an earlier interview. */
export interface InterviewStartInput { operationId:string;learningSession:LearningSession;previousReport:ProfessionalReport|null }
/** The coordinator has already passed the safety and rest gates, checked the interview exists, is in_progress, has a pending question and expectedRevision is current. */
export interface InterviewAnswerInput extends InterviewAnswer { interview:InterviewSession }
/** reason 'rest' = the student's answer matched REST_PATTERN; 'student' = the pause button. */
export interface InterviewPauseInput { operationId:string;interview:InterviewSession;reason:'student'|'rest' }
export interface InterviewResumeInput { operationId:string;interview:InterviewSession;learningSession:LearningSession }
/** observations = home-mode 「待核实」 observations (理解/逻辑) that exist now; the report may only cite these. */
export interface ReportInput { operationId:string;interview:InterviewSession;observations:ChatObservation[];previousReport:ProfessionalReport|null;supersedes:ProfessionalReport|null }
/** month = the program's current Asia/Shanghai month (YYYY-MM); previous = the latest stage of an earlier month. */
export interface MonthStageDraftInput { operationId:string;report:ProfessionalReport;month:string;previous:MonthStage|null }
/** The coordinator has checked the stage exists and expectedRevision is current. */
export interface MonthStageConfirmInput extends ConfirmMonthStage { stage:MonthStage }
export interface RetestDeclineInput { operationId:string;stage:MonthStage }
/** at = clock now; stages = latest revision of every month stage. */
export interface RetestReminderInput { at:string;stages:MonthStage[] }
/** reports = every professional report, oldest first (history is kept; the same month keeps the most recent as latest). */
export interface TrendInput { at:string;reports:ProfessionalReport[] }
export const notImplemented=(name:string)=>new RuntimeError('not_implemented',name+' 尚未实现（阶段 0 桩）');
