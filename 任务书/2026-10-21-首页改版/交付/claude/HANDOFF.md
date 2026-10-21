# Claude 路交接

契约见同目录 `CONTRACT.md`（阶段 0，tag `revamp-base`）。本文件按期追加。路径相对 `outputs/xiaon/`。

## 第一期（2026-10-21）：综合模式的对话观察与小结（A）+ 一起思考与进步卡（B）

### 1. 范围与未完成项

**A：综合模式的对话观察与小结（先做）**

- **观察校验** `validateObservation`（`server/plugins/conversation`）。四条规则：
  - 维度只能是理解或逻辑；
  - 只在阶段机放行试探的 probe 轮；
  - `quote` 必须逐字出自本场次学生原话（协调器只传本场次最近 `turn` 条学生消息）；
  - 同场次每维至多 3 条。

  通过的观察由协调器写入 `observations`，一律 `unverified`，不写评分证据、不改知识点状态。
- **对话小结** `endConversation`。触发方式：学生点「今天先聊到这」（`/api/learning/conversation/end`），或道别时程序自动触发（回复带 `summary`）。每场次只生成一份，重复调用返回已存的那份。
  - 有模型时用 `SUMMARY_PROMPT` 起草 `topics` 和 `planSuggestions`；程序丢弃含情绪标签的条目（`EMOTION_LABEL_PATTERN`），计划截到 1–3 条。没有模型或草稿不合格时，由程序拼装：聊了什么、错题和卡点知识点、计划建议。
  - `changes`：只对比上一份小结和本次「同一维度都有观察」的情况，每条同时引用两边原话；没有上一份就为空。
  - `suggestProfessionalMode`：本场次最后 2 句命中强烈情绪关键词时为 false；否则有观察、错题或卡点时为 true。
  - 本场次有进步卡时挂上 `progressCardId`。
  - 本场次碰过安全拦截的，不生成小结（`invalid_state`）。不受记忆开关影响。
- `latestSummary` 已实现，给 zCode 的问候用。
- 成长页（`LearningPages.tsx`）新增「对话小结」列表，标注「聊天观察，待专业模式确认，不是评分」。

**B：改造三，一起思考与进步卡**

- **逐级帮助（FR16）**：学生明确要帮助时（「给我一点提示」等，`HELP_PATTERN`），程序把级别加一，最高 3 级：
  - 1 级：请学生复述条件或下一步想法；
  - 2 级：指向一个关系或符号；
  - 3 级：展示必要的局部一步。

  级别通过输入 `helpLevel` 交给模型，模型不能自己升级。每一级都写进 episode 的 `helpLevelsUsed`；题库题另外写一条 `chat_help` 暴露事件，所以之后的作答如实算作「提示后完成」。
- **答案拦截**：以下答案在学生自己说出前一律拦下（运行状态 `failed`，学生看到一句温和的话，看不到答案）：
  - 本场次错题记录的 `ProblemSecret`；
  - episode 引用的题库题答案。

  学生说出后（程序比对命中，`studentSolvedAt`），放行这些表达式，学生想看解析可以看（决定 7）。秘密答案不进入提示词数据。
- **think → reflect**：答案命中、说「懂了」或满 10 轮。**reflect → companion**：确认或整张跳过进步卡之后。episode 关闭。重启后片段从 SQLite 接着聊。
- **进步卡草稿** `draftProgressCard`：进入 reflect 那一轮只请学生说收获，学生回应后（包括「先跳过」）才起草。
  - 来源顺序：模型本轮提议的草稿 → 单独的模型调用（`PROGRESS_CARD_PROMPT`）→ 程序拼卡。程序拼卡如实写「在第 N 级提示后算出了结果」，方法栏引用学生原话。
  - 每栏都要过程序校验，不合格就换成程序文本：用过提示不能写「完全靠自己」之类；不写信心；「」里的引用必须是本片段学生原话。
  - 记忆开启时，从方法栏（没有就用突破栏）提炼一句 `MemoryDraft`（`kind: method`、`origin: progress_card`），交给 zCode 的 `MemoryPrompt`；记忆关闭时为 null。
- **进步卡确认** `confirmProgressCard`：
  - 只能在 episode 到了 reflect 之后，每个 episode 一张，重复保存返回 `conflict`；
  - AI 草稿（`aiDraft`）和学生文本分开存，空栏记入 `skipped`；
  - 信心只来自学生自选；
  - 不进入评分证据。
- **`ProgressCardView`**：三栏可编辑、每栏可跳过，有可不选的信心自评，按钮是「确认保存」和「这次先不记」（整张跳过）。卡片内挂 zCode 的 `MemoryOffNotice`（`where="progress_card"`）。样式在 `src/styles/progress.css`。
- 成长页新增「进步卡」列表，标「提示后完成 / 自己完成」，没有自评显示「未记录」。

**未完成、限制与偏差**

- **界面要等 ChatGPT 打开首页流程才能走到。** `ChatPanel.tsx` 的 `HOME_FLOW` 仍为 false（ChatGPT 的文件），所以本分支上首页仍是旧流程。观察、小结、一起思考、进步卡在后端和测试里完整可用，界面要等集成后才能走演示路线。
- **`ProgressCardView` 和成长页新列表没在浏览器里看过**，390 宽也没实测（本期没有跑浏览器）。
- **学生原话靠客户端发来的 history 核对。** 服务端不存聊天原文，观察原话和进步卡引用的核对依据是客户端发来的 history，并截到本场次或本片段的轮数。
- **安全检查范围偏严。** 小结的安全检查扫的是请求 history 的整个窗口，最多 20 条。如果上一场次的危险用语还在窗口里，本次也不出小结。宁可偏严。
- **`aiDraft` 没有和服务端副本核对。** 进步卡确认时的 `aiDraft` 由客户端回传，服务端不保存未确认的草稿。
- **「先停一下」不改阶段。** 学生说了仍停在 think，随时回来接着想。`LearningEpisode.status` 没有 paused，想加需要走契约变更。
- **没有参考答案的错题记录**（`answerStatus: unknown`）只能靠说「懂了」或满 10 轮进入 reflect。
- **成长页进步卡的标注偏离了任务书原文。** 任务书写「对话小结，不是评分」，像是笔误；实际写的是「你确认过的学习记录，不是评分」。
- **跨路改动一处**：`tests-agent/h/contract-smoke.test.ts`（ChatGPT 名下）的一行断言，从「conversation/end 返回 501」改为「返回小结」。这份冒烟是阶段 0 由 Claude 写的桩测试；本期实现后它必然失败，而完成标准要求 `test:agent` 全过，所以只改了这一行。ChatGPT 如果已经整体替换了这个文件，集成时以 ChatGPT 的版本为准。

### 2. 分支、提交、改动文件

- 分支 `revamp/g-think-card`，从 `revamp-base`（`99a9385`）开始。worktree 是 `/Users/ami/Documents/个人/ACC黑客松/.claude/worktrees/g0-contracts-6a70eb`，由 app 分配，与总控表写的 `ACC黑客松-wt/claude` 不同。
- 代码提交 `25c689e`；本文件在其后的单独提交里。
- 改动文件：
  - 后端：`server/agents/learning.ts`、`roles.ts`、`stages.ts`、`prompts/think.ts`、`prompts/reflect.ts`、`server/plugins/conversation/index.ts`、`server/plugins/progress/index.ts`
  - 前端：`src/components/learning/LearningPages.tsx`、`src/components/learning/home/ProgressCardView.tsx`、`src/styles/progress.css`
  - 测试：`tests-agent/g/{conversation,think-card}.test.ts`（新增）、`tests-agent/g/{contract-smoke,home-chat}.test.ts`、`tests-agent/h/contract-smoke.test.ts`（一行）
  - 证据：`交付/claude/evidence/` 下的三个文件
- 契约（`shared/**`）没有改动，无需 CONTRACT-CHANGE。

### 3. 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck:agent` | 0 | |
| `npm test` | 0 | 25/25 |
| `npm run test:agent`（a b c d e g h i） | 0 | 161/161 |
| `npm run build` | 0 | built |
| `npm run test:agent:g` | 0 | 38/38 |
| `npm run test:agent:h` / `:i` | 0 / 0 | 2/2、2/2 |

记录在 `evidence/p1-gates.txt`。

先写测试、首次失败留档：

- `evidence/p1a-conversation-first-run.txt`：7 项全部失败，都是 `not_implemented`（桩）。
- `evidence/p1b-think-card-first-run.txt`：第一次运行 6 项失败、1 项通过。通过的那项本身写错了：合成答案 `-x+5` 含题库答案 `x+5`，被旧的题库拦截碰巧拦下。改用与题库无关的 `7y-11` 后重跑，7 项全部失败，同一文件里有说明。

实现过程中暴露并修正的问题：学生在一起思考里说出题库题答案后，旧拦截仍会拦下这个表达式，因为另一道未作答的题库题（`calc-1`）答案也是 `3x+2`。现在按「学生已说出的答案表达式」放行，而不是按题号放行。

阶段 0 的两条桩断言（`home-chat` 的观察丢弃原因、道别时 `summary` 为 null）按实现后的行为更新了。

### 4. 证据级别

| 级别 | 状态 |
| --- | --- |
| 静态检查 | 跑了 |
| 规则单测 | 跑了 |
| 模拟模型端到端 | 跑了：协调器层，合成模型；HTTP 层冒烟 |
| 真实模型 | 未运行：没有读取 `.env.server`，没有 Key |
| 浏览器 | 未运行：本期没建本路浏览器配置；没有运行任何 D 阶段浏览器测试 |
| 真实设备 | 未运行 |

### 5. 给集成方的入口

- 快速核对：`npm run test:agent:g`。按流程读，从 `tests-agent/g/think-card.test.ts` 的 `intoThink()` 开始。
- 手动走一遍后端（本路端口 18951，库放在 worktree 内）：

```bash
XIAON_API_PORT=18951 XIAON_DB_PATH=.local/claude.sqlite npm run server
```

  然后对 `/api/learning/chat` 发带 `flow:'home'` 的请求：
  1. 倾诉两句；
  2. 说「这道题我不会做」进入 probe；
  3. `intent:'start_together'`（需要先 `learning/start` 并 `learning/open` 一道题库题，或带 `problemId`）；
  4. 说「给我一点提示」，再说出答案；
  5. 说收获，拿到 `progressCardDraft`，调用 `/api/learning/progress-card/confirm`；
  6. 再聊一句回到 companion；
  7. 调用 `/api/learning/conversation/end` 拿到小结。
- 界面联调：ChatGPT 把 `HOME_FLOW` 改为 true 之后，`ProgressCardView` 从 `reply.progressCardDraft` 出现，成长页显示进步卡和对话小结。
