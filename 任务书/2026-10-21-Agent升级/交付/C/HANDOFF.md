# C 复习、动态计划和历史交付

**READY_FOR_D_PLANNING** · 冻结协议 **1.0.0** · 2026-10-21 · C 实施者规则与端口自验，非独立验收。

已实现 PlanningEnginePort 五方法、可信复习结果核验、到期队列、困难选题、跨次结果、差异化草案与学生确认历史、报告事实与修订投影。使用合成 AssessmentSnapshot/TaskCatalog，不依赖 B 实现。没有接现有页面、修改共享文件、自动注册或启动服务。

## A 前置与工作区

已完整读取总控、C任务书、仓库/应用README、阶段3审查和阶段2修复报告；检查适用父目录与仓库内AGENTS.md（未发现），使用karpathy-guidelines限定改动。

最初A未就绪，仅整理准备材料，历史记录保留在 evidence/preflight.json、preflight-HANDOFF.md、final-preflight.json。随后完整读取已就绪的A/HANDOFF.md、INTERFACES.md、RUN.md、冻结类型和消费者样例，核验 READY_FOR_BC、1.0.0，A全部41项交付哈希相符；读取最新 coding-plan-tests.log（23/23、退出0）与 coding-plan-typecheck.log（退出0）。未使用早期前端基线替代A完成证据。

共享协议哈希保持：

- shared/learning-contracts.ts：`8d9f73257ab36ca78a8965c0ffcd879f46b301b5638ee5300092b5b1574509b8`
- shared/learning-contracts.schema.json：`3c3f1949420c6a0b8768ebf7de56935d5838fb89ef795deb1a80cd0ef1157d01`

开始/结束均为main、HEAD `773e95ecc3063648a4ece1e67484c48f763ccaff`，开始单一worktree。A就绪后的保护文件基线见 evidence/implementation-baseline.json；结束 boundary-audit.json 显示受保护文件零变化。既有dirty/untracked和用户材料保留。

最终清单阶段观察到B所属目录新增11个文件，按并行分工单列排除，未读取其内容、未归入C交付。清单校验首次因“所有新文件都必须属于C”的过宽断言失败，记录在evidence/delivery-boundary-first-error.log；调整为区分B并行路径后复核，不改产品测试或B文件。

## 真实改动及哈希

仅新增以下8个应用内文件，SHA256/字节数见 **final-files.json** 与 evidence/boundary-audit.json；整个C交付文档/日志哈希见 evidence/delivery-hashes.json（不自哈希）。

| 路径（相对outputs/xiaon） | 内容 |
| --- | --- |
| src/learning/review/index.ts | 上海日历、选题、当前复习版本、报告/计划修订投影；无Node导入 |
| server/plugins/planning/index.ts | PlanningEngine：A五方法和更正reconcile |
| server/plugins/planning/evidence.ts | 核验已保存尝试、暴露、最新评分和当前快照，不做B判题 |
| server/plugins/planning/register-example.ts | D显式注册函数，导入不自动执行 |
| tests-agent/c/fixtures.ts | 明确标注合成的题库、尝试、预设评分和快照 |
| tests-agent/c/planning.test.ts | 11组主规则、SQLite重开恢复 |
| tests-agent/c/edges.test.ts | 14组边界、休息、更正 |
| tests-agent/c/examples.ts | 四画像与虚拟25天流程输出 |

交付只写C目录。未修改A/B/D、App.tsx/domain.ts/data.ts/ai.ts、配置、package/lockfile、既有测试或用户文档；未commit/push/发布、改电脑时钟或操作用户5173数据。

## 实测命令与退出码

工作目录 `/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon`。原始日志均保留命令与退出码。

| 检查 | 结果 | evidence/日志 |
| --- | --- | --- |
| `npm run test:agent:c` | **25/25，退出0** | c-final-tests-2.log |
| `npm run typecheck:agent` | **退出0** | c-final-typecheck-2.log |
| `node --import tsx --test tests-agent/a/contracts.test.ts` | **3/3，退出0**；Schema一致及不可变存储 | c-contract-check.log |
| `env TZ=America/Los_Angeles node --import tsx --test '--test-name-pattern=Shanghai\|absence' tests-agent/c/edges.test.ts tests-agent/c/planning.test.ts` | **5/5，退出0**；只改变测试进程TZ | c-timezone-check.log |
| `node --import tsx tests-agent/c/examples.ts` | **退出0** | c-delivery-examples.log、four-profiles.json、virtual-timeline.json |

覆盖完整1/3/7/14天、到期边界、当天重复、跨午夜、帮助/错误/待核查/缺席、四画像、暴露/耗尽、先修/预算/每场次10题、学生四分支与恢复、旧revision/幂等、真实磁盘SQLite重开、未知旧时间、不可变历史与评分更正、乱序及初始依据复用拒绝、新日草案和小数预算、新证据时仍能休息。

## 先行失败与修复链

1. c-first-red.log：先写主测试，模块不存在，退出1。
2. c-first-implementation.log：8通过/3失败、退出1。合成帮助结果的novelty标注应按保守语义为seen；两处不可变断言比较了新对象和SQLite排序后的JSON。核对存储后，fixture标注帮助暴露为seen，断言比较同一数据库对象前后序列化，未放松存储保护。c-rerun-1.log：11/11、退出0。
3. c-edges-first-red.log：新增计划历史导出尚不存在，退出1。补投影后 c-edges-implementation-red.log：16通过/5失败、退出1，揭露初始依据复用、重复安排刚做题、更正重算遗漏改期、乱序结果、过期依据引用。修复后 c-edges-rerun.log：21/21、退出0。
4. c-calendar-first-red.log：22通过/2失败、退出1，揭露跨日仍复用旧日草案、小数预算生成非整数预计分钟。修复后 c-final-tests.log：24/24、退出0。
5. c-final-review-red.log：定向2项失败、退出1，揭露新草案阻碍暂停当前计划、报告变化只有版本号。修复为暂停当前计划只需匹配当前计划ID，增加具体知识点状态前后变化；c-final-tests-2.log：25/25、退出0。

原始失败均保留。本窗口自测不称独立复验。

## D入口与限制

调用、权限、修订历史读法见 **INTEGRATION.md**；规则及画像见 **排程规则表.md**。显式注册new PlanningEngine，复用runtime同一repository/clock/catalog。确认必须来自真实学生事件；结果必须来自A保存尝试和B保存评分，C再次核验。不能用合成fixture替代B产品实现。

历史通过reportHistory/planHistory附加basisRevised/replacementId，不回写旧快照；当前计划实时进度与currentReviewItems按知识点/planVersionId合并。task=null或exhausted时重新选择，不自动开题。

- **无阻断接口缺口**，未修改共享协议、未复制同名私有wire协议。选题详情、历史投影、reconcile为C本地导出，使用现有冻结实体。
- 1.0.0 ReviewItem无policyId；首版同一数据库保持固定排程配置，只支持初始化自定义，不支持热换策略或多策略混用。后续迁移需D另行协调，不宣称已支持。
- 无可信旧完成时间时可保存学生确认的可选计划，但不伪造复习到期；取得真实尝试后重新提案确认。题库耗尽明确返回原因和null题目，不编造题。
- C不实现B的评分/知识点状态算法；画像是合成输入的规则响应，不代表B或跨模块完成。
- 只完成规则、端口和临时SQLite自验。真实模型文案/API、页面接线、跨模块浏览器、真机、长期教学效果、独立复验均未运行；未运行全产品构建、B/D专属测试或用户浏览器流程。

完成本批后停止，等待D集成。
