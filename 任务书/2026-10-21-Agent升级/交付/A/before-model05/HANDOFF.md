# A 工具基础与接口冻结交付

**READY_FOR_BC** · schemaVersion **1.0.0** · 2026-10-21 · 实施者自验，非独立验收。

本批完成本地 Node/TypeScript API、真实 SQLite 持久化与学生事件入口、5 个受控工具、原生工具循环、智谱官方 HTTP 适配器、合成适配器、同源前端客户端、可选偏好权限与导入基础。B/C可分别按冻结端口开发。没有实现完整五维判断、复习算法、多角色产品流程或全页面接线。

## 基线与保护边界

开始核对：main，HEAD `773e95ecc3063648a4ece1e67484c48f763ccaff`，单一 worktree；结束 HEAD 未变。已完整读取总控/A任务、仓库/应用README、阶段3报告和阶段2修复报告，并读取B/C任务语义用于预留端口。未发现适用 AGENTS.md；使用 karpathy-guidelines 约束改动范围。

基线 `baseline-files.json`、`baseline-source/`（排除真实.env、密钥、node_modules、dist）；dirty/untracked、分支、HEAD和端口见 `evidence/baseline-*.log`。原5173（PID3840）、8787（PID885）未关闭，未访问用户浏览器进度。

**并发变化单独记录**：A执行期间其他操作修改 `src/App.tsx`、`src/domain.ts`、`src/domain.test.ts`；A没有写这些文件。中途构建出现 withTrail / planDraft / taskStatus 缺失及3项新用例失败；原样日志保留。其他操作补齐后，当前25项规则与构建通过。哈希见 `evidence/protected-changes-during-A.json`。这3个新增测试及页面/历史变动不能归为A交付。结束时5191又有另一Vite进程（PID21062，非A的Playwright进程），保留未处理；再次验证应先检查端口并使用环境覆盖。

A改动39个应用文件，完整清单与SHA256：`final-files.json` / `final-source.sha256`；A相对本轮开始快照的补丁为 `changes-from-baseline.patch`，不混入此前dirty或上述并发修改。没有改任务正文、用户README/分享ZIP/原审计失败资料；只在A交付目录写本批文档和证据。没有commit、push、merge、发布、生成分享ZIP，也没有启动B/C/D或子任务。

## 冻结接口与接手入口

| 文件 | SHA256 |
| --- | --- |
| outputs/xiaon/shared/learning-contracts.ts | 8d9f73257ab36ca78a8965c0ffcd879f46b301b5638ee5300092b5b1574509b8 |
| outputs/xiaon/shared/learning-contracts.schema.json | 3c3f1949420c6a0b8768ebf7de56935d5838fb89ef795deb1a80cd0ef1157d01 |

**[INTERFACES.md](INTERFACES.md)** 包含所有端口的准确签名、字段含义、版本/幂等/时间/暴露语义及注册样例；**[exports.json](exports.json)** 逐项列出导出符号和路径；**[RUN.md](RUN.md)** 是运行、API、数据和验证方法。

共享导出包括 SCHEMA_VERSION、schemas，TaskDefinition、TaskPublicView、LearningSession、SessionEvent、Attempt、ExposureEvent、GradingResult、Evidence、SkillState、AssessmentSnapshot、ReviewPolicy、ReviewItem、ReviewOutcome、ReportSnapshot、PlanProposal、PlanVersion、MemoryItem、ConsentState、ToolCall、ToolResult、AgentRun、RolePolicy、Failure、SourceTime、SubmitAttempt、ChatRequest、Dimension；Clock、EntityMap、LearningRepository、TaskSelection、TaskCatalog、EngineContext、AssessmentEnginePort、PlanningEnginePort、EngineRegistration、NativeToolCall、ModelMessage、ToolDefinition、ModelProvider、AgentReply。新协议对象严格拒绝未知字段；浏览器共享模块没有Node/SQLite依赖。

B：实现 AssessmentEnginePort，提供可信catalog/grade/snapshot；C：实现 PlanningEnginePort，独立消费AssessmentSnapshot和TaskCatalog；D：`createRuntime` + `registerAssessment` / `registerPlanning` 接入统一repository/clock/provider。编译样例 `tests-agent/a/consumers.ts` 同时验证独立实现与统一注册。未注册的完整快照/规划功能明确 not_implemented；默认 legacy 只复用 data.ts/correct() 的有限结果核对。

测试夹具 `server/storage/testing.ts` 的 temporaryRepository(clock?) 是真实临时磁盘SQLite；TestClock支持now/advance/set。不需要B/C修改package、共享协议或服务。B/C测试各自放 tests-agent/b、tests-agent/c，命令已预置。

五个工具：get_learning_context、query_learning_evidence、get_skill_state、select_task、grade_attempt。grade_attempt只接受已保存attemptId；题目版本、答案、评分依据由服务器读取。模型没有学生提交、偏好写入、任意SQL/网络/代码执行工具。request_hint仅声明参数，明确unavailable。角色由程序设置，HTTP不接受自报角色/学习者ID。默认4轮模型响应、6次工具执行，支持取消/超时/错误分类，保存去敏调用轨迹。

## 本轮实测与命令退出码

工作目录 `outputs/xiaon`；每条原始日志包含命令和退出码，见evidence。

| 证据等级 / 检查 | 当前结果 | 日志 |
| --- | --- | --- |
| 基线现有规则 `npm test` | 22/22，退出0 | unit-baseline.log |
| 基线 `npm run build` | 退出0 | build-baseline.log |
| 最终A规则/契约/HTTP/SQLite/合成模型 `npm run test:agent:a` | **18/18，退出0** | freeze-tests.log |
| A及独立B/C消费者 `npm run typecheck:agent` | **退出0** | freeze-typecheck.log |
| 当前共享工作区 `npm test` | **25/25，退出0**（含其他操作新增3项） | shared-current-unit.log |
| 当前生产构建+实际bundle哨兵扫描 `node scripts/agent/bundle-sentinel.mjs` | **退出0，26产物无哨兵值** | shared-current-build.log |
| 实际服务进程关闭/重启 `node scripts/agent/service-smoke.mjs` | **退出0**，SQLite尝试与operationId重试仍为1条，未配置模式local_rules | service-restart.log |
| 定向Playwright独立origin/context `npm run test:agent:browser` | **2/2，退出0**（合成模型+真实handler；规则回退） | browser-first.log / browser-results.json |
| 合成模型原生tool call→真实SQLite handler→tool result→最终回复 | **退出0**，providerKind=synthetic | trace-final.log / synthetic-tool-trace.json |
| 真实模型API `npm run test:agent:real` | **NOT_RUN，退出2**，无服务端GLM Key/模型配置 | real-model-status.log |
| B/C/D专属命令 | **未覆盖，各退出2** | b/c/d-not-covered.log |
| 总命令 `npm run test:agent` | 已有A18项通过，B/C/D NOT_COVERED，**退出2** | total-coverage.log |

静态检查、规则/HTTP测试、合成模型端到端与浏览器自验均已区分。GLM HTTP序列化与401/403/429/错误响应分类是合成fetch测试，不是供应商真实调用。真实设备、长期教学效果、独立复验、完整既有浏览器套件均未运行。既有浏览器脚本绑定用户5173并覆写截图，本批另设定向配置，不冒用其历史18项结论。

## 首次失败与修复链

- `agent-first-red.log`：先写场景用例，运行时尚不存在，模块缺失（退出1）。`http-first-red.log`：HTTP实现前模块缺失（退出1）。
- `agent-first-implementation.log`：legacy知识点ID含中文，不符合冻结ASCII ID校验（退出1）。修复adapter稳定ID映射，保留中文展示维度；`agent-rerun-1.log`变为7通过/1失败。
- 上述剩余失败来自测试复用同callId传不同参数，触发正确的conflict；改为每个独立错误场景不同callId，没有放松幂等限制。
- `agent-rerun-2.log`：8通过/1失败，fetch没有按预期发送伪造Host；改用原生http.request真实发送攻击Host验证403。`agent-rerun-3.log`11/11通过，随后补充权限、预算、协议和不可变存储边界，最终18/18通过。
- `bundle-sentinel.log`、`unit-current-final.log`、`build-current-final.log`保存并发受保护源码中途不完整的失败；A未越界修复。最终 `shared-current-unit.log` / `shared-current-build.log`按同类命令恢复通过。此前成功的 `bundle-sentinel-rerun.log`也保留，不覆盖失败。

## 关键边界与待后续工作

1. A只接模型聊天客户端与新学生API；现有完整页面的作答/提示/报告/计划/记忆仍使用原localStorage。D负责把真实UI事件接入API、迁移确认界面、取消按钮、模式/数据用途展示和B/C路由。A不宣称原页面已全面切SQLite。
2. 五维知识点判断、跨次规则、完整rubric评分、动态报告/复习/计划算法均未实现。legacy get_skill_state保守返回unobserved/已有记录和限制，不输出虚构跨次能力。未注册功能不以mock成功替代。
3. 旧导入仅attempts_only：先返回预览hash/范围，再事务执行；不导入旧correct布尔值、聊天、图片、记忆或旧计划，不自动读取或清空原数据。旧发生时间、场次、题目暴露历史保持未知，不制造跨日证据。
4. 报告/计划/评分证据以不可变对象和supersedes引用保存；修正后的重算、旧确认冲突和历史修订展示由B/C/D实现。复习版本存储可用，排程业务未实现。
5. 可选偏好与必要进度/确认计划分开；关闭不新增/不检索、停止/删除/过期/复核到期不进入后续上下文；权限变化后旧回复缓存不重放。删除偏好不改原作答，不承诺取证级擦除SQLite/WAL或已发送外部模型数据。
6. 默认仅loopback，写请求有本地会话/Origin/Host/CSRF防护；不是可安全公网发布的服务。Node最低版本22.13.0是配置要求，实际运行26.8.2，最低版本未另行安装验证。
7. 实际前端bundle未检出合成哨兵密钥；旧浏览器密钥读取路径已移除。但受保护data.ts原有答案仍在静态页面中，不能把“学生API不泄露答案”扩大成整个旧前端答案保密。
8. 真实模型验收未运行；不要用synthetic trace或HTTP mock把它改写为通过。后续可用已安全配置的`.env.server`运行专门合成材料验收命令，不在聊天索要密钥。

A共享协议现已冻结。后续缺口由D按总控写兼容修订，或用户明确回派A；本窗口完成后停止。
