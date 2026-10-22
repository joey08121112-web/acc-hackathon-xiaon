# 学伴小N negative-brackets 教学闭环交接

[执行任务书](/Users/ami/Documents/个人/ACC黑客松/任务书/2026-10-22-学习Agent教学闭环/执行任务书.md)。

交付时间：2026-10-22T16:32:50.294418+08:00（Asia/Shanghai）。P0—P3 已完成实施者自验；可审查交付，不是独立验收或真人学习效果证明。

## 1. 工作区、基线与停线

- 工作目录：`/Users/ami/.codex/worktrees/learning-loop/ACC黑客松`；应用目录：`/Users/ami/.codex/worktrees/learning-loop/ACC黑客松/outputs/xiaon`。
- 分支：`codex/learning-loop`；起始和最终 HEAD 均为 `06048b6a617268015af5469e3eaf0ffc0af17ed9`。代码与本交接均未提交、未暂存。
- 开始时主目录 main、origin/main、远端 main 都是 06048b6；已用 `git ls-remote origin refs/heads/main` 核实。
- **执行中其他会话推进了主目录 main**：交接核对为 `54690a97b86661c5745f88346da5ef2d3e2f69ae`，origin/main 仍为 06048b6，并出现新的未提交产品改动。本轮不追合、不回退、不复制它们，当前交付未验证与这些并行改动集成后的行为。
- 初始保护清单 59 个文件；其中历史截图与 PRD 的哈希均保持不变。`.claude/launch.json` 在其他会话活动期间发生变化，本轮没有写它。主目录状态变化不能写成“整个仓库未变化”。原始清单、哈希和前后状态见 `evidence/verification/`。
- 并行改动包含主目录 `ChatPanel.tsx`、memory-flow 等；后续如获合并授权，需先读该目录现状并人工协调，不能把本 worktree 文件整体覆盖主目录。
- 本轮没有 git commit、合入 main、push、部署、关闭他人服务、使用线上共享库或启动子代理。

## 2. 已实现与复用边界

首页“**一起看看去括号的负号**”进入本轮闭环：学生原话 → 可确认/纠正的卡点 → 正式首次尝试 → 根据实际错误线索与请求给逐级帮助 → 学生自选未见同类题 → 据实回顾 → 保存/跳过总结与信心、继续帮助、退出或查看原复习建议。

复用 StudentEvents.submit/expose、原 RubricAssessment/classifyAttempt、静态题库、TaskGenerator/校验器/内容指纹、LearningEpisode 修订与 operationId 收据、ProgressCardView、原 PlanningEngine 及 TestClock。先修仍由真实尝试满足，不强迫重新测评；无合并同类项记录时有先试小题入口。

详细加法字段和路由见 [CONTRACT-DELTA.md](CONTRACT-DELTA.md)。关键原则：

1. `LearningEpisode.loop?` 只保存流程和事件引用，结论继续从正式尝试/暴露/评分推导；没有平行评分或排程系统。
2. 旧片段没有 loop；无迁写、无虚构确认/独立/验证题。旧报告按原始快照保留。JSON schema 已同步。
3. 假设记录 model/program 来源；确认与更正只能来自学生事件。更正会进入后续帮助和 Tutor 必要上下文，旧假设保留为历史。
4. 原答先保存、后判题；取消或重启可按原 operationId 继续。重复请求不重复作答、暴露或发题，旧修订报冲突。
5. 实际显示的帮助原文与 exposureId 存在片段中。普通模型回复也可能有线索，因此保守记为 dialogue 帮助，不暗中推进主动请求的三级阶梯。独立结论可能因此偏保守。
6. 新题同子技能且从未暴露/尝试，并查 ID、版本与结构指纹；静态题优先，不足才用原受控生成器。无合适题就明确不足，可结束。
7. 结束、预算到达和自述“懂了”不证明掌握。部分理解/否定/引用继续当前帮助；正常可信正确仍能回顾。可从回顾回到当前题，或自然拒绝/道别返回聊天；暂停后也能退出练习。
8. AI 草稿中的完成事实由程序记录兜底；学生改写保留为自述，aiDraft 与编辑结果分开，不回写评分/evidence。新题只是同题族换数，结论限于本次本题/子技能。
9. 复习入口给原引擎加可选子技能 focus，先生成提案，学生确认后才有正式计划。当天新题不冒充跨日结果。

新增闭环针对可信题库/受控生成的 negative-brackets。原其他聊天与错题入口继续保留；没有宣称任意照片/OCR或口述式子都获得了本轮的新题核对能力。

## 3. 先红后绿与设置问题

各次首次红灯的原命令、退出码与当时产品状态另见 `evidence/verification/first-red-commands.json`。

两项指定问题首次测试的产品基线是 06048b6，尚未改产品代码：

```sh
node --import tsx --test tests-agent/g/learning-loop.test.ts
```

`evidence/logs/p1-first-red.log`：exit **1**，0/3。原始日志明确显示：

- “公式我明白了，但这道题还是不会做”被返回 reflect；
- 生产 interview/report 无理由 rubric 时，“今天阳光真好”得到 correct_with_reason；
- 无来源“已经掌握”草稿通过。

`p1-green.log`：同命令 exit 0、3/3。后续目标测试扩为 **18/18**，见 `loop-delivery-target.log`。旧 interview 测试把“无 rubric、相关长句=good”改为“相关但未核实=partial”，依据是本轮明确契约；有可信 rubric 且语义得到 Assessor 支持的正向 good 路径仍通过。

新增功能先红：`p2-first-red.log` exit 1（当时 loopEvent 不存在，3/4 通过）；实现后 `p2-green-initial.log` exit 0。它是新增入口缺失证据，不是环境失败。

补充边界均先留下非零原始日志，再修复：

| 日志 | 首次结果/含义 | 修复后覆盖 |
| --- | --- | --- |
| `loop-planner.log` | exit 1，原全局提案没有负号复习项 | F01 目标测试 |
| `focused-planning-first-red.log` | exit 1，新子技能限定请求尚不支持 | F01、全量规划回归 |
| `skip-choice-first-red.log` | exit 1，跳过后 UI 没有重新选新题入口 | 闭环浏览器第3项 |
| `refusal-first-red.log` | exit 1，暂停后自然拒绝被场次门控挡住 | E03 目标测试 |
| `model-help-first-red.log` | exit 1，模型对话未进入帮助暴露 | C03 目标测试 |
| `hypothesis-leak-first-red.log` | exit 1，假设可含空格变体答案 | A04 答案拦截测试 |
| `global-end-first-red.log` | exit 1，没聊过天时全局结束按钮被禁用 | 闭环浏览器第4项 |

另有真实模型首跑设置错误：`real-model.log` exit 1。前四个闭环检查已经通过；测试仍写死第三道计算题答案为 5x-4，忽略此前暴露导致选题变化，所以报告计算模块还未完成。已把合成学生答案改为当前可信题的参考答案，未改产品评分来迎合。设置问题与产品首次失败分开，不算模型或学生失败。

## 4. A01—F01 验收矩阵

下列“通过”是相应自动证据覆盖通过；每行并不等于真机、真人或独立验收。

| 编号 | 结果 | 测试/证据 |
| --- | --- | --- |
| A01 | 通过 | learning-loop.test：partial/negated/quoted、coordinator mixed understanding；浏览器第2项；真实模型 partialUnderstanding |
| A02 | 通过 | 目标首项覆盖否定、转述、引用和疑问；正常“哦我懂了”和可信正确保留正向回顾 |
| A03 | 通过 | budget/unsupported draft、三级后换表示与预算、natural refusal；浏览器第4项全局结束；回顾可继续帮助 |
| A04 | 通过 | corrected hypothesis 用于后续帮助，历史保留；hypothesis 答案拦截；浏览器第1项纠正 |
| B01 | 通过 | 生产 interview/report：无关、相关但无 rubric、不确定三类文字；真实模型 unrelatedReason |
| B02 | 通过 | g/interview.test 的 with a model 正向 good；b/model.test validated explanation 精确引用；全量250项通过 |
| B03 | 通过 | b/model.test no quote/foreign quote/broken JSON/provider unavailable/conflict 均 needs_review；interview 离线正确结果与理由未核实分开 |
| C01 | 通过 | 目标 C01/C02/D02；浏览器第1项与 complete-synthetic-facts，bracket 原答依次 x-5、x+5，帮助保留 |
| C02 | 通过 | 同一生产路径，transfer 首次 4a+2 无帮助，结论限本次同类新题；真实模型走查同样核对 |
| C03 | 通过 | 求助/先错后改均不独立；模型普通回复也保守记帮助；浏览器第3项 |
| C04 | 通过 | 目标 original/seen/alias fingerprints/catalog exhaustion；原生成器校验/耗尽回归包含在全量 agent 中 |
| D01 | 通过 | SQLite restart 保留练习草稿/错误/帮助；浏览器第1项核对途中刷新保留草稿/同片段且不重新暴露，第2项练习和暂停恢复 |
| D02 | 通过 | 相同 operationId 的 submit/verify/help HTTP 重放，参数冲突、旧修订；取消后重启同 operationId；既有进步卡与计划幂等回归 |
| D03 | 通过 | 目标 additive optional loop，旧片段/报告哈希前后相同、不补字段；原迁移回归仍通过 |
| E01 | 通过 | 无来源草稿降级；合成模型刻意写“已掌握”被替换；学生编辑不改变 evidenceRevision/评分 |
| E02 | 通过 | 可跳过核对/总结/信心；memory off 无记忆写入；既有关闭记忆/上下文过滤回归；浏览器第1/3项 |
| E03 | 通过 | 安全无写入、暂停拒绝发题/帮助、取消可重试、自然拒绝/道别退出；浏览器第2/3/4项与安全支持入口 |
| F01 | 通过 | 目标 F01 真实规划提案→学生确认→TestClock 到期查询，无伪造跨日结果；既有 c/planning 间隔/跨场次/帮助/原题回归 |

目标测试：`outputs/xiaon/tests-agent/g/learning-loop.test.ts`（18项，runner 自动发现）。新浏览器配置实际只发现 `learning-loop.spec.ts`（4项），均为真 HTTP、临时 SQLite、生产协调器/插件与合成模型。

## 5. 最终命令、数量与证据级别

cwd 均为本 worktree 的 `outputs/xiaon`。每条命令独立记录日志和 exit；总表机器记录见 `evidence/verification/final-gates.json`。最后 UI 结束接线后额外重跑 H 首页、闭环、build 和 agent typecheck，见下表选用的最新日志。

| 命令 | exit | 实际结果 | 日志 |
| --- | --- | --- | --- |
| `npx tsc -b` | 0 | 通过 | `evidence/logs/tsc-final.log` |
| `npm run typecheck:agent` | 0 | 通过 | `evidence/logs/typecheck-handoff.log` |
| `npm run schema:agent` | 0 | 通过 | `evidence/logs/schema-final.log` |
| `npm test` | 0 | 25/25 | `evidence/logs/domain-final.log` |
| `npm run test:agent` | 0 | 250/250 | `evidence/logs/agent-final.log` |
| `npm run build` | 0 | 通过 | `evidence/logs/build-final-ui.log` |
| `npx playwright test -c tests-agent/h/playwright.config.ts` | 0 | 9/9 | `evidence/logs/h-home-final-ui.log` |
| `npx playwright test -c tests-agent/g/playwright.config.ts` | 0 | 3/3 | `evidence/logs/g-browser-final.log` |
| `npx playwright test -c tests-agent/h/playwright.professional.config.ts` | 0 | 6/6 | `evidence/logs/h-professional-final.log` |
| `npx playwright test -c tests-agent/i/playwright.config.ts` | 0 | 4/4 | `evidence/logs/i-browser-final.log` |
| `npx playwright test -c tests-agent/integration2/playwright.config.ts` | 0 | 2/2 | `evidence/logs/integration2-final.log` |
| `node --import tsx --test tests-agent/g/learning-loop.test.ts` | 0 | 18/18 | `evidence/logs/loop-delivery-target.log` |
| `npx playwright test -c tests-agent/h/playwright.learning-loop.config.ts` | 0 | 4/4 | `evidence/logs/loop-browser-handoff.log` |
| `node --env-file=<原服务端配置路径> --import tsx scripts/agent/real-learning-loop.ts` | 0 | 少量合成学生场景，真实模型 | `evidence/logs/real-model-handoff.log` |

浏览器合计 **28/28**：H首页9、G3、H专业6、I4、integration2 2、新闭环4。规则/HTTP/SQLite agent **250/250**，domain **25/25**。build 仍有既有 >500kB chunk 提示，不影响 exit 0，未扩展拆包范围。

真实模型与纯程序检查分开：假设由真实模型提出、partial 这轮模型 run completed；提示后的正式评分与新题独立性由程序判定；生产面试使用真实模型问答/理由分析，计算无 rubric 的无关理由仍为 correct_reason_incomplete。细节见 `real-model-result.json`，只含去敏检查结论与运行状态。配置由 Node 的 env-file 直接加载，未打印/复制 Key，临时数据库已关闭并删除。

**未测**：真机软键盘、真实语音/麦克风、Safari与辅助技术专项、真实学生学习效果、长期跨日教学效果、独立评审、线上/部署验收。TestClock 和 Chromium 手机视口不能替代这些。D 默认 Playwright、全发现浏览器、legacy/map/offline 浏览器未运行。

## 6. 截图、复验与本地预览

截图都在本交接独有 `evidence/screenshots/`；已逐张实际查看，未见横向溢出。正常截图均为 **375×812**，输入焦点另为 **375×420**：

- `01-hypothesis.png`：卡点待核实与确认/纠正。
- `02-helped-completion.png`：提示后改对、尚未核对、下一步选择。
- `03-unseen-verification.png`：同类新题及首次尝试。
- `04-unverified-review.png`：未完成/未核实也能回顾、继续或跳过。
- `05-focus-375x420.png`：缩小视口输入焦点与发送可达、导航隐藏。
- `06-paused.png`、`07-resumed.png`：暂停与同题草稿恢复。

复验新闭环（自动启动并结束本轮自己的测试服务）：

```sh
cd '/Users/ami/.codex/worktrees/learning-loop/ACC黑客松/outputs/xiaon'
export XIAON_LOOP_BROWSER_OUT="$(mktemp -d /tmp/xiaon-loop-review-XXXXXX)"
npx playwright test -c tests-agent/h/playwright.learning-loop.config.ts
```

端口可用 `XIAON_LOOP_UI_PORT` / `XIAON_LOOP_API_PORT` 配置，默认 5318 / 18968。旧 H/H2 共用5212/18952、I/integration2共用5214/18954，应顺序运行；不关闭他人服务。其他浏览器输出目录按任务书变量全部指向独立临时根。

手动合成预览使用两个终端，均在上述 app 目录：

```sh
# 终端1：真实生产HTTP/SQLite，显式合成模型，独立临时库
export XIAON_LOOP_BROWSER_OUT="$(mktemp -d /tmp/xiaon-loop-preview-XXXXXX)"
node --import tsx tests-agent/h/learning-loop-server.ts
# 终端2
XIAON_API_TARGET=http://127.0.0.1:18968 npm run dev -- --host 127.0.0.1 --port 5318 --strictPort
```

浏览器访问 http://127.0.0.1:5318，走授权与首页入口。该夹具仅预置一条用生产提交路径完成的合并同类项先修尝试，模型是合成输出，不能标成真人实测。分别在这两个终端 Ctrl-C 结束；当前交付没有留下常驻预览。

真实模型复验：`XIAON_LOOP_REAL_OUT=<新临时输出> node --env-file=/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/.env.server --import tsx scripts/agent/real-learning-loop.ts`；只用脚本中的合成学生输入和 temporaryRepository，不要换成共享学生库。

## 7. 改动文件与审查建议

产品/测试源码共 20 个文件（包含生成的JSON schema），SHA256见 `evidence/verification/source-manifest.json`：

- `outputs/xiaon/scripts/agent/real-learning-loop.ts`
- `outputs/xiaon/server/plugins/learning-loop/index.ts`
- `outputs/xiaon/src/components/learning/home/LearningLoopCard.tsx`
- `outputs/xiaon/tests-agent/g/learning-loop.test.ts`
- `outputs/xiaon/tests-agent/h/learning-loop-server.ts`
- `outputs/xiaon/tests-agent/h/learning-loop.spec.ts`
- `outputs/xiaon/tests-agent/h/playwright.learning-loop.config.ts`
- `outputs/xiaon/server/agents/learning.ts`
- `outputs/xiaon/server/agents/stages.ts`
- `outputs/xiaon/server/http/server.ts`
- `outputs/xiaon/server/plugins/interview/index.ts`
- `outputs/xiaon/server/plugins/interview/levels.ts`
- `outputs/xiaon/server/plugins/planning/index.ts`
- `outputs/xiaon/server/plugins/progress/index.ts`
- `outputs/xiaon/shared/learning-contracts.schema.json`
- `outputs/xiaon/shared/learning-contracts.ts`
- `outputs/xiaon/src/components/learning/ChatPanel.tsx`
- `outputs/xiaon/src/style.css`
- `outputs/xiaon/tests-agent/g/interview.test.ts`
- `outputs/xiaon/tests-agent/h/browser-server.ts`

另有本目录 P0、CONTRACT-DELTA、HANDOFF 与独立证据包。没有改 package.json/lockfile、供应商配置、线上地址、主目录产品文件或旧交付 evidence。

建议下一位独立评审先读执行任务书、CONTRACT-DELTA、上述首次红灯，再审：

1. 新旧 LearningEpisode 与评分/暴露来源是否一致；先错后改、求助、普通模型对话和暂停的证据是否保守。
2. 卡点原话/假设/学生确认/学生编辑的来源边界；未验证回顾和正向可信理由是否都保留。
3. 在独立临时输出复跑18目标测试和4闭环浏览器，查看375×812截图；不要覆盖历史截图。
4. 集成前核对主目录已前进的提交及未提交改动，尤其 ChatPanel 与记忆相关重叠；未获用户授权不得合入 main。

所有交接内证据可持续审查；完整 trace、浏览器中间产物与未选日志仍在临时目录 `/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-learning-loop-la49f7ci`，系统可能清理它们。初始/后续失败原文未覆盖，归档日志未为消除空白而清洗。`manifest.json`记录本交付证据哈希。

完成到此停止；不自动开始提交、main集成、部署或下一知识点。
