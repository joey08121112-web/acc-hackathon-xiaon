# D 接手：端口、注册与运行

以下路径相对 `outputs/xiaon/`。契约只使用A冻结1.0.0，无另一套同名协议。可编译样例 `tests-agent/b/consumer.ts`；生产启动/路由仍由D修改。

```ts
import { createRuntime } from './server/bootstrap';
import { RubricAssessment, createModelAnalyzer } from './server/plugins/assessment';

// 默认完全离线：确定性结果能评分；必须解释却没有可信分析时返回needs_review。
const assessment = new RubricAssessment();
const runtime = createRuntime({ databasePath: '/absolute/private/learning.sqlite' });
runtime.registerAssessment(assessment);
const ctx = runtime.engineContext();
// attemptId必须先由runtime.events.submit保存。不要把UI/模型自报答案、评分或role传入评分器。
const grading = await assessment.grade({ attemptId, operationId: 'grade-unique-1' }, ctx);
const snapshot = await assessment.snapshot({ operationId: 'snapshot-unique-1' }, ctx);
```

需要模型解释分析时，D的Assessor程序角色显式注入已有A `ModelProvider`：

```ts
const assessment = new RubricAssessment({
  analyzer: createModelAnalyzer(assessorProvider, { timeoutMs: 30_000 }),
  policy: { minimumTasks: 2, minimumDates: 2, minimumSessions: 2 },
});
```

不要把此示例视为生产已接线。分析器本身不授予角色权限、不实现HTTP、不读取环境凭据或偏好记忆，也不从文字JSON中执行工具。对已有评分修订使用可信程序入口：

```ts
const revised = await assessment.regrade({
  attemptId,
  operationId: 'regrade-unique-1',
  expectedGradingId: grading.id,
}, ctx);
```

`regrade`不是共享端口的替代接口，也不是学生/模型可自由提交verdict的HTTP能力；它用原始已保存作答与同一可信题库重新运行当前分析器，校验前一revision并追加新Evidence/GradingResult。离线客观题重新评分不会凭用户意愿改变正确答案。没有实现人工判分写入API。

同operationId同请求重放原结果；参数变更冲突。重复grade即使用新operationId也复用本次已保存B评分，避免重复证据；有意修订须regrade。snapshot保存生成时evidenceRevision并追加不可变skills/assessments；同operationId仍返回原快照，不会变成“实时快照”。每次要观察新事实应使用新operationId。

## 题库、版本与候选题

- `catalog.definition(taskId, version)`为可信服务端入口，返回脱离内部题库的副本。v1=旧定义；v2=本批定义。不能将v2覆盖到旧tasks的v1存储键。
- `catalog.publicTask` / `candidates`只返回TaskPublicView，无answer/rubric/hints正文/commonErrors。候选过滤依TaskSelection的dimension、knowledgePointId、excludeTaskIds、limit（0–100）。sessionId由A调用方校验；预算/先理解逻辑门控仍由A程序执行。prerequisites是元数据，不是掌握授权。
- `legacyIdMapping`为旧ID→保留ID的显式映射，全部16个旧ID可读取v1/v2。已保存或导入的旧答题保留version1，不将旧选项文字擅自改成v2字母，不补造历史时间。新作答使用UI实际打开的版本。
- v2提示ID为`hint-1`；v1提示ID为`legacy-hint`。通过A的学生暴露事件入口读取提示。聊天中获得关键步骤也必须由程序记录chat_help，不能仅靠prompt自述帮助。
- 需要理由的题按题面约定：第一行填式子/选项字母，后续行写解释。这是分析引用边界；没有后续解释就待核查。

## 空间渲染数据

所有v2空间题都有visual：依次的points、center、clockwiseDegrees以及具名options.points；这是折线的对应顶点顺序。坐标约定横轴向右、纵轴向上，题面也写明。

SVG/Canvas原生y轴向下，D渲染时应把全部题面、中心和选项的y取反后统一设置viewBox与缩放；仅作平移/等比缩放，不能将选项再次旋转。保留A/B/C文字按钮和坐标文本回退。B没有改Art.tsx，也没有做浏览器渲染验收。正确性证明见COVERAGE与空间测试，不能由已有旧图形的方向猜新题答案。

## 浏览器与事实展示

`src/learning/assessment/index.ts`只含状态和证据类型标签。D不要从浏览器import服务端catalog或测试夹具。`classifyAttempt(savedAttempt, ctx)`返回kind、novelty、learningDate、independent、delayedRetention和reason，分别展示原题修改/重做、提示后完成、新题独立完成、未知。delayedRetention不是独立迁移，也不由B安排复习时间。

snapshot.coverage为每维实际已观察子技能、有效评分点证据数量、最近可信时间、缺项；证据数量不是题数或分数。skill.recentDifficulty=true须和历史成功一起展示，不能只画最高状态。所有评分修订/旧快照保持可追溯；C/D报告引用新的evidenceRevision。

## 可重复运行

在应用目录执行 `npm run test:agent:b`、`npm run typecheck:agent`。B测试不占端口，使用A temporaryRepository/TestClock，每例关闭自己的SQLite并清理自己的临时目录。

导出合成实例：

```sh
node --import tsx tests-agent/b/export-evidence.ts '/absolute/path/to/B/evidence/new-synthetic-scenario.json'
```

导出命令需选择B交付内新文件，避免覆盖既有证据。`tests-agent/b/fixtures.ts`与`evidence/synthetic-scenario.json`均只含合成作答，不证明真实模型或学生表现。
