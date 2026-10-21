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
| `npm run test:agent:i` | 0 | 17/17（problem 8、memory 7、contract-smoke 2） |
| `npm run test:agent` | **1** | 162 项中 158 通过；仅 `tests-agent/g` 4 条钉死 zCode 桩的断言失败（见 `CONTRACT-REQUEST.md` 第 1 条，g 目录归 Claude，集成时更新） |
| `npm run build` | 0 | |
| `node --import tsx scripts/agent/vision-smoke.ts` | 2 | 无 Key →「未运行」，符合预期 |

**首次失败留档**（`evidence/i-first-run-stub.txt`）：测试写完后用 `git stash` 临时还原两个插件的阶段 0 桩再跑 `test:agent:i`，17 项按预期全部失败（not_implemented / 断言不符），随后恢复实现转绿。这满足「先写能揭露错误的测试、第一次失败原样留档」。修复过程中的真实失败（测试自己的 `f.r` 笔误、题干无冒号时表达式没核对到、greeting 合成模型措辞替换了默认文字）都已在最终版本中改正，无未决失败。

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
