# 初次静态失败补记

本文件是根据当次工具回显整理的摘录，不伪装为原始终端完整日志。完整关键业务测试失败另有原始.log/trace。

- `npm run typecheck:agent` 退出2：D测试最初把temporaryRepository.clock的Clock接口当TestClock调用advance；测试显式创建并注入TestClock后恢复，不改Clock契约。
- `npm run build` 退出1：LearningPages.tsx第70行恢复按钮JSX多一个闭括号；修正语法后同命令通过。
- `npm run test:agent` 首轮74/76、退出1：D收紧Tutor判题权限后，A两条旧测试仍以Tutor调用grade_attempt。先读取原失败，保留对原尝试、幂等与权限的断言，合法判题改Assessor，未放松Tutor拒绝。见integrated-modules.log与最终87项日志。
