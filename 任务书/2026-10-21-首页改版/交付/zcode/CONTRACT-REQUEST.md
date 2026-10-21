# zCode 路契约变更申请（第一期交付时提出）

编制日期：2026-10-21。三项，按影响从小到大排列；第 1 项不改 schema，只需要 Claude 更新自己的测试。

## 1. tests-agent/g 里钉死 zCode 桩的 4 条断言需要更新（集成时）

`npm run test:agent` 全批次现在只剩 4 条失败，全部在 Claude 拥有的 `tests-agent/g`：

| 文件:行为 | 阶段 0 断言 | 第一期实现后的实际行为 |
| --- | --- | --- |
| `g/home-chat.test.ts:43` | probe 轮 `problemDraft:not_implemented` | `problemDraft:invalid`（Greedy 模型编的卡点原话在学生话里找不到出处，被 `validateProblemDraft` 丢弃） |
| `g/home-chat.test.ts:65-66` | 记忆开启时 memoryDraft 仍为 null、`not_implemented` | `validateMemoryDraft` 接受了「喜欢打篮球/interest」，`shouldOfferMemory` 首轮放行 → 草稿下发确认卡 |
| `g/alignment.test.ts:49` | `confirmProblem` 抛 `not_implemented` | 学生确认后正常写入 `problems`（题面/卡点合法） |
| `g/alignment.test.ts:66` | 桩阶段 Tutor 收到全部 7 条有效记忆 | `selectMemoriesForContext` 只挑与当前话题相关的（该用例学生只说「你好」，相关为 0 条） |

这些测试名都写着「while … is a stub」，本就是阶段 0 快照。zCode 不能改 g 目录，请在第一期集成时由 Claude 更新期望值。证据：`交付/zcode/evidence/test-agent-all-known-g-conflicts.txt`（158 通过、仅这 4 条失败）。

## 2. `ConfirmMemoryDraft` 建议加 `retention` 字段（影响：Claude 改一处 schema，ChatGPT/zCode 无感）

任务书要求确认记忆时可选「一直记得 / 记 7 天 / 记 30 天」，但冻结的 `ConfirmMemoryDraft` 只有 `{operationId, sessionId, draft, text}`，选择传不进服务端。当前 zCode 实现的服务端默认：一律「一直记得」+ `reviewAt = 确认时间 + 30 天`（到期自动退出上下文，等学生复核）。

申请：`ConfirmMemoryDraft` 增加可选 `retention: z.enum(['forever','7d','30d']).optional()`；`forever → expiresAt:null, reviewAt:+30d`、`7d → expiresAt:+7d, reviewAt:null`、`30d → expiresAt:+30d, reviewAt:null`。zCode 侧 MemoryPrompt 的选择器已留好位置，schema 放开后即可接上。另外「满 30 天在记忆页提示这条还适用吗」的 UI 在 `LearningPages.tsx`（Claude 拥有），建议一并考虑。

## 3. `ProblemCaptureProps` 建议补 `navigate`（影响：ChatPanel 一处挂载参数）

冻结的 `ProblemCaptureProps` 没有 `navigate`，但「拍一张」要进上传页、「从题库挑」要进探索页。zCode 目前的做法是在组件内 `history.pushState + dispatchEvent(PopStateEvent)` 复用 App 的 popstate 契约，能用、不改别人的文件，但属于绕路。集成时建议直接在挂载位传 `navigate`，zCode 随即切换。
