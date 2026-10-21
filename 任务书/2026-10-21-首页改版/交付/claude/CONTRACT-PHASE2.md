# 第二期契约补丁：专业模式（Claude 路）

编制日期：2026-10-21。本文件说明 `revamp-base2` 的契约，ChatGPT、zCode 第二期以此为准；要改走 `CONTRACT-REQUEST.md` → `CONTRACT-CHANGE.md`。路径相对 `outputs/xiaon/`。本补丁只做加法，第一期的类型、路由和行为都没变。

## 1. 分支与提交

| 项 | 值 |
| --- | --- |
| 实际分支 | `claude/g2-contracts-163adf`（由 app 分配；任务书写的是 `revamp/g2-contracts`） |
| 实际 worktree | `/Users/ami/Documents/个人/ACC黑客松/.claude/worktrees/g2-contracts-163adf` |
| 基于 | main `5602b1a`（tag `revamp-phase1`） |
| 代码提交 | `9841910`（契约补丁：类型、存储、路由、插件桩、挂载位、冒烟测试） |
| 本文件 | 代码提交之后单独提交 |
| 待用户操作 | 确认后把本分支合入 main，在合入后的提交上打 tag `revamp-base2`。本路没有推送、没有合并 |

## 2. 先读这几条（与任务书的差异与补充）

1. **月阶段多一条路由：`stage/retest-decline`**（学生拒绝复测）。任务书只列了月阶段的「草案 / 确认」，但 zCode 的「拒绝后本月不再提」需要一个学生事件来记录。
2. **复测提醒由服务端判定**：`view().retestReminder` 由 zCode 的 `stages.retestReminder` 计算，协调器再复查（只能指向已确认、未拒绝的月阶段），前端只负责显示。另新增类型 `RetestReminder` 和常量 `RETEST_REMIND_DAYS_BEFORE = 3`。
3. **`TrendPoint` 不存库**：它由 `professionalReports` 推导，经 `GET /api/learning/trend` 查询。理由有两条：一是趋势不可能和报告对不上；二是桩阶段生成的报告以后也能进趋势。协调器校验每个点：来源报告存在，等级、月份、时间都与报告一致，`latest` 出自 `history`。
4. **路由响应类型 `InterviewStep`**：开始 / 回答 / 继续三条路由的返回值，任务书没有单列。
5. **`ModuleLevel` 带 `basis`（判级依据代码）**，并有共享常量 `LEVEL_BY_BASIS`。等级必须等于 `LEVEL_BY_BASIS[basis]`，否则协调器拒收。这样「模型的等级与程序不一致时以程序为准」由程序保证。「本次观察」用 `scope: 'this_interview'` 表示。
6. **`MonthStage` 的「关联周计划版本」写成 `weeks[]`**，每周一项：`{weekStart, proposalId, planVersionId}`。周计划仍用现有计划引擎生成，用现有 `learning/confirm` 确认。
7. **面试从「未完成」到「完成」只有一份**：已有进行中或暂停的测评时，`interview/start` 返回 409。界面应读 `view().interviews` 显示「上次停在：X」，然后调 `interview/resume`。
8. **同一个月只有一份有效草案**：再出草案时，本月未确认的旧草案由协调器标为 `superseded`。本月已确认或「暂不开始」时，`stage/draft` 返回 409。月中想重新定目标，要 zCode 提变更申请。

## 3. 共享契约新增导出（`shared/learning-contracts.ts`）

全部是 `z.strictObject`（拒绝多余字段），已加入 `schemas` 并写入 `learning-contracts.schema.json`（已运行 `npm run schema:agent`）。`SCHEMA_VERSION` 仍为 `1.0.0`。

**常量**

| 符号 | 值 |
| --- | --- |
| `INTERVIEW_MODULE_ORDER` | `['理解','逻辑','计算','建模','空间想象']` |
| `INTERVIEW_REQUIRED_MODULES` | `['理解','逻辑']` |
| `MODULE_LEVEL_LABELS` | `good:'掌握得不错'` `partial:'部分掌握'` `needs_work:'需要加强'` `not_tested:'还没测到'` |
| `LEVEL_BY_BASIS` | `correct_with_reason→good`；`correct_reason_incomplete`、`completed_with_hint`、`correct_on_transfer→partial`；`incorrect_on_both→needs_work`；`not_tested→not_tested` |
| `RETEST_REMIND_DAYS_BEFORE` | `3` |

**实体与值对象**（`schemas.X` / `type X`）

| 符号 | 字段要点 |
| --- | --- |
| `InterviewSession` | `id` `operationId` `revision`（追加修订，键 `id:r<revision>`，同 `LearningEpisode`）<br>`learningSessionId`（所在的探索场次）<br>`moduleOrder`（固定五元组，顺序不对就拒收）<br>`currentModule`（可空）、`completedModules[]`<br>`status`：`in_progress` / `paused` / `completed`<br>`pending`（已问未答的题，可空）<br>`startedAt` `pausedAt` `completedAt` `updatedAt` |
| `InterviewPending` | `module` `task{taskId,taskVersion}` `kind` `prompt`（≤300 字）`mode`（model / local_rules）`askedAt` |
| `InterviewTurn` | `id` `operationId` `interviewId` `seq` `module` `task` `kind` `prompt` `answer`（学生回答，≤2000 字）`attemptId`（追问为 null）`mode` `askedAt` `answeredAt` |
| `InterviewTurnKind` | `question`（模块观察题） / `follow_up`（追问） / `transfer`（答错后加问的同类题） |
| `ModuleLevel` | `module` `level` `basis` `evidenceIds` `attemptIds` `turnIds`<br>`quotes[]`（依据原话，≤5 条）<br>`wording`（模型措辞，可空）<br>`suggestions[]`（≤2 条，只给部分掌握 / 需要加强）<br>`scope:'this_interview'` |
| `ModuleLevelValue` / `ModuleLevelBasis` | 上面的两个枚举 |
| `ProfessionalReport` | `id` `operationId` `evidenceRevision` `interviewId` `version`<br>`supersedesReportId`（同一测评的上一份）<br>`comparedWithReportId`（上一次测评的报告）<br>`modules`（正好 5 个）<br>`observationChecks[{observationId, dimension:理解/逻辑, result:confirmed/not_seen}]`<br>`changes[{module, from, to, note}]`<br>`mode` `createdAt`<br>**没有任何总分或排名字段** |
| `MonthStage` | `id` `operationId` `revision`（追加修订）<br>`month`（YYYY-MM）`module` `goal`（≤200 字）`sourceReportId`<br>`weeks[{weekStart, proposalId, planVersionId}]`（≤6 项）<br>`retestSuggestedAt`（YYYY-MM-DD）<br>`status`：`draft` / `confirmed` / `deferred` / `superseded`<br>`confirmation{action:accept/defer, confirmedAt, actor:'student'}`（可空）<br>`retestDeclinedAt` `mode` `createdAt` `updatedAt` |
| `TrendPoint` | `month` `module` `level` `sourceReportId` `reportCreatedAt`（推导，不存库） |
| `TrendQuery` | `{latest: TrendPoint[], history: TrendPoint[]}` |
| `RetestReminder` | `stageId` `month` `retestSuggestedAt` `remindFrom` |
| `InterviewStep` | `text`（小N这一句）`safety` `interview`（可空）`task`（`TaskPublicView`，可空，不含答案）`turn`（刚记下的问答，可空）`reportReady` `run` |
| 类型 `InterviewModule` | 等于 `Dimension` |

**请求**

| 请求 | 字段 |
| --- | --- |
| `InterviewStart` | `operationId` |
| `InterviewAnswer` | `operationId` `interviewId` `expectedRevision` `text`（1–2000 字） |
| `InterviewPause` / `InterviewResume` / `InterviewReportRequest` | `operationId` `interviewId` |
| `DraftMonthStage` | `operationId` `reportId` |
| `ConfirmMonthStage` | `operationId` `stageId` `expectedRevision` `action`（accept/defer）`goal`（学生确认或改过的文字） |
| `DeclineRetest` | `operationId` `stageId` |

客户端不能传等级、模块选择或确认记录：多余字段一律 400，冒烟测试已覆盖。

## 4. 存储（`server/storage/repository.ts`，迁移 v5）

- 新集合：`interviews` `interviewTurns` `professionalReports` `monthStages`。
- `interviews`、`monthStages` 按修订追加（键 `id:r<revision>`，`get` 取最新）。修订集合的判断改成了一个集合 `revisioned`，`reviewItems`、`episodes` 的行为不变。
- 这些都是必要学习记录：不看记忆开关，记忆关闭时 `view()` 照样列出（有测试）。
- 「重置整个演示」会清除全部集合（含新增，有测试）。
- `view()` 新增字段：
  - `interviews`、`monthStages`：每个 id 的最新修订；
  - `interviewTurns`、`professionalReports`：全部；
  - `retestReminder`：`RetestReminder | null`。

## 5. 路由

都在 `/api/learning/` 下，需要本机会话 Cookie。POST 另需 Origin 和 CSRF。入参先按 schema 严格校验，插件结果出服务端前再解析一次；报告、月阶段、趋势还要过 `server/agents/professional.ts` 的程序门控，不通过就返回 500 `internal_error`，并且不写库。

| 路由 | 请求 → 返回 | 协调器先做的程序门控 | 委托 | 桩阶段 |
| --- | --- | --- | --- | --- |
| `POST interview/start` | `InterviewStart` → `InterviewStep` | 有未完成测评 → 409；然后 `learning/start {mode:'exploration', switchMode:true}`（第一期的显式切换，沿用同一场次） | interview.`startInterview` | 切到探索模式，然后 501 |
| `POST interview/answer` | `InterviewAnswer` → `InterviewStep` | ① `SAFETY_PATTERN` → 求助回复（`safety:true`），什么都不写，即使测评不存在；② 测评不存在 → 404；③ 不在进行中或没有待答题 → 409；④ `expectedRevision` 过期 → 409 conflict；⑤ `REST_PATTERN` → 走暂停（reason `rest`） | interview.`answerInterview` / `pauseInterview` | 501（安全回复照常） |
| `POST interview/pause` | `InterviewPause` → `InterviewSession` | 不存在 → 404；已暂停 → 原样返回；已完成 → 409 | interview.`pauseInterview`（reason `student`） | 501 |
| `POST interview/resume` | `InterviewResume` → `InterviewStep` | 不存在 → 404；已完成 → 409；然后同 start 进入探索场次（换天会开新场次，插件记下新的 `learningSessionId`） | interview.`resumeInterview` | 501 |
| `POST interview/report` | `InterviewReportRequest` → `ProfessionalReport` | 不存在 → 404；理解或逻辑没测完 → 409；插件结果过 `reportProblems` 后由协调器写入 `professionalReports` | interview.`buildReport` | 501 |
| `POST stage/draft` | `DraftMonthStage` → `MonthStage` | 报告不存在 → 404；本月已确认 / 暂不开始 → 409；`month` 由程序按上海时间算；结果过 `draftProblems`；写入时把本月未确认的旧草案标为 superseded | stages.`draftMonthStage` | 501 |
| `POST stage/confirm` | `ConfirmMonthStage` → `MonthStage` | 不存在 → 404；版本过期 → 409；状态不是 draft / deferred → 409；结果过 `revisionProblems`（confirmation 的 action 与本次点击一致、`confirmedAt` 等于程序时钟、`actor:'student'`，goal 等于学生的文字） | stages.`confirmMonthStage` | 501 |
| `POST stage/retest-decline` | `DeclineRetest` → `MonthStage` | 不存在 → 404；未确认 → 409；已拒绝 → 原样返回；结果过 `revisionProblems` | stages.`declineRetest` | 501 |
| `GET trend` | — → `TrendQuery` | 结果过 `trendProblems` | tracking.`trend` | 501 |

**协调器内部的程序门控**（`server/agents/professional.ts`，所有者 Claude）。这些函数只检查事实与引用，不替插件选题、判级或选模块：

- `reportReady(interview)`：理解和逻辑都完成。`InterviewStep.reportReady` 一律由它覆盖，插件给的值不算。
- `latestRevisions(rows)`：取每个 id 的最新修订。
- `reportProblems(report, facts)`，报告的检查项：
  - 模块按固定顺序出现、正好 5 个；
  - `level === LEVEL_BY_BASIS[basis]`；
  - 已测模块不能标「还没测到」，没测的模块只能标「还没测到」，并且不带依据和建议；
  - 已测模块要有作答依据；「掌握得不错」不附建议；
  - 引用的作答、证据存在，问答属于本次测评；
  - 理解、逻辑都已测；
  - 对照只引用真实存在的观察，并且维度一致；
  - `comparedWithReportId` 存在；`supersedesReportId` 和 `version` 与本测评的上一份报告衔接。
- `draftProblems(stage, {reportId, month})`：来源报告、月份一致；是未确认的第 1 版；复测建议日期在本月。
- `revisionProblems(next, prev, expect)`：同一月阶段的下一版；来源报告、月份、创建时间不可改；确认和拒绝复测必须来自本次点击，并使用程序时钟。
- `trendProblems(trend, reports)`：见第 2 节第 3 条。
- `checkedStep`（协调器私有）：返回的测评就是本次的测评，并且已保存为最新修订；start / resume 的测评关联本次探索场次。

## 6. 插件签名（第二期定死）

共用类型加在 `server/plugins/context.ts`（所有者 Claude）：

```ts
interface ProfessionalContext extends RevampContext {
  submitAttempt(input:SubmitAttempt, signal?:AbortSignal): Promise<{attempt:Attempt; grading:GradingResult}>; // 同 learning/submit：events.submit + Assessor 判分；在调用方的操作里执行，无单独回执
  planning(): PlanningEnginePort;                                    // 已注册的现有计划引擎（提案、确认、版本历史）
  assessment(operationId:string): Promise<AssessmentSnapshot>;
}
interface InterviewStartInput  { operationId; learningSession:LearningSession; previousReport:ProfessionalReport|null }
interface InterviewAnswerInput extends InterviewAnswer { interview:InterviewSession }      // 安全、休息、存在、状态、版本已由协调器查过
interface InterviewPauseInput  { operationId; interview:InterviewSession; reason:'student'|'rest' }
interface InterviewResumeInput { operationId; interview:InterviewSession; learningSession:LearningSession }
interface ReportInput          { operationId; interview; observations:ChatObservation[]; previousReport:ProfessionalReport|null; supersedes:ProfessionalReport|null }
interface MonthStageDraftInput { operationId; report:ProfessionalReport; month:string; previous:MonthStage|null }   // previous = 更早月份最近的阶段
interface MonthStageConfirmInput extends ConfirmMonthStage { stage:MonthStage }
interface RetestDeclineInput   { operationId; stage:MonthStage }
interface RetestReminderInput  { at:string; stages:MonthStage[] }        // 每个月阶段的最新修订
interface TrendInput           { at:string; reports:ProfessionalReport[] } // 全部报告，旧的在前
```

| 文件（所有者） | 导出 | 谁写库 |
| --- | --- | --- |
| `server/plugins/interview/index.ts`（Claude） | `startInterview(input, ctx, signal?): Promise<InterviewStep>`<br>`answerInterview(input, ctx, signal?): Promise<InterviewStep>`<br>`pauseInterview(input, ctx): Promise<InterviewSession>`<br>`resumeInterview(input, ctx, signal?): Promise<InterviewStep>`<br>`buildReport(input, ctx, signal?): Promise<ProfessionalReport>` | 前四个由插件自己写 `interviews` / `interviewTurns`，作答通过 `ctx.submitAttempt`；`buildReport` 只返回，由协调器写库 |
| `server/plugins/stages/index.ts`（zCode） | `draftMonthStage(input, ctx, signal?): Promise<MonthStage>`<br>`confirmMonthStage(input, ctx): Promise<MonthStage>`<br>`declineRetest(input, ctx): Promise<MonthStage>`<br>`retestReminder(input, ctx): RetestReminder \| null` | 都只返回，由协调器过门控后写 `monthStages`。周计划提案、版本经 `ctx.planning()` 由插件生成，并记在 `weeks[]` |
| `server/plugins/tracking/index.ts`（zCode） | `trend(input, ctx): TrendQuery` | 只读 |

桩阶段每个函数都抛 `notImplemented(name)`（`RuntimeError('not_implemented')` → HTTP 501）。`retestReminder` 在桩阶段或返回非法值时，`view().retestReminder` 为 `null`。

另有提示词桩 `server/agents/prompts/interviewer.ts`（Claude），导出 `INTERVIEWER_PROMPT`，版本 `interviewer-g2`，只有最小文本。

**提示和暴露**：测试中的小提示沿用现有 `learning/hint`，传 `{sessionId: interview.learningSessionId, taskId, taskVersion, level}`。它会写暴露，作答的 `hintSnapshot` 里就有，判级时据此分出「提示后完成」。面试不另开提示路由。

## 7. 前端挂载位

组件都是桩，返回 `null`。文件头写了所有者，并导出 `<Name>Props`。`navigate` 的类型都是 `(page:string, tab?:string)=>void`。数据从 `l.view` 取，`LearningView` 的类型随 `view()` 自动更新。

| 组件（所有者） | 文件 | 挂在 | props |
| --- | --- | --- | --- |
| `ProfessionalModeView`（ChatGPT） | `src/components/professional/ProfessionalModeView.tsx` | 探索页（LearningPages `explore`），五维地图之上 | `l` `navigate` `safety:boolean` |
| `ProfessionalReportView`（ChatGPT） | `src/components/professional/ProfessionalReportView.tsx` | 报告页（`report`），标题之下 | `l` `navigate` |
| `GrowthArchive`（ChatGPT） | `src/components/professional/GrowthArchive.tsx` | 成长页（`growth`），错题列表之后 | `l` `navigate`（趋势：`apiRequest<TrendQuery>('learning/trend')`） |
| `MonthStageView`（zCode） | `src/components/plan/MonthStageView.tsx` | 计划页（`plan`），标题之下 | `l` `navigate` `safety:boolean` |
| `WeeklyTasksView`（zCode） | `src/components/plan/WeeklyTasksView.tsx` | 今日页（`today`），复测提醒之下 | `l` `navigate` `safety:boolean` |
| `RetestReminder`（zCode） | `src/components/plan/RetestReminder.tsx` | 首页（`ChatPanel`，安全拦截命中时不渲染）和今日页顶部 | `reminder:RetestReminder\|null`（= `l.view.retestReminder`）`where:'home'\|'today'` `l` `navigate` |

改动的现有文件：
- `LearningPages.tsx`（Claude）：挂上五个组件。
- `ChatPanel.tsx`（ChatGPT 的文件）：只加了一个 import 和一行挂载，与阶段 0 建挂载位的做法相同。
- 底部导航「探索」改名「专业模式」仍是 ChatGPT 的工作，本补丁没有动 `App.tsx`。

## 8. 测试与证据

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck:agent` | 0 | |
| `npm test` | 0 | 25/25 |
| `npm run test:agent`（a b c d e g h i） | 0 | 201/201（第一期集成后 189，加本补丁 12 项） |
| `npm run build` | 0 | built |
| `npm run test:agent:g` / `:h` / `:i` | 0 / 0 / 0 | 47 / 12 / 23 |

完整记录在 `evidence/g2-gates.txt`。第一次跑门禁脚本时每条都是 exit 127：脚本在 zsh 里没有把命令拆成参数，没有真正执行任何命令。改用 `eval` 重跑，文件里是重跑后的结果。

新增测试（三个测试目录各一份，端口都用 `freePort()`，不会和各路开发端口冲突）：

- `tests-agent/g/phase2-contract-smoke.test.ts`（Claude，4 项）：
  - schema：固定顺序、四个等级、本次观察、没有总分和排名、客户端不能传等级；
  - 报告门控的各条边界；
  - 面试路由：门控先生效（会话、schema、安全、存在、状态、版本、理解和逻辑先测完），然后返回 501；`start` 沿用同一场次切到探索模式；桩没有写任何记录；
  - 记忆关闭不影响这些记录；重置会清除。
- `tests-agent/h/phase2-contract-smoke.test.ts`（ChatGPT，4 项，可整体替换）：等级文字；报告没有分数和排名字段；`view()` 的新字段（取最新修订）；三个挂载位渲染为空；`GET trend` 需要会话，返回 501。
- `tests-agent/i/phase2-contract-smoke.test.ts`（zCode，4 项，可整体替换）：
  - 月阶段、趋势、提醒的 schema（确认者只能是学生）；
  - 草案、确认、趋势门控；
  - 月阶段路由的门控和 501；
  - 一个月只有一份有效阶段；
  - 提醒在桩阶段隐藏；重置会清除；
  - 三个挂载位渲染为空。

首次失败留档：这次没有做到先写测试。门控和测试是先后写的，三份冒烟第一次运行就全部通过，所以没有可留档的首次失败。

证据级别：

| 级别 | 状态 |
| --- | --- |
| 静态检查 | 跑了 |
| 规则单测 | 跑了（门控函数） |
| 模拟模型端到端 | 跑了（HTTP 层；插件是桩，只覆盖门控与 501） |
| 真实模型 | 未运行（本补丁不调用模型，没有读取 `.env.server`） |
| 浏览器 | 未运行（挂载位都返回 null；不运行 D 阶段浏览器测试） |
| 真实设备 | 未运行 |

## 9. 给各路的提醒

- **Claude（面试引擎，`revamp/g2-interview`）**：
  - 插件要自己写 `interviews` 修订和 `interviewTurns`，问题打开时记 task 暴露，作答走 `ctx.submitAttempt`；
  - 报告只返回，不写库；`reportProblems` 已经覆盖等级与依据一致、对照引用真实观察、没测的标「还没测到」，引擎测试可以直接复用；
  - 暂停时是否同时暂停 `LearningSession`，补丁没有规定，引擎实现时决定并写测试；
  - 第一期 REPORT-1 留下的「试探的下一轮才能记录回答」也在这一期处理。
- **ChatGPT**：
  - 「开始」按钮调 `interview/start`；有未完成测评（`view().interviews` 里 status 不是 completed）时显示「上次停在：`currentModule`」并调 `interview/resume`；
  - 作答带上 `interview.revision` 作为 `expectedRevision`；
  - `InterviewStep.safety` 为 true 时显示求助信息；
  - 等级文字用 `MODULE_LEVEL_LABELS`。
- **zCode**：
  - 月阶段、复测、趋势都由插件返回值，协调器写库；
  - 「需要加强优先、其次部分掌握」的模块选择是插件里的程序规则，补丁只检查来源报告、月份和未确认状态；
  - 周计划用 `ctx.planning().propose/confirm` 和现有 `learning/confirm`，在新修订的 `weeks[]` 里记下 `proposalId` / `planVersionId`。如果需要一条「把已确认的周计划挂到月阶段」的路由，请提变更申请。
- 第一期 REPORT-1 里退回 ChatGPT、zCode 的问题不在本补丁范围，本补丁没有改。

## 10. 下一步

停在这里，等用户确认：合入 main，打 tag `revamp-base2`。之后三路从 `revamp-base2` 开始第二期。
