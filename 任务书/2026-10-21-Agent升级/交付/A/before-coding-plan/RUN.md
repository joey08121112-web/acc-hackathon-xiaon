# A 本地运行说明

只完成工具基础。Node 最低 22.13.0（内置 `node:sqlite` 与 env-file-if-exists），实测 Node 26.8.2 / SQLite 3.53.4。新增运行依赖只有 Zod 4.3.6，lockfile 已锁定。最低版本本身未另装复测。

在 `/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon`：

```sh
npm ci
npm run server
```

另一终端运行前端（用户 5173 已在运行时，不重启/关闭它；用独立端口）：

```sh
npm run dev -- --host 127.0.0.1 --port 5191
```

API 默认 `127.0.0.1:18920`，Vite 同源 `/api` 代理到此端口。改变 API 端口时同步设置启动 Vite 的 `XIAON_API_TARGET=http://127.0.0.1:新端口`。修改 Vite 配置后，既有 Vite 实例是否自动重载需自行确认，本批只在独立实例验证。不要为了验证关闭用户进程。

`GET /api/health` 返回 mode、providerKind、schemaVersion 和模型数据用途说明；未配置模型时明确 `mode=local_rules`。前端 ai.ts 启动时探测 health，保留 App 原有同步 aiConfigured 调用和理解休息/暂停状态的本地规则回退。服务恢复或配置变更后刷新页面重新探测。模型失败时不会把未执行工具说成成功；现有 App 对网络失败沿用本地规则回退，完整模式标识和状态 UI 由 D 接线。

配置真实智谱时只在本机 `.env.server` 填写 `.env.example` 的服务端字段；不要使用 `VITE_LLM_*`，不要在聊天或日志粘贴密钥。官方适配器默认使用国内标准 HTTPS 端点，基址由服务端配置；不保证任意“OpenAI 兼容”供应商或流式工具。首版默认模型 `glm-5.3-flash`，标准基址 `https://open.bigmodel.cn/api/paas/v4`。可在服务端设置 XIAON_GLM_BASE_URL、XIAON_GLM_TIMEOUT_MS、XIAON_GLM_MAX_TOKENS；默认120000毫秒/8192 tokens，只是待真实调用校准的首版预算。保留 XIAON_GLM_API_KEY / XIAON_GLM_MODEL，不新增 LLM_*。基址由服务端追加 /chat/completions；不自动使用Coding套餐或第三方地址。浏览器不再用固定22秒计时截断服务端预算。真实模型验收命令：

```sh
npm run test:agent:real
```

该命令只用独立临时 SQLite 和合成作答，必须实际发生 query_learning_evidence 并成功完成才判 VERIFIED。无 Key 时退出 2（模型名缺省采用 glm-5.3-flash），输出 NOT_RUN。本批真实 API 未运行。

默认数据库 `.local/learning.sqlite`，WAL，目录 0700 / 主文件 0600，已忽略。SQLite 是新接口持久化来源；现有完整页面的任务、报告、计划、记忆仍沿用浏览器 localStorage，D 才接线/迁移，不应把 A 说成整套产品已切换 SQLite。数据库无应用层加密，只使用合成材料。

学生接口使用本地会话：先同源 POST `/api/local-session`（body `{}`），浏览器收 HttpOnly/SameSite=Strict cookie；后续写请求带返回的 `X-Xiaon-CSRF`。写请求还要求准确 Origin、允许的 Host、JSON、大小限制。重启后本地认证会话重建，业务场次/作答/幂等收据仍在 SQLite。这个防护适用于本机单用户工具，不是公网部署方案。

## 稳定检查命令

```sh
npm test
npm run typecheck:agent
npm run test:agent:a
npm run test:agent:b
npm run test:agent:c
npm run test:agent:d
npm run test:agent
npm run test:all
npm run build
npm run test:agent:browser
node scripts/agent/bundle-sentinel.mjs
node scripts/agent/service-smoke.mjs
npx tsx scripts/agent/trace.ts
```

B/C/D 放 `tests-agent/b|c|d/**/*.test.ts`（可 `.test.tsx`），不需改 package。专属目录无测试时退出 2；总测试仍运行已有测试，但任何批次未覆盖均明确 NOT_COVERED 并退出 2。当前只有 A 已覆盖，不能把总测试称为全部通过。B/C 单测使用临时 SQLite，不需端口。

端口：A HTTP 测试 18921（XIAON_A_TEST_PORT）；A 进程重启 18922（XIAON_A_SMOKE_PORT）；A 浏览器 API 18923（XIAON_A_BROWSER_API_PORT）、UI 5191（XIAON_A_BROWSER_PORT）；运行 API 默认18920（XIAON_API_PORT）；预留 D API18931/UI5194，由 D 自己服务与配置。所有 A 测试清理自己创建的进程、上下文和临时数据库，不触碰5173/8787或用户浏览器。

现有 `npm run test:browser` 没有重跑，因为它绑定用户5173并会覆盖既有截图；A 使用 `playwright.agent.config.ts` 独立两项定向验证，日志/截图只写 A/evidence。没有运行 build:offline，不替换既有 HTML/ZIP 分享材料。

## API（都相对于同源 /api）

- GET health；POST local-session。
- POST sessions / sessions/state；POST attempts；POST exposures。
- GET context；GET tasks/:taskId/:taskVersion（无答案和完整rubric）。
- POST consent；POST memories；POST memories/state（stop/delete）。
- POST import/preview（source 字符串）→ 预览 hash/范围；POST import（operationId/source/previewHash/scope=attempts_only）→ 事务导入。用户自行导出预览并确认范围，服务不自动读浏览器、不清空原数据。
- POST chat（operationId/history）→ AgentReply；客户端 `chat(input, signal)` 可取消，HTTP 断开会取消运行，使用服务端可配置超时（默认120秒）、4轮、6工具。
- POST planning/due：未集成时明确 not_implemented；B/C 实现通过端口注册，不能用空成功冒充。

没有任意工具执行 HTTP 路由，没有自报 role/learnerId 升权入口。学生可以提交答案 value，但不能传可信参考答案 answer、rubric、时间或分数。请求结构不接受未知字段。

可选长期偏好只有学生明确保存、授权开启、active、未过期/未到复核时间且 purpose=tutoring 时才进辅导上下文。关闭不读其条目；停止/删除使后续上下文移除；运行中授权或有效偏好变化会取消本次循环，防止旧供应商私有思考字段再被回传；旧回复重放在权限变化后报 conflict，需新 operationId。已经发送给外部模型的请求无法追溯撤回。删除偏好不是清空原作答，也不是承诺对 SQLite/WAL/已有历史回复做取证级抹除。计划和任务必要信息独立保存。

外部模型信息类别：最近20条聊天、当前必要场次/作答/评分依据、获准的有效辅导偏好；用途是回复和受控学习工具。普通上下文不发送可信题库答案和完整rubric，A legacy程序判题不需要外发评分密钥。原有受保护 data.ts 仍包含前端题库答案，A没有改造全套页面，不宣称当前静态页面具备答案保密能力。
