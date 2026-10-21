# D协议兼容修订

前置A/B/C全部READY且62项哈希匹配、73项定向独立复跑通过后，才开始正常D集成。B/C无阻断共享接口缺口，本轮没有使用提前协议协调例外。

持久化/实体 `schemaVersion=1.0.0` 保留，扩展修订记为 **1.0.0 / D1**；不重写旧数据的版本号。

- ToolArguments新增 get_hint（必须已有学生提示事件）、get_due_reviews、propose_plan、propose_memory。旧request_hint保留为显式unavailable。
- ToolResult成功分支只增加严格定义的提示结果、真实ReviewItem队列、PlanProposal和需要学生另行确认的记忆候选。没有宽泛任意JSON成功分支。
- LearningRepository新增可选receipt/reset供程序幂等读取与学生重置，B/C既有消费者无实现负担，reset从不注册为模型工具。
- Tutor移除grade_attempt权限；Assessor负责判题，PlannerReporter使用既有planner枚举标识；reporter保留旧兼容角色。A原测试中两处判题场景改用Assessor，原越权/原始尝试/幂等断言不放松。
- D学生事件在server/agents/learning.ts本地严格schemas中定义；HTTP拒绝role/learnerId/可信答案/评分/时间。启用D后原sessions/attempts/exposures/chat写路由明确拒绝，避免绕过D状态机。A未注册D的消费者继续原行为。
- 集成缺陷：C浏览器安全投影selectReviewTarget请求limit=500，B只允许0–100，D先保留integration-first-red.log，再将请求改100。另一次最终交叉核验复现：题面在前一上海日期预览、同场次次日提交时，B已认定seen，C仍可能推进未见复习阶段。保留preview-day-first-red.log后，在C attemptFacts补入相同的早日暴露判断，禁止此类进级；未改C架构或重新判分。

旧客户端能继续解析旧工具结果；要消费新增工具需使用更新后的共享Schema；不声称旧冻结Schema能识别新增分支。JSON Schema已重新生成，A契约一致性测试及所有消费者静态检查通过。版本实体无需迁移，SQLite使用原1.0.0存储。

最终共享文件SHA256：

- `outputs/xiaon/shared/learning-contracts.ts`：`6a8b015561877209aa222cf4235d00bc922f46c1a01f155700f694b17545198e`
- `outputs/xiaon/shared/learning-contracts.schema.json`：`75be61b83e32af116b9fb67c7af045cd80d6334df8140ae879f34250bcb340c4`

完整消费者复验见evidence/final-upstream-and-build.log、final-typecheck.log。
