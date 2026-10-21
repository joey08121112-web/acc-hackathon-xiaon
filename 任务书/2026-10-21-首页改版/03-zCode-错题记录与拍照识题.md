# zCode 路：错题记录与口述卡点、记忆、周月规划与长期跟踪、拍照识题

先读 `00-总控与共同约束.md`，再读 Claude 阶段 0 交付的 `交付/claude/CONTRACT.md`（里面有 `ProblemDraft`、`ProblemRecord`、`ProblemSecret`、`Recognize` 等类型和插件函数签名）。

分支 `revamp/i-problem-vision`，worktree `/Users/ami/Documents/个人/ACC黑客松-wt/zcode`，端口 5213 / 18953，测试目录 `tests-agent/i`。

## 先读这些代码

- `outputs/xiaon/README.md`、`.env.example`：模型配置，`XIAON_GLM_*`。
- `server/providers/glm.ts`、`config.ts`：现有智谱调用，只发文字。
- `server/agents/roles.ts`、`server/agents/stages.ts`：Tutor 的追问阶段（`probe`）和阶段机。
- `server/voice/asr.ts` 与 `server/http/server.ts` 的 `/api/voice/asr`：大请求体只转发一次、不存储的现成做法，识图照着做。
- `src/Upload.tsx`、`src/App.tsx` 的上传页区块：现有选图、裁剪、遮挡、手动核对。
- `server/plugins/assessment/catalog.ts`：现有 6 个知识点和题库。
- `server/plugins/generation/expression.ts`：现有代数式计算，可用来核对参考答案。

## 阶段 0（可选）：视觉模型冒烟测试（与 Claude 阶段 0 并行）

- 可以先从 main 建本路分支和 worktree，只新增 `scripts/agent/vision-smoke.ts`。`revamp-base` 出现后执行 `git rebase revamp-base`（只有这一个新文件，不会冲突）。
- 脚本做法：用 Playwright 渲染一段合成错题的 HTML（参照 `Upload.tsx` 里的示例学习单：「化简：3x − (2x − 5)」和一行学生的错误尝试），截图得到 PNG，转 JPEG 后按智谱官方文档的图文消息格式发给 `glm-5.3-flash`，要求返回题干和学生作答的 JSON。
- 没有 Key 时退出码 2 并写「未运行」。日志只记状态、耗时、是否识别正确，不记 Key 和图片内容。
- 结果写进本路 HANDOFF。如果模型不支持图片或套餐不允许，立刻告诉用户，第三期方案需要调整。

## 第一期 A：口述卡点与错题记录（约 2 天）

学生不必拍照，也可以直接说出哪里不会。三条路最后都存成同一种错题记录，供 Claude 的「一起思考」和后续出题使用。

1. **三个入口**（`ProblemCapture`）：回复带 `askProblem: true`（学生在聊天里提到哪里考差、哪道题做错），或学生点了「陪我看看这张卷子吧」时，在首页对话里出现「拍一张」「说给我听」「从题库挑」三个按钮（布局由 ChatGPT 负责，本路实现组件内容）。
   - 「说给我听」：提示学生用话筒或打字说说是什么题、卡在哪一步，也可以直接念出题目。
   - 「拍一张」：第一期先进入现有上传页，走手动输入题目，并写明「识别功能稍后上线」；第三期接入识图。
   - 「从题库挑」：进入现有探索页。
2. **追问时生成草稿**（`prompts/problem-draft.ts`）：在 `probe` 阶段，学生说清了题型或题目、以及卡在哪里之后，模型输出一份 `problemDraft`（`source: 'spoken'`）。
3. **程序校验**（`validateProblemDraft`）：
   - `knowledgePointId` 只接受现有 6 个之一，否则改为 `other`。
   - `stuckPoint` 和 `questionText` 必须能在学生本场次说过的话里找到出处，不能是模型编的；找不到就丢弃该字段。
   - 草稿不完整时不展示确认卡。
4. **确认卡**（`ProblemConfirmCard`）：「我记下的是：……，对吗？」字段可编辑，按钮「记下」「改一下」「不用了」。只有点「记下」才调用 `confirmProblem` 写入 `problems`。
5. **参考答案**（`confirmProblem` 内部）：有完整题目文字时，两次独立调用模型解题；两次一致，并且能用 `expression.ts` 核对的也一致，才写入 `ProblemSecret`，`answerStatus` 记为 `verified`；否则记为 `unknown`。参考答案绝不返回给前端、不写日志。
6. **只有知识点、没有题目文字时**：确认后给出该知识点在题库里的同类题建议（复用现有选题工具），由学生确认后进入「一起思考」。
7. **我的错题**（`ProblemList`，挂在成长页，阶段 0 已留好挂载位）：按时间列出已确认的错题记录，显示来源、知识点和卡点；第三期出题的入口会放在这里。

### 测试（`tests-agent/i`）

- 未确认的草稿不写入；「改一下」保存的是学生改后的文字。
- 知识点不在列表里时改为 `other`；模型编造的卡点或题目被丢弃。
- 两次解题不一致时 `answerStatus` 为 `unknown`，且不写 `ProblemSecret`。
- `view()`、HTTP 响应和日志里都找不到参考答案。
- 模型离线时，口述仍能手动确认错题记录（不生成参考答案）。

## 第一期 B：改造五，记得你说过的小事（约 2 天）

对应海报 04：你说过的小事，我都认真记得；哪些事情值得留下，由你决定。代码放在 `server/plugins/memory-flow/`、`server/agents/prompts/memory-draft.ts`、`src/components/learning/home/MemoryPrompt.tsx`、`MemoryOffNotice.tsx`，测试放在 `tests-agent/i/memory-*`。首次介绍里问记忆开关由 ChatGPT 做。

1. **对话里提议记住**：`companion` / `listen` / `reflect` 阶段，模型可以按 `prompts/memory-draft.ts` 输出一句 `memoryDraft`。程序（`validateMemoryDraft`）校验：
   - 只记事件、兴趣、有用的方法；情绪和对人的评价不记（例如「他很焦虑」「数学差」一律丢弃）。
   - 长度不超过 40 字；记忆关闭时一律丢弃。
   - 同一场次最多提议 2 次（`shouldOfferMemory`）。
2. **确认界面**（`MemoryPrompt`）：小N问「要我记住这件事吗？」，显示草稿，三个按钮「记住」「改一下」「不用了」。只有点「记住」才调用 `confirmMemoryDraft`，写成现有 `MemoryItem`（`source: 'student_explicit'`、`purpose: 'tutoring'`）。进步卡带来的记忆草稿（`origin: 'progress_card'`）走同一个界面。
3. **记忆关闭时的提示**（`MemoryOffNotice`）：首页和进步卡处显示「记忆已关，小N不会记住这次的方法，下次也不会主动提起」，带一个去打开的入口（跳到记忆页的开关）。
4. **下次主动开口**（`greeting`）：
   - 有上一份对话小结时，优先用 Claude 提供的 `latestSummary` 接上次的话题（小结是学习记录，记忆关闭时也可以用），例如「上次你说应用题读着绕，这几天怎么样？」。
   - 否则从有效记忆里挑一条，优先最近没提起过的，例如「上次说的篮球赛，后来怎么样了？」。挑哪条由程序定，模型只负责措辞。
   - 提起后写入 `memoryMentions`，同一条记忆 3 天内不再提。
   - 首次见面、记忆关闭且没有小结、或模型失败时，返回默认问候并标明 `memoryOff`。
5. 记忆页照常可以查看、更正、停用、删除；删除后不再进入任何上下文和问候。
6. **按需取用**（`selectMemoriesForContext`，阶段 0 已留接口）：每轮 Tutor 上下文只取与当前话题相关的 3–5 条有效记忆，总长度不超过 300 字；去重；同一件事有更正时只取最新。现在是发送全部有效偏好，需要改掉。
7. **时效与复核**：确认记忆时可以选「一直记得」「记 7 天」「记 30 天」；长期记忆满 30 天后，在记忆页提示「这条还适用吗？」。后端已有 `expiresAt` / `reviewAt` 过滤，页面目前都传空值，需要接上。

### 测试

- 记忆关闭：不提议、不提起，提示可见；打开后才提议。
- 未点「记住」不保存；「改一下」保存的是学生改后的文字。
- 情绪类草稿被丢弃；同场次提议不超过 2 次。
- 问候优先接上次小结；只引用有效记忆；删除后的记忆不再被提起；3 天内不重复（用 TestClock）。
- 没有模型时问候仍能返回默认文字。
- Tutor 上下文里的记忆不超过 5 条、300 字；过期和到期待复核的记忆不进入上下文。

## 第二期：周 / 月学习规划与长期跟踪（约 3 天）

等 Claude 的第二期契约补丁合入 main 并打 tag `revamp-base2` 后，从它新建分支 `revamp/i2-plan-tracking`。先读 `交付/claude/CONTRACT-PHASE2.md`，再读现有计划模块 `server/plugins/planning/**` 和 `src/learning/review/**`（只读，不改；需要改时写契约变更申请）。

1. **月阶段目标**（`server/plugins/stages/`）：根据最新的专业评测报告，为「需要加强」优先、其次「部分掌握」的模块生成一个月阶段目标，例如「读题时能自己找出全部条件」。模型只负责措辞，选哪个模块由程序按等级决定。学生确认后保存为 `MonthStage`。
2. **拆周任务**：把月目标拆成每周 2–4 个小任务，通过现有计划模块的公开接口生成周计划草案，沿用接受 / 减量 / 改期 / 暂不开始的确认流程。不绕开现有计划版本和历史。
3. **今日页**（`WeeklyTasksView`）：显示本月阶段目标、本周任务和完成情况；错过的任务不扣分、不堆积，沿用现有规则。
4. **月底复测提醒**（`RetestReminder`）：月阶段到期前 3 天起，在首页问候和今日页提示「可以做一次专业模式复测，看看这个月的变化」。只在 app 内提醒；学生拒绝后本月不再提。
5. **长期趋势**（`server/plugins/tracking/`）：按月汇总每个模块的等级，形成 `TrendPoint`，供 ChatGPT 的成长档案展示。同一月多次测评取最近一次，并保留全部历史。
6. 规划、月阶段、趋势都是学习记录，不受记忆开关影响；重置演示时一并清除。

测试：月目标的模块选择符合等级优先级；不确认不生效；周任务走现有计划版本；拒绝复测后本月不再提醒；趋势取同月最近一次且历史可查。使用 TestClock 推进日期，不改电脑时间。

## 第三期：拍照识题（约 3 天）

第二期交付后可以直接在新分支 `revamp/i3-vision`（从第二期集成后的 main 开始）继续。

### 前端（`src/Upload.tsx`、`App.tsx` 上传页区块、`ProblemCapture`）

1. 保留选图、裁剪、遮挡三步。**遮挡步骤必经**：要么画了遮挡，要么点「没有需要遮挡的」，才能继续。
2. 只发送裁剪后的部分。前端压缩：长边不超过 1280 像素，转 JPEG，目标约 300KB。
3. 发送前显示说明：「将把裁剪后的这一张图片发送给智谱 GLM（glm-5.3-flash），只用于识别题目文字；服务器不保存这张图片。」学生点确认才发送。
4. 识别结果用 `ProblemConfirmCard` 展示：题目、我的作答、知识点都可编辑；看不清时如实说「这张没看清」，提供重拍或手动输入，不硬猜。
5. 确认后回到首页对话，小N从「这道题哪里让你觉得难？」接着聊。
6. 原上传页「明确选择：体验原创示例题」的跳转改为带题目回首页对话。

### 服务端

1. `server/providers/glm.ts`：按智谱官方文档的格式支持图文消息（契约里 `ModelMessage` 已允许图文分段）。纯文字调用的行为不能变，现有测试必须照常通过。
2. `server/providers/config.ts`：可选 `XIAON_GLM_VISION_MODEL`，默认与 `XIAON_GLM_MODEL` 相同。同步更新 `.env.example` 的注释（需写契约变更申请，因为该文件属于 Claude）。
3. `recognize`（`server/plugins/problems/`）配合 `prompts/recognize.ts`：
   - 请求必须带 `maskConfirmed: true`，否则拒绝。
   - 图片只在内存里转发一次：不写数据库、不写日志、不进模型轨迹的原文。
   - 输出用 zod 校验：题干、学生作答、知识点猜测、是否看不清、把握度。不合格重试一次，仍不合格就返回「没看清」。
   - 识别出的题目照第一期第 5 条生成参考答案。
   - 单独超时（建议 60 秒），超时和取消不留下半成品。
4. 未配置模型时，「拍一张」直接进入手动输入，并写明当前没有识别服务。

### 测试

- 未确认遮挡的请求被拒；超过大小上限被拒。
- SQLite 文件、服务日志、轨迹里检索不到图片的 base64 片段。
- 看不清、模型返回乱格式、超时三种情况都有明确提示，不发布错题记录。
- 纯文字聊天在改动 `glm.ts` 后行为不变。
- 浏览器测试用本路自建配置（输出写系统临时目录），用合成学习单走一遍：拍照 → 裁剪 → 遮挡 → 发送说明 → 核对 → 回到对话。**不要跑 D 阶段浏览器测试。**
- 有 Key 时用合成图跑一次真实识别，记录结果；没有 Key 写「未运行」。

### PRD 同步

PRD v1.1 FR13 写着「本版不默认外发原图」。不要直接改 PRD，在 HANDOFF 里附一段建议的新条文：接收方、发送内容、不保存、失败路径。

## 交付

写 `任务书/2026-10-21-首页改版/交付/zcode/HANDOFF.md`（格式见总控第八节），随本分支提交。每期各写一节。完成就停，不合并别人的分支。
