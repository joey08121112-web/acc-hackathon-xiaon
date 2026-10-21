# 阶段 0 契约冻结与骨架（Claude 路）

编制日期：2026-10-21。本文件是 `revamp-base` 的契约说明，另外两路以此为准；改动走 `CONTRACT-REQUEST.md` → `CONTRACT-CHANGE.md`。路径相对 `outputs/xiaon/`。

## 1. 分支与提交

| 项 | 值 |
| --- | --- |
| 实际分支 | `claude/g0-contracts-6a70eb`（app 分配；任务书写的是 `revamp/g0-contracts`） |
| 实际 worktree | `/Users/ami/Documents/个人/ACC黑客松/.claude/worktrees/g0-contracts-6a70eb`（任务书写的是 `ACC黑客松-wt/g0`） |
| 基于 | main `9e9b759` |
| 代码提交 | `9b70d31c65776fd81026b3efe20d41fd496b7bdc`（首页改版阶段0：契约冻结与骨架，47 个文件） |
| 本文件 | 在其后的一个单独提交里（只加本文件） |
| 待用户操作 | 确认后把本分支合入 main，并在合入后的提交上打 tag `revamp-base`。本路没有推送、没有合并 |

## 2. 先读这四条（与任务书的差异）

1. **新阶段机要显式开启：`ChatRequest.flow: 'home'`。** 不带 `flow`（或 `flow: 'legacy'`）时，聊天走原来的 D 两步流程，提示词逐字不变（`tutor-d3-listen` / `tutor-d3-probe`）。原因：现有 D 测试要求第 2 句就进入 `probe`，和新规则「倾听至少 2 轮」冲突；任务书要求现有测试全部通过。`ChatPanel.tsx` 里有常量 `HOME_FLOW = false`，ChatGPT 第一期改成 `true` 即切到新流程。`intent`、`problemId` 只在 `flow: 'home'` 时接受，否则 400。
2. **`intent` 多一个值 `formal_test`**（确定需求卡上的「做个正式测试」）。回复带 `modeSuggestion`，学生点确认才切换。
3. **`ModelMessage` 用可选 `parts` 承载图文分段，`content` 仍是字符串。** 改成联合类型会让现有 D/E 测试里大量 `JSON.parse(m.content)` 编译失败。zCode 第三期在 `glm.ts` 里：有 `parts` 时发 `parts`，否则照旧发 `content`。
4. **新增一个集合 `chatTurns`（类型 `ChatTurn`）**，任务书集合清单之外。阶段机状态（倾听轮数、陪聊连续轮数、是否问过、拒绝过、上次试探轮次）必须在服务端，客户端发来的 history 不可信且最多 20 条。每轮一条记录，**不存学生原话**；`dropped` 字段就是「不允许的字段被丢弃并记入轨迹」。

其他小差异：`ProblemDraft` 不含 `answerStatus`（由程序在 `ProblemRecord` 上决定，草稿来自模型或客户端，不能自称已核验），另有 `catalogTask` 引用题库题；`Greeting` 多 `summaryId`；`ConversationSummary` 多 `sessionId`、`trigger`、`mode`；`EndConversation` 带 `history`（服务端不存聊天原文，小结需要它）。`SCHEMA_VERSION` 仍为 `1.0.0`，旧记录照常可读。

「对话场次」`sessionId`（形如 `chat-<operationId>`）由程序分配，不是 `LearningSession.id`。新场次的条件：没有上一轮、上一轮 `ended`、上一轮超过 6 小时、该场次已有小结、或请求 history 里只有 1 句学生消息。

## 3. 共享契约新增导出（`shared/learning-contracts.ts`）

全部是 `z.strictObject`（拒绝多余字段），已在 `schemas` 中并写入 `learning-contracts.schema.json`（`npm run schema:agent`）。

| 符号（schemas.X / type X） | 要点 |
| --- | --- |
| `ChatStage` | `companion` `listen` `probe` `think` `reflect` `safety` `rest` |
| `ChatIntent` | `study` `life` `decline_study` `start_together` `formal_test` |
| `ChatFlow` | `legacy` `home` |
| `StageField` | `problemDraft` `observation` `progressCardDraft` `memoryDraft` |
| `ProblemKnowledgePoint` | 现有 6 个知识点 id 或 `other` |
| `ModeSuggestion` | `{mode:'professional', reason}` |
| `ChatRequest`（扩展） | 原字段 + 可选 `flow`、`intent`、`problemId` |
| `ChatReply` | `text` `stage` `sessionId` `run` `safety` `quickReplies` `suggestions` `askStudy` `needsCheck` `askProblem` `modeSuggestion` `problemDraft` `progressCardDraft` `memoryDraft` `summary`（后五个可空）。旧流程也返回完整结构，新字段为 false / null |
| `ObservationDraft` | 模型输出：`dimension`（只有 理解/逻辑）`signal`（clear/partial/confused）`quote` `note` |
| `ChatObservation` | 上面 + `id` `sessionId` `status:'unverified'` `at` |
| `ConversationSummary` | `sessionId` `trigger`(student_end/farewell) `topics` `observationIds` `comparedWithSummaryId` `changes` `planSuggestions`(1–3) `suggestProfessionalMode` `progressCardId` `mode`(model/local_rules) `createdAt` |
| `ProblemDraft` | `source`(photo/spoken/catalog) `questionText` `studentWork` `knowledgePointId` `stuckPoint` `catalogTask` |
| `ProblemRecord` | 草稿字段 + `id` `operationId` `sessionId` `answerStatus`(verified/unknown) `confirmedAt` |
| `ProblemSecret` | `problemId` `answer[]` `origin`(catalog/student_provided/program_computed) `createdAt`；只在服务端 |
| `LearningEpisode` | `revision`（追加修订，同 ReviewItem）`sessionId` `problemId` `task` `stage`(think/reflect) `helpLevelsUsed` `studentSolvedAt` `endReason`(solved/understood/turn_limit) `status`(active/reflecting/closed) |
| `ProgressCardDraft` | `episodeId` `breakthrough` `method` `nextTry`（均可空） |
| `ProgressCard` | `aiDraft`（AI 草稿）与学生确认的 `breakthrough` `method` `nextTry` 分开存；`skipped[]`；`confidence`(more_sure/about_same/still_unsure/prefer_not，可空) |
| `ProgressConfidence` | 上面的信心枚举 |
| `MemoryDraft` | `text` `kind`(event/interest/method) `origin`(chat/progress_card) |
| `MemoryMention` | `memoryId` `sessionId` `via`(greeting/chat) `at` |
| `Greeting` | `text` `memoryId` `summaryId` `memoryOff` |
| `ChatTurn` | 一轮的阶段机结果与计数、`signals`、`dropped[{field, reason: stage_not_allowed/memory_off/invalid/not_implemented}]` |
| `RecognizeResult` | `{draft: ProblemDraft|null, notice}` |
| 请求 `ConfirmProblem` | `operationId` `sessionId` `draft` `referenceAnswer`（只写 problemSecrets） |
| 请求 `Recognize` | `operationId` `sessionId` `mimeType:'image/jpeg'` `image`(base64，解码后 ≤1.5MB) `maskConfirmed: true`（必填） |
| 请求 `ConfirmProgressCard` | `operationId` `sessionId` `episodeId` `aiDraft` `breakthrough` `method` `nextTry` `confidence` |
| 请求 `ConfirmMemoryDraft` | `operationId` `sessionId` `draft` `text`（学生改后的文字） |
| 请求 `GreetingRequest` | `operationId` |
| 请求 `EndConversation` | `operationId` `sessionId` `history` |
| 类型 `ChatMessage` | 原 `ChatMessage` schema 的类型，新导出 |
| 类型 `Validation<T>` | `{ok:true;value:T}` 或 `{ok:false;reasons:string[]}` |
| 类型 `ModelContentPart` / `ModelMessage.parts` | `{type:'text';text}` 或 `{type:'image_url';image_url:{url}}` |
| 常量 `RECOGNIZE_MAX_IMAGE_BYTES` | `1_500_000` |

确认后的记忆仍写成现有 `MemoryItem`（`source:'student_explicit'`），没有新增记忆来源。

## 4. 存储（`server/storage/repository.ts`，迁移 v4）

新集合：`problems` `problemSecrets` `episodes` `progressCards` `memoryMentions` `observations` `summaries` `chatTurns`。只追加；`episodes` 的键是 `id:r<revision>`，`get` 取最新修订。重置演示清除全部集合（含新增）。

`view()`（`GET /api/learning`）新增：`problems` `episodes` `progressCards` `memoryMentions` `observations` `summaries` `chatTurns`（最近 20 条）。**`problemSecrets` 不在 view 里**，测试同时确认 JSON 中不含答案原文。

## 5. 路由

都在 `/api/learning/` 下，POST，需本机会话 Cookie + CSRF，同其他学习路由。入参先按 schema 严格校验（多余字段 400），插件返回值出服务端前再按 schema 解析一次。

| 路由 | 请求 | 返回 | 协调器方法 → 插件函数 | 阶段 0 |
| --- | --- | --- | --- | --- |
| `chat`（扩展） | `ChatRequest` | `ChatReply` | `chat` → 阶段机 + 各 validate* | 可用 |
| `problem/confirm` | `ConfirmProblem` | `ProblemRecord` | `confirmProblem` → problems.`confirmProblem` | 501 |
| `recognize` | `Recognize` | `RecognizeResult` | `recognize` → problems.`recognize` | 501 |
| `progress-card/confirm` | `ConfirmProgressCard` | `ProgressCard` | `confirmProgressCard` → progress.`confirmProgressCard` | 501 |
| `memory/confirm-draft` | `ConfirmMemoryDraft` | `MemoryItem` | `confirmMemoryDraft` → memory-flow.`confirmMemoryDraft` | 501 |
| `greeting` | `GreetingRequest` | `Greeting` | `greeting` → memory-flow.`greeting` | 501 |
| `conversation/end` | `EndConversation` | `ConversationSummary` | `endConversation` → conversation.`endConversation`（trigger `student_end`） | 501 |

`recognize`：只有这条路由放宽请求体上限（`ceil(1.5MB×4/3)+2000` 字节，做法同 `/api/voice/asr`）；一次只处理一张；不走回执（不把识别结果写进 operations 表）；服务端不记日志。其余路由走协调器 `perform`（同一 operationId 幂等、串行）。

## 6. 插件签名（阶段 0 定死）

共用类型在 `server/plugins/context.ts`（所有者 Claude）：

```ts
interface ModelCall { operationId:string; prompt:{version:string;text:string}; data:unknown; parts?:ModelContentPart[]; timeoutMs?:number }
interface RevampContext extends EngineContext {      // repository, clock, catalog
  events: StudentEvents;                              // remember() / memoryEnabled() / context() / sessions()
  providerKind: 'real_http'|'synthetic'|'offline';
  memoryEnabled(): boolean;
  model(call:ModelCall, signal?:AbortSignal): Promise<{content:string; run:AgentRun}>; // 单次、无工具、记 AgentRun；offline 抛 unavailable
}
interface FieldCheck { sessionId:string; stage:ChatStage; studentTexts:string[] }   // studentTexts = 本场次学生原话（来自请求 history）
interface ObservationCheck extends FieldCheck { probeAllowed:boolean; existing:ChatObservation[] }
interface MemoryDraftCheck extends FieldCheck { memoryEnabled:boolean; origin:'chat'|'progress_card' }
interface ProgressDraftInput { sessionId:string; episode:LearningEpisode|null; studentTexts:string[]; candidate:unknown }
interface EndConversationInput { operationId:string; sessionId:string; trigger:'student_end'|'farewell'; history:ChatMessage[] }
interface MemoryOfferInput { sessionId:string; stage:ChatStage; turn:number }
const notImplemented: (name:string) => RuntimeError   // code 'not_implemented'
```

| 文件（所有者） | 导出 |
| --- | --- |
| `server/plugins/problems/index.ts`（zCode） | `validateProblemDraft(candidate:unknown, check:FieldCheck): Validation<ProblemDraft>`<br>`confirmProblem(input:ConfirmProblem, ctx:RevampContext): Promise<ProblemRecord>`<br>`recognize(input:Recognize, ctx:RevampContext, signal?:AbortSignal): Promise<RecognizeResult>` |
| `server/plugins/memory-flow/index.ts`（zCode） | `validateMemoryDraft(candidate:unknown, check:MemoryDraftCheck): Validation<MemoryDraft>`<br>`confirmMemoryDraft(input:ConfirmMemoryDraft, ctx:RevampContext): Promise<MemoryItem>`<br>`greeting(input:GreetingRequest, ctx:RevampContext, signal?:AbortSignal): Promise<Greeting>`<br>`shouldOfferMemory(input:MemoryOfferInput, ctx:RevampContext): boolean` |
| `server/plugins/progress/index.ts`（Claude） | `draftProgressCard(input:ProgressDraftInput, ctx:RevampContext, signal?:AbortSignal): Promise<{draft:ProgressCardDraft; memoryDraft:MemoryDraft|null}>`<br>`confirmProgressCard(input:ConfirmProgressCard, ctx:RevampContext): Promise<ProgressCard>` |
| `server/plugins/conversation/index.ts`（Claude） | `validateObservation(candidate:unknown, check:ObservationCheck): Validation<ObservationDraft>`<br>`endConversation(input:EndConversationInput, ctx:RevampContext, signal?:AbortSignal): Promise<ConversationSummary>`<br>`latestSummary(ctx:RevampContext): ConversationSummary|null` |

协调器怎么用这些函数（`server/agents/learning.ts`，所有者 Claude）：

- 聊天里，模型提议的字段先经阶段机过滤，再交给对应 `validate*`；返回 `ok:false`、抛 `not_implemented` 或返回值不符合 schema，字段都被丢弃，原因写进该轮 `ChatTurn.dropped`。所以桩阶段聊天照常工作，所有草稿为 null。
- 通过校验的观察由协调器写入 `observations`（`id: obs-<operationId>`，`status:'unverified'`）。
- `memoryDraft`：记忆关闭时阶段机已不放行；开启时再问 `shouldOfferMemory`，返回 false 或桩抛错都不放行。
- `reflect` 阶段（刚进入，或模型本轮提议了卡片）调用 `draftProgressCard`；它给的 `memoryDraft` 只在记忆开启时下发。
- 学生道别（`FAREWELL_PATTERN`）时调用 `endConversation`（trigger `farewell`），成功则回复带 `summary`；`RuntimeError` 时 `summary` 为 null。
- `latestSummary` 协调器不直接调，留给 `greeting` 使用。

## 7. 对话阶段机（`server/agents/stages.ts`，所有者 Claude）

纯函数，只在 `flow:'home'` 时使用。导出：

- 常量：`LISTEN_MIN_TURNS=2` `ASK_STUDY_AFTER_COMPANION_TURNS=6` `PROBE_GAP_TURNS=3` `THINK_MAX_TURNS=10` `CHAT_STALE_MS=6h`
- 程序判定用的正则：`SAFETY_PATTERN`（从 learning.ts 移来，内容不变）`REST_PATTERN` `STUDY_PATTERN` `DECLINE_PATTERN` `INTENSE_PATTERN` `PROBLEM_PATTERN` `UNDERSTOOD_PATTERN` `FAREWELL_PATTERN`
- `STAGE_FIELDS: Record<ChatStage, StageField[]>`、`HOME_QUICK_REPLIES: Record<ChatStage, string[]>`
- 类型 `ChatStageState`、`StageEvent`、`StageDecision`
- `initialStageState(sessionId)`、`decideStage(previous, event)`、`filterStageFields(allowed, candidate)`、`matchesAnswer(text, answers)`

规则（每条都有单测）：

| 规则 | 实现 |
| --- | --- |
| 安全优先 | 命中 `SAFETY_PATTERN` → `safety`，什么都不放行，状态不前进，不写任何记录、不调模型 |
| 休息优先 | 命中 `REST_PATTERN` → `rest`，照旧暂停（`preference`），并记为拒绝学习 |
| 倾听 | 新场次前 2 句一律 `listen`，即使已经说到考试或点了学习 |
| 确定需求 | 倾听满 2 轮、本句没有强烈情绪时，`needsCheck:true` 一次；强烈情绪时顺延到下一个平静的轮次；进入 probe/think/reflect 即视为需求已明确 |
| 陪聊停留 | 倾听后没有学习意图 → `companion`，直到出现学习意图 |
| 问学习 | 连续第 6 轮 `companion` 时 `askStudy:true`，每场次一次；拒绝（`decline_study` 或拒绝的话）后不再问 |
| 进入 probe | 点学习选项（`study` / `start_together` / `formal_test`）或命中 `STUDY_PATTERN` |
| 引导上传 | `probe` 中提到具体哪道题做错、本场次还没有错题记录 → `askProblem:true` |
| 试探 | 只在 `probe`、本句不强烈、距上次试探 ≥3 轮时 `probeAllowed`，提示词里拼上 observe 块并放行 `observation` |
| probe → think | `start_together` 且有已确认错题（`problemId` 或本场次的错题）或已激活的题库题；协调器建 `LearningEpisode` |
| think → reflect | 程序比对参考答案命中（题库答案或 `ProblemSecret`）、说「懂了」、或已满 10 轮；episode 记修订 |
| reflect → companion | 该 episode 已有进步卡（确认或全部跳过）；episode 关闭 |
| 道别 | `end:true`，场次结束，下一句开新场次 |

各阶段放行字段：`companion`/`listen` → `memoryDraft`；`probe` → `problemDraft`，试探轮再加 `observation`；`reflect` → `progressCardDraft`、`memoryDraft`；`think`/`safety`/`rest` → 无。

## 8. 提示词（`server/agents/prompts/`）

每个文件导出 `{version, text}`，文件头写所有者；阶段 0 只有最小可用文本。

| 文件 | 导出 | 所有者 | 何时使用 |
| --- | --- | --- | --- |
| `companion.ts` | `COMPANION_PROMPT` | ChatGPT | companion 阶段块 |
| `memory-draft.ts` | `MEMORY_DRAFT_PROMPT` | zCode | 放行 memoryDraft 的轮次 |
| `problem-draft.ts` | `PROBLEM_DRAFT_PROMPT` | zCode | probe 阶段 |
| `recognize.ts` | `RECOGNIZE_PROMPT` | zCode | `recognize` 的系统提示 |
| `think.ts` | `THINK_PROMPT` | Claude | think 阶段块 |
| `reflect.ts` | `REFLECT_PROMPT` | Claude | reflect 阶段块 |
| `observe.ts` | `OBSERVE_PROMPT` | Claude | 允许试探的 probe 轮 |
| `summary.ts` | `SUMMARY_PROMPT` | Claude | `endConversation` 的系统提示 |

`roles.ts` 新增 `homeTutorPrompt({stage, allowed})`（版本号 `tutor-g0-<stage>[-observe]`）、`homeTutorOutput`、`ControlledRoles.compose(call, signal)`（即 `RevampContext.model`）。通用规则第 6 条按阶段放开：`probe` 可以给解题思路但不给完整答案或最终结果；`think` 逐级引导、完成前不给最终答案；其余阶段沿用原文。第 8 条由程序写出本轮允许的附加字段。`listen` / `probe` 现有文本保留在 `roles.ts`；旧流程 `tutorPrompt()` 输出已核对与改动前逐字相同。模型输出里的 `signals`（needsCheck/askStudy/askProblem）由程序放进输入数据，模型不能自己决定。

## 9. 前端挂载位

`src/components/learning/home/` 十个桩组件都返回 `null`，文件头写所有者，并导出 `<Name>Props`。`navigate` 的类型都是 `(page:string, tab?:string)=>void`。

| 组件（所有者） | 挂在 | props |
| --- | --- | --- |
| `HomeChat`（ChatGPT） | ChatPanel 顶部 | `l:LearningUI; reply:ChatReply|null; send:(text, extra?:{intent?:ChatIntent; problemId?:string})=>void; navigate` |
| `NeedsCheckCard`（ChatGPT） | ChatPanel 快捷回复下 | `open:boolean`（= `reply.needsCheck`）`; disabled:boolean; onChoose:(intent:ChatIntent, label:string)=>void`（ChatPanel 已接成 `send(label,{intent})`） |
| `ModeSwitchCard`（ChatGPT） | ChatPanel | `suggestion:ModeSuggestion|null; navigate` |
| `ConversationSummaryView`（ChatGPT） | ChatPanel | `summary:ConversationSummary|null; l; navigate` |
| `ProblemCapture`（zCode） | ChatPanel | `open:boolean`（= `reply.askProblem`）`; sessionId:string|null; l; onConfirmed:(problem:ProblemRecord)=>void`（已接成 `send('就看这道题吧',{intent:'start_together', problemId})`） |
| `ProblemConfirmCard`（zCode） | ChatPanel | `draft:ProblemDraft|null; sessionId; l; onConfirmed`（同上） |
| `ProblemList`（zCode） | 成长页（LearningPages `growth`） | `l; navigate`（数据取 `l.view.problems`） |
| `MemoryPrompt`（zCode） | ChatPanel | `draft:MemoryDraft|null; sessionId; memoryEnabled:boolean; l` |
| `MemoryOffNotice`（zCode） | ChatPanel | `memoryEnabled:boolean; where:'home'|'progress_card'; navigate` |
| `ProgressCardView`（Claude） | ChatPanel | `draft:ProgressCardDraft|null; sessionId; memoryEnabled; l; navigate` |

其他前端改动：

- `ChatPanel.tsx`：用 `ChatReply` 类型，保存最近一次回复，把对应字段传给上面的组件；`send(text, extra)` 只在 `HOME_FLOW` 为 true 时发送 `flow:'home'` 和 extra。现有行为不变。
- `useLearning.ts`：重新导出 `ChatReply`、`ChatIntent`、`ChatStage` 类型，不改行为。
- `src/styles/home.css`（ChatGPT）、`problem.css`（zCode）、`progress.css`（Claude）：只有所有者注释，`main.tsx` 在 `style.css` 之后引入。
- `src/agents/devMode.ts`（Claude；ChatGPT 只调用，设置页开关由 ChatGPT 加）：`DEV_MODE_KEY='xiaon-dev-mode'`、`isDevMode()`、`setDevMode(on)`、`useDevMode()`。浏览器本地开关，默认关。关时 `LearningStatus`（服务模式条）返回 null，「查看 Agent 与工具轨迹」不渲染。

## 10. 测试与证据

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck:agent` | 0 | |
| `npm test` | 0 | 25/25 |
| `npm run test:agent`（a b c d e g h i） | 0 | 142/142 |
| `npm run build` | 0 | built |
| `npm run test:agent:g` | 0 | 19/19 |
| `npm run test:agent:h` | 0 | 2/2 |
| `npm run test:agent:i` | 0 | 2/2 |

记录在 `evidence/g0-gates.txt`。首次失败留档：先写阶段机单测再实现，第一次运行 11 项全部以 `not_implemented` 失败，原样存于 `evidence/g0-stages-first-run.txt`。

新增测试：

- `tests-agent/g/stages.test.ts`：阶段机单测 11 项（倾听 ≥2 轮、确定需求只问一次并避开强烈情绪、陪聊停留、第 6 轮陪聊问一次、拒绝后不再问、试探间隔与情绪、安全/休息优先、askProblem、think/reflect/companion 路径、各阶段字段、正式测试与道别）。
- `tests-agent/g/home-chat.test.ts`：经协调器的端到端，用合成模型（每轮把四种字段全部提议一遍）。阶段由程序定；丢弃原因写入 `chatTurns`；`chatTurns` 不含学生原话；安全不留记录；无模型时给固定温和回复。
- `tests-agent/{g,h,i}/contract-smoke.test.ts`：各路契约冒烟。新 schema 可解析、拒绝多余字段；新路由在桩阶段返回 501 `not_implemented`；recognize 先拒绝未遮挡、非 JPEG 和超限；`problemSecrets` 不进 view；重置清除新集合。h、i 两份可由所有者整体替换。

证据级别：

| 级别 | 状态 |
| --- | --- |
| 静态检查 | 跑了 |
| 规则单测 | 跑了 |
| 模拟模型端到端 | 跑了（协调器层 + HTTP 层） |
| 真实模型 | 未运行（本阶段不需要 Key，也没有读取 `.env.server`） |
| 浏览器 | 未运行（不得运行 D 阶段浏览器测试；本阶段 UI 只有返回 null 的桩） |
| 真实设备 | 未运行 |

## 11. 已知影响，集成时处理

- 服务模式条现在默认隐藏。`tests-agent/d/browser.spec.ts`、`tests-agent/d/pet-voice.spec.ts`、`tests-agent/e/browser.spec.ts` 的 `onboard()` 会断言看到「模拟模型 · 真实工具 / SQLite」，下次运行这些浏览器 spec 前要先打开开发者模式（例如 `page.addInitScript(()=>localStorage.setItem('xiaon-dev-mode','1'))`）。这些文件不在任何一路的所有权里，按规则需要契约变更申请；本阶段没有运行、也没有修改它们。
- `HOME_FLOW` 打开后，新流程的 `rest` 仍沿用旧的暂停语义（「只想聊」「不想看」会暂停学习）。如果 ChatGPT 希望「只想聊」只进入陪聊而不暂停，请提契约变更申请。
- 关于 `chat-<operationId>` 场次：同一个学生在两个标签页同时聊，会共用最后一轮的场次（单用户演示可以接受）。

## 12. 本路下一步

停在这里，等用户确认：合入 main，打 tag `revamp-base`。之后三路从 `revamp-base` 开始第一期；Claude 第一期 A 从 `conversation` 插件开始（`validateObservation`、`endConversation`、`latestSummary`）。
