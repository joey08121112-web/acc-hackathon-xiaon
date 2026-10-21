# D接入C

示例尚未接产品。应用根目录 `/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon`。C未改bootstrap或启动服务。

```ts
import { PlanningEngine } from './server/plugins/planning';
import { attemptFacts } from './server/plugins/planning/evidence';
import { selectReviewTarget, currentReviewItems, reportHistory, planHistory } from './src/learning/review';

// runtime由D创建并注册真实B引擎，C不要求B实现路径。
const planning = new PlanningEngine();
runtime.registerPlanning(planning);
const context = runtime.engineContext();
const assessment = await runtime.assessment().snapshot({operationId: uniqueAssessmentOperationId}, context);
// 必须为已保存、当前evidenceRevision、没有过期依据引用的快照。
const selection = selectReviewTarget(assessment, 6, context);
// 学生改选只读预览：selectReviewTarget(assessment, 6, context, selectedKnowledgePointId)
// selection.status=available/exhausted，candidates为公开题面；原题单列，constraints交主控。
const proposal = await planning.propose({operationId: uniqueProposalOperationId, assessment, timeBudgetMinutes: 6}, context);

// 仅在实际学生事件后调用，operationId保留供重试。
const previous = context.repository.list('plans').at(-1);
const plan = await planning.confirm({
  operationId: uniqueStudentConfirmationOperationId, proposalId: proposal.id,
  expectedPreviousVersionId: previous?.id ?? null, action: 'accept',
  scheduledDate: null, reason: '学生明确选择接受',
}, context);
const due = await planning.due({at: context.clock.now(), includePaused: true}, context);
const allCurrent = currentReviewItems(context); // 也可查看未到期暂停项和终态

// A真实提交、B评分后，真实attemptId/reviewItemId/expectedRevision来自学生操作关联。
const item = allCurrent.find(i => i.id === reviewItemId)!;
const facts = attemptFacts(attemptId, item.knowledgePointId, context);
await planning.recordOutcome({
  schemaVersion: '1.0.0', id: uniqueOutcomeId, operationId: uniqueOutcomeOperationId,
  evidenceRevision: context.repository.evidenceRevision(),
  reviewItemId: item.id, reviewRevision: expectedRevision, attemptId,
  sessionId: facts.attempt.sessionId!, verdict: facts.grade.verdict,
  independent: facts.independent, taskNovelty: facts.novelty,
  completedAt: facts.time!, reason: '学生完成复习；程序再次核验',
}, context);

// 评分修订后显式重算，due也会按需触发。随后B应生成新快照用于报告/草案。
await planning.reconcile({operationId: uniqueCorrectionOperationId}, context);
const currentAssessment = await runtime.assessment().snapshot({operationId: uniqueCurrentAssessmentOperationId}, context);
const report = await planning.report({operationId: uniqueReportOperationId, assessment: currentAssessment, previousReportId: previousReportId ?? null}, context);
const reports = reportHistory(context); // snapshot/basisRevised/replacementId
const plans = planHistory(context);
```

未定义变量须D从真实事件取得，不是可直接运行的伪造授权。最小可编译注册函数在server/plugins/planning/register-example.ts；完整可执行合成调用见tests-agent/c/examples.ts。

## 前提和展示

- confirm/recordOutcome为内部服务端端口，D须接真实学生事件和A本地会话/来源防护，不给模型任意写入工具。不能相信浏览器/模型自报分数或独立性；C会核验来源、暴露、场次、时间和revision。
- C消费B已保存快照，不实现B评分。陈旧依据/计划冲突应提示重新核对。暂停当前确认计划可在新证据出现后执行，但仍检查最新计划ID。
- action为accept/lighter/reschedule/defer/resume；仅reschedule传有效且不早于上海今天的scheduledDate，其余null。每个真实动作新operationId，重试保持原ID与参数。
- 已关联复习结果的尝试不能换ID再计一次；评分更正走B修订加reconcile。不要伪造新场次绕过10题限制。
- 同数据库固定排程配置；初始化可new PlanningEngine({id:'school-policy-v1',intervalDays:[1,3,7,14],minimumAdvanceHours:24,helpRetryHours:12,errorRetryHours:6})，不支持热迁移多策略。
- C不读取/新增memories；可选偏好关闭不影响必要学习记录和确认计划。

历史报告/计划展示basisRevised与replacementId，绝不回写旧快照。当前计划的taskType/预计时间/日期是当时确认快照；实时完成/暂停进度与currentReviewItems按知识点和planVersionId合并。

task=null、exhausted或paused时不自动开题。未知旧时间只展示可选计划和未知说明；取得真实作答、B新依据后重新提案和确认。

## 复跑

```sh
cd '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon'
npm run test:agent:c
npm run typecheck:agent
node --import tsx tests-agent/c/examples.ts
```

测试使用独立临时磁盘SQLite和TestClock，重启用例真实关闭重开同一文件；不占端口、不打开浏览器、不调用真实模型、不改系统时间。examples刷新C合成输出后需更新交付哈希，不影响A/B或用户数据库。
