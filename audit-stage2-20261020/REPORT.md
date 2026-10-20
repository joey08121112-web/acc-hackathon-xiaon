# 学伴小N · 阶段2 最小完整流程审查

审查日期：2026-10-20（Asia/Shanghai）。

审查性质：独立审查，分两段执行。前段由 Codex 审查会话（与本产品实现会话不同）采集证据 01–30、math-probe、构建与单元日志，因额度耗尽中断，未写出报告；后段由 ZCode 会话复验三项已发现问题（证据 31–39），补齐核对并撰写本报告。两段均未修改产品源码，未触碰 5173 端口的演示进度。这不代表人工第三方认证。

## 1. 审查结论

**不通过（存在 1 项未解决的 P1）。**

阶段2核心路径本身可以走通：首次进入 → 必要授权 → 拒绝可选功能 → 小N交流 → 主动看题 → 初次作答 → 提示 → 修改 → 学习观察，全程实际操作并留有证据；初次/提示后/修改的作答区分、失败重试不重复计题、聊天等待与失败状态均表现正确。但答案核对在可枚举的**数学等价写法**上把正确答案判为错误，并连带让学习观察报告漏记首次独立完成（S2-01，P1）。按共同规则「仍有未解决的 P0/P1 就不能写本阶段通过」，本轮判不通过。修复 S2-01 后可针对性复验，无需重跑全部检查。

另有 1 项 P2（跨题后浏览器返回不接续）和 1 项 P3（休息返回聊天时邀请立即出现），不阻塞通过。

## 2. 审查依据与范围

### 需求来源与优先级

1. 用户 2026-10-20 提供的阶段2审查要求（本轮验收依据），含共同审查要求与统一交付格式。
2. 实现聊天「实现学伴小N手机网页原型」的完整用户原始提示词，保存于 [audit-stage1 sources](/Users/ami/Documents/个人/ACC黑客松/audit-stage1-20261020/sources/01a15834-2d3c-79a1-b4cb-daced9f9ab4c.md)；本轮另存活动快照 [implementation-users-live.json](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/sources/implementation-users-live.json)。
3. 阶段1审查 [REPORT.md](/Users/ami/Documents/个人/ACC黑客松/audit-stage1-20261020/REPORT.md) 与修复 [FIX-REPORT.md](/Users/ami/Documents/个人/ACC黑客松/fixes-stage1-20261020/FIX-REPORT.md)：S1-01、S1-02 已修复，本轮验证其修复后行为（拒绝后暂缓状态、地图字号不在阶段2范围）。
4. 规划确认 [planning-confirmations.md](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/sources/planning-confirmations.md)、队友原稿提取 [开发APP需求-live-extracted.txt](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/sources/开发APP需求-live-extracted.txt)。助手提案（planning-proposals）中未被确认的细节不作为验收条件。
5. 项目 [README](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/README.md)、[VALIDATION.md](/Users/ami/Documents/个人/ACC黑客松/outputs/VALIDATION.md)。开发者自查记录不直接算本轮通过，仅作对照。
6. 当前目录及父目录无 AGENTS.md。

### 版本与环境

- 产品路径 `/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon`（阶段1修复后版本）。非 Git 仓库。审查开始时 45 项文件哈希记录于 [source-before.json](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/source-before.json)；本轮结束时抽验 `src/data.ts` 哈希仍为 `9fd87a20…`，与记录一致，产品源码未变。
- 运行副本 `audit-stage2-20261020/runtime/`，`diff` 确认与产品 `src/`、`package.json` 完全一致；在 127.0.0.1:5178 独立启动，不接触 5173 产品端口。
- 前段环境：Codex 内置浏览器（桌面引擎手机视口 390×844）。后段复验环境：Playwright chromium 1248 无头浏览器，390×844 视口，Node v26.8.2。均为桌面引擎，非真机。
- 构建、类型检查与 20/20 单元测试结果见 [build-current.log](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/build-current.log)、[unit-current.log](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/unit-current.log)（前段采集）。
- 全程虚构年龄/年级、合成对话与原创示例题；未发送任何真实通知，未修改产品代码，未发布。

### 本轮未覆盖

真实 iOS/Android 软键盘与移动浏览器（键盘遮挡项因此未验证）、屏幕阅读器人工验收、真机系统字号；地图五维任务全量、上传裁剪流程、监护/求助/隐私页深测（属阶段3/4范围）；「拒绝探索」仅经单元规则测试覆盖，未走完整浏览器链路；未重跑 17 条浏览器全套用例。

## 3. 问题列表

### S2-01 · P1 · 数学等价的正确写法被判为错误，学习观察因此漏记首次独立完成

**事实，已复现（两段审查各自独立复现）。**新题 `7a − (3a − 2)` 输入 `4*a+2`，判为错误并提示「先观察去括号这一步，尤其是括号前的符号」；改为数学含义相同的 `4a+2` 后才判对。确定性核对探针显示 `4*a+2`、`4×a+2`、`+4a+2` 三种等价写法全部误判（`×` 已被 normalize 转为 `*`，仍被拒）。同一学生先答 `4*a+2` 再改 `4a+2` 时，报告状态为「需要继续观察」，新题首次独立完成未被记录。

- **实际影响：**数学上正确的首次独立作答被记为待继续观察，报告结论与真实表现相反；错误反馈还把学生引向不存在的符号问题。这直接违背「有依据的学习观察」的核心承诺，误导学生与后续计划。正确写法 `4a+2` 可绕行，但产品未告知学生必须省略显式乘号，手机键盘输入 `*` 或 `×` 都很自然。
- **对应需求：**阶段2「示例数学题、答案、提示和反馈是否正确」「初次作答、提示后回答、最终结果是否分别记录」「不同回答是否产生相应反馈，报告是否真正依赖作答」；原始提示词「题目、参考答案与反馈应正确、清楚」。
- **前置条件：**进入基本体验，打开同类新题（探索或「用一道新题检验」入口均可）。
- **复现：**新题 `7a − (3a − 2)` 输入 `4*a+2` 提交 → 观察「先停在这一步」反馈；或直接运行 [math-probe.ts](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/math-probe.ts)。
- **预期：**与参考答案数学等价的一次式写法（显式乘号、前置正号）应判对；报告应记录首次独立完成。
- **实际：**三种等价写法判错；报告退化为「需要继续观察」。
- **证据：**[math-probe.log](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/math-probe.log)（前段）、[31-math-probe-rerun-zcode.log](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/31-math-probe-rerun-zcode.log)（后段复跑，同样 3 项 FAIL）、[15 误判当场](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/15-equivalent-marked-wrong.png)、[16 报告漏记](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/16-equivalent-report.png)、[24 对照：`3x+1` 规范写法正常记为本次独立完成](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/24-independent-report.png)。
- **位置：**[data.ts:172](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/data.ts:172)。`correct()` 先要求最后一步与预设答案**字符串相等**，不相等即 `return false`，后面的 `linear()` 等价解析（[data.ts:174-183](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/data.ts:174)，其乘积解析 [data.ts:143-152](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/data.ts:143) 本身完全支持 `4*a+2`）没有机会运行。
- **最小修复方向：**最终一步字符串不匹配时回退到现有 `linear()` 等价判断，而不是直接判错；选择类题目维持原逻辑。需保证错误答案（如 `4a-2`、`x-5`）仍判错——探针中的负例可直接用作回归。

![4*a+2 被判错误](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/15-equivalent-marked-wrong.png)

### S2-02 · P2 · 从原题进入新题后，浏览器返回不恢复上一题

**事实，已复现（两段审查各自独立复现）。**答完原题后点「用一道新题检验」进入新题，再按浏览器返回：页面仍停留在新题（后段复验中标题仍为「换一道，看看新变化」、0 次尝试、URL 仍为 `#task`），返回操作看似无效。前段证据中，答错新题后点「换一题，先练这个小环节」再按返回，显示的是又一道未作答的新题 `6x − (3x − 2)`。

- **实际影响：**学生用系统返回想回看上一题时回不去，甚至被留在一道未打开过的补充题前；返回键无响应感。可经顶部「返回」按钮或底部导航绕行，因此不定为 P1。
- **对应需求：**阶段2「暂停、刷新、返回和恢复是否接续到正确位置」。
- **前置条件：**已进入基本体验，连续打开两道计算题。
- **复现：**原题答对 → 「用一道新题检验」→ 按浏览器返回 → 观察仍在新题页。
- **预期：**返回应回到上一题（或进入任务前的页面），恢复到正确位置。
- **实际：**停留在新题，无任何状态变化。
- **证据：**[25 原题](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/25-history-original.png)、[26 新题](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/26-history-new.png)、[27 返回后仍停留新题](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/27-history-back-still-new.png)（前段）；[33 返回前](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/33-zcode-back-before.png)、[34 返回后](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/34-zcode-back-after.png)（后段复验，脚本 [verify-issues.mjs](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/verify-issues.mjs)）。
- **位置：**[App.tsx:278](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/App.tsx:278) `openTask` 的 `pushState` 只携带 `{page:'task'}` 不携带题目 id；[App.tsx:176-184](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/App.tsx:176) `popstate` 只恢复 `page/tab`，不恢复 `activeTask`。
- **最小修复方向：**`pushState` 的 state 记录 `taskId`，`popstate` 时恢复对应 `activeTask`；或至少保证从任务页返回时回到进入该任务前的页面。不应影响刷新恢复（进度持久化）与计题上限。

### S2-03 · P3 · 休息后选择「我想继续聊聊」，看题邀请立即重新出现

**事实，已复现（两段审查各自独立复现）。**学生先拒绝看题（暂缓状态正常显示），随后经「我想开始看题」主动重新进入任务（此操作按设计清除暂缓），之后选择「今天先休息」，再点「我想继续聊聊」返回聊天：邀请条「如果愿意，我们可以只看一道题 / 我愿意」与快捷项「我愿意试试」立即出现。

- **实际影响：**有限。休息期间确无催促、今日任务已暂停；「我想继续聊聊」是学生主动返回，邀请条为静态单条、无自动跳转、无重复催促，且此学生此前刚主动做过题，暂缓已被合法清除。剩余问题是表达时机：学生刚表明「只想聊聊」，邀请立即出现，与「先倾听、再邀请行动」的节奏略有出入。
- **对应需求：**阶段2「选择休息或拒绝探索后，是否停止催促和自动跳转」（休息期间行为通过；本项仅涉返回时机）；原始提示词「先倾听、再邀请行动」。
- **复现：**拒绝看题 → 「我想开始看题」完成一题 → 聊天「今天先休息」→ 「我想继续聊聊」→ 观察邀请条。脚本见 [verify-rest.mjs](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/verify-rest.mjs)。
- **证据：**[20](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/20-rest-chat-reinvites.png)（前段）、[37 拒绝后暂缓正常](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/37-zcode-declined.png)、[38 休息主页](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/38-zcode-rest.png)、[39 返回聊天邀请出现](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/39-zcode-rest-resume-chat.png)（后段完整链路复验）。
- **位置：**[App.tsx:918](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/App.tsx:918) 邀请条仅由 `!rest && !questionInvitePaused` 控制；[App.tsx:762-767](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/App.tsx:762) 「我想继续聊聊」仅置 `rest:false`；[domain.ts:151](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/domain.ts:151) 进入任务时清除暂缓。
- **最小修复方向（非阻塞建议）：**从「我想继续聊聊」入口返回聊天时，暂缓邀请至学生完成一轮倾诉；或邀请条延迟到对话首个回合后再出现。不改变拒绝/恢复的既有语义。

## 4. 验收矩阵

| 阶段2要求 | 验证方式 | 结果 | 证据 |
| --- | --- | --- | --- |
| 拒绝可选项目后仍可用基本功能 | 实际操作：关闭长期记忆与研究用途进入 | 通过 | [03](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/03-optional-off.png)、[04](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/04-home.png) |
| 休息后停止催促和自动跳转 | 实际操作：休息后查主页/今日页 | 通过 | [18](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/18-rest-restored.png)、[19](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/19-rest-today.png)、[38](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/38-zcode-rest.png) |
| 拒绝看题后不重复邀请（S1-02 修复回归） | 实际操作：拒绝→刷新→继续聊天 | 通过 | [07](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/07-declined-restored.png)、[37](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/37-zcode-declined.png) |
| 拒绝探索后停止催促 | 单元规则测试（文字拒绝规则） | 通过（仅单元级；浏览器链路未走） | [unit-current.log](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/unit-current.log) 20/20 |
| 示例数学题、答案、提示和反馈正确 | 确定性探针 + 实际作答 | **失败（S2-01）** | math-probe.log、31 复跑、15/16 |
| 初次/提示后/修改分别记录 | 实际作答后查作答记录 | 通过 | [09-13](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/13-report-evidence.png)（首次 x−5 待观察·未用提示；提示后完成如实标注） |
| 不同回答产生相应反馈，报告依赖作答 | 不同作答路径对比报告 | 通过 | [13](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/13-report-evidence.png) 提示下完成 → [24](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/24-independent-report.png) 本次独立完成（注：S2-01 场景下结论被误导，已在问题中记录） |
| 提示后完成不标为独立掌握 | 提示后答对查报告 | 通过 | [12](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/12-correct-hinted.png)、[13](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/13-report-evidence.png) |
| 无证据/未完成不解释为能力弱 | 查未作答维度报告 | 通过 | [24](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/24-independent-report.png)（尚未观察 + 「未开始或暂停，都不代表能力弱」） |
| 暂停、刷新、恢复接续正确 | 暂停→刷新→恢复；离线提交→恢复重试 | 通过 | [10-11](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/11-resume.png)、[21-22](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/22-retry-once-restored.png)、[29](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/29-chat-paused-restored.png) |
| 浏览器返回接续正确 | 原题→新题→返回 | **失败（S2-02）** | 25-27、33-34 |
| 重复提交/失败重试不重复记录 | 断网提交失败→重试一次成功 | 通过 | [21](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/21-offline-no-attempt.png) 0次尝试、[22](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/22-retry-once-restored.png) 1次尝试且计题 3/10 未变、[chat-retry-count.json](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/chat-retry-count.json) |
| 模拟回复、等待、失败状态清楚 | 聊天全状态操作 | 通过 | [05](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/05-chat-wait.png)、[06](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/06-chat-reply.png)、[28](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/28-chat-failure.png)、[30](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/30-chat-retry-success.png)（AI 标注、输入保留、重试） |
| 手机键盘不遮挡题目、输入或按钮 | 桌面引擎手机视口 | 未验证（需真机软键盘） | — |

辅助检查：TypeScript 与生产构建通过、单元测试 20/20（前段采集，非本轮重跑）。

## 5. 最小修复任务

**M1（对应 S2-01，P1）**
- 修改范围：仅 [data.ts](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/data.ts) `correct()` 的最终步判定——字符串不匹配时回退到 `linear()` 等价判断；选择类题目不变。
- 验收方法：math-probe 9 个用例全部 PASS（含 `4a-2`、`x-5` 等负例仍判错）；新增单元回归；实际浏览器走一遍 `4*a+2` 首答→报告记「本次独立完成」。
- 不应影响：计题上限逻辑、提示记录、attempt 结构、`=` 连接的多步等式核对、上传题固定示例。

**M2（对应 S2-02，P2）**
- 修改范围：[App.tsx](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/App.tsx) `openTask`/`popstate` 的 history state 携带并恢复 `taskId`。
- 验收方法：原题→新题→浏览器返回恢复上一题；任务页→返回进入前页面；刷新恢复不受影响；20/20 单元与既有浏览器用例不回归。
- 不应影响：暂停/恢复、计题、计划与报告。

**M3（对应 S2-03，P3，可选）**
- 修改范围：`rest` 恢复入口与聊天邀请展示时机（App.tsx 相应条件）。
- 验收方法：休息→「我想继续聊聊」后邀请暂缓至首轮倾诉完成；正常聊天邀请、拒绝语义、刷新持久化不变。
- 不应影响：S1-02 已修复的拒绝/重启语义。

本轮按审查要求停在报告，不实施修改。

## 6. 证据与后续

- 证据目录：[evidence/](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/evidence/)。01–30 及日志为前段（Codex）采集；31–39 与两个可重跑脚本（verify-issues.mjs、verify-rest.mjs）为后段（ZCode）复验；35、36 编号因前段脚本中断空缺。
- 需求快照与运行副本：[sources/](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/sources/)、[runtime/](/Users/ami/Documents/个人/ACC黑客松/audit-stage2-20261020/runtime/)（与产品源码逐字一致，见第2节）。
- 模拟能力边界不变：聊天为本地预设、OCR 为固定示例、监护核验/通知/权利申请均为演示，本轮未见虚假能力承诺（05/06/28/30 均如实标注 AI 与演示状态）。
- 仍需人工或真机验证：软键盘遮挡与缩放行为、真实 iOS/Android 浏览器、系统字号与读屏、真实学生试用；「拒绝探索」的完整浏览器链路可在阶段3一并覆盖。
- 后续顺序建议：实施 M1 → 针对性复验 S2-01（探针 + 浏览器报告链路）→ 阶段2可改判；M2、M3 可随阶段3修复批次处理。
