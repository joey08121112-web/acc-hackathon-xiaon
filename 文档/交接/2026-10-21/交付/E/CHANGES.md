# E1 变更、协议与迁移说明

起点：main @ `41dca8121ba820da3c44dabc88d7a10a81a2095c`，只有原工作区。没有 commit、push、merge 或部署。各文件改前和改后的 SHA256 见 `source-hashes.json`，完整 diff 见 `source.diff`（只含已跟踪文件；新增文件见第 3 节）。

## 1. 共享协议：1.0.0 / D1 → 1.0.0 / E1（只做增量）

- `RolePolicy.role` 增加 `generator`。这是一个不调用工具的结构化输出角色，`ROLE_POLICIES.generator.allowedTools=[]`，最多 2 轮。`AgentRun.role` 随之可取 `generator`。
- 新增实体 `GenerationRecord`（严格 schema，拒绝额外字段），在 `EntityMap` 中对应 `generations`。
- **没有改动** `TaskDefinition`、`TaskPublicView`、`ToolArguments` 或 `ToolResult`：生成信息不塞进题目对象，也没有新增模型工具。
- `schemaVersion` 仍是 `1.0.0`。JSON Schema 已用 `npm run schema:agent` 重新生成，A 阶段的契约一致性测试通过。
- 兼容性：旧客户端能继续解析所有旧实体。旧的冻结 Schema 不认识 `generator` 角色和 `generations` 实体，消费轨迹的地方需要使用新版 Schema。

## 2. 改动的已有文件及原因

| 文件 | 原因 |
|---|---|
| shared/learning-contracts.ts、.schema.json | 上述增量协议 |
| server/storage/repository.ts | 登记 `generations` 集合（建表沿用现有循环）；迁移记录 v2 |
| server/plugins/assessment/catalog.ts | `AssessmentCatalog` 可接收已发布生成题的来源，新增 `all()`；同一 ID+版本时静态题优先 |
| server/plugins/assessment/index.ts | `RubricAssessment` 可传入 `generatedTasks`，评分时用同一份统一目录 |
| server/agents/roles.ts | 增加 Generator prompt 和 `generate()`（无工具，每轮回复都交给程序判定）；运行可以使用更短的超时；可选记忆的变化会取消 Generator |
| server/tools/registry.ts | 补上 `generator` 的策略（空工具列表） |
| server/agents/learning.ts | 组装存储、统一目录和 TaskGenerator；新增学生事件 `generateTask`；学习视图增加 `generations`（含 `exposed`）和 `generationAvailable` |
| server/http/server.ts | 新增 `POST /api/learning/generate-task` 路由 |
| server/index.ts | 读取非密钥的出题限额 |
| src/components/learning/LearningPages.tsx | 在题目页、成长卡片、复习队列挂上出题面板；轨迹显示 Generator |
| scripts/agent/test.mjs、package.json | `all` 包含 E；新增 `test:agent:e`、`test:agent:e:browser`、`test:agent:e:real` |
| outputs/xiaon/README.md | 写明支持范围、校验方式、限额与回退 |

没有改：首页 Hero 和交互、探索地图、语音或 TTS、B/C 的评分和排程规则、模型和基址、部署文件。

## 3. 新增文件

- `server/plugins/generation/`：`expression.ts`（独立的受限解析、渲染和指纹）、`templates.ts`、`validator.ts`、`prompt.ts`、`config.ts`、`store.ts`、`index.ts`（TaskGenerator）。
- `src/learning/generation/`：`index.ts`（浏览器端可用的标签）、`GenerationPanel.tsx`。
- `tests-agent/e/`：`provider.ts`（合成模型）、`templates.test.ts`、`flow.test.ts`、`http.test.ts`、`browser.spec.ts`。
- `scripts/agent/e-browser-server.ts`（只用于测试的服务）、`scripts/agent/e-real-generation.ts`（真实 GLM 验证）。
- `playwright.e.config.ts`（E 浏览器测试，端口 5197/18938）、`playwright.e-regression.config.ts`（用 5198/18939 重跑 D 集成浏览器测试，证据写到 E 目录）。

## 4. 数据迁移与消费者影响

- 已有 SQLite 文件在启动时自动建好空的 `generations` 表（`CREATE TABLE IF NOT EXISTS`），旧数据不改动，也不需要手动迁移。迁移表会写入版本 2。
- 生成题使用 version 2 和 `gen-` 前缀的 ID，不会与静态题、v1 旧题冲突。历史作答、评分和报告照常可读。
- 消费统一目录的地方会自动看到已发布的生成题：B 的评分和状态、C 的复习选题和计划候选、`select_task` 工具、Tutor 的“未作答题答案拦截”、学习视图的题目列表、探索地图的计数。
- 重置会清空 `generations` 和 `tasks`。旧版本的离线前端不受影响，生成题也不会进入前端包（已扫描构建产物）。
