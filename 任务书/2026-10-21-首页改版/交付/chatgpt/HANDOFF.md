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
