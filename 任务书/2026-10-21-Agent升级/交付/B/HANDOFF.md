# B 五维题库、判题与证据交付

**READY_FOR_D_ASSESSMENT** · schemaVersion **1.0.0** · 2026-10-21。

**模块自验通过，尚未接产品页面 / 独立验收。** 没有验证真实模型、真实设备或长期教学效果。

## 范围与前置核验

已完整阅读总控、B任务、仓库/应用README、阶段3审查、阶段2修复报告；补读A任务、A HANDOFF、INTERFACES、RUN、冻结类型/Schema与关键实现和测试证据。未发现适用AGENTS；实施使用karpathy-guidelines。没有委派其他窗口或子代理。

开始时A目录及协议不存在，因此只读并保存 `evidence/baseline.json` 和 `prerequisite-first-check.log`（前置检查退出1，不是B单测失败）。随后复核发现A已交付，才开始产品实现。A READY_FOR_BC、版本、冻结哈希核验见 `evidence/a-ready-verification.json`；A `final-files.json` 的 **41/41** 项当前SHA匹配，见 `evidence/a-manifest-recheck.json`。A原始证据中的23项基础测试通过与类型检查退出0已读取；本轮另外实际重跑A的3项契约测试通过，未将阅读历史日志称为全套A独立复验。

冻结文件未改：

| 文件 | SHA256 |
| --- | --- |
| `outputs/xiaon/shared/learning-contracts.ts` | `8d9f73257ab36ca78a8965c0ffcd879f46b301b5638ee5300092b5b1574509b8` |
| `outputs/xiaon/shared/learning-contracts.schema.json` | `3c3f1949420c6a0b8768ebf7de56935d5838fb89ef795deb1a80cd0ef1157d01` |

基线main / HEAD `773e95ecc3063648a4ece1e67484c48f763ccaff`，原dirty/untracked保留。实现前再次记录 `implementation-baseline-status.log` 和 `implementation-protected-hashes.json`；保护文件前后核对见 `protected-files-check.json`。最初只读基线与A后来交付属于两个时点，不能把两者差异计为B修改。

## 实现结果

- 6个明确子技能，18道核心题（每子技能观察/新题/延迟题各1），另保留10道旧计算补充题的v2定义，共28道v2题。16道v1历史定义仍可读取和复核，不覆盖A冻结的旧版本。覆盖与数学推导见 [COVERAGE.md](COVERAGE.md)。
- `RubricAssessment implements AssessmentEnginePort`：可信catalog、按已保存attemptId评分、逐点评分证据、append-only评分修订、可重算状态和不可变快照。没有另建HTTP服务、模型provider或注册运行时。
- 复用现有 `data.ts/correct()` 的受限解析能力：一次式与等号链确定性比较；未知语法进入needs_review。选择正确不替代理由证据。
- 注入A ModelProvider的独立分析器、提示词和严格结构/引用校验；按可信rubric区分supported/unsupported/uncertain，输出来源区分program/model。无可定位引用、引用不属本次作答、畸形响应、模型/程序冲突、超时或失败均待核查。
- 保存首次错误、帮助、修改、原题重做和未见题独立完成的区别。默认跨次规则为2道未见题、2个可信上海日期、2个场次；可配置提高阈值，不称标准化测评。后续困难单独标记，既有成功与历史快照保留。
- 浏览器目录只含状态/证据标签与边界说明，不包含新版可信答案库。D仍需完成页面接线，原有静态 `src/data.ts` 中的答案保密问题没有被本批改造。

## 真实改动文件与入口

**全部产品改动为B所属目录中的新增文件**，完整路径、SHA256与字节数见 [final-files.json](final-files.json)，校验格式见 [final-source.sha256](final-source.sha256)。交付文档/日志另见 `delivery-files.sha256`，该文件不自校验。

| 入口 | 用途 |
| --- | --- |
| `outputs/xiaon/server/plugins/assessment/index.ts` | `RubricAssessment`、`AssessmentOptions`及对外导出 |
| `server/plugins/assessment/catalog.ts` | `AssessmentCatalog`、`assessmentTasks`、`skillDefinitions`、`legacyIdMapping` |
| `server/plugins/assessment/grading.ts` | `checkObjective`、分层评分组合 |
| `server/plugins/assessment/model-analysis.ts` | `createModelAnalyzer`、`ASSESSOR_PROMPT`、分析点校验 |
| `server/plugins/assessment/state.ts` | `classifyAttempt`、跨次规则和快照重算 |
| `src/learning/assessment/index.ts` | 仅浏览器展示标签，无可信答案 |
| `tests-agent/b/consumer.ts` | D可直接使用的冻结接口注册编译样例 |
| `tests-agent/b/fixtures.ts` | 明确标为合成的真实临时SQLite夹具 |

表内首行以后的路径均相对应用 `outputs/xiaon/`。没有改shared、App、domain、data、ai、A启动/路由/工具注册、package/lock/config、C目录、既有测试或任务书正文。没有操作用户5173 localStorage、端口或其他进程。

## 命令、退出码与测试证据

工作目录 `outputs/xiaon/`，实际Node 26.8.2。下列原始日志均在 `evidence/`，包含完整命令和退出码；测试仅使用合成材料和独立临时磁盘SQLite，无共享端口。

| 证据级别 / 实测命令 | 结果 | 日志 |
| --- | --- | --- |
| B规则 / 合成模型 / SQLite / 注册集成 `npm run test:agent:b` | **25/25，退出0** | `unit-final.log` |
| 全部agent消费者 `npm run typecheck:agent` | 退出0 | `typecheck-delivery.log` |
| 前端静态检查 `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false` | 退出0 | `frontend-typecheck.log` |
| A冻结协议 `node --import tsx --test tests-agent/a/contracts.test.ts` | **3/3，退出0** | `a-contract-recheck.log` |
| 当前既有规则 `npm test` | **25/25，退出0** | `existing-unit.log` |
| 合成场景导出 `node --import tsx tests-agent/b/export-evidence.ts <B交付目录>/evidence/synthetic-scenario.json` | 退出0，6次原始尝试 | `synthetic-scenario.log` / `.json` |

上述B的25项测试已包含SQLite关闭后重开、幂等收据和快照恢复，以及通过A真实工具注册器消费B端口的检查。这是模块自验，不是另一窗口的独立验收。A原有25项规则仅为当前共享工作区回归检查，不归为B新增功能。

没有重跑生产打包、既有浏览器套件、真实模型API、真机或长期效果。没有修改dist或分享ZIP。无真实模型Key也不阻断这些离线测试；没有读取/打印用户凭据，没有索要密钥。

## 首次失败、修复及同命令重跑

所有B单测调用使用同一命令 `npm run test:agent:b`，原日志未覆盖：

1. `unit-first-red.log`：实现前模块不存在，退出1。
2. `unit-first-implementation.log`：17通过/1失败，退出1。失败是将SQLite规范化字段顺序后的JSON字符串与原对象字符串比较，字段值实际一致；改为逐字段深比较，未放松原始尝试不可变断言。`unit-rerun-1.log`：18/18，退出0。
3. `boundary-first-red.log`：新加的跨版本原题已见、同场次跨午夜两项真实规则失败，22通过/2失败，退出1。补入旧版本原题的严格较早暴露检查、按上海日期核验题面提前暴露。`boundary-rerun-1.log`：24/24，退出0。
4. `timestamp-first-red.log`：跨版本事件同一时间戳被误认未见，24通过/1失败，退出1。无法从冻结协议证明先后时保守为unknown，不编造顺序。`unit-final.log`：25/25，退出0。

## D接手方法与停止线

准确注册/调用见 [INTEGRATION.md](INTEGRATION.md)，规则与评分边界见 [RULES.md](RULES.md)。D先核验本清单和冻结哈希，再从 `RubricAssessment`、`consumer.ts`、合成场景接手。B不替D做运行时注册或页面修改，不实现C计划/复习时间。

**没有阻断当前模块使用的协议缺口**。冻结协议的跨版本同毫秒事件没有全局顺序，B保守处理为未知；D若要消除这类不确定性，可统一扩展可信序号或题目别名暴露快照，须按总控保留兼容说明。详见RULES，不能凭时间相同猜顺序。当前快照仍受冻结Schema各ID数组最多500项限制，大规模长期记录的分页/摘要不是本批已验证范围。

已完成本批测试、文档和交付后停止。未commit、push、merge、发布、部署或打包，不自动进入C/D。
