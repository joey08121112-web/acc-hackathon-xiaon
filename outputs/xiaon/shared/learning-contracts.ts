/** Frozen A contract v1.0.0. Browser safe. All wire/persistence objects reject unknown keys. */
import { z } from 'zod';
export const SCHEMA_VERSION = '1.0.0' as const;
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
const text = z.string().min(1).max(8000);
const version = z.number().int().positive();
const utc = z.iso.datetime();
const nullableTime = utc.nullable();
const ids = z.array(id).max(500);
const dimension = z.enum(['理解','逻辑','计算','建模','空间想象']);
const verdict = z.enum(['correct','incorrect','needs_review']);
const base = { schemaVersion: z.literal(SCHEMA_VERSION), id };
const operation = { operationId: id };
const revision = { evidenceRevision: z.number().int().nonnegative() };
const ref = z.strictObject({taskId:id,taskVersion:version});
const sourceTime = z.strictObject({ occurredAt:nullableTime, recordedAt:utc, timezone:z.literal('Asia/Shanghai'), trust:z.enum(['server','legacy_unknown']), legacyLabel:z.string().max(100).nullable() });
const hint = z.strictObject({id,text,level:version});
const rubricPoint = z.strictObject({id,description:text,expected:text,weight:z.number().positive(),requiresExplanation:z.boolean()});
const commonTask = {
  ...base, version, title:text, question:text, choices:z.array(text), knowledgePoints:ids,
  primaryDimension:dimension, auxiliaryDimensions:z.array(dimension), familyId:id,
  variantKind:z.enum(['observation','transfer','delayed','legacy']), difficulty:z.enum(['introductory','standard','stretch']),
  prerequisites:ids, estimatedMinutes:z.number().int().min(1).max(120),
  // Explicit coordinates allow D to render validated spatial tasks without guessing orientation.
  visual:z.strictObject({kind:z.literal('rotation2d'),points:z.array(z.tuple([z.number(),z.number()])),center:z.tuple([z.number(),z.number()]),clockwiseDegrees:z.number(),options:z.array(z.strictObject({label:text,points:z.array(z.tuple([z.number(),z.number()]))}))}).nullable(),
};
const TaskDefinition = z.strictObject({...commonTask,answer:z.array(text).min(1),rubric:z.array(rubricPoint).min(1),hints:z.array(hint),commonErrors:z.array(z.strictObject({id,description:text,indicator:text,certainty:z.literal('clue_only')}))});
const TaskPublicView = z.strictObject({...commonTask,hintAvailable:z.boolean()});
const LearningSession = z.strictObject({...base,...operation,startedAt:utc,endedAt:nullableTime,status:z.enum(['active','paused','closed']),mode:z.enum(['exploration','support','review']),timezone:z.literal('Asia/Shanghai')});
const SessionEvent = z.strictObject({...base,...operation,sessionId:id,status:LearningSession.shape.status,at:utc});
const ExposureEvent = z.strictObject({...base,...operation,...ref.shape,sessionId:id,kind:z.enum(['task','hint','answer','chat_help']),hintId:id.nullable(),contentSnapshot:z.string().max(8000).nullable(),sourceTime});
const Attempt = z.strictObject({...base,...operation,...ref.shape,sessionId:id.nullable(),value:text,sourceTime,exposureIds:ids,hintSnapshot:z.array(hint),answerExposed:z.boolean(),origin:z.enum(['student_api','legacy_import']),exposureHistory:z.enum(['complete','legacy_unknown']),supersedesAttemptId:id.nullable()});
const Evidence = z.strictObject({...base,...revision,attemptId:id,taskId:id,taskVersion:version,knowledgePointId:id,pointId:id,status:z.enum(['supported','unsupported','uncertain']),quote:z.string().max(8000),location:z.strictObject({start:z.number().int().nonnegative(),end:z.number().int().nonnegative()}),explanation:text,errorClues:z.array(text),uncertainties:z.array(text),source:z.enum(['program','model','human']),createdAt:utc,supersedesEvidenceId:id.nullable()});
const GradingResult = z.strictObject({...base,...operation,...revision,attemptId:id,verdict,points:z.array(z.strictObject({pointId:id,status:z.enum(['supported','unsupported','uncertain']),evidenceIds:ids})),evidenceIds:ids,errorClues:z.array(text),uncertainties:z.array(text),method:z.enum(['legacy_program','rubric_program','model_assisted','human']),createdAt:utc,supersedesGradingId:id.nullable()});
const SkillState = z.strictObject({...base,...revision,knowledgePointId:id,dimension,status:z.enum(['unobserved','needs_support','completed_with_help','first_independent','cross_session_independent']),evidenceIds:ids,attemptIds:ids,observedTaskIds:ids,trustedLearningDates:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),recentDifficulty:z.boolean(),coverage:text,unknowns:z.array(text),computedAt:utc});
const AssessmentSnapshot = z.strictObject({...base,...revision,createdAt:utc,skills:z.array(SkillState),coverage:z.array(z.strictObject({dimension,knowledgePointIds:ids,evidenceCount:z.number().int().nonnegative(),lastObservedAt:nullableTime,unknowns:z.array(text)})),evidenceIds:ids,limitations:z.array(text)});
const ReviewPolicy = z.strictObject({...base,version,intervalDays:z.array(z.number().int().positive()).min(1),minimumAdvanceHours:z.number().positive(),helpRetryHours:z.number().positive(),errorRetryHours:z.number().positive(),timezone:z.literal('Asia/Shanghai')});
const ReviewItem = z.strictObject({...base,...operation,...revision,revision:version,knowledgePointId:id,stage:z.number().int().nonnegative(),task:ref.nullable(),originalDueAt:utc,dueAt:utc,status:z.enum(['active','paused','completed','superseded']),sourceSessionIds:ids,exposureIds:ids,reason:text,postponements:z.array(z.strictObject({from:utc,to:utc,reason:text,at:utc})),planVersionId:id.nullable(),createdAt:utc});
const ReviewOutcome = z.strictObject({...base,...operation,...revision,reviewItemId:id,reviewRevision:version,attemptId:id,sessionId:id,verdict,independent:z.boolean(),taskNovelty:z.enum(['unseen','seen','unknown']),completedAt:utc,reason:text});
const statement = z.strictObject({text,kind:z.enum(['fact','inference','unknown']),evidenceIds:ids});
const ReportSnapshot = z.strictObject({...base,...operation,...revision,createdAt:utc,assessmentSnapshotId:id,statements:z.array(statement),coverage:z.array(text),changes:z.array(text),recommendations:z.array(text),supersedesReportId:id.nullable()});
const planItem = z.strictObject({id,knowledgePointId:id,taskType:z.enum(['explore','supported_practice','independent_transfer','delayed_check','original_review']),task:ref.nullable(),estimatedMinutes:z.number().int().positive(),scheduledDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),evidenceIds:ids,goal:text,status:z.enum(['proposed','scheduled','paused','completed','superseded'])});
const PlanProposal = z.strictObject({...base,...operation,...revision,createdAt:utc,assessmentSnapshotId:id,goal:text,items:z.array(planItem),statements:z.array(statement),alternatives:z.array(text),constraints:z.strictObject({calculationLimit:z.literal(10),requireUnderstandLogicFirst:z.boolean(),timeBudgetMinutes:z.number().positive()}),supersedesProposalId:id.nullable()});
const PlanVersion = z.strictObject({...base,...operation,...revision,version,proposalId:id,previousVersionId:id.nullable(),goal:text,items:z.array(planItem),changes:z.array(text),confirmation:z.strictObject({action:z.enum(['accept','lighter','reschedule','defer','resume']),confirmedAt:utc,actor:z.literal('student'),expectedPreviousVersionId:id.nullable(),reason:text}),createdAt:utc});
const MemoryItem = z.strictObject({...base,...operation,text,source:z.literal('student_explicit'),purpose:z.enum(['tutoring','planning']),createdAt:utc,expiresAt:nullableTime,reviewAt:nullableTime,active:z.boolean()});
const ConsentState = z.strictObject({...base,...operation,optionalMemory:z.boolean(),updatedAt:utc});
const ErrorCode = z.enum(['invalid_params','unknown_tool','forbidden','not_found','invalid_state','conflict','unavailable','not_implemented','timeout','cancelled','budget_exhausted','provider_auth','provider_rate_limit','provider_error','unsupported_tools','internal_error']);
const Failure = z.strictObject({code:ErrorCode,message:text,recoverable:z.boolean()});
const RolePolicy = z.strictObject({role:z.enum(['tutor','assessor','planner','reporter']),allowedTools:ids,maxRounds:z.number().int().min(1).max(4),maxToolExecutions:z.number().int().min(1).max(6)});
const ToolCall = z.strictObject({...base,runId:id,callId:id,name:id,argumentsHash:z.string().length(64),status:z.enum(['succeeded','failed']),errorCode:ErrorCode.nullable(),evidenceIds:ids,dataVersion:z.number().int().nonnegative(),at:utc});
const ToolResult = z.discriminatedUnion('ok',[
  z.strictObject({schemaVersion:z.literal(SCHEMA_VERSION),callId:id,ok:z.literal(true),dataVersion:z.number().int().nonnegative(),evidenceIds:ids,data:z.union([TaskPublicView,GradingResult,AssessmentSnapshot,z.strictObject({sessions:z.array(LearningSession),attemptCount:z.number().int().nonnegative(),memories:z.array(MemoryItem)}),z.strictObject({attempts:z.array(Attempt),gradings:z.array(GradingResult),evidence:z.array(Evidence)}),z.strictObject({skills:z.array(SkillState),limitations:z.array(text)}),z.strictObject({hint:z.string(),level:version,exposureId:id}),z.strictObject({reviews:z.array(ReviewItem)}),PlanProposal,z.strictObject({candidate:z.string(),requiresStudentConfirmation:z.literal(true)})])}),
  z.strictObject({schemaVersion:z.literal(SCHEMA_VERSION),callId:id,ok:z.literal(false),dataVersion:z.number().int().nonnegative(),evidenceIds:ids,error:Failure}),
]);
const AgentRun = z.strictObject({...base,...operation,role:RolePolicy.shape.role,providerKind:z.enum(['real_http','synthetic','offline']),status:z.enum(['completed','unavailable','timeout','cancelled','budget_exhausted','failed']),rounds:z.number().int().min(0).max(4),toolExecutions:z.number().int().min(0).max(6),callIds:ids,permissionFingerprint:z.string().length(64),startedAt:utc,finishedAt:utc,error:Failure.nullable()});
const ChatMessage = z.strictObject({role:z.enum(['user','assistant']),content:text});
const SubmitAttempt = z.strictObject({...operation,...ref.shape,sessionId:id,value:text});
const tools = {
  get_learning_context:z.strictObject({}),
  query_learning_evidence:z.strictObject({taskId:id.optional()}),
  get_skill_state:z.strictObject({knowledgePointId:id.optional()}),
  select_task:z.strictObject({sessionId:id,dimension:dimension.optional()}),
  grade_attempt:z.strictObject({attemptId:id}),
  request_hint:z.strictObject({taskId:id}),
  get_hint:z.strictObject({sessionId:id,taskId:id,taskVersion:version,level:version}),
  get_due_reviews:z.strictObject({}),
  propose_plan:z.strictObject({timeBudgetMinutes:z.number().int().min(1).max(30)}),
  propose_memory:z.strictObject({text}),
};
export const schemas = {
  TaskDefinition,TaskPublicView,LearningSession,SessionEvent,Attempt,ExposureEvent,GradingResult,Evidence,SkillState,AssessmentSnapshot,
  ReviewPolicy,ReviewItem,ReviewOutcome,ReportSnapshot,PlanProposal,PlanVersion,MemoryItem,ConsentState,ToolCall,ToolResult,AgentRun,RolePolicy,
  SourceTime:sourceTime,Failure,SubmitAttempt,
  StartSession:z.strictObject({...operation,mode:LearningSession.shape.mode}),
  SessionState:z.strictObject({...operation,sessionId:id,status:LearningSession.shape.status}),
  Expose:z.strictObject({...operation,...ref.shape,sessionId:id,kind:ExposureEvent.shape.kind,hintId:id.nullable()}),
  SetConsent:z.strictObject({...operation,optionalMemory:z.boolean()}),
  Remember:z.strictObject({...operation,text,source:MemoryItem.shape.source,purpose:MemoryItem.shape.purpose,expiresAt:nullableTime,reviewAt:nullableTime}),
  MemoryState:z.strictObject({...operation,memoryId:id,action:z.enum(['stop','delete'])}),
  ChatRequest:z.strictObject({...operation,history:z.array(ChatMessage).min(1).max(20)}),
  ImportRequest:z.strictObject({...operation,source:z.string().max(500000),previewHash:z.string().length(64),scope:z.literal('attempts_only')}),
  ImportPreviewRequest:z.strictObject({source:z.string().max(500000)}),
  ToolArguments:tools,
};
export type TaskDefinition = z.infer<typeof TaskDefinition>;
export type TaskPublicView = z.infer<typeof TaskPublicView>;
export type SessionEvent = z.infer<typeof SessionEvent>;
export type LearningSession = z.infer<typeof LearningSession>;
export type Attempt = z.infer<typeof Attempt>;
export type ExposureEvent = z.infer<typeof ExposureEvent>;
export type GradingResult = z.infer<typeof GradingResult>;
export type Evidence = z.infer<typeof Evidence>;
export type SkillState = z.infer<typeof SkillState>;
export type AssessmentSnapshot = z.infer<typeof AssessmentSnapshot>;
export type ReviewPolicy = z.infer<typeof ReviewPolicy>;
export type ReviewItem = z.infer<typeof ReviewItem>;
export type ReviewOutcome = z.infer<typeof ReviewOutcome>;
export type ReportSnapshot = z.infer<typeof ReportSnapshot>;
export type PlanProposal = z.infer<typeof PlanProposal>;
export type PlanVersion = z.infer<typeof PlanVersion>;
export type MemoryItem = z.infer<typeof MemoryItem>;
export type ConsentState = z.infer<typeof ConsentState>;
export type ToolCall = z.infer<typeof ToolCall>;
export type ToolResult = z.infer<typeof ToolResult>;
export type AgentRun = z.infer<typeof AgentRun>;
export type RolePolicy = z.infer<typeof RolePolicy>;
export type Failure = z.infer<typeof Failure>;
export type SourceTime = z.infer<typeof sourceTime>;
export type SubmitAttempt = z.infer<typeof SubmitAttempt>;
export type ChatRequest = z.infer<typeof schemas.ChatRequest>;
export type Dimension = z.infer<typeof dimension>;
export interface Clock { now(): string }
export interface EntityMap {
  tasks:TaskDefinition; sessions:LearningSession; sessionEvents:SessionEvent; attempts:Attempt; exposures:ExposureEvent; gradings:GradingResult;
  evidence:Evidence; skills:SkillState; assessments:AssessmentSnapshot; reviewPolicies:ReviewPolicy; reviewItems:ReviewItem;
  reviewOutcomes:ReviewOutcome; reports:ReportSnapshot; proposals:PlanProposal; plans:PlanVersion; memories:MemoryItem; consents:ConsentState; toolCalls:ToolCall; runs:AgentRun;
}
/** Synchronous single-process SQLite transaction. Do not await inside transaction callbacks. append never replaces. */
export interface LearningRepository {
  get<K extends keyof EntityMap>(collection:K,id:string):EntityMap[K]|undefined;
  list<K extends keyof EntityMap>(collection:K):EntityMap[K][];
  append<K extends keyof EntityMap>(collection:K,value:EntityMap[K]):void;
  transaction<T>(work:()=>T):T;
  /** A receipt is scoped across events; same ID + different request fails. Work and receipt commit atomically. */
  once<T>(operationId:string,request:unknown,work:()=>T):T;
  revision():number;
  /** Changes to attempts/exposures/gradings/evidence only; derived records and traces do not advance this. */
  evidenceRevision():number;
  setMemoryState(id:string,action:'stop'|'delete'):void;
  /** Authenticated student reset only. Never exposed as a model tool. */
  receipt?<T>(operationId:string,request:unknown):{found:boolean;value?:T};
  reset?():void;
  close():void;
}
export interface TaskSelection { sessionId:string; dimension?:Dimension; knowledgePointId?:string; excludeTaskIds:string[]; limit:number }
export interface TaskCatalog {
  definition(taskId:string,taskVersion:number):TaskDefinition|undefined;
  publicTask(taskId:string,taskVersion:number):TaskPublicView|undefined;
  candidates(selection:TaskSelection):TaskPublicView[];
}
export interface EngineContext { repository:LearningRepository; clock:Clock; catalog:TaskCatalog }
export interface AssessmentEnginePort {
  readonly id:string;
  catalog:TaskCatalog;
  grade(input:{attemptId:string;operationId:string},context:EngineContext):Promise<GradingResult>;
  snapshot(input:{operationId:string},context:EngineContext):Promise<AssessmentSnapshot>;
}
export interface PlanningEnginePort {
  readonly id:string;
  due(input:{at:string;includePaused:boolean},context:EngineContext):Promise<ReviewItem[]>;
  recordOutcome(input:ReviewOutcome,context:EngineContext):Promise<ReviewItem[]>;
  propose(input:{operationId:string;assessment:AssessmentSnapshot;timeBudgetMinutes:number},context:EngineContext):Promise<PlanProposal>;
  confirm(input:{operationId:string;proposalId:string;expectedPreviousVersionId:string|null;action:PlanVersion['confirmation']['action'];scheduledDate:string|null;reason:string},context:EngineContext):Promise<PlanVersion>;
  report(input:{operationId:string;assessment:AssessmentSnapshot;previousReportId:string|null},context:EngineContext):Promise<ReportSnapshot>;
}
export interface EngineRegistration { assessment?:AssessmentEnginePort; planning?:PlanningEnginePort }
export type NativeToolCall = {id:string;name:string;arguments:string};
export type ModelMessage = {role:'system'|'user'|'assistant'|'tool';content:string;toolCallId?:string;toolCalls?:NativeToolCall[]};
export type ToolDefinition = {name:string;description:string;parameters:Record<string,unknown>};
export interface ModelProvider {
  readonly kind:'real_http'|'synthetic'|'offline';
  readonly supportsTools:boolean;
  complete(input:{messages:ModelMessage[];tools:ToolDefinition[];signal:AbortSignal}):Promise<{content:string;toolCalls:NativeToolCall[]}>;
}
export type AgentReply = {run:AgentRun;text:string;mode:'model'|'local_rules';disclosure:string};
