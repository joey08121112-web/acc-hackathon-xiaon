# ChatGPT 路第一期交接

2026-10-21。状态：本路 A/B/C 实现与开发者自验已交付，停在第一期；不代表三路集成验收通过。

## 1. 范围与未完成项

已实现：首页直接对话并请求问候、五条快捷回复与 home intent、确定需求卡、轻问学习、显式确认专业模式、结束与道别小结展示、观察原话与待确认标记、历史进步卡三栏、进入现有计划确认页、首次记忆平等选择与告知、隐私说明、默认关闭的开发者开关、390 宽布局和可达输入区。休息、继续上次题目及离线旧首页入口保留。

保留 zCode 的 ProblemCapture / ProblemConfirmCard / MemoryPrompt / MemoryOffNotice 与 Claude 的 ProgressCardView 的冻结挂载位及 props；没有填改别路组件。小结中的已确认进步卡直接读取 view.progressCards，按三栏只读展示，不重复请求确认。

已实现 Docker 的 /data 数据路径、实际挂载检查与缺卷启动警告、Zeabur/Railway 挂卷说明；在线一致性备份、备份轮换、停服恢复、恢复前另存。未改存储读写逻辑，也未改共享类型或包配置。

**集成前限制：**

1. 基线的 greeting、conversation/end、观察校验、进步卡和记忆/错题插件仍为 501/null 桩。本路处理问候回退及小结失败；浏览器用显式夹具提供问候/小结，其他两路完整流程未验证。不能把夹具截图当后端业务完成。
2. `learning/start` 在已有同日场次时忽略 mode。H 已检查返回模式，错误模式不跳页；详情见 [CONTRACT-REQUEST.md](CONTRACT-REQUEST.md)。无旧场次的显式切换通过，旧场次的真实切换仍待 Claude 契约补丁。没有为绕过问题关闭旧场次或重置预算。
3. 真实模型、真实麦克风/语音服务、真实手机软键盘、Docker 镜像运行与云平台卷持久化均未验收。没有读取、复制或打印 `.env.server`，没有使用真实学生材料。
4. 备份轮换测试在本机有约 30–54 秒的耗时，功能与完整性通过，未做性能结论。备份默认保留 7 份；恢复前另存保留 10 份，操作者仍须另存卷外备份。
5. 不含第二期专业模式面试 UI、报告/成长档案，亦不含第三期出题。

## 2. Git 与文件范围

- 分支：`revamp/h-home-memory`。
- worktree：`/Users/ami/Documents/个人/ACC黑客松-wt/chatgpt`。
- 起点：annotated tag `revamp-base` 解引用到 `99a9385b03adc9a7f7b5762bd0a2993963b45f8b`。
- 最后一个实现与验证提交：`3ea3dc9`（实现首页综合陪聊、小结与隐私界面并加入一致性备份恢复）。本 HANDOFF 随后作为纯交接文档提交；其自身提交号可用 `git log -1 --oneline` 查看，避免文档自引用 hash。
- 未合并其他分支，未合并/推送 main，未推送本路分支；主工作目录与用户 PRD、未跟踪材料未修改。

应用改动清单（相对 outputs/xiaon）：

- `src/App.tsx`：仅首页、首次介绍、设置、对应隐私说明及其接线；未改上传、底部导航、评分、计划或复习区块。
- `src/components/learning/ChatPanel.tsx`。
- `src/components/learning/home/HomeChat.tsx`、`NeedsCheckCard.tsx`、`ModeSwitchCard.tsx`、`ConversationSummaryView.tsx`。
- `src/styles/home.css`；`server/agents/prompts/companion.ts`。
- `Dockerfile`、`DEPLOY.md`；`scripts/agent/backup.ts`、`restore.ts`。
- `tests-agent/h/home-ui.test.ts`、`backup.test.ts`、`browser.spec.ts`、`browser-server.ts`、`playwright.config.ts`、`live-backup.ts`。

交付目录新增：本文件、`TEST-CASES.md`、`CONTRACT-REQUEST.md` 和 `evidence/` 原始日志。精确清单：`git -c core.quotepath=false show --name-only 3ea3dc9`。日志保留原始空白；针对源码的 diff whitespace 检查通过，原始日志中的尾空白不清洗。

## 3. 命令、退出码与首次失败

以下命令均在本 worktree 的 outputs/xiaon 执行。最终记录见 [evidence/gates.json](evidence/gates.json)。

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| npm ci | 0 | 79 packages；未新增依赖 |
| npm run typecheck:agent | 0 | 最终含所有 H 测试和服务冒烟脚本 |
| npm test | 0 | 25/25 |
| npm run test:agent | 0 | a/b/c/d/e/g/h/i 全部 153/153 |
| npm run test:agent:h | 0 | 8/8 |
| npm run build | 0 | 生产构建通过 |
| npx playwright test -c tests-agent/h/playwright.config.ts | 0 | 8/8；390×844、缩至390×420 |
| node --import tsx tests-agent/h/live-backup.ts | 0 | 实际规则服务进程、并发合成写入、在线备份、清空、停服恢复 |

首次失败及修复均保留，不改写旧日志：

- `first-red-ui.txt`：退出 1，三个新 UI 测试因空桩失败，先测后实现。
- `first-red-backup.txt`：退出 1，脚本尚未实现，模块缺失；实现后重跑。
- `h-first-green.txt` 实际退出 1（文件名保留）：WAL 备份的旁文件使轮换断言失败。改为独立单文件快照后通过。`backup-timeout.txt` 是定位耗时的有界运行，退出 1，不是最终结果。
- `typecheck-initial.txt`、`typecheck-rerun-1.txt`：退出 2，测试的 nullable 类型和可选 reset 方法调用已修复；最终退出 0。
- `browser-first-run.txt`：退出 1，独立配置的启动 cwd 错误，改为应用目录。
- `browser-rerun-1.txt`：退出 1，输入区吸附导致结束按钮点击失效；安全用例等待了本应隐藏的快捷回复。输入区改为正常文档流并处理可见视口，等待改为真实 aria-busy。
- `browser-rerun-2.txt`：退出 1，刷新时问候在服务会话未连接就发出，StrictMode 清理取消请求；改为连接就绪后请求，保留默认回退。
- `browser-rerun-3.txt`：退出 1，暂停请求没有串行等待，紧接着的切换点击被提前忽略；补齐暂停等待和说明卡禁用。
- `browser-rerun-4.txt` 与 `browser-final.txt`：退出 0，8/8。最终一次补了滚到顶部的截图姿态，避免长截图里粘性页头留在中间。

实际服务备份结果：运行中记录 2 条，快照在并发写入时含 1 条；清空后为 0，停服恢复为 1，恢复前另存库为 0，quick_check 为 ok。快照与恢复数相同，未要求并发写入发生在快照之前。

## 4. 证据级别

| 级别 | 本路实际执行 |
| --- | --- |
| 静态检查 | typecheck、build |
| 规则单测/HTTP | 原 25 项 + 全批次 153 项；未运行任何 D 浏览器测试 |
| 模拟模型端到端 | H 浏览器走真实 HTTP/SQLite/阶段机和合成 Tutor；问候、小结是显式夹具；不替代别路插件验收 |
| 实际本地服务进程 | 无模型规则模式的在线备份与恢复冒烟 |
| 真实模型 | 未运行，无 Key，不声称提示词经真实模型验收 |
| 浏览器 | Chromium，390 宽；输入缩小视口、无横向溢出、截图查看；仅开发者自验 |
| 真实设备 | 未运行；软键盘、Safari、麦克风与真实语音待验收 |
| 云部署持久卷 | 未运行；只有配置、官方步骤与挂载判定单测 |

最终浏览器输出（系统临时目录，未写入 D 或既有交付证据）：

`/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-h-browser-DYyTIz/`

其中 `results.json` 与 artifacts 下的 `summary-390.png`、`composer-390x420.png` 可复核。失败 trace 在每轮日志指向的独立系统临时目录中，未覆盖；临时目录不保证长期保存，可用同一 H 命令重现。

## 5. 给集成方的入口

先在此 worktree 的 outputs/xiaon：

```sh
XIAON_API_PORT=18952 XIAON_UI_PORT=5212 XIAON_DB_PATH=.local/h.sqlite npm run dev:learning
```

打开 http://127.0.0.1:5212/ 。测试留下的 `.local/h.sqlite` 只有合成数据，可通过设置中的「重置整个演示」清空；不要误用主目录的日常库。真实模型需要用户自行放置本 worktree 的配置，本路未操作。

体验：首次介绍 → 记忆两项亲自选一项 → 首页先开口 →「我考砸了」→ 再聊一轮 → 确定需求 → 看错题或正式测试说明 → 点确认才开始；「先不了」留首页。道别或结束展示返回的小结，计划入口进入既有确认页。当前基线的小结/问候仍为桩，完整展示可通过本路浏览器夹具重现，待集成 Claude/zCode 实现再作真实插件验收。

跨路集成时必须重跑：实际问候接上次记录、实际观察校验、错题三个入口及回调、记忆确认/关闭提示、进步卡确认与小结关联、已有场次切专业模式、重置所有新增集合。H 没有合入其他路来冒充这些已验收。

备份、停服恢复、容器挂卷具体命令见 `outputs/xiaon/DEPLOY.md` 第 9 节。持久化操作只用临时演示库演练，禁止对日常库做清空测试。

第一期到此停止，不自动开始第二期或第三期。

---

# 第二期：专业模式界面、评测报告页、成长档案

2026-10-21。状态：H2 文件范围内的实现与开发者自验完成，到本期停止。**不代表第二期三路集成通过，也不代表真实模型或真机验收通过。** 已完整阅读 `CONTRACT-PHASE2.md`（包括第 2、9 节）、H 任务书、总控、第一期契约和集成报告。

## 1. 范围与未完成项

- 底部第二个按钮显示「专业模式」，保留内部「探索」tab 键和原离线路径。
- `ProfessionalModeView`：说明约 10–15 分钟（实际按学生节奏）、五模块固定顺序、可以随时暂停、不打总分。首页建议/小结只导航到同一说明页，**不调用 learning/start**；点「开始」才调 interview/start。已有未完成测评从 view.interviews 取模块并调 interview/resume。
- 面试区展示五站进度、当前题面/选项/空间图形、一次一道问题或追问、历史问答。作答携带当前 revision，文字草稿按测评和待答题保存；冲突/失败不清空，刷新后保留。话筒复用现有语音服务，先转为可修改草稿，学生点击才提交。
- 始终保留「先暂停」；等待回复时可取消等待，再保存暂停位置并回首页。休息输入按响应暂停；再次进入显示「上次停在：计算」。安全响应显示求助信息，隐藏作答、开始、续测和报告操作；不自行生成学习记录。
- 小提示沿用真实 learning/hint 路由、原 ToolResult 返回值与暴露记录，展示「会如实记录提示后完成」。
- `ProfessionalReportView`：五模块四档等级使用 MODULE_LEVEL_LABELS；本次观察、原话展开、学习建议、综合模式观察对照、和上次比、只读历史切换、导航至 zCode 月阶段挂载页。不生成总分、数值排名、客户端等级或确认记录。
- `GrowthArchive`：只从 GET learning/trend 读取等级，按上海月份串上小结和已确认进步卡；同月多份评测按时间展示。趋势失败时明确说明并允许重试，仍能看小结/进步卡，不从聊天或旧五维状态补造等级。
- 新组件中的工程细节只在既有开发者开关开启时展示。

**集成前限制（不能算已验收）：**

1. 本基线的面试、月阶段与趋势插件仍是 501/null 桩。本路没有合入 Claude/zCode 分支或改服务端插件。生产接口接通后的选题、程序判级、报告依据与门控、复测/月阶段流转，要集成后重新验证。
2. H2 浏览器使用 **脚本协调器夹具** 替换测试进程内的面试/报告/趋势方法，保留真实 HTTP 会话/CSRF、临时 SQLite；题目暴露是显式合成种子，提示走真实路由。报告等级与趋势响应也是合成的。它验证 UI 和请求/响应接线，**不是生产引擎的模拟模型端到端验收**，不证明评分/证据正确。
3. 旧 `LearningPages.tsx` 外壳仍与新组件并排，含旧报告入口、工程细节、地图自由选题和旧恢复按钮；explore 页头仍叫「五维探索」。这些是 Claude/未授权区块，H 没有越权修改或用 CSS 隐藏。第二期接线请求已追加到 [CONTRACT-REQUEST.md](CONTRACT-REQUEST.md)，应在集成时统一名称、区分两套报告、按开发者开关收起工程细节，并决定面试时地图的展示方式。
4. 进入月阶段只导航 plan，沿用 zCode 挂载位；历史报告选择是只读，不会在客户端自动生成、确认阶段或覆盖本月草案。当前 props 没有选中报告传参，来源报告选择留给 zCode。
5. 真实模型、真实麦克风/识别服务、真实手机软键盘、Safari、辅助技术与真实学生验收未运行。没有读取、复制、打印 `.env.server`；只用合成学习材料。生产构建通过，但仍有 Vite 的单 chunk 超过 500 kB 提示，本期未做包拆分。
6. 第一期集成报告里「小结生成后气泡仍是上一句」没有在本期顺带修复；小结 history.slice(-20) 的集成补丁保留。

## 2. Git 与文件边界

- 分支：`revamp/h2-professional-ui`。
- 独立 managed worktree：`/Users/ami/.codex/worktrees/h2-professional-ui/ACC黑客松`。
- 起点：`revamp-base2^{}` = `b6116106a38b03897975599ac37a2c74d7dfc125`，与开始时 main 一致。
- 实现、测试、原始日志提交：`775f1d2`。本 HANDOFF 追加随后独立提交；文档自身提交号看 `git log -1 --oneline`。
- 没有合并其他分支、没有推送任何分支、没有合并/推送 main；主目录用户的 PRD、未跟踪材料和其他 worktree 均未修改。

应用文件（相对 outputs/xiaon）：

- `src/App.tsx`：仅底部导航一行显示名。
- `src/components/learning/ChatPanel.tsx`：首页建议改为只进入说明，删除原提前 learning/start 接线。
- `src/components/professional/ProfessionalModeView.tsx`、`ProfessionalAnswer.tsx`、`ProfessionalReportView.tsx`、`GrowthArchive.tsx`、`archive.ts`。
- `src/styles/home.css`：追加限定在新 professional 组件内的样式，以及输入聚焦时收起底栏的规则。
- `tests-agent/h/phase2-contract-smoke.test.ts`、`professional-ui.test.ts`、`professional.spec.ts`、`professional-server.ts`、`playwright.professional.config.ts`、`browser.spec.ts`。
- 本路交付目录：HANDOFF 第二期、TEST-CASES 第二期、CONTRACT-REQUEST 第二期、`evidence/h2-*`。

没有修改共享类型、schema、package/lockfile、存储、HTTP、协调器、评分/计划/复习、语音实现、Claude 的 LearningPages 或 zCode 组件。

## 3. 命令、退出码和失败留档

所有命令在该 worktree 的 outputs/xiaon 运行。机器可读记录：[evidence/h2-gates.json](evidence/h2-gates.json)。

| 命令 | 退出码 | 结果/日志 |
| --- | --- | --- |
| npm ci | 0 | 79 packages，未增依赖/改 lockfile |
| npm run typecheck:agent | 0 | h2-typecheck-with-fixture-final.txt |
| npm test | 0 | 25/25，h2-domain-final.txt |
| npm run test:agent | 0 | 204/204，h2-agent-all-after-ui-final.txt |
| npm run test:agent:h | 0 | 15/15，h2-h-final.txt |
| npm run build | 0 | h2-build-final.txt |
| npx playwright test -c tests-agent/h/playwright.professional.config.ts | 0 | 5/5，h2-browser-final-green.txt |
| npx playwright test -c tests-agent/h/playwright.config.ts | 0 | 首页回归 8/8，h2-home-browser-final.txt |
| git diff --check（本路源码/测试） | 0 | 原始日志里的格式不清洗 |

失败和修复过程保留，不能把带 final 名字的失败日志当通过：

- `h2-first-red.txt`：先写新界面测试，空桩导致 2/2 失败（exit 1），实现后通过。首次留档命令的相对目录多退了一层，shell 重定向失败；纠正路径后才实际执行测试并生成此文件。
- `h2-typecheck-2.txt`：exit 2，测试夹具误写 repository.dataVersion()，改用现有 revision() 后通过。
- `h2-browser-1.txt`：exit 1，合成协调器把 view.tasks 的额外 eligible 字段传入严格 InterviewStep.task；失败码测试还错误传了不合法 revision 0。`h2-browser-2.txt` 保留了定位堆栈。夹具改为 catalog.publicTask，冲突测试用合法但过期的修订 999；没有放宽 schema。
- `h2-browser-3.txt`：exit 1，测试初始化每次刷新都把页面覆写回首页，导致草稿恢复断言找不到测评区。改为仅首次初始化，`h2-browser-4.txt` 为 4/4；增加等待时暂停后 `h2-browser-5.txt` 为 5/5。
- **`h2-browser-final.txt` 实际 exit 1（4/5）**：补测真实提示路由后，暴露了脚本夹具没有记录题面打开事实。保留原文件名与内容。夹具显式加入合成 task 暴露；未绕过真实 hint 门控。最后 `h2-browser-final-green.txt` exit 0，5/5，包括提示原文展示和没有 undefined。
- 最终日志里的 409 conflict 是有意注入过期修订的成功测试，不是未处理失败。所有失败 trace 位于各轮日志中的系统临时目录，没有覆盖 D 证据。

## 4. 证据级别

| 级别 | 本期实际执行 |
| --- | --- |
| 静态检查 | typecheck、生产 build；本路范围审计 |
| 规则/HTTP 单测 | 25 原领域项 + 全批次 204；H 15 项含新渲染、上海月份边界、既有冻结路由门控 |
| 模拟模型端到端 | 首页 H 原合成 Tutor 回归运行；第二期生产面试/趋势引擎端到端未运行，使用脚本 UI 夹具，见第 1 节 |
| 真实模型 | 未运行 |
| 浏览器 | H2 5 项 + H 首页 8 项；Chromium 390×844、输入缩至 390×420；DOM/无横向溢出断言与截图查看，属于开发者自验 |
| 真实设备 | 未运行，浏览器缩小视口不证明真实软键盘可用 |
| D 阶段浏览器 | **没有运行**，没有改其配置或交付证据 |

最终 H2 输出：`/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-h2-browser-mLCay0/`。artifacts 下含 `report-390.png`、`archive-390.png`、`composer-390x420.png`，另有 results.json。长截图的固定底栏出现在一个视口高度的位置；实际页面可继续滚动。首页回归输出：`/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-h-browser-Z301BN/`。临时目录不承诺长期保存；可用同命令重现。

## 5. 集成方入口与停线

普通规则服务（不复制任何模型配置）：

```sh
cd '/Users/ami/.codex/worktrees/h2-professional-ui/ACC黑客松/outputs/xiaon'
XIAON_API_PORT=18952 XIAON_UI_PORT=5212 XIAON_DB_PATH=.local/h2.sqlite npm run dev:learning
```

浏览器打开 `http://127.0.0.1:5212/`。当前基线接口仍是桩，所以「开始」/趋势会诚实显示未完成提醒。要走本路完整合成演示，可运行 H2 Playwright 命令自动启动夹具；如需手动查看，单独终端运行 `node --import tsx tests-agent/h/professional-server.ts`，另一个终端运行 `XIAON_API_TARGET=http://127.0.0.1:18952 npm run dev -- --host 127.0.0.1 --port 5212 --strictPort`。先确认端口空闲，不关闭别人的服务。夹具使用系统临时库；首页原回归用本 worktree 的 `.local/h.sqlite`，均不是日常库。

体验：专业模式说明 → 点开始 → 理解与追问 → 逻辑与追问 → 计算暂停 → 回首页并刷新 → 专业模式续测 → 其余三站 → 本次报告/展开原话/历史切换 → 月阶段入口 → 成长档案按月看小结与进步卡。也可在理解/逻辑完成后提前生成报告，检查三项「还没测到」。

集成后必须重跑真实插件的开始、追加修订、提示暴露、答错同类题、题库不足、暂停换天续测、reportReady 与报告门控、趋势来源报告一致、历史/月阶段入口、记忆关闭仍保留这些学习记录，并处理 CONTRACT-REQUEST 的旧页面外壳接线。实际报告/月阶段等快照由服务端决定，H 不在客户端补造。

**第二期到此停止；不启动第三期、不合并其他路、不推送、不合并到 main。**
