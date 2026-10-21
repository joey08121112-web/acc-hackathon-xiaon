# 第一期集成报告

日期：2026-10-21。按 `04-集成与验收.md`「第一期集成」执行。

- 分支 `revamp/integration`，从 main `99a9385`（含 `revamp-base`）开始；worktree 是 `/Users/ami/Documents/个人/ACC黑客松-wt/integration`。
- 集成用端口 5214 / 18954。zCode 的开发服务器（18953 / 5213）不是本次启动的，没有动。
- **未合入 main，未打 tag，未推送。** 等用户确认后合入 main 并打 `revamp-phase1`。

## 1. 合并的提交

| 顺序 | 来源 | 集成分支上的提交 | 冲突 |
| --- | --- | --- | --- |
| 1 | zCode `revamp/i-problem-vision` `f476b66` | 合并提交 `eb0c901` | 无文本冲突 |
| 2 | Claude `revamp/g-think-card` `affb54f` | 合并提交 `518fa15`；随后修正提交 `8c3111b` | 无文本冲突 |
| 3 | ChatGPT `revamp/h-home-memory` `2b9ae20` | 合并提交 `d7cfb7a` | 无文本冲突 |
| — | 两份契约变更申请与挂载位接线 | `0ce03c0` | — |
| — | g 路浏览器走查与集成中发现的修复 | `2855679` | — |
| — | 本报告 | 其后的单独提交 | — |

每合一路都跑了 `typecheck:agent` 和 `test:agent`，记录在 `evidence/merge-gates.txt`：

| 时点 | typecheck:agent | test:agent |
| --- | --- | --- |
| 合入 zCode 后 | 0 | **exit 1**：164 项中 159 过、5 失败（g 里 4 条钉死 zCode 桩的断言，加上 `/api/voice/asr` 端口冲突） |
| 合入 Claude 并修正后 | 0 | 0：178/178 |
| 合入 ChatGPT 后 | 0 | 0：184/184 |
| 契约变更之后 | 0 | 0：189/189 |

## 2. 需求评审会话转来的 7 项，逐项处理

**1. g 里钉死 zCode 桩的 4 条断言**：按 zCode 的实际实现更新（`8c3111b`）：
- `home-chat`：probe 轮的 `problemDraft` 丢弃原因改为 `invalid`（模型编的卡点原话不在学生话里）；记忆开启时聊天里的记忆草稿会下发，不再被丢弃；
- `alignment`：`confirmProblem` 正常保存并保留 `stuckPointId`；Tutor 只收到 `selectMemoriesForContext` 挑出的相关记忆（学生只说「你好」时一条也不挑），并核对不超过 5 条、都属于有效记忆。

**2. 已有场次显式切换模式（ChatGPT 申请）**：
- 做法：沿用同一场次，以带 `mode` 的场次事件记录切换；`learning/start` 只有在带 `switchMode: true`（学生点「去专业模式」）时才切换，不带时行为不变。
- 场次 id 不变，所以每场次 10 道计算题的上限、暴露和证据都不会被重置；暂停中切换会同时恢复；换一天照旧新开场次。
- 回归测试 `tests-agent/g/mode-switch.test.ts`（3 项，先写测试，首次失败留档在 `evidence/mode-switch-first-run.txt`）。D 的原有测试全过。
- ChatGPT 的 `h/browser.spec.ts` 里有一条用例钉的是「切换失败、留在首页」这个旧限制，已改为期望进入探索页（属于申请本身的结果）。
- 详见 `交付/claude/CONTRACT-CHANGE.md` 第 1 节。

**3. 确认记忆时选时效（zCode 申请第 2 条）**：
- `ConfirmMemoryDraft.retention` 可选，取值 forever / 7d / 30d；共享函数 `retentionWindow` 负责换算；重新生成了 JSON Schema。
- zCode 的 `confirmMemoryDraft` 改为调用它（一行）。
- 前端最小接线：`MemoryPrompt` 里加了三选一（zCode 文件，**本次集成补的接线，请 zCode 复核**）；记忆页的手动新增和更正接上 `expiresAt` / `reviewAt`；满 30 天显示「这条还适用吗？」，可以「还适用」（续 30 天）或「不适用了」（停用）。
- 测试 `tests-agent/g/retention.test.ts`（2 项，首次失败留档在 `evidence/retention-first-run.txt`）。

**4. 题目卡片补 `navigate`**：
- `ProblemCaptureProps`、`ProblemConfirmCardProps` 加了 `navigate`，ChatPanel 传入；`ProblemCapture` 去掉了 `pushState + PopStateEvent` 的绕路。
- 确认卡不需要 `send`，确认后由 `onConfirmed` 交给 ChatPanel 发送。
- 进步卡处的 `MemoryOffNotice where="progress_card"`：`ProgressCardView` 内部早已挂上；走查截图 `m0-02` 显示首页和进步卡两处都有提示。

**5. 测试端口冲突**：
- 新增 `freePort()`（监听 0 端口，由系统分配）。
- `d/voice-input.test.ts` 原来写死 18952/18953，`d/voice-stage.test.ts` 原来写死 18950/18951，都与各路开发端口重叠，现在改用 `freePort()`；仍可用原来的环境变量指定端口。
- zCode 正在运行的 18953 进程没有动。

**6. `tests-agent/h/contract-smoke.test.ts`**：
- ChatGPT 分支没有改过这个文件（与 `revamp-base` 一致）；g 分支只改了一行（conversation/end 期望从 501 改为返回小结）。
- 合并结果取 g 分支的版本，与 `affb54f` 完全一致。h 批次 8/8 通过。

**7. `.git/refs/heads/revamp/g-think-card 2`**：没有动。git 每次都会提示「忽略带有错误名称 refs/heads/revamp/g-think-card 2 的引用」，不影响结果，等用户决定。

## 3. 验收命令与退出码（最终，`evidence/final-gates.txt`）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck:agent` | 0 | |
| `npm test` | 0 | 25/25 |
| `npm run test:agent`（a b c d e g h i） | 0 | 189/189 |
| `npm run build` | 0 | built |
| `npm run test:agent:g` / `:h` / `:i` | 0 / 0 / 0 | 43 / 8 / 19 |
| h 浏览器 `playwright test -c tests-agent/h/playwright.config.ts` | 0 | 8/8（`evidence/browser-h.txt`，含第一次运行时的那 1 条失败） |
| g 浏览器 `playwright test -c tests-agent/g/playwright.config.ts`（集成端口） | 0 | 3/3（`evidence/browser-g.txt`） |
| i 浏览器 | — | **未运行**：zCode 没有建本路浏览器配置（其 HANDOFF 写明留到第三期） |
| D 阶段浏览器测试 | — | 按约束**没有运行** |
| 真实模型 | — | **未运行**：集成 worktree 没有 `.env.server`，没有复制 |

浏览器输出都在系统临时目录。走查截图存在 `evidence/walkthrough/`。

## 4. 演示走查（390 宽，模拟模型）

g 路浏览器用例就是第一期演示路线：
- `tests-agent/g/walkthrough.spec.ts`，配置 `tests-agent/g/playwright.config.ts`；
- 服务端 `tests-agent/g/walkthrough-server.ts`：真 HTTP / SQLite / 阶段机和三路真实插件，只有模型是按阶段写台词的合成模型。

截图都在 `evidence/walkthrough/`，每张都人工看过：

| 截图 | 走查点 | 结果 |
| --- | --- | --- |
| `p1-01-home-opener` | 打开首页，小N先开口 | 通过 |
| `p1-02-needs-check` | 「我考砸了」倾诉两轮后出现确定需求，选「看看哪里没考好」 | 通过 |
| （无单独截图） | 聊到应用题读着绕，第 6 轮程序放行试探，记下一条理解观察（学生原话、待核实） | 通过 |
| `p1-03-problem-card` | 口述「负号括号总错」，出现错题记录确认卡，点「记下」 | 通过 |
| `p1-04-think` | 一起想题库题 bracket（错题记录引用题库题），中途要一次提示（1 级），说出答案进入看见进步 | 通过 |
| `p1-05-progress-card-and-memory` | 进步卡如实写「在第1级提示后算出了结果」，方法栏引用学生原话「拆开来看就清楚了」；记忆草稿可选「一直记得 / 记 7 天 / 记 30 天」 | 通过 |
| `p1-06-saved` | 记住方法、保存进步卡 | 通过 |
| `p1-07-summary` | 「今天先聊到这」：小结里有聊了什么（无情绪标签）、对话观察（待专业模式确认）、计划建议、今天的进步卡、专业模式建议 | 通过 |
| `p1-08-explore` | 点「去专业模式」进入探索页，场次模式确为 exploration | 通过 |
| `p1-09-refresh-greeting` | 回首页刷新，小N用上次的小结开场 | 通过 |
| `p1-10-second-compare` | 第二次对话：「和上次比」只写一条，引用两次的原话 | 通过 |
| `p1-11-growth` | 成长页：对话小结、进步卡 | 通过 |
| `m0-01` 到 `m0-03` | 记忆关闭再走一遍：不提议、不提起，首页和进步卡两处都显示「记忆已关」，小结照常保存 | 通过 |
| `s-01-rest`、`s-02-safety` | 休息照旧暂停；安全拦截给求助信息，不留阶段记录，不产生观察 | 通过 |

说明：
- 整页截图里，固定的顶栏和底部导航会出现在图片中段，这是截图方式造成的，不是页面布局问题。
- 390 宽浏览器不等于真实手机，没有用真机验收。

## 5. 集成中发现的问题与处理

| 问题 | 责任路 | 集成分支上做了什么 | 要不要退回 |
| --- | --- | --- | --- |
| 「今天先聊到这」把整段聊天发给 `conversation/end`，超过 20 条时契约拒绝（400），长对话拿不到小结 | ChatGPT | 在 ChatPanel 挂载位改成 `chat.slice(-20)`，一处 | 退回 ChatGPT 确认 |
| 学生说出答案后，题库里另一道未作答的题（`calc-1`）答案相同，旧拦截仍会拦下 | Claude | 已在 g 分支修好（按学生说出的表达式放行），集成时验证通过 | 不退回 |
| 记忆时效选中后没有可见的选中状态 | Claude（接线时补） | `progress.css` 加了 `[aria-label="记多久"]` 的选中样式 | 不退回 |
| 错题确认卡点「记下」后马上发送「就看这道题吧」，新回复里没有 `problemDraft`，卡片立即消失，「记下了」的提示学生看不到 | zCode（确认卡在 draft 为空时直接返回 null） | 未改 | 退回 zCode |
| `shouldOfferMemory` 把「提议过一次」的计数用一个假的 memoryId 写进 `memoryMentions`：判断函数带写入副作用，也让该集合混进了非记忆数据 | zCode | 未改 | 退回 zCode |
| 发出小结后，小N的气泡仍显示上一句回复（例如「你算出来了……」） | ChatGPT | 未改 | 退回 ChatGPT（体验小问题） |
| 对话观察只能在程序放行试探的那一轮记录；学生对试探问题的回答，要到下一个试探轮（3 轮后）才能被记下 | Claude | 未改；走查时让学生在试探轮说出原话 | Claude 后续处理（下一期前修正：允许在试探的下一轮记录回答） |
| zCode 没有本路浏览器用例 | zCode | — | 退回 zCode |
| D/E 浏览器用例的 `onboard()` 依赖默认显示的服务模式条（现在只在开发者模式显示） | 无人拥有（D/E） | 未运行、未改 | 等用户决定是否申请修改 |

## 6. 证据级别

| 级别 | 状态 |
| --- | --- |
| 静态检查 | 跑了 |
| 规则单测 | 跑了 |
| 模拟模型端到端 | 跑了：协调器层、HTTP 层，以及浏览器 390 宽走查 |
| 真实模型 | 未运行 |
| 浏览器 | g、h 跑了；i 不存在；D 按约束没有运行 |
| 真实设备 | 未运行 |

## 7. 等用户确认

- 把 `revamp/integration` 合入 main，并在合入后的提交上打 tag `revamp-phase1`。
- 第 5 节里退回 ChatGPT、zCode 的问题，是否在第二期开始前修。
