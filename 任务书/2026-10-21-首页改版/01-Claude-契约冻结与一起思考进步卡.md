# Claude 路：契约冻结、综合模式后端、一起思考与进步卡、专业模式面试引擎、集成

先读 `00-总控与共同约束.md`。本路包含阶段 0（契约冻结与骨架）、第一期（综合模式的对话观察与小结、改造三）、第二期（专业模式契约补丁与面试引擎）、第三期（改造四 A 线），以及每期的集成（见 `04-集成与验收.md`）。

## 阶段 0：契约冻结与骨架（约 1 天）

分支 `revamp/g0-contracts`，从 main 建 worktree `/Users/ami/Documents/个人/ACC黑客松-wt/g0`。目标是让另外两路拿到 `revamp-base` 后，只在自己的文件里填实现，不必改共享文件。

### 1. 共享契约（`shared/learning-contracts.ts`）

只做加法，已有记录必须照常读取。新增并导出（类型名以最终冻结为准，写进 HANDOFF）：

| 类型 | 用途 | 关键字段 |
| --- | --- | --- |
| `ChatStage` | 对话阶段 | `companion`（陪聊）、`listen`、`probe`、`think`、`reflect`、`safety`、`rest` |
| `ChatRequest`（扩展） | 聊天请求 | 原字段 + 可选 `intent`（学生点的选项意图：`study` / `life` / `decline_study` / `start_together`）、可选 `problemId` |
| `ChatReply` | 聊天回复 | `text`、`stage`、`quickReplies`、`suggestions`、`askStudy`、`needsCheck`、`askProblem`（布尔）、`modeSuggestion`（可空，建议切到专业模式时给出）、`problemDraft`、`progressCardDraft`、`memoryDraft`（均可为空） |
| `ChatObservation` | 对话观察 | `dimension`（只允许 `理解` / `逻辑`）、`signal`（`clear` / `partial` / `confused`）、`quote`（学生原话）、`note`、`status: 'unverified'`、`sessionId`、`at` |
| `ConversationSummary` | 对话小结（学习记录） | `topics`（聊了什么，不含情绪标签）、`observationIds`、`comparedWithSummaryId`（可空）、`changes`（和上次比）、`planSuggestions`（1–3 条）、`suggestProfessionalMode`（布尔）、`progressCardId`（可空）、`createdAt` |
| `ProblemDraft` / `ProblemRecord` | 错题记录 | `source`（`photo` / `spoken` / `catalog`）、`questionText`（可空）、`studentWork`（可空）、`knowledgePointId`（现有 6 个之一或 `other`）、`stuckPoint`（学生原话）、`answerStatus`（`verified` / `unknown`）、`confirmedAt` |
| `ModelMessage`（扩展） | 图文消息 | `content` 允许文字与图片分段，供 zCode 第三期识图；纯文字调用不变 |
| `ProblemSecret` | 只存服务端的参考答案 | `problemId`、`answer`；**任何视图、日志和前端都不得出现** |
| `LearningEpisode` | 一段教学片段 | `problemId` 或题库题引用、`stage`、`helpLevelsUsed`、`studentSolvedAt`、`status` |
| `ProgressCardDraft` / `ProgressCard` | 进步卡 | `breakthrough`、`method`、`nextTry`、`confidence`（可空枚举）、AI 草稿与学生确认文本分开保存、`skipped` 栏位 |
| `MemoryDraft` | 记忆草稿 | `text`、`kind`（`event` / `interest` / `method`）、`origin`（`chat` / `progress_card`） |
| `Greeting` | 开场问候 | `text`、`memoryId`（可空）、`memoryOff`（布尔） |
| 请求 schema | 新路由入参 | `ConfirmProblem`、`Recognize`（JPEG base64，上限约 1.5MB，`maskConfirmed: true` 必填）、`ConfirmProgressCard`、`ConfirmMemoryDraft`、`GreetingRequest`、`EndConversation` |

确认后的记忆仍写成现有 `MemoryItem`（`source: 'student_explicit'`，因为学生点了确认），不新增记忆来源类型。运行 `npm run schema:agent` 更新 JSON Schema。

### 2. 存储与路由

- `server/storage/repository.ts`：新增集合 `problems`、`problemSecrets`、`episodes`、`progressCards`、`memoryMentions`（记录哪条记忆何时被提起过）、`observations`、`summaries`。`problemSecrets` 不进入 `view()`；`observations` 和 `summaries` 属于必要学习记录，不受记忆开关影响，重置演示时一并清除。
- `server/http/server.ts`：新增 `/api/learning/problem/confirm`、`/api/learning/recognize`（只对它放宽请求体上限，做法同语音识别路由）、`/api/learning/progress-card/confirm`、`/api/learning/memory/confirm-draft`、`/api/learning/greeting`、`/api/learning/conversation/end`。
- `server/agents/learning.ts`：每个新路由委托给对应插件函数；插件函数在阶段 0 只抛 `not_implemented`。

### 3. 插件桩（各路填实现）

| 文件 | 导出函数（签名阶段 0 定死） | 所有者 |
| --- | --- | --- |
| `server/plugins/problems/index.ts` | `validateProblemDraft`、`confirmProblem`、`recognize` | zCode |
| `server/plugins/progress/index.ts` | `draftProgressCard`、`confirmProgressCard` | Claude |
| `server/plugins/conversation/index.ts` | `validateObservation`、`endConversation`、`latestSummary` | Claude |
| `server/plugins/memory-flow/index.ts` | `validateMemoryDraft`、`confirmMemoryDraft`、`greeting`、`shouldOfferMemory` | zCode |

### 4. 对话阶段机（`server/agents/stages.ts`）

阶段由程序按事件决定，模型和前端都不能自己跳。阶段 0 实现综合模式的倾听、陪聊、追问和几个程序信号，一起思考与看见进步先留接口：

- 打开首页：小N先开口（问候走 `/api/learning/greeting`）。学生第一句后进入 `listen`，至少倾听 2 轮。
- 之后学生提到学习（点了学习选项，或消息命中考试、成绩、错题等关键词）→ `probe`；否则 → `companion`，停留在陪聊直到出现学习意图。
- 确定需求：倾听满 2 轮且学生最近一句没有命中情绪强烈的关键词时，回复带一次 `needsCheck: true`，前端给出「继续聊聊」「看看哪里没考好」「做个正式测试」三个选项。选测试时回复带 `modeSuggestion`，学生点确认才切到专业模式。
- 问学习：连续 6 轮陪聊后，回复带一次 `askStudy: true`。学生拒绝（`intent: decline_study` 或明确拒绝的话）后，本场次不再问。
- 引导上传：`probe` 阶段学生提到具体哪道题做错时，回复带 `askProblem: true`，前端显示 zCode 的三个入口。
- 理解 / 逻辑试探：只在 `probe` 阶段，且距上次试探至少 3 轮；`listen` 阶段和学生情绪激动时不试探。允许试探的轮次由程序在提示词里打开，模型自己不能决定。
- `probe` → `think`：有已确认的错题记录或已激活的题库题，并且学生同意一起看（`intent: start_together`）。
- `think` → `reflect`：学生自己说出了正确结果（程序比对参考答案）、或说「懂了」、或一起思考达到 10 轮。
- `reflect` → `companion`：进步卡确认或跳过之后。
- 安全拦截与休息照旧优先于一切阶段。

每个阶段只允许模型输出对应字段：`companion` / `listen` 可带 `memoryDraft`；`probe` 可带 `problemDraft`，在允许试探的轮次还可带一条 `observation`；`reflect` 可带 `progressCardDraft` 和 `memoryDraft`。不允许的字段由程序丢弃，并记入轨迹。

### 5. 提示词拆分

把 `roles.ts` 里的 Tutor 提示词拆为通用规则加阶段块，阶段块放到 `server/agents/prompts/`：`companion.ts`（ChatGPT），`memory-draft.ts`、`problem-draft.ts`、`recognize.ts`（zCode），`think.ts`、`reflect.ts`、`observe.ts`、`summary.ts`（Claude）。通用规则第 6 条（不讲题）改为按阶段放开：`probe` 阶段可以给解题思路，但不给完整答案。阶段 0 只给最小可用文本，并在文件头写明所有者。`listen` / `probe` 现有文本保留在 `roles.ts`。

### 6. 前端挂载位

- 新建 `src/components/learning/home/`，含 `HomeChat`、`MemoryPrompt`、`MemoryOffNotice`、`NeedsCheckCard`、`ModeSwitchCard`、`ConversationSummaryView`、`ProblemCapture`、`ProblemConfirmCard`、`ProblemList`、`ProgressCardView` 桩组件（先返回 `null`），每个文件头写所有者。`ProblemList` 挂在成长页，其余挂在 `ChatPanel`。
- `ChatPanel.tsx` 在合适位置渲染这些组件，并把 `ChatReply` 的对应字段传进去。
- 新建 `src/styles/home.css`、`problem.css`、`progress.css`，在入口引入。
- `useLearning` 增加读取 `ChatReply` 新字段的类型，不改现有行为。
- 新增 `src/agents/devMode.ts`（浏览器本地开关，默认关），用它隐藏 `LearningStatus` 和「查看 Agent 与工具轨迹」。设置页里的开关由 ChatGPT 加。

### 7. 测试脚手架

- `scripts/agent/test.mjs` 的 `all` 加入 `g`、`h`、`i`；`package.json` 加 `test:agent:g`、`test:agent:h`、`test:agent:i`。
- 三个目录各放一份契约冒烟测试：新 schema 可解析，新路由在桩阶段返回 `not_implemented`，`problemSecrets` 不出现在 `view()`。另外两路可以替换这份测试。
- 阶段机单测：倾听至少 2 轮、确定需求只问一次、陪聊停留、6 轮后问一次学习、拒绝后不再问、试探频率上限、安全优先。

### 8. 与已有卡点补丁对齐、记忆与长度的程序门控

- main 上的 `8a97be9` 已有 `stuckPoints` 实体、`record_stuck_point`、`get_latest_feedback` 和 prompt `tutor-d3`。不要另起一套重复的卡点概念：`ProblemRecord.stuckPoint`、`ChatObservation` 与 `stuckPoints` 对齐（复用或写清转换关系）；拆提示词时保留 tutor-d3 的规则；`tests-agent/d/stuck-point.test.ts` 等现有测试继续通过。
- 「学生确认」只能由程序根据学生的点击或输入写入。现有由模型传入的确认字段改为程序判定，或在 CONTRACT.md 列为待修。
- `memory-flow` 插件桩加 `selectMemoriesForContext`（zCode 实现），协调器构建 Tutor 上下文时调用；桩阶段保持现有行为。
- Tutor 回复长度由阶段机做程序校验（建议不超过 80 字），超长重试一次，仍超长截断到句末。

### 阶段 0 完成标准

全部现有测试和新增测试通过，`npm run build` 成功。写 `交付/claude/CONTRACT.md`，列出所有新导出符号、路由、插件函数签名和挂载位 props。然后停下，请用户确认合入 main 并打 tag `revamp-base`。

## 第一期 A：综合模式的对话观察与小结（约 1.5 天，先做）

分支 `revamp/g-think-card`，worktree `/Users/ami/Documents/个人/ACC黑客松-wt/claude`，从 `revamp-base` 开始。这是首页第一优先功能的后端，先于改造三完成，方便 ChatGPT 尽早联调界面。

### 对话观察（`observe.ts`、`validateObservation`）

- 试探的问法：不问「你读懂了吗」，而是问学生提到的题目里某个具体条件的意思（理解），或「你怎么确定这一步是对的、反过来会怎样」（逻辑）。语气像同学闲聊，一次只问一个。
- 模型在允许试探的轮次可以输出一条 `observation`。程序校验：维度只能是理解或逻辑；`quote` 必须逐字出自学生本场次说过的话；同一场次每维最多 3 条；不通过就丢弃。
- 计算、建模、空间想象只作为「可能的卡点」写进小结的计划建议，不记观察。
- 观察一律 `status: 'unverified'`，不写入评分证据、不改知识点状态。

### 对话小结（`summary.ts`、`endConversation`）

- 触发：前端调用 `/api/learning/conversation/end`（学生点「今天先聊到这」），或学生消息命中道别用语时程序自动触发。
- 模型生成草稿，程序装配并校验：
  - `topics` 只写科目、题型、发生了什么，不写情绪标签（如「他很焦虑」一律丢弃）。
  - `observationIds` 只引用本场次已保存的观察。
  - `changes`：有上一份小结时，逐条对比同一维度的观察，只写有原话支持的变化；没有上一份就留空。
  - `planSuggestions` 1–3 条，每条一个小动作。
  - `suggestProfessionalMode`：本场次最后 2 轮命中强烈情绪关键词时为 false，否则在有观察或有卡点时为 true。
  - 本场次做过题并确认了进步卡时，挂上 `progressCardId`。
- 小结写入 `summaries`，学生在成长页可以看到历次小结；问候接口用 `latestSummary` 做对比开场。
- 成长页（`LearningPages.tsx`）新增「对话小结」列表，标注「聊天观察，待专业模式确认，不是评分」。

### 测试

观察原话不是学生说的就丢弃；`listen` 阶段不产生观察；试探间隔不足 3 轮时丢弃；情绪标签进不了小结；无上次小结时 `changes` 为空；情绪强烈时不建议专业模式；记忆关闭时小结照常保存。

## 第一期 B：改造三，一起思考与进步卡（约 3 天）

### 一起思考（`think` 阶段）

- 按 PRD v1.1 FR16 逐级帮助：先请学生复述条件或下一步想法 → 指向一个关系或符号 → 展示必要的局部步骤。一次只问一个问题。
- 每一级帮助都写一条暴露事件；提示后完成如实记为「提示后完成」，不算独立完成。
- 完成前不给最终答案。现有答案拦截扩展到错题记录：用 `ProblemSecret` 比对回复，命中就拦下。学生已经自己说出答案之后才放行。
- 学生完成后，主动要解析可以给（决定 7）。
- 快捷回复：「我想想」「给我一点提示」「我算出来了」「先停一下」。
- 片段状态写入 `episodes`，刷新或重启后能接着聊。

### 看见进步（`reflect` 阶段）与进步卡

- 先请学生自己说说这次收获，可以跳过。
- `draftProgressCard` 由模型生成三栏草稿和一句记忆草稿。程序校验：引用的过程必须来自本片段；有提示时不能写「完全靠自己」；信心只能来自学生的自评。
- `ProgressCardView`：三栏可编辑、可跳过某栏，加可跳过的信心自评；点确认才调用 `confirmProgressCard`。AI 草稿和学生最终文本分开存。
- 记忆草稿只传给 `MemoryPrompt`（zCode 实现）展示，本路不直接写记忆。
- 记忆关闭时 `progressCardDraft` 照常生成，`memoryDraft` 为空；提示文案由 zCode 的 `MemoryOffNotice` 负责。
- 成长页（`LearningPages.tsx`）列出历次进步卡，标注「对话小结，不是评分」。进步卡不进入评分证据。

### 测试（`tests-agent/g`）

阶段切换全路径；`think` 阶段回复含参考答案时被拦截；提示后完成如实记录；学生说出正确答案后进入 `reflect`；进步卡未确认不保存；含提示的片段不能生成「完全靠自己」；记忆关闭时不产生记忆草稿；重启后片段能接续。

联调时可以先用题库题；错题记录用 `ProblemRecord` 合成夹具，不依赖 zCode 分支。

## 第二期：专业模式的契约补丁与面试引擎（约 3–4 天）

从第一期集成后的 main（tag `revamp-phase1`）开始。

### 1. 契约补丁（约 0.5 天，先做，完成后另外两路才开始）

分支 `revamp/g2-contracts`，新增：

| 类型 | 用途 | 关键字段 |
| --- | --- | --- |
| `InterviewSession` | 一次专业模式测评 | `moduleOrder`（固定为理解、逻辑、计算、建模、空间想象）、`currentModule`、`completedModules`、`status`（进行中 / 暂停 / 完成）、`startedAt`、`pausedAt`，关联现有探索场次 |
| `InterviewTurn` | 一问一答 | 模块、题目引用、小N的问法、学生回答、是追问还是加问题、关联的作答 ID |
| `ModuleLevel` | 模块等级 | `good` / `partial` / `needs_work` / `not_tested`，附证据 ID 和「本次观察」标记 |
| `ProfessionalReport` | 评测报告 | 各模块等级与依据、对综合模式待核实观察的确认结果、和上次比、学习建议；保存为版本化快照 |
| `MonthStage` | 月阶段目标 | 月份、目标、来源报告、关联周计划版本、复测建议日期、学生确认记录 |
| `TrendPoint` | 长期趋势 | 月份、模块、等级、来源报告 |

同时加路由（开始 / 回答 / 暂停 / 继续 / 出报告、月阶段的草案 / 确认、趋势查询）和插件桩：`server/plugins/interview/`（Claude）、`server/plugins/stages/`、`server/plugins/tracking/`（zCode）；在探索页、报告页、计划页、今日页、成长页留挂载位（`ProfessionalModeView`、`ProfessionalReportView`、`GrowthArchive` 归 ChatGPT，`MonthStageView`、`WeeklyTasksView`、`RetestReminder` 归 zCode）。写 `交付/claude/CONTRACT-PHASE2.md`，请用户确认合入 main 并打 tag `revamp-base2`。

### 2. 面试引擎（`server/plugins/interview/`、`prompts/interviewer.ts`）

分支 `revamp/g2-interview`，从 `revamp-base2` 开始。

- **顺序与续测**：理解、逻辑必测且先测，之后依次是计算、建模、空间想象。随时可以暂停；下次进入时从停下的模块接着测，已答的不重问。
- **选题**：每个模块先用该模块的观察题；答错时加问一道同类题（迁移题）。题目全部来自现有题库，不让模型现场出测评题。沿用现有的先修规则和每场次计算题上限。
- **出题与追问**：小N用轻松的聊天口吻把题目说出来（像闯关，不像考试）。学生作答后追问一两句「你是怎么想的」「为什么这样」。追问的回答作为理由证据，交给现有的 Assessor 按 rubric 分析。
- **作答与判分**：每道题的作答照常走现有提交和判分，写入作答、证据和暴露事件。追问不另算一道题。小提示照常记为暴露，提示后完成如实分类。
- **等级判定（程序）**：每个模块根据本次证据判定。答对且理由清楚 → 掌握得不错；答对但理由不全，或提示后完成，或加问题才答对 → 部分掌握；观察题和加问题都没答对 → 需要加强；没测 → 还没测到。阈值写成常量并有单测。模型只负责把等级说成学生能懂的话，不能改等级。
- **对照**：报告里列出综合模式中同维度的「待核实」观察，标明本次是「得到确认」还是「没有看到」。有上次报告时，逐模块写变化。
- **学习建议**：每个「部分掌握 / 需要加强」的模块给一两条具体建议，交给 zCode 的月阶段和周任务使用。

### 3. 测试（`tests-agent/g`）

模块顺序不可跳过理解和逻辑；暂停后续测从正确模块开始、不重问；答错时才加问；等级判定的每条边界；模型输出的等级与程序不一致时以程序为准；报告中的对照只引用真实存在的观察；没测的模块标「还没测到」。

## 第三期：改造四 A 线，扩展出题模板（本轮暂缓）

题库扩充暂缓，本节先不做。第三期 Claude 改做：第三期集成的准备与全量回归；把 PRD v1.1 需要改的条文（FR02、FR05、FR07、FR09、FR13、FR17）写成修订草案，交用户决定。以下保留原设计，供题库扩充后使用。

分支 `revamp/g3-templates`，从第二期集成后的 main 开始。

- 与用户确认新增哪 2 个知识点（建议从错题记录里出现最多的选）。
- 先在 `server/plugins/assessment/catalog.ts` 加技能和题库题（此文件需要先写契约变更申请，因为属于 B 阶段所有者范围），再在 `templates.ts`、`validator.ts`、`expression.ts` 加模板与校验。
- 每个模板配独立算术测试；生成题照常进入评分和复习。

## 集成

见 `04-集成与验收.md`。
