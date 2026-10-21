# 契约变更（第一期集成，2026-10-21）

在 `revamp/integration` 上完成，回应 ChatGPT 和 zCode 的契约变更申请。全部只做加法：旧记录、旧请求照常可用。`learning-contracts.schema.json` 已重新生成。路径相对 `outputs/xiaon/`。

## 1. 已有场次显式切换模式（ChatGPT 申请）

问题：`LearningCoordinator.start()` 在同一天已有未结束的场次时，会直接返回旧场次，忽略请求里的 `mode`。学生确认「去专业模式」后拿到的仍是 support 场次。

做法：**沿用同一场次，用场次事件记录模式切换。** 不关闭旧场次、不新建场次。

- `SessionEvent` 新增可选字段 `mode`。`StudentEvents.sessions()` 取最近一条带 `mode` 的事件作为当前模式（之后的暂停、恢复事件不带 mode，不会改回去），没有这类事件时用场次创建时的 mode。
- `StudentEvents.switchMode({operationId, sessionId, mode})` 追加一条 `{status:'active', mode}` 事件，所以同时会恢复已暂停的场次。场次已结束时返回 `invalid_state`。
- `learning/start` 请求新增可选 `switchMode: true`：
  - 带这个标记、同一天有未结束场次、且模式不同时，切换并返回新模式；
  - 不带标记时行为完全不变，仍返回旧场次和旧模式。`activate`（确认题目）和各处「主动恢复」按钮都不带标记，不会无声改变模式；
  - 换了一天时照旧：关闭旧场次，按请求的模式新开。
- 学生确认「去专业模式」时，`ChatPanel.tsx` 会发送 `switchMode: true`，这是一处接线。ChatGPT 原有的「仍非 exploration 就留在首页并提示」作为兜底保留。
- 不会借切换重置任何东西：场次 id 不变，所以每场次 10 道不同计算题的上限、已有暴露、作答和证据都还在同一场次上。
- 回归测试 `tests-agent/g/mode-switch.test.ts`（3 项）覆盖：
  - 不带标记行为不变；
  - 带标记时同一场次切到 exploration，并留有事件；
  - 切换后计算题上限不重置、暴露数不变；
  - 暂停中切换会恢复，之后再暂停仍保持 exploration；
  - 换天照旧新开场次。

## 2. 确认记忆时选时效（zCode 申请第 2 条）

- `ConfirmMemoryDraft` 新增可选 `retention: 'forever' | '7d' | '30d'`，导出类型 `MemoryRetention`。
- 新增共享纯函数 `retentionWindow(retention, now)`，服务端和页面用同一套换算：
  - `forever` 或不填：`expiresAt: null`，`reviewAt: +30 天`；
  - `7d`：`expiresAt: +7 天`，`reviewAt: null`；
  - `30d`：`expiresAt: +30 天`，`reviewAt: null`。
- zCode 的 `confirmMemoryDraft` 改为调用它，一行。不填时与原来的默认相同。
- `learning/memory-correct` 新增可选 `retention`，记忆页「还适用」和更正时使用。不填保持原行为：不过期、不复核。
- 前端：
  - `MemoryPrompt`（zCode）加了最小的三选一：一直记得 / 记 7 天 / 记 30 天；
  - 记忆页（`LearningPages.tsx`）手动新增和更正都可以选时效；
  - 已到期的记忆显示「已到期，不再进入对话」；
  - 满 30 天待复核的记忆显示「这条还适用吗？」，「还适用」会续 30 天（旧条目停用、写一条新的），「不适用了」会停用。
- 到期和待复核的记忆本来就不进入 Tutor 上下文，`events.context()` 已有过滤。
- 测试 `tests-agent/g/retention.test.ts`（2 项）。

## 3. 题目卡片的挂载位补 `navigate`（zCode 申请第 3 条）

- `ProblemCaptureProps`、`ProblemConfirmCardProps` 都新增 `navigate:(page:string, tab?:string)=>void`，ChatPanel 挂载时传入。
- `ProblemCapture` 去掉 `history.pushState + PopStateEvent` 的绕路，「拍一张」「从题库挑」改为直接 `navigate`。
- 确认卡不需要 `send`：确认后的「就看这道题吧」仍由 `onConfirmed` 交给 ChatPanel 发送。
- 进步卡处的记忆关闭提示：`ProgressCardView` 内部已挂 `MemoryOffNotice where="progress_card"`（第一期 B），无需再改。

## 4. 测试辅助

`server/storage/testing.ts` 新增 `freePort()`：监听 0 端口，由系统分配空闲端口。`tests-agent/d/voice-input.test.ts`（原来写死 18952/18953）和 `voice-stage.test.ts`（原来写死 18950/18951）改用它；仍可用原来的环境变量覆盖。原因：写死的端口和各路开发端口重叠，zCode 的开发服务器正占着 18953。

---

# 契约变更（第二期：面试引擎，2026-10-21）

在 `revamp/g2-interview` 上完成，是实现面试引擎时发现的问题。全部是加法或注释，`learning-contracts.schema.json` 没有变化。路径相对 `outputs/xiaon/`。

## 1. `InterviewTurn.attemptId` 放在追问那一轮（只改注释）

- `CONTRACT-PHASE2.md` 原来写的是「追问为 null」，改为：**作答 ID 放在追问那一轮**，题目轮（question / transfer）为 null。
- 原因：任务书要求把追问的回答作为理由证据交给现有 Assessor。所以要等追问答完，再合成一次作答去判分：
  - 题目有理由评分点（理解、逻辑、建模）时，作答 = 第一行答案 + 换行 + 追问回答；
  - 计算、空间想象只交答案行，追问回答只用来判断「有没有说出理由」。
- 追问仍然不另算一道题。
- 对 ChatGPT 的影响：要显示某道题的作答，取同一道题的追问轮上的 `attemptId`。

## 2. 探索顺序：续测带上本测评已完成的理解、逻辑作答（`server/core/events.ts`，加法）

- 现有规则：探索模式的场次里，打开理解、逻辑以外的题之前，必须先在**本场次**答过理解和逻辑。
- 面试换天续测时会开新场次，旧规则会拦住计算题。这违反任务书「下次从停下的模块接着测，已答的不重问」。
- 改法：判断时同时算上「当前测评在本场次继续时，它的问答所关联的作答」。规则本身不变。
- 这个文件不在任何一路的所有权里，按规则记录在这里；ChatGPT、zCode 不受影响。

## 3. 首页对话观察：试探的下一轮可以记下回答（Claude 自己的文件）

- 回应 REPORT-1 第 5 节留下的问题。
- `StageDecision` 新增 `answerTurn`：试探轮的下一轮，仍在 probe、情绪平稳时为 true。这一轮：
  - 放行 `observation`；
  - 提示词换成 `OBSERVE_ANSWER_PROMPT`（版本后缀 `-observe-answer`），不再试探；
  - 观察只能引用这一句原话。
- `homeTutorPrompt` 多一个可选参数 `answerTurn`。
- `ObservationCheck` 的形状不变：协调器在回答轮把 `probeAllowed` 传 true，`studentTexts` 只传这一句。

## 4. 暂停测评时同时暂停学习场次（行为说明）

- `interview/pause` 和休息用语会把测评标为 paused，同时把所在的 `LearningSession` 设为 paused，与其他地方「休息」的含义一致。
- `interview/resume` 经 `learning/start` 恢复场次，换天时开新场次。
- 对 ChatGPT 的影响：暂停后回到首页，会显示首页原有的暂停提示。
