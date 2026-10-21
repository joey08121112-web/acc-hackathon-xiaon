# H 第一期契约变更申请：已有场次切换专业模式

2026-10-21；基于 revamp-base / main 99a9385。仅申请，不修改 Claude 文件。

## 要改什么

`server/agents/learning.ts` 的 `LearningCoordinator.start()` 当前在同日有未结束场次时，直接返回旧场次；忽略请求里的 `mode`。暂停的 support 场次也会先恢复，再以 support 返回，即使学生刚确认 `mode: exploration`。

请由 Claude 设计并实现模式切换的程序语义，并在 `CONTRACT-CHANGE.md` 说明：学生显式确认后，应返回 exploration 模式；不能借切换重置同日计算题预算、暴露与已有作答证据，也不能无声接受错误模式。请保留暂停/恢复及原有 D 测试要求。

## 为什么

第一期 A 第 5 条要求：学生确认后调用 learning/start(mode: exploration) 并进入现有五维探索。初次打开且无 LearningSession 时可用；但点过「今天先休息」、从题目页返回、或同日已有 support 场次时，会拿到 support 场次，导致展示与实际模式不一致。

## H 已做的边界处理

H 只在学生点击确认后调用 start，并检查返回的 LearningSession.mode。若仍非 exploration，留在首页，显示「上次的学习还没结束，暂时没能切到专业模式。可以先继续聊天。」不擅自关闭旧场次、不重建场次、不自行改变预算。

## 另外两路影响

zCode 的错题/记忆接口与共享类型无需改变。Claude 的 start 协调器及对应模式切换回归需补充。H 已用本路浏览器用例验证「旧 support 未切成功时不跳页」。本问题是集成前的已知限制，不能算完整模式切换验收通过。

# H 第二期集成接线请求：旧页面外壳与工程用语

2026-10-21，基线 `revamp-base2` = `b611610`。不改共享契约，不改 Claude 的文件。

- `LearningPages.tsx` 中的旧报告页在新的 `ProfessionalReportView` 后，仍并排显示旧的「根据当前证据生成报告与计划草案」、另一套「报告历史」、以及「观察快照 · 证据版本」等内容；全局错误区也会直接展示服务端错误。请 Claude 在第二期集成时把工程细节接到既有 `useDevMode()`，明确两套报告的名称与入口。H 的新组件内部已用开关收起 id、revision、basis、mode 等信息。
- `LearningPages.tsx` 的旧探索页仍有地图自由选题、旧「主动恢复本次学习」按钮和计算题计数。H 的面试区只按冻结顺序开始/续测。建议 Claude 在集成时区分「面试测评」与原地图任务，并决定测评进行中是否折叠地图，避免学生绕到另一条任务流。H 没有用 CSS 隐藏或 DOM 操作绕过所有权。
- `App.tsx` 页面标题映射的 explore 仍为「五维探索」；H 仅获底部导航区块的改名权限，已把第二个按钮显示成「专业模式」，保留内部「探索」tab 键以兼容原导航/离线分支。若统一页头名称，请 Claude 集成时授权或接线。
- 首页建议进入说明页现在不调用 `learning/start`。只有面试区「开始」调用 `interview/start`，既有未完成测评只调用 `interview/resume`；由协调器进行显式模式切换。原 H 首页浏览器相应断言已更新。
- `ProfessionalReportView` 的月阶段按钮仅 `navigate('plan','成长')`，沿用契约挂载的 zCode `MonthStageView`；历史报告切换只读，不自行草拟月阶段、不传客户端等级、不写趋势。当前挂载没有选中报告的 prop，月阶段应由 zCode 处理自己的来源报告选择。

这些是交给集成方的明确边界。本路不会擅改 `LearningPages.tsx`、`src/agents/devMode.ts`、共享类型、服务端插件或另一条路的组件。
