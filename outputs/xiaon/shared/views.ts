/** 聚合视图 DTO 契约（LearningView）。
 *
 * 为什么要有这个文件：LearningView 以前是
 *   export type LearningView = Awaited<ReturnType<LearningCoordinator['view']>>;
 * 前端直接从服务端实现反推类型。改一下 view() 的返回形状，前端类型就静默跟着变，
 * 没有契约校验、没有报错 —— 冻结契约（shared/learning-contracts.ts）只管住了
 * zod 校验的单实体，管不住聚合视图这条边界。
 *
 * 现在视图形状在这里显式声明：
 *   · 前端只依赖 shared/，不再 import server/；
 *   · 服务端出站前用同一个 schema 自校验，形状漂移当场报错，不会静默流到前端。
 *
 * 字段与 LearningCoordinator.view() 一一对应。服务端改视图结构时，
 * 必须先改这里 —— 这是刻意的摩擦：契约变了就该让两边同时被看见。
 */
import { z } from 'zod';
import { schemas } from './learning-contracts';
import { evidenceKindValues } from './assessment-labels';

const { LearningEpisode, TaskPublicView, Attempt, GradingResult } = schemas;

// LearningEpisode.loop 是可选的；取它的内部 schema 复用，保证 help/draft 的形状
// 与实体定义只有一处来源。
const episodeLoop = LearningEpisode.shape.loop.unwrap();

/** 服务端 classifyAttempt() 的返回形状。放在契约里是因为它会随 view 一起发给前端。 */
const AttemptClassification = z.strictObject({
  kind: z.enum(evidenceKindValues),
  novelty: z.enum(['unseen', 'seen', 'unknown']),
  learningDate: z.string().nullable(),
  independent: z.boolean(),
  delayedRetention: z.boolean(),
  reason: z.string(),
});

/** reportHistory()/planHistory() 的派生项：快照 + 「依据是否被修订过」+ 替代它的新版本。 */
const HistoryEntry = <T extends z.ZodTypeAny>(snapshot: T) =>
  z.strictObject({
    snapshot,
    basisRevised: z.boolean(),
    replacementId: z.string().nullable(),
  });

/** learningLoops：learn→reflect 回合的派生视图（loopView()）。 */
const LearningLoopView = z.strictObject({
  episode: LearningEpisode,
  task: TaskPublicView.nullable(),
  summary: z.string(),
  independent: z.boolean(),
  currentGrade: GradingResult.nullable(),
  draft: episodeLoop.shape.draft,
  help: episodeLoop.shape.help,
  attempts: z.array(Attempt),
});

export const LearningView = z.strictObject({
  now: z.iso.datetime(),
  session: schemas.LearningSession.nullable(),
  paused: z.boolean(),
  assessment: schemas.AssessmentSnapshot,
  tasks: z.array(TaskPublicView.extend({ eligible: z.boolean() })),
  attempts: z.array(Attempt.extend({ classification: AttemptClassification })),
  exposures: z.array(schemas.ExposureEvent),
  gradings: z.array(GradingResult),
  evidence: z.array(schemas.Evidence),
  reports: z.array(HistoryEntry(schemas.ReportSnapshot)),
  plans: z.array(HistoryEntry(schemas.PlanVersion)),
  proposal: schemas.PlanProposal.nullable(),
  reviews: z.array(schemas.ReviewItem),
  consentConfigured: z.boolean(),
  optionalMemory: z.boolean(),
  memories: z.array(schemas.MemoryItem),
  runs: z.array(schemas.AgentRun),
  toolCalls: z.array(schemas.ToolCall),
  stuckPoints: z.array(schemas.StuckPoint),
  generations: z.array(schemas.GenerationRecord.extend({ exposed: z.boolean() })),
  generationAvailable: z.boolean(),
  learningLoops: z.array(LearningLoopView),
  problems: z.array(schemas.ProblemRecord),
  episodes: z.array(LearningEpisode),
  progressCards: z.array(schemas.ProgressCard),
  memoryMentions: z.array(schemas.MemoryMention),
  observations: z.array(schemas.ChatObservation),
  summaries: z.array(schemas.ConversationSummary),
  chatTurns: z.array(schemas.ChatTurn),
  lifeScenes: z.array(schemas.LifeSceneState),
  chatLog: z.array(schemas.ChatLog),
  interviews: z.array(schemas.InterviewSession),
  interviewTurns: z.array(schemas.InterviewTurn),
  professionalReports: z.array(schemas.ProfessionalReport),
  monthStages: z.array(schemas.MonthStage),
  retestReminder: schemas.RetestReminder.nullable(),
  /** 监护人同意流水（2026-11-21）。家长要能查「当时同意的是哪一版、谁同意的」。 */
  guardianConsents: z.array(schemas.GuardianConsent),
});

export type LearningView = z.infer<typeof LearningView>;
