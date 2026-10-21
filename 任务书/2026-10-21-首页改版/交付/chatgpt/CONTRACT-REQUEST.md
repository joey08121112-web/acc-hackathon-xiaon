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
