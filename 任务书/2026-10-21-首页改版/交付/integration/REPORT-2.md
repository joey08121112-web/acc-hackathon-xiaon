# 第二期集成报告：专业模式

日期：2026-10-21。执行者：Codex（接替原任务书中的 Claude 集成职责）。

**结论：三路已集成，授权修复已完成；四项全量命令通过，第二期真实插件浏览器路线通过，但不能判为整期验收通过。** 发现月目标与周任务模块错配（zCode），另有 G 旧浏览器夹具未适配新提示版本。建议先退回处理，再决定是否合入 main。

分支 `revamp/integration2`，工作区 `/Users/ami/Documents/个人/ACC黑客松-wt/integration2`，起点 main / tag `revamp-base2` = `b6116106a38b03897975599ac37a2c74d7dfc125`。开发与浏览器服务均用 **5214 / 18954**。

**本分支已提交；没有合入或推送 main，没有创建 `revamp-phase2`，没有推送任何分支。** 主目录的 PRD 修改和用户材料没有动。交付后的最终提交号以本分支 `git log -1` 为准；产品补丁及验收脚本提交为 `a1a072f`，本报告与证据随后单独提交。

## 1. 阅读范围、合并提交与冲突

实施前完整阅读总控、04 第二期集成、Claude 的 PHASE2 契约及 CHANGE、三路各自分支的第二期 HANDOFF 和两份 REQUEST，以及 REPORT-1 第 5、7 节；第一期说明一并读过。以下用固定提交合并，没有追随分支之后的变化。

| 顺序 | 来源分支与提交 | 集成合并提交 | 文本冲突 | 合后 typecheck / test:agent |
| --- | --- | --- | --- | --- |
| 1 | `revamp/g2-interview` · `0ae3ce2` | `39f8092` | 无 | 0 / 0；212/212 |
| 2 | `revamp/i2-plan-tracking` · `136514b` | `4be5cc0` | 无 | 0 / **1**；216/217，H 的旧 trend=501 断言 |
| 3 | `revamp/h2-professional-ui` · `f8f35a8` | `ce621ea` | 无 | 0 / **1**；219/220，同一条旧断言 |
| 4 | `revamp/h-fix1`、`revamp/i-fix1` | 跳过 | 开始及交付时的本地/已有远端引用均未发现对应分支 | 退回项见第 6 节 |

原始合后日志保存在 `evidence/phase2/logs/merge-{g,i,h}-{typecheck,agent}.log`。第二、三次失败均先定位为阶段桩测试过时，再按本次授权更新；没有删除或放宽业务门控来让合后检查通过。

## 2. 授权事项逐项处理与文件边界

### 2.1 拒绝复测的 confirmation 键序缺陷

- **Claude 文件** `outputs/xiaon/server/agents/professional.ts`：只新增 `hash` import，将 confirmation 的 `JSON.stringify` 比较换为仓库导出的规范化 `hash` 比较。目标、状态、修订号和学生点击时间等原门控保持。
- 按授权翻转 **zCode 测试** `tests-agent/i/plan-tracking.test.ts`：HTTP 由 500 改为 200，提醒由非空改为 null；另外核对拒绝时间等于 TestClock、再次使用新的 operationId 点击返回同一修订、修订数量不增、月底仍不提醒。
- 新增 **G 回归** `tests-agent/g/retest-confirmation.test.ts`：真正经过仓库存取和 schema.parse，先确认两边 JSON 键序确实不同，再验证拒绝通过；若真的篡改 confirmation 时间仍拒绝。
- 先翻转 HTTP 断言，原实现 **8/9，exit 1：500 !== 200**，见 `logs/retest-first-red.log`。修复后 targeted 13/13（I 9 + H 契约 4），最终全批次包含新增 G 回归通过。
- 390 宽浏览器点「本月先不做」得到 200，提醒消失，刷新后仍不出现。没有改 stages 插件来绕过门控。

### 2.2 趋势冒烟从桩切到真实实现

`tests-agent/h/phase2-contract-smoke.test.ts` 保留无本机会话时 403，改为核对已登录空库返回 200 和空 latest/history；再用真实面试引擎完成理解、逻辑并生成报告，验证响应的五个模块点逐个对应报告等级、来源 id、上海月份和创建时间。不是仅把状态码改成 200。

### 2.3 旧页面外壳与新专业模式接线

本次额外修改的 **Claude 名下现有文件只有**：

| 文件 | 必要修改与原因 |
| --- | --- |
| `server/agents/professional.ts` | 上述 confirmation 规范化比较 |
| `src/components/learning/LearningPages.tsx` | 以 ProfessionalReportView 为报告主体；旧生成按钮、旧报告历史和「观察快照·证据版本」收进 useDevMode 控制的「详细证据（原学习观察报告）」折叠区；错误默认显示通用可恢复提醒，仅开发者模式显示原文；连接失败默认文案隐藏 SQLite；有未完成测评时不给旧恢复按钮或地图选题，地图折叠区只说明去上方续测；无未完成测评时地图作为折叠的次要入口保留 |
| `src/App.tsx` 页面标题映射 | 仅将 `explore` 标题由「五维探索」改为「专业模式」 |

另按用户允许新增 G 一条回归。没有修改其他 Claude 现有文件，也没有改 zCode 产品文件（stages/tracking/plan 组件）或规划引擎。zCode 仅有上述授权的测试断言修改。

浏览器验证默认看不到旧生成入口；开启已有开发者开关后，可展开原报告；故意令 stage/confirm 返回含工程原文的 500，页面只显示通用提醒，草稿和重试入口保留，见截图 18。

### 2.4 月阶段确实引用最新报告

没有修改 MonthStageView：它本来从 `view.professionalReports.at(-1)` 取来源。实际测试生成同一测评的两份不同时间/版本报告，在报告页**主动选中旧版**后进入规划，点击生成草案，读回 `monthStages.sourceReportId`，确认仍等于最新报告 id（截图 19）。历史选择保持只读，不代替学生确认或覆盖已确认的当月阶段。

**来源报告正确不等于周任务对齐正确**：后者在本次发现缺陷，见第 5 节。

### 2.5 集成验收脚本

新增 `tests-agent/integration2/`：

- `server.ts`：真实 HTTP、SQLite、协调器、面试/规划/趋势插件，只注入合成 ModelProvider 与 TestClock；库在系统临时目录，不读 `.env.server`；测试控制端点仅用于清空该临时库、设置注入时钟。
- `phase2.spec.ts`、`playwright.config.ts`：只发现本目录第二期 spec；390×844 / 390×420；模型故意试图输出与程序不同的理解等级，最终以程序为准。
- `run-home-browser.mjs`：加载 H 自己的配置，在系统临时目录复制 H 首页 spec/server，仅重定位 import 与端口（包括 beforeEach reset URL），不改断言。H 原配置与 server/spec 写死 5212/18952，因此用此适配保持本次服务统一为 5214/18954。

没有新增依赖，没有修改 package/lockfile、shared 契约/schema、HTTP/存储实现、D 配置或 D 浏览器 spec。

## 3. 命令、退出码与首次失败

除 Git 命令外均在本 worktree 的 `outputs/xiaon`。最终命令退出码也见 `evidence/phase2/logs/final-gates.json`。

| 命令 | 退出码 | 最终结果 / 日志 |
| --- | --- | --- |
| `npm ci` | 0 | `logs/npm-ci.log` |
| `npm run typecheck:agent` | 0 | `logs/final-typecheck.log`；最后加严浏览器步骤后再检查 exit 0，`typecheck-last-spec.log` |
| `npm test` | 0 | 25/25；`logs/final-domain.log` |
| `npm run test:agent` | 0 | **221/221**（包含 a/b/c/d/e/g/h/i 单测）；`logs/final-agent.log` |
| `npm run build` | 0 | `logs/final-build.log`；仍有已有的 >500 kB chunk 提示，本期没做拆包 |
| `node --import tsx --test tests-agent/i/plan-tracking.test.ts tests-agent/h/phase2-contract-smoke.test.ts` | 0 | 13/13；`logs/targeted-green.log` |
| `node --import tsx --test tests-agent/g/retest-confirmation.test.ts` | 0 | 1/1，随后也包含于 221 全批次；`logs/g-regression.log` |
| `npx playwright test -c tests-agent/integration2/playwright.config.ts` | 0 | **2/2**；最终为 `logs/browser-real-final3.log` |
| `XIAON_H2_UI_PORT=5214 XIAON_H2_API_PORT=18954 npx playwright test -c tests-agent/h/playwright.professional.config.ts` | 0 | **5/5**，H 协调器夹具测试；`logs/browser-h2.log` |
| `node tests-agent/integration2/run-home-browser.mjs` | 0 | **8/8**，H 原首页断言的临时端口适配；`logs/browser-h-home-rerun.log` |
| `XIAON_G_UI_PORT=5214 XIAON_G_API_PORT=18954 npx playwright test -c tests-agent/g/playwright.config.ts` | **1** | **1/3，通过安全/休息；2 项停在错题草稿确认卡缺失**；`logs/browser-g.log`，见第 5 节 |
| i 路独立浏览器配置 | 未运行 | 该分支没有本路配置；月阶段/今日/提醒/趋势已由集成浏览器实际走到 |
| D 阶段浏览器、legacy/map/offline spec | 未运行 | 按约束禁止运行；没覆盖旧交付证据 |
| `git diff --check`（产品与脚本） | 0 | 原始日志尾空白不清洗 |

失败与重跑原样保留，不把名字含 final 的日志当作通过：

1. 合入 I、H 后各有一次旧趋势桩断言失败（200 !== 501），分别保存，没有覆盖。
2. `retest-first-red.log` exit 1，复现真实缺陷；修复后 targeted exit 0。
3. `browser-real-1.log` exit 1，2 项失败：合成答案表漏了复测会选到的 `b-cost-delayed`；另一项用全 good 的报告却想点「定加强目标」，实际规则不会提供这个入口。补齐现有题库合成答案，并让第二项走一次逻辑答错/加问形成真实 partial，重跑 `browser-real-2.log` 2/2。
4. `browser-real-final.log` exit 0，另加强了「历史选旧报告、月阶段仍引用最新」检查。
5. **`browser-real-final2.log` 实际 exit 1，1/2**：进一步把暂停点推进到计算题已回答、等待追问时；测试误在追问轮点击仅题目轮显示的提示按钮，超时。改成先请求提示、答计算题，再暂停在追问处；没有改产品逻辑。最终 **`browser-real-final3.log` exit 0，2/2**，并验证提示记录跨天仍使计算判为 partial。
6. H 首页端口适配首轮 `browser-h-home.log` exit 1，8 项均在 beforeEach 仍请求 18952 而失败；补齐临时 spec 的 reset 地址适配，最终 8/8。首轮不是产品失败。
7. G 原配置 2 项失败仍保留，没有改旧夹具或断言掩盖，未报回归全绿。

浏览器 trace、运行结果、临时适配源码均在系统临时目录；截图按要求复制/写入本交付目录。日志头保留各次目录，主要最终目录：

- 集成最终：`/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-integration2-browser-tsYz22/`。
- H 首页最终：`/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-integration2-h-home-lCsi2B/`。
- G 失败：`/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-g-browser-w1YInI/`。

临时目录不承诺永久保存；原始文本日志和 19 张截图已随此报告提交。

## 4. 390 宽第二期演示走查

使用三路**真实生产插件**和合成模型，不使用 H2 替换协调器方法的夹具。记忆全程关闭；测评、报告、阶段与趋势照常保存。TestClock 从 10-21 → 10-22 → 10-31 → 11-01，不改系统时间。

| 截图（`evidence/phase2/`） | 实际走到与核对 | 结论 |
| --- | --- | --- |
| `01-summary.png` | 综合模式聊天产生真实待核实观察并生成小结，点击「去专业模式」 | 通过 |
| `02-intro.png` | 说明页；尚未请求 interview/start，点「开始」才开测；页头专业模式 | 通过 |
| `03-understanding.png`、`04-follow-up.png` | 理解题与一次追问；进行中的测评不给地图选题和旧恢复入口 | 通过 |
| `05-transfer.png` | 逻辑第一题答 C 出错，追问后加问同类题，答对再进计算 | 通过 |
| `06-next-day-paused.png` | 计算先请求提示、提交答案，停在追问轮；暂停，TestClock +1 天；续测保持 pending.task 和 follow_up，场次 id 换新，前两模块不重问 | 通过 |
| `07-composer-390x420.png` | 缩小视口输入与发送按钮可达；不代表真实软键盘 | 通过（浏览器） |
| `08-report.png` | 五模块等级、依据展开、学习建议、综合观察确认；理解 good 胜过模型要求的 needs_work；计算提示后 partial | 通过 |
| `09-month-draft.png`、`10-month-week-confirmed.png` | 月阶段来自最新报告，确认月目标，再亲自接受周计划；没有自动替学生确认 | 接线通过；周任务内容有错配，见第 5 节 |
| `11-today.png` | 今日页真实显示已确认当周任务和等待自主开始状态 | 显示通过；任务模块不对齐 |
| `12-archive-october.png` | 成长档案含 10 月五模块等级与综合模式小结 | 通过 |
| `13-month-end-reminder.png`、`14-declined.png` | 推进至 10-31 出现提醒；拒绝 200，提醒消失，刷新仍不出现 | 通过；本周任务为空见第 5 节 |
| `15-retest-comparison.png` | 推进 11-01 做下一次测评并出报告，comparedWithReportId 指向首份测评报告，有「和上次比」及等级变化 | 通过 |
| `16-archive-two-months.png` | 成长档案显示 10、11 月两个趋势区，数据来自真实趋势接口 | 通过 |
| `17-partial-report.png` | 仅理解与逻辑测完出报告，另三模块显示「还没测到」 | 通过 |
| `18-safe-error.png` | 500 工程原文不直接展示；保留草稿和重试 | 通过 |
| `19-latest-report-stage.png` | 历史选择旧报告，进入月阶段后实际 sourceReportId 仍是最新报告 | 通过 |

上述页面逐次断言 `documentElement.scrollWidth <= innerWidth`。截图已做概览查看，报告、今日、输入区另作放大查看；长截图中的固定顶栏/底栏位于一个视口位置属于整页截图表现。`walkthrough-facts.json` 保留首末报告、月阶段修订、测评修订、问答种类和确认计划，可直接核对新发现的问题。`manifest.json` 记录本次截图/日志的 SHA-256。

报告没有生成总分、排名或百分位数据，断言排除数值分数/名次及「总分：」「排名：」等评价。现有组件仍显示「本次观察，不是总分，不排名」这一边界说明；没有把这句说明误报成提供排名。

## 5. 未通过项、新发现与责任路

| 优先级 / 项目 | 本次证据与影响 | 责任路 / 处理 |
| --- | --- | --- |
| **P1：月目标和周任务模块错配** | 本轮报告逻辑 partial、计算提示后 partial，按固定顺序月目标选逻辑；但 `weekPlan()` 调全局 `assessment()` 再 `planning().propose()`，未带月阶段模块/目标，实际两条任务都是 `like-terms`（合并同类项）。来源报告 id 虽正确，周任务仍不是逻辑目标拆分。见截图 09/10/11、facts 中 stage.module=逻辑 与 plans.items.knowledgePointId=like-terms | **zCode**。超出本次授权，不改 stages 或旧规划引擎；建议退回，阻止整期验收通过 |
| **后续周未安排** | 月阶段只给当周创建 proposal；推到 10-31，10-26 那一周没有 proposal，今日页显示「这一周还没有安排任务」。`weeks[]` 的其他周是空脚手架；没有自动生成下一周的入口/事件。本次只验证首周可确认，不能声明整月拆周已完成 | **zCode**。与 HANDOFF 所述脚手架一致，仍是长期规划未完成部分；截图 13/14 |
| **G 原浏览器回归 2/3 失败** | 新 `tutor-g0-probe-observe-answer` 经旧 Walkthrough 的 `.replace('-observe','')` 变成 `probe-answer`，不再进入其 `stage==='probe'` 的脚本分支，所以第 7 轮本该返回的 problemDraft 未返回，卡片断言失败。新集成走查的 provider 显式处理这个版本。原 G 用例另仍有第一期「跳专业页即已切 exploration」旧断言，尚未走到；H2 已改为点开始才切场次 | **Claude，测试夹具/旧断言**。没有修改未获授权的旧 G 文件；需维护者更新后重跑。不是已证明的生产错题流程回归，也不能因此说原 G 浏览器通过 |
| i 独立浏览器用例缺失 | 当前分支仍没有本路浏览器配置 | **zCode**。集成用例实际覆盖月阶段、今日、提醒与趋势，但不能标成本路独立浏览器通过 |
| 真实模型、真机等 | `.env.server` 不存在，只检查存在性，未读取、复制或打印；真实麦克风/识别、软键盘、Safari、辅助技术和真实学生验收未跑 | **未运行**，不以合成模型或 Chromium 代替 |

这里的通过属于本次开发者集成自验，不是第三方独立审查或产品最终验收。即使四项全量命令通过，也不抹去以上 P1 和浏览器回归未通过项。

## 6. REPORT-1 第 5、7 节退回项

没有 `revamp/h-fix1` / `revamp/i-fix1` 可合，因此没有在本分支顺手修第一期逻辑：

| 原退回项 | 本次状态 |
| --- | --- |
| H 长聊天小结只取最近 20 条 | 第一期已有的 `chat.slice(-20)` 补丁保留；没有新的 fix1 分支/回执，不宣称额外修复 |
| I 错题卡确认后立即消失，看不到「记下了」 | **仍未修**，本次没有修改确认卡/ChatPanel 逻辑 |
| I shouldOfferMemory 把假的 memoryId 写进 memoryMentions，判断函数有写入副作用 | **仍未修**，当前实现仍有 `memory-offer` 标记 |
| H 小结发出后气泡仍显示上一句 | **仍未修**；没有借接线改首页回复逻辑 |
| Claude 观察在试探后的回答轮无法记录 | 已由本次合入的 G2 实现和 observe-answer 单测处理，集成新走查也记录了回答轮原话；不是本次越权补修 |
| I 没有本路浏览器用例 | **仍未补**，见第 5 节 |
| D/E onboard 依赖默认服务模式条 | 未运行、未修改，继续等用户决定 |

原报告中已解决的 Claude 答案拦截、记忆时效选中样式等随基线保留，本次没有扩展修改。REPORT-1 第 7 节的原批准不被解释为本次可自动合 main 的授权。

## 7. 证据级别与停线

| 层级 | 本次结果 |
| --- | --- |
| 静态检查与构建 | 通过 |
| 规则/HTTP 单测 | 25 + 221 全过；真正的拒绝路由/幂等与趋势来源被覆盖 |
| 合成模型 + 生产引擎端到端 | 运行；集成浏览器 2/2，包含 TestClock 跨天/月、报告与真实规划接线；保留发现的规划错配 |
| UI 协调器夹具 | H2 5/5；与生产引擎证据分开 |
| 浏览器 | H 首页 8/8，H2 5/5，集成 2/2；G 原回归 1/3；i 无独立用例 |
| 真实模型 | **未运行** |
| 真实设备 / 人工学生验收 | **未运行** |
| D 阶段浏览器 | **未运行** |

所有测试服务由本次启动并由 Playwright 关闭；没有用宽匹配终止进程，没有碰用户其他服务。交付检查 5214/18954 均没有遗留监听进程。

**停在 `revamp/integration2`。请用户决定是否先退回 zCode 修复规划对齐、Claude 更新旧浏览器夹具，或明确确认将当前结果合入 main 并打 `revamp-phase2`。当前不建议按“第二期全部验收通过”合入。没有推送、合 main 或打该 tag。**

## 8. 修复轮

日期：2026-10-21。分支仍为 `revamp/integration2`，worktree 仍为 `/Users/ami/Documents/个人/ACC黑客松-wt/integration2`；本轮起点为原集成交付 HEAD。**本节更新第 5、6 节退回项的状态：下述授权事项已修复并通过开发者自验；尚未合入 main、未推送、未打标签，停下等待用户决定。** 此结论不升级为独立审查、真实模型或真机验收。

### 8.1 逐项修复与文件

路径除交付文档外均相对 `outputs/xiaon/`。

| 项目 | 现象与原因 | 本轮修改 | 对应验证与结果 |
| --- | --- | --- | --- |
| P1 月目标与周任务不符 | 阶段选逻辑，周计划仍按全局 assessment 排序，且同日预算相同会复用未限定模块的旧草案 | `server/plugins/stages/index.ts` 向公开 `planning().propose` 传可选 focus；`server/plugins/planning/index.ts` 在完整可信快照校验后，仅对选题投影限定模块子技能，并将学生月目标写入计划/任务文案。缓存同时比较 focus；共享契约新增可选 focus，旧记录/旧调用不变。没有符合条件的未见题时说明题库、前置练习或时间条件，未开始/暂停场次则说明对应原因，均不跨模块补题 | `tests-agent/i/fix-round.test.ts`：真实提交合并同类项错答后，全局草案确为 like-terms；逻辑阶段产出的所有任务均为 counterexample，题目维度为逻辑，文案对应目标；省略 focus 仍遵守原选择、文案、同日缓存。另测题库不足。生产集成走查也核对真实测评报告后的逻辑阶段与周任务 |
| 后续周没有安排 | 原 weeks[] 只有脚手架，stage/confirm 又拒绝已确认的月阶段，没有后续周草案入口；周确认未回记 planVersionId | `stages/index.ts` 新增 `draftStageWeek`、返回周确认关联修订的 `linkWeekPlan`；`server/agents/learning.ts` / `server/http/server.ts` 最小接线新增 `learning/stage/week-draft`，沿用认证、CSRF、版本与原 revisionProblems 门控；原 `learning/confirm` 成功后回记对应 weeks[]，保留月阶段原 confirmation。新增 `src/components/plan/WeekDraftButton.tsx`，在 `MonthStageView.tsx` / `WeeklyTasksView.tsx` 给出「生成这一周的任务」，生成后去原计划页接受 / 减量 / 改期 / 暂不开始；不自动确认 | TestClock 验证 10-05 第一周、10-12 第二周、10-19 第三周，生成草案时正式计划数量不变，学生确认后 versions 与 weeks[] 对得上；覆盖 lighter、确认时间保留、已拒绝/暂不开始不生成。HTTP 覆盖无认证 403、额外字段 400、错误状态/过期修订 409、重复请求幂等。两页提示的只读渲染也覆盖拒绝/暂缓隐藏。I 浏览器实际走第二周今日入口、第三周计划入口；生产集成走查实际走 10-26 第二周 |
| G 旧浏览器回归 2 条 | 旧后缀替换把 observe-answer 变成 probe-answer；旧断言把进入说明页当成已切换模式 | **G 路只改** `tests-agent/g/walkthrough-server.ts` / `walkthrough.spec.ts`：同时识别 observe 与 observe-answer；回答轮仅引用本轮学生话语，仍能返回错题草稿；进入专业说明时断言尚无测评，点「开始」后才核对 exploration。测试数据库改用系统临时库 | 原用例先跑 1/3（exit 1），更新后 3/3（exit 0）。未改 G 对应产品代码 |
| 长聊天结束的小结 | 原请求上限为 20 条；已保留的 slice(-20) 会截掉较早聊天正文。检查发现 chatTurns 只存阶段、信号等元数据，不存正文，不能替代这 20 条文本 | `ChatPanel.tsx` 保留 `chat.slice(-20)`，加注释说明原因；没有把空 history 当作完整聊天，也没有扩大正文持久化。服务端小结另汇总整场已保存的 observations、problems、progressCards，不随前端窗口截断 | H 新浏览器用例连续 12 轮，确认结束请求恰为 20 条，能得到小结；G/集成的小结继续含已保存的观察与进步卡。**限制仍如实保留：更早、没有形成结构化记录的聊天正文不参与本次小结，不能宣称完整长聊天语义回顾** |
| 小结后气泡停留上一句 | end 只更新 summary，PetHero 的 bubble 仍读 reply.text | `home/ConversationSummaryView.tsx` 导出小结对应文案，`ChatPanel.tsx` 在按钮结束或道别返回本次小结时使用它；手动结束且已开朗读时同步朗读。刷新后的已存小结仍按原问候流程接话 | H 长聊天浏览器先失败于气泡仍为旧回复，修复后气泡包含本次主题与「小结」；首页 9/9、G 刷新接话通过 |
| 错题确认看不到「记下了」 | 下一条回复不含 problemDraft，组件在展示 done 前就因 draft=null 返回 null | `home/ProblemConfirmCard.tsx` 允许已确认 done 在 draft=null 时保留展示，新的非空草稿仍重置确认状态；继续自动接入原一起想流程，不重复保存 | I 浏览器先失败于确认状态消失，修复后等待下一条不含草稿的聊天响应完成，仍能看见「记下了」，且 problems 只有一条；截图 03 |
| 记忆判断写假 memoryId | shouldOfferMemory 既判断又把提议机会写进 memoryMentions，模型没有给草稿的轮次也会消耗额度 | `server/plugins/memory-flow/index.ts` 将 shouldOfferMemory 改为只读；新增 recordMemoryOffer，由协调器在聊天草稿通过校验后记录。共享契约增加不含正文的 MemoryOffer / memoryOffers；`server/storage/repository.ts` 加法建表并登记 v6，重置自动清空。真实确认/提起仍写 memoryMentions；不再新增假 memoryId。历史标记只读兼容，不清洗旧数据 | 先失败于反复判断耗尽次数；修复后重复判断不改变 repository.revision、无假 mention；前两轮无草稿不消耗额度，随后只允许两次有效聊天提议，重试不重复、关闭不提议、未确认不写 memories、重置清空。I 浏览器覆盖确认、7 天时效、关闭单次提示与记忆关闭提示 |
| I 路浏览器缺失 | 没有自己的配置与走查 | 新增 `tests-agent/i/playwright.config.ts`、`browser-server.ts`、`fix-round.spec.ts`，配置参照 F，仅发现本路 spec。真实协调器与生产插件，合成模型/报告与独立 TestClock，数据库、trace、截图、JSON 均输出系统临时目录；不导入或执行 D 浏览器 spec | 4/4 通过，覆盖口述错题确认、记忆确认与关闭、记忆关闭、月阶段和三周任务。I 的月报告是显式合成夹具，不冒充真实测评；集成 2/2 另外验证真实面试引擎生成的报告与阶段 |

本轮最小扩展由用户在会话中明确授权：`learning.ts`、`http/server.ts`、`storage/repository.ts` 与共享契约/schema。加法变更已追加在 `交付/claude/CONTRACT-CHANGE.md` 末尾，`npm run schema:agent` exit 0。

测试维护还涉及：`tests-agent/i/memory.test.ts` 把“调用判断就消耗次数”的旧断言改成显式记录后计数；`tests-agent/integration2/phase2.spec.ts` 增加生产流程的模块、weeks[] 版本关联和第二周断言；`run-home-browser.mjs` 将 H 原夹具的数据库也重定位到临时目录，仅适配 imports、端口、数据库路径，不改 H 断言。未新增依赖，未改 package/lockfile、离线单文件、D 浏览器配置或 D/legacy/map/offline spec。

### 8.2 首次失败、夹具错误与重跑

证据在 `evidence/phase2/fix/logs/`，失败原文没有覆盖或删改：

1. **先于产品修复的业务红灯**：`node --import tsx --test tests-agent/i/fix-round.test.ts`，`rules-business-first-red.log`，exit 1、0/6，分别揭露草案没有限定、确认版本没有回记、纯判断耗尽次数、没有后续周方法、无草稿也消耗提议额度、题库不足仍未限定。修复后 6/6；再补 HTTP 与提示状态门控，最终 `rules-final.log` 8/8、exit 0。
2. P1 后续把夹具加强为真实提交合并同类项错答；在系统临时目录解出**修复前 HEAD 的 server/shared/src 快照**，仅把新用例放进去回放该条，`p1-exact-baseline-red.log` exit 1，显示「逻辑月目标的周任务不能选合并同类项」；修复工作区同条通过，旧调用仍选择 like-terms，限定调用只选 counterexample。没有重置、覆盖当前工作区，没有复制 .env.server。
3. `g-first-red.log`：原 G 走查 exit 1，1/3；修正测试夹具/旧断言后 `g-green1.log` 与 `g-final.log` 均 exit 0、3/3。
4. `h-bubble-first-red.log`：只跑新增长聊天用例，exit 1；20 条请求和小结已通过，但小N气泡仍为上句话，缺少主题/小结。修复后 `h-home-final.log` exit 0、9/9，保留失败重试与刷新接话回归。
5. `i-first-red.log`：exit 1，1/4。错题用例确实失败于下一条回复之后没有「记下了」；记忆用例因旧判断提前消耗机会而等不到提议；月阶段用例第一次写错按钮名称「计划」，未到业务断言。`i-week-ui-first-red.log` 仍 exit 1，是注入报告后没刷新 view 的夹具错误，**不当作产品红灯**。更正为「查看我的计划」、注入后刷新，`i-green1.log`、`i-final.log` 均 exit 0、4/4。
6. 另保留测试准备错误：`rules-first-red.log` / `rules-all-first-red.log` 中 P1/题库不足用例起初未 installLearning，遇到 B snapshot 未注册；补注册后才得到第 1 项的有效业务红灯。`h-first-red.log` 是 G 尚占用 18954 时误启动 H 适配器，exit 1；没有关闭占用进程，等 G 自行结束后重跑成功。上述错误未被计为功能复现或通过证据。

### 8.3 最终命令与退出码

除 Git/归档外，cwd 为本 worktree 的 `outputs/xiaon`。全部浏览器按顺序使用集成 **5214 / 18954**；最初只跑新增 H 红灯用例时使用其原 **5212 / 18952**。执行时输出在系统临时目录，选定文本日志和三张截图另归档到 fix/，trace 与完整浏览器结果仍在临时目录。

| 命令 | exit | 结果 / 日志 |
| --- | --- | --- |
| `npm run schema:agent` | 0 | `schema.log`，加法 schema 已同步 |
| `npm run typecheck:agent` | 0 | `final-typecheck.log`；最后调整浏览器截图与加强用例后再跑 `typecheck-last.log` 也为 0 |
| `npm test` | 0 | 25/25，`final-domain.log` |
| `npm run test:agent` | 0 | 229/229，`final-agent.log`；加强真实错答夹具后再跑见 `agent-last.log` |
| `npm run build` | 0 | `final-build.log`；仍有既有 >500 kB chunk 提示，未扩展拆包范围 |
| `npm run test:agent:g` | 0 | 59/59，`final-unit-g.log` |
| `npm run test:agent:h` | 0 | 15/15，`final-unit-h.log` |
| `npm run test:agent:i` | 0 | 36/36，`final-unit-i.log` |
| `node --import tsx --test tests-agent/i/fix-round.test.ts` | 0 | 最终 8/8，`rules-final.log` |
| `XIAON_G_UI_PORT=5214 XIAON_G_API_PORT=18954 XIAON_G_BROWSER_OUT=<tmp>/g-final npx playwright test -c tests-agent/g/playwright.config.ts` | 0 | 3/3，`g-final.log` |
| `node tests-agent/integration2/run-home-browser.mjs` | 0 | H 首页 9/9，`h-home-final.log`；自建临时适配目录 |
| `XIAON_H2_UI_PORT=5214 XIAON_H2_API_PORT=18954 XIAON_H2_BROWSER_OUT=<tmp>/h2-final npx playwright test -c tests-agent/h/playwright.professional.config.ts` | 0 | H 专业模式 5/5，`h2-final.log`；预期的过期修订 409 是测试的一部分 |
| `XIAON_I_BROWSER_OUT=<tmp>/i-final npx playwright test -c tests-agent/i/playwright.config.ts` | 0 | 4/4，`i-final.log` |
| `XIAON_INTEGRATION2_OUT=<tmp>/integration-final XIAON_INTEGRATION2_SHOTS=<tmp>/integration-final/shots npx playwright test -c tests-agent/integration2/playwright.config.ts` | 0 | 生产插件集成 2/2，`integration-final.log` |
| `git diff --cached --check -- outputs/xiaon <契约变更文档> <本报告>` | 0 | 产品、测试脚本、契约与文档无新增空白错误 |
| `git diff --cached --check`（包括原始日志） | 2 | 仅原始命令输出的尾空格/EOF 空行，见 staged-check.log；为保留首次失败原文，不清洗日志 |

`<tmp>` = `/tmp/xiaon-integration2-fix-BcLfPe`。H 首页适配目录 = `/var/folders/fr/nbw51ddj6xx5kt_9qyh389br0000gn/T/xiaon-integration2-h-home-XkVmpI`。临时目录不保证永久存在，所需原始文字证据已归档。`final-gates.json` 与 `manifest.json` 记录命令结果及归档文件 SHA-256。

### 8.4 三张 390 宽截图、限制与停线

- `evidence/phase2/fix/01-month-and-week.png`：生产面试/规划插件、合成模型，逻辑月目标与反例/条件周任务同屏，已确认第 1 版。
- `evidence/phase2/fix/02-week-two-confirmed.png`：同一集成流程 TestClock 到 10-26，学生手动生成并确认第二周，显示第 2 版；第三周另外由规则测试和 I 浏览器的 10-19 流程验证。
- `evidence/phase2/fix/03-problem-recorded.png`：I 路真实错题确认接口返回、下一条聊天响应完成后，「记下了」仍可见；截图为 390×844。前两张为 390 宽整页图，固定导航在整页截图中的一个视口位置属于截图表现。三张均已实际查看并核对，页面无横向溢出。

本轮点名的 P1、后续周、G 回归及第一期退回项均已处理；没有剩余已知阻塞项。保留的能力/证据边界：长对话只向小结提供最近 20 条正文及全场结构化记录，未扩充题库；题目不足或条件不满足时如实显示；现有大 chunk 构建提示未处理。以上自验不能替代下列未运行项：

| 证据层级 | 本轮状态 |
| --- | --- |
| 静态检查、构建、规则/HTTP | 通过 |
| 生产引擎 + 合成模型集成浏览器 | 通过；TestClock，不改系统时间 |
| H 首页问候/小结与 H 专业 UI 替换协调器夹具 | 通过；仅相应 UI 证据，与生产引擎分开 |
| I 月报告夹具 | 显式合成；月/周插件真实执行，另由集成走查补真实面试报告链路 |
| 真实模型 | **未运行**；未读取、复制或打印 .env.server |
| 真实设备、真实麦克风识别、软键盘、辅助技术、人工学生验收、第三方独立审查 | **未运行** |
| D 阶段浏览器及 legacy/map/offline spec | **未运行** |

只启动并结束本轮自己的测试进程，无宽匹配终止。提交前再次核对集成端口没有本轮遗留服务。具体提交号以本轮 `git log -1` 为准（报告在该提交内，不自引用提交号）。**提交完成后停在 revamp/integration2，请用户明确决定是否合入 main；未推送、未合并、未打标签。**
