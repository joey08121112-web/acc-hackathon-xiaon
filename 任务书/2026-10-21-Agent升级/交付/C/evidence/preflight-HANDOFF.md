# C 批前置核验交接

状态：WAITING_FOR_A。C 实现尚未开始，未标记 READY_FOR_D_PLANNING。

## 已完成与当前阻塞

已完整阅读总控、C 任务书、仓库 README、应用 README、阶段3审查报告及阶段2修复报告；已检查适用父目录及仓库 AGENTS.md（未发现），读取现有 domain.ts/data.ts 了解旧记录限制。

本次核验记录见 evidence/preflight.json。检查时 A/HANDOFF.md、共享契约与 Schema、server、tests-agent、src/agent-client 均不存在。A 交付目录仅有基线源码、基线清单、辅助脚本和基线日志。已读取其 unit-baseline.log（22/22、exitCode=0）与 build-baseline.log（exitCode=0）；这是 A 保存的原有前端基线证据，不是冻结协议或新增服务测试，本窗口未重跑。

依总控“B/C/D缺前置交付时只能阅读、梳理用例和提出接口缺口，不能实现猜测中的接口”，本窗口只写 C 交付目录。冻结接口版本、哈希、注册样例、C 测试命令与端口分配均待核验，不能猜签名、编写私有替代协议或抢跑实现。

## 本轮产物及证据级别

- 验收用例与接口核验.md：未执行的测试矩阵、四种合成画像预期及接口核验清单；不是测试通过记录或真实运行结果。
- evidence/preflight.json：开始时 Git 状态、main、HEAD 773e95ecc3063648a4ece1e67484c48f763ccaff、单一 worktree、文件清单、只读源码哈希、C 所属源码目录不存在的记录及 A 前置检查结果。
- evidence/delivery-hashes.json：本次交付文件哈希（清单自身不纳入自身哈希）。

本窗口只进行了文件读取与前置核验；未运行 C 规则测试、持久化恢复、静态检查、模型 API 或浏览器测试。没有业务测试首次失败或重跑可报告；首次前置读取失败是 A/HANDOFF.md 不存在，之后显式存在性检查再次确认。未修改产品、配置、共享文件、B 文件、电脑时钟或用户数据；未 commit/push/发布。

## 继续执行入口

A 生成真实 HANDOFF 并标记 READY_FOR_BC 后，重新核对协议/Schema/哈希及新增服务测试证据，再按验收矩阵先写失败测试；仅在 src/learning/review/**、server/plugins/planning/**、tests-agent/c/** 实现，使用 A 统一协议、注入 Clock 和临时数据库。不依赖 B 未完成实现。

随后交付排程规则表、四画像真实合成 fixture 输入输出、D 可注册 PlanningEnginePort 实现及调用样例、测试命令/退出码/首次失败与重跑日志、改动哈希及真实接口缺口；关键规则和持久化恢复通过才能标记 READY_FOR_D_PLANNING。

真实模型文案、页面接线、跨模块浏览器、真实设备、长期学习效果、独立复验均未运行。本交接为前置未满足的阶段记录，不是 C 批完成交付。
