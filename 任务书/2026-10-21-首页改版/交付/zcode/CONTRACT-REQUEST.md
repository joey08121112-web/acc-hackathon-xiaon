# zCode 路契约变更申请

第一期（2026-10-21 交付时提出）：三项，按影响从小到大排列；第 1 项不改 schema，只需要 Claude 更新自己的测试。第 2、3 项已在第一期集成时由 Claude 落地（`交付/claude/CONTRACT-CHANGE.md`）。

## 第二期新增申请：4. revisionProblems 的拒绝复测分支按键序比较，stage/retest-decline 路由无法成功

申请日期：2026-10-21（第二期：周 / 月学习规划与长期跟踪）。

### 要改什么

`outputs/xiaon/server/agents/professional.ts`（所有者 Claude）`revisionProblems` 中这一行：

```ts
}else if(JSON.stringify(next.confirmation)!==JSON.stringify(prev.confirmation)||next.status!==prev.status||next.goal!==prev.goal)problems.push('没有学生确认时不能改确认、状态或目标');
```

把 `JSON.stringify(next.confirmation)!==JSON.stringify(prev.confirmation)` 改成与键序无关的比较，例如复用 `storage/repository.ts` 已导出的 `hash`：

```ts
}else if(hash(next.confirmation)!==hash(prev.confirmation)||next.status!==prev.status||next.goal!==prev.goal)problems.push(...);
```

（`hash` 内部先做 canonical 键排序再摘要，两侧都过同一个函数即可。）

### 为什么

`MonthStage` 按修订存库：`repository.append` 存的是 `canonical()`（按对象键名排序）文本，`repository.get` 取出后 `confirmation` 的键序是 `action, actor, confirmedAt`；而协调器写库前会对插件结果再做一次 `schemas.MonthStage.parse`，zod 按 shape 声明序重建对象，输出键序是 `action, confirmedAt, actor`。两序不同，`JSON.stringify` 永不相等，于是「学生拒绝复测」写入前的必经分支恒命中「没有学生确认时不能改确认、状态或目标」，`POST /api/learning/stage/retest-decline` 恒 500。

复现（`revamp/i2-plan-tracking` 分支，`tests-agent/i/plan-tracking.test.ts` 的 HTTP 端到端用例里已留断言）：

1. `stage/draft` → `stage/confirm`（accept）→ 仓库里月阶段 r2 已确认；
2. `POST stage/retest-decline` → 500 `internal_error`，错误信息即上句。

实测确认：`schemas.MonthStage.parse({confirmation:{actor:'student',confirmedAt:'…',action:'accept'}})` 输出键序为 `action,confirmedAt,actor`（zod 不保留输入键序）。

为什么本路不能自己绕过：该函数与协调器都在 Claude 的文件里；stages 插件按契约「只返回、不写库」，插件返回什么键序都会被协调器的 zod 解析变回 schema 序，不存在本路内的合法绕法（让插件直接写库违反「都只返回，由协调器过门控后写」的约定）。

### 对另外两路的影响

无行为影响。`revisionProblems` 只被 `stage/confirm`、`stage/retest-decline` 两条路由使用（月阶段，zCode 路）。确认分支（`expect.confirm`）比较的是标量字段，不走这行；Claude 的 `tests-agent/g/phase2-contract-smoke.test.ts` 对 `revisionProblems` 的单测用的都是内存构造对象（两侧键序天然一致），改成键序无关比较后这些断言依旧成立。面试引擎不用这个函数，ChatGPT 路不接触服务端。

### 修复后的验收

- `POST stage/retest-decline` 对已确认、未拒绝的月阶段返回 200，新修订 `retestDeclinedAt` 为程序时钟当前时间；重复调用原样返回、不叠加修订。
- `view().retestReminder` 在拒绝后为 `null`（本月不再提）。
- zCode 路 `tests-agent/i/plan-tracking.test.ts` HTTP 用例中标注「契约修复后应翻转」的两条断言翻转为 200 / `null`。



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
