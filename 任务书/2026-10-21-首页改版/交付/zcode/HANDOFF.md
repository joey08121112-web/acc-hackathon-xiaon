# zCode 路 HANDOFF

本文件自上而下：第二期（最新，周 / 月学习规划与长期跟踪）、第一期（口述卡点与错题记录、记忆与开场问候）。

# zCode 路 HANDOFF · 第二期（周 / 月学习规划与长期跟踪）

编制日期：2026-10-21。分支 `revamp/i2-plan-tracking`，worktree `/Users/ami/Documents/个人/ACC黑客松-wt/zcode2`。基于 `revamp-base2`（main b611610）。先完整读了 `交付/claude/CONTRACT-PHASE2.md`（含第 2 节与任务书的差异、第 9 节给各路的提醒），`server/plugins/planning/**` 与 `src/learning/review/**` 只读未改。

## 1. 范围与未完成项

**已完成**

- **月阶段目标**（`server/plugins/stages/index.ts` → `draftMonthStage`）：模块选择是程序规则（`focusModule`：「需要加强」优先、其次「部分掌握」，同级按 `INTERVIEW_MODULE_ORDER` 固定顺序；都没有 → `invalid_state`，前端也不再给入口）。目标文字由模型措辞（提示词版本 `stage-goal-i2`，内联在插件里，一次、无工具；过长/带分数排名/坏 JSON 回退程序措辞并标 `local_rules`；上个月同模块时措辞接续「继续上个月……」）。复测建议日期 = 当月最后一天；`weeks[]` 草案期是本周到月底各周周一的脚手架（≤6 项，两端都空）。
- **拆周任务**（`confirmMonthStage`）：学生点「定下这个目标」后，用 `ctx.planning().propose`（现有计划引擎，预算 6 分钟与计划页一致）生成本周草案，把 `proposalId` 记进本周 `weeks[]` 项；`planVersionId` 留空——周计划的确认走现有 `learning/confirm`（接受 / 减量 / 改期 / 暂不开始），由学生在计划页完成，本路不替学生确认（这正是契约 §9 预见的「把已确认周计划挂到月阶段」无路由情形；如需把 `planVersionId` 写回 `weeks[]`，要一条新路由 = 契约变更，未申请）。「暂不开始」（defer）不安排任务。
- **今日页**（`WeeklyTasksView`，今日页复测提醒之下）：显示本月目标（模块 + 目标文字）、本周任务及其状态（待确认 / 已暂停 / 等待自主开始 / 已有真实尝试，尝试按计划确认时间之后的作答算）；只显示本周，附「错过的安排不扣分，也不集中堆积」。周计划草案未确认时给出带去计划页的入口。周与月阶段用 `proposalId` 对应 `view().plans` / `view().proposal`，不需要新路由。
- **月底复测提醒**（`RetestReminder` 组件 + `retestReminder` 插件）：从 `retestSuggestedAt` 前 `RETEST_REMIND_DAYS_BEFORE`（3）天起到建议日期当天，首页与今日页显示「可以做一次专业模式复测」；已确认但未拒绝才提醒，草案 / 暂不开始 / 被取代 / 已拒绝一律不提醒；同窗口多月阶段取最近的。拒绝调 `learning/stage/retest-decline`（受下述契约缺陷阻塞，见第 3 节）。
- **长期趋势**（`server/plugins/tracking/index.ts` → `trend`）：`history` = 全部报告 × 5 模块（按报告时间、模块固定序），`latest` = 每月每模块取最近一次报告的点；月份按报告时间的上海月份（UTC 月底的报告正确归到下月）；全部过 `trendProblems` 门控。供 ChatGPT 成长档案用（`GET /api/learning/trend`）。
- **计划页**（`MonthStageView`，标题之下）：本月无阶段且最新报告有可聚焦模块时给「根据最近的评测定一个本月目标」入口（调 `stage/draft`）；报告无可聚焦模块时说明本月不用定加强目标。草案卡显示模块 + 等级文字（`MODULE_LEVEL_LABELS`）+ 可编辑目标 + 复测日期，按钮「定下这个目标 / 暂不开始」（暂不开始后仍可再确认）；已确认显示目标、各周安排状态与「看看评测依据」。
- 月阶段 / 提醒 / 趋势均为学习记录：不受记忆开关影响（HTTP 测试里关掉开关后 `view()` 照常），重置演示清除（已测）。
- 共用日历规则放 `src/components/plan/calendar.ts`（纯函数，服务端插件与组件共用，避免两份周一/月底逻辑漂移）。

**未完成 / 受阻**

- **`POST stage/retest-decline` 恒 500（契约缺陷）**：`revisionProblems` 用 `JSON.stringify` 比较 `confirmation`，仓库 canonical 键序与 zod 输出键序不同，拒绝复测的写入必被门控拒绝。插件逻辑本身正确（单测过门控），路由层面等 Claude 按契约变更申请修复。已提 `CONTRACT-REQUEST.md` 第 4 条（一行修复：改用键序无关的 `hash` 比较）。修复前：学生点「本月先不做」会看到错误提示，提醒继续显示（本月还剩几天窗口）；修复后语义即恢复（拒绝后本月不再提——`retestReminder` 的过滤逻辑已实现并有单测）。
- `weeks[].planVersionId` 恒为 `null`（见上），不申请变更，前端按 `proposalId` 对应。
- 月中重新定目标：契约规定已确认 / 暂不开始的月份 `stage/draft` 409，要变更需走契约流程，未做。
- 真实模型措辞（stage-goal-i2）未跑（无 `.env.server`）；离线回退已测。
- 浏览器测试未跑（约束禁跑 D 阶段；组件用 SSR 断言覆盖文案与入口）。

## 2. 分支、提交与文件清单

- 分支 `revamp/i2-plan-tracking`（从 tag `revamp-base2` 新建），worktree `/Users/ami/Documents/个人/ACC黑客松-wt/zcode2`，提交号见 `git log -1`。
- 只改了 zCode 拥有的文件：
  - `server/plugins/stages/index.ts`（实现四个函数 + `focusModule`、`WEEK_TIME_BUDGET_MINUTES`）
  - `server/plugins/tracking/index.ts`（实现 `trend`）
  - `src/components/plan/{MonthStageView,WeeklyTasksView,RetestReminder}.tsx`（桩→实现）、`src/components/plan/calendar.ts`（新增，纯函数）、`src/components/plan/pointNames.ts`（新增，显示名）
  - `tests-agent/i/plan-tracking.test.ts`（新增 9 项）；`tests-agent/i/phase2-contract-smoke.test.ts` **删除**（契约允许整体替换；其仍有效的断言——schema 学生专属确认、客户端不能选模块 400、路由存在性/版本门控——已并入新文件）
  - 交付物：`任务书/2026-10-21-首页改版/交付/zcode/{HANDOFF.md,CONTRACT-REQUEST.md,evidence/i2-*}`
- 未动：`shared/learning-contracts.ts`、`server/agents/{learning,professional}.ts`、`server/plugins/planning/**`、`src/learning/review/**`、`LearningPages.tsx`、`ChatPanel.tsx` 等他人文件；主目录未动（误写入主目录 CONTRACT-REQUEST 的一次编辑已当场恢复，最终只改 worktree 副本）。

## 3. 运行过的命令与退出码

在 `outputs/xiaon`（worktree 内，Node 26.8.2）：

| 命令 | 退出码 | 备注 |
| --- | --- | --- |
| `npm ci` | 0 | worktree 初装 |
| `npm run typecheck:agent` | 0 | |
| `npm test` | 0 | 25/25 |
| `npm run test:agent:i` | 0 | 28/28（problem 9、memory 8、G0 契约 2、plan-tracking 9） |
| `npm run test:agent` | **1** | 205/206；唯一失败 `tests-agent/h/phase2-contract-smoke.test.ts:47` 钉死「GET trend 桩 501」的阶段 0 快照（本路实现后返回 200）。h 目录归 ChatGPT，集成时更新期望值即可（证据：`evidence/i2-test-agent-all-known-h-conflict.txt`） |
| `npm run build` | 0 | |

**首次失败留档**（`evidence/i2-first-run-stubs.txt`）：测试先于实现编写；桩未导出 `focusModule` 等新符号，整个测试文件在模块加载期失败——桩状态的原样留档。修复过程中的真实失败（测试夹具 attemptId 含中文不合 id 规则、`assert.equal` 误用于对象比较、以及发现 retest-decline 契约缺陷）都已在最终版本处理；无未决失败（除上述 h 路快照与契约缺陷）。

## 4. 证据级别

| 级别 | 状态 |
| --- | --- |
| 静态检查 | 跑了（typecheck、build） |
| 规则单测 | 跑了（focusModule、retestReminder 窗口、trend 推导、declineRetest 修订、组件 SSR） |
| 模拟模型端到端 | 跑了（HTTP 层：草案→确认→周计划→learning/confirm→提醒窗口→拒绝（受契约缺陷阻，断言如实记 500）；合成 Provider 测模型措辞与回退；TestClock 推进 10-26→10-31） |
| 真实模型 | 未运行（本路未读 `.env.server`；模型只用于目标措辞，有离线回退） |
| 浏览器 | 未运行（约束禁跑 D 阶段） |
| 真实设备 | 未运行 |

## 5. 给集成方的入口

- 启动：worktree 内 `XIAON_UI_PORT=5213 XIAON_API_PORT=18953 XIAON_DB_PATH=.local/zcode2.sqlite npm run dev:learning`。
- 走一遍月规划：先有专业评测报告（Claude 面试引擎 `interview/report`，或测试里直接插报告）→ 计划页出现「根据最近的评测定一个本月目标」→ 草案卡（模块由等级决定、目标可改）→「定下这个目标」→ 本周草案进 `view().proposal` 且 `weeks[]` 记 `proposalId` → 计划页下方现有草案卡「接受这份计划」→ 今日页看本月目标与本周任务。
- 走一遍提醒：TestClock 或等到 `retestSuggestedAt` 前 3 天 → 首页与今日页出现复测提醒 →（契约修复后）「本月先不做」→ 提醒消失。
- 走一遍趋势：`GET /api/learning/trend`（需本机会话 Cookie）→ `latest` 每月每模块一点、`history` 全量；ChatGPT 成长档案直接用。
- 已知集成点：`CONTRACT-REQUEST.md` 第 4 条（retest-decline 键序缺陷，修复后翻转 `plan-tracking.test.ts` 里标注的两条断言）；h 路快照期望值；如集成想把已确认周计划写回 `weeks[].planVersionId` 需新路由（契约变更）。

第二期到此为止，不自动开始第三期，不合并别人的分支。

---

# zCode 路 HANDOFF · 第一期（口述卡点与错题记录、记忆与开场问候）

编制日期：2026-10-21。分支 `revamp/i-problem-vision`，worktree `/Users/ami/Documents/个人/ACC黑客松-wt/zcode`。基于 `revamp-base`（main 99a9385）。

## 1. 范围与未完成项

**已完成（第一期 A：口述卡点与错题记录）**
- `validateProblemDraft`：知识点只认现有 6 个（否则 `other`）；`stuckQuote` 必须能在学生本场次原话里找到出处（忽略空白/连字符/全半角标点差异），`questionText`、`studentWork` 找不到出处就丢字段；只剩卡点、没有题目/作答/题库题的草稿不通过（不展示确认卡）。
- `confirmProblem`：写 `problems`；参考答案只进 `problemSecrets`——题库题用题库答案（`catalog`，verified）；有题目文字且配了模型时两次独立解题，一致且 `expression.ts` 能核对时也一致才记 `program_computed`（verified），否则 `unknown` 不写秘密；学生自带参考答案记 `student_provided`（不冒充已核验）。解题失败不影响确认。口述题干没有「化简：」冒号也能提取表达式核对（本地兜底正则）。
- 前端：`ProblemCapture`（拍一张→上传页 / 说给我听→引导卡 / 从题库挑→探索页）、`ProblemConfirmCard`（字段可编辑、记下/改一下/不用了；只有知识点时确认后给题库同类题建议）、`ProblemList`（成长页，按时间倒序，显示来源/知识点/卡点）、`Upload.tsx` 核对页写明「识别功能稍后上线」。
- `problem/confirm` 路由经协调器：卡点关联存在性与知识点一致性由程序先查（阶段 0 已有）。

**已完成（第一期 B：记忆与开场问候）**
- `validateMemoryDraft`：记忆关闭一律拒；情绪/评价类丢弃；>40 字丢弃；`origin` 只认程序给的调用方（chat/progress_card）。
- `shouldOfferMemory`：同一场次最多 2 次提议机会（`memoryMentions` 里 `memoryId:'memory-offer'` 标记计数，宁可少问不多问）。
- `confirmMemoryDraft`：写成现有 `MemoryItem`，`reviewAt = 确认时间 + 30 天`；同时记一条 `chat` 提起（刚确认的事不马上主动提起）。
- `greeting`：优先接最近一份对话小结（`latestSummary`，桩/失败时直接读 `summaries`；小结是学习记录，记忆关闭也用）；否则挑一条 3 天内没提起过的有效记忆（程序挑、模型只措辞、离线用默认文字），提起后写 `memoryMentions`；首次/关闭且无小结/失败 → 默认问候并如实标 `memoryOff`。
- `selectMemoriesForContext`：与近期学生原话有 ≥2 字公共子串才算相关，按相关度、新旧排序，最多 `MEMORY_CONTEXT_MAX_ITEMS` 条；没有相关记忆时不带（经协调器 `capMemorySelection` 复查截断）。旧的「发送全部有效偏好」行为已被替换。
- 前端：`MemoryPrompt`（记住/改一下/不用了，保存学生改后的文字）、`MemoryOffNotice`（记忆已关提示 + 去记忆页打开的入口）。
- `MEMORY_DRAFT_MAX_CHARS=40`、`MEMORY_MENTION_COOLDOWN_DAYS=3`、`MEMORY_REVIEW_DAYS=30` 从 `memory-flow` 导出。

**未完成 / 留给后续期**
- `recognize`（拍照识题）：第三期，本阶段保持 `not_implemented`（路由如实 501）；未遮挡/非 JPEG/超限仍先被 400 拒绝（阶段 0 逻辑）。
- 记忆时效的「记 7 天 / 记 30 天」选择：`ConfirmMemoryDraft` 契约没有该字段，已提 `CONTRACT-REQUEST.md` 第 2 条；当前服务端默认「一直记得 + 30 天复核」。
- 「满 30 天在记忆页提示还适用吗」的 UI 在 `LearningPages.tsx`（Claude 拥有），本路只保证了 `reviewAt` 的服务端行为（到期自动退出上下文），见 `CONTRACT-REQUEST.md`。
- `scripts/agent/vision-smoke.ts`：无 Key 路径已验证（退出码 2「未运行」）；真实模型冒烟**未运行**（worktree 无 `.env.server`，等用户复制后跑 `node --env-file-if-exists=.env.server --import tsx scripts/agent/vision-smoke.ts`）。
- 前端组件未跑浏览器测试（按约束不跑 D 阶段；本路自建浏览器配置留到第三期拍照流程一起做更划算）。

## 2. 分支、提交与文件清单

- 分支 `revamp/i-problem-vision`；阶段 0 提交 `a7f67b5`（rebase 自 revamp-base）；第一期提交见 `git log -1`（本文件随最后一次提交入库）。
- 只改了 zCode 拥有的文件：
  - 服务端：`server/plugins/problems/index.ts`、`server/plugins/memory-flow/index.ts`、`server/agents/prompts/problem-draft.ts`（`problem-draft-i1`）、`server/agents/prompts/memory-draft.ts`（`memory-draft-i1`）
  - 前端：`src/components/learning/home/{ProblemCapture,ProblemConfirmCard,ProblemList,MemoryPrompt,MemoryOffNotice}.tsx`、`src/styles/problem.css`、`src/Upload.tsx`（仅核对页提示文案）
  - 测试：`tests-agent/i/{problem,memory,contract-smoke}.test.ts`（contract-smoke 为整体替换，阶段 0 版本在 git 历史里）
  - 脚本：`scripts/agent/vision-smoke.ts`（阶段 0）
- 未动：`shared/learning-contracts.ts`、`server/agents/learning.ts`、`server/http/server.ts`、`ChatPanel.tsx`、`package.json` 等他人文件；主目录未动。

## 3. 运行过的命令与退出码

在 `outputs/xiaon`（worktree 内，Node 26.8.2）：

| 命令 | 退出码 | 备注 |
| --- | --- | --- |
| `npm ci` | 0 | worktree 初装 |
| `npm run typecheck:agent` | 0 | |
| `npm test` | 0 | 原 25 项规则 |
| `npm run test:agent:i` | 0 | 19/19（problem 9、memory 8、contract-smoke 2） |
| `npm run test:agent` | **1** | 164 项中 160 通过；仅 `tests-agent/g` 4 条钉死 zCode 桩的断言失败（见 `CONTRACT-REQUEST.md` 第 1 条，g 目录归 Claude，集成时更新） |
| `npm run build` | 0 | |
| `node --import tsx scripts/agent/vision-smoke.ts` | 2 | 无 Key →「未运行」，符合预期 |

**首次失败留档**（`evidence/i-first-run-stub.txt`）：测试写完后用 `git stash` 临时还原两个插件的阶段 0 桩再跑 `test:agent:i`，按预期全部失败（not_implemented / 断言不符），随后恢复实现转绿。这满足「先写能揭露错误的测试、第一次失败原样留档」。修复过程中的真实失败（测试自己的 `f.r` 笔误、题干无冒号时表达式没核对到、greeting 合成模型措辞替换了默认文字、首页流程测试的消息没触发 `STUDY_PATTERN` 落在 companion）都已在最终版本中改正，无未决失败。

**交付后深度复查（同日第二轮）修正了三处实现问题并补了测试**：
1. `traceable` 归一后为空串的「原话」（全是标点）会让 `includes` 恒真——已加非空校验，并有用例「。。。」不通过。
2. 情绪/评价正则里单字「差/弱」会误伤「差不多每天练琴」这类事件——改成带语境匹配（数学差/成绩差/很差/差劲/很弱等），并加了不误伤用例。
3. 确认卡底部「保存在小N的服务端」含工程味措辞——改为「保存在这台设备的记录里」。
4. 补测：首页流程合法草稿透传 + 未点「记下」不写入（A1）+ 确认响应无答案字段；greeting 只从有效记忆里挑（过期/到期待复核/已停用不提，B12）；相关记忆超过 5 条的截断。

**复查确认的设计取舍（此前未写明，补充在这里）**：
- `shouldOfferMemory` 计数的是「程序放行的提议机会」（memory-offer 标记），不是模型实际提议次数：模型在放行轮保持沉默也会消耗一次。方向是宁少勿多（学生最多被问两次），与任务书「同一场次最多提议 2 次」的上限语义一致。
- `ProblemConfirmCard` 确认后「只有知识点、没有题目文字」的同类题建议走 `l.choose`（现有选题/支持练习流程），不是 think 聊天——`ProblemConfirmCardProps` 冻结没有 send/navigate，无法在此组件里再发 `start_together`。已在 `CONTRACT-REQUEST.md` 第 3 条一并提出。
- `MemoryOffNotice` 的 `where:'progress_card'` 挂载位：ChatPanel 目前只挂 `where='home'`；进步卡处的提示需要 Claude 的 `ProgressCardView` 或 ChatGPT 在挂载位补一行（props 已支持）。
- 记忆页手动新增表单传 `expiresAt/reviewAt` 空值的问题在 `LearningPages.tsx`（Claude 拥有），本路只能保证自己确认路径带 30 天复核，已在 `CONTRACT-REQUEST.md` 第 2 条提出。

## 4. 证据级别

| 级别 | 状态 |
| --- | --- |
| 静态检查 | 跑了（typecheck、build） |
| 规则单测 | 跑了（17 项 i 路 + 原 25 项 + a–e 批次 158 项通过） |
| 模拟模型端到端 | 跑了（合成 LaneProvider：两次解题、问候措辞、Tutor 上下文；HTTP 层 contract-smoke 覆盖路由、CSRF、重置） |
| 真实模型 | **未运行**（worktree 无 `.env.server`；需要时由用户复制后先跑 vision-smoke 与真实链路） |
| 浏览器 | 未运行（约束禁跑 D 阶段；本路 UI 为规则组件，留第三期一起测） |
| 真实设备 | 未运行 |

## 5. 给集成方的入口

- 启动：worktree 内 `XIAON_UI_PORT=5213 XIAON_API_PORT=18953 XIAON_DB_PATH=.local/zcode.sqlite npm run dev:learning`。
- 走一遍口述错题：首页聊天（需 ChatGPT 打开 `HOME_FLOW`，或直接 POST `/api/learning/chat` 带 `flow:'home'`）→ 第 3 轮起 probe 会给 `askProblem` → `ProblemCapture` 三入口 → 学生口述题目与卡点 → 模型在 probe 轮输出 `problemDraft` → `ProblemConfirmCard` 展示（可改）→「记下」→ `problems`/`problemSecrets` 落库、回复 `start_together` 进 think。成长页看「我的错题」。
- 走一遍记忆：记忆页打开开关 → 聊天里 `memoryDraft` 下发 → `MemoryPrompt` 确认 → 下次 `POST /api/learning/greeting` 主动提起（3 天冷却、TestClock 已测）。关闭开关 → `MemoryOffNotice` 可见、无提议无提起。
- 已知集成点：`CONTRACT-REQUEST.md` 三项（g 测试期望值、`ConfirmMemoryDraft.retention`、`ProblemCaptureProps.navigate`）；`ProblemCapture` 的页面跳转目前走 `pushState + PopStateEvent` 复用 App 的 popstate 契约。

第一期到此为止，不自动开始第二期，不合并别人的分支。
