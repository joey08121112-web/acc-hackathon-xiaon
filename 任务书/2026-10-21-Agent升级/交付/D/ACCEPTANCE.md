# D验收矩阵 · 2026-10-21

范围：当前本机合成材料版本。A/B/C的原交付由D独立复跑；D新增集成、浏览器和真实模型属于实施者自验，整版没有第三方独立验收。跨天均用测试Clock，不是等待多天的真实学生试验。

## 前置与测试分层

| 检查 | 结果 | 原始证据 |
|---|---|---|
| A→B→C原交付哈希、接口、失败与未完成项 | 41/41、13/13、8/8当前文件匹配，契约1.0.0；三份READY均与代码和证据成立；无阻断共享缺口 | prerequisite-hashes.json；A/B/C原HANDOFF |
| A基础独立复跑 | 23/23，退出0 | independent-a.log |
| B关键规则独立复跑 | 25/25，退出0 | independent-b.log |
| C关键规则独立复跑 | 25/25，退出0 | independent-c.log |
| 当前所有模块+工具/HTTP | 88/88，退出0（A23/B25/C25/D15）；A两处权限用例按Assessor改为正确调用方 | final-upstream-and-build.log |
| 原规则/完整构建 | 原25/25、当前Agent88/88及生产构建通过 | final-upstream-and-build.log |
| 当前消费者静态检查 | 退出0 | final-typecheck.log、typecheck-delivery.log |
| 完整独立origin浏览器套件 | 23/23：D新版5、原流程16、原自动无障碍1、离线候选1 | browser-complete-delivery.log / browser-results.json |
| 暂停优先修补后的相关浏览器 | 6/6：新版5与当前离线候选1 | browser-after-pause.log / browser-results.json |
| 真实进程关闭/重启、SQLite及收据 | 退出0，保存尝试与重试仍1条 | process-restart.log |
| 实际前端bundle假密钥扫描 | 26个产物无哨兵，退出0 | bundle-sentinel.log；offline-current.log |
| 实际运行 | API与前端HTTP200，仅loopback；独立.local/d-preview.sqlite | startup.json |

以上浏览器为桌面Chromium的手机视口，非真机。测试全用独立origin/数据库，未清空用户5173 localStorage，未关闭其他窗口进程。

## 用户要求逐项对应

| # | 场景 | 结果与边界 | 证据 |
|---|---|---|---|
| 1 | 全新、五维未观察、不开可选记忆 | 通过：6个子技能未观察；本机规则也能学；无记录只给可选建议，计划需确认 | D preflight/controls；浏览器主链optionalMemory=false；01–03截图 |
| 2 | 负号困难→提示修改→计划→跨日新题→再次复测 | 通过：先完成先修同类项；x-5错误、x+5提示后完成，次日4*a+2独立，再+3天12-3x独立；跨次状态与队列stage=2 | flow.test；browser-chain.json；01-task/02-report/03-plan/04-history.png |
| 3 | 建模困难、计算独立与负号画像不同 | 通过真实B/C集成，不靠C合成画像替代：model错误与like-terms独立，草案目标fixed-variable-cost | controls profiles；B/C定向复跑 |
| 4 | 同日重复/原题/聊天泄题不计稳定 | 通过：B跨次规则、未知/原题/帮助暴露分别记录；D所有学习相关聊天保守记chat_help，可能宁可低估独立性 | independent-b.log；D controls/flow |
| 5 | 原题修改、首次独立、提交后提示、等价与矛盾等式 | B独立复跑及原25规则通过；浏览器实作提示后修改和4*a+2 | independent-b.log；final-all.log；browser-chain.json |
| 6 | 休息/拒绝/改期/暂不开始、缺席与恢复 | 通过：程序优先暂停场次与当前计划；模型等待中仍可休息并丢弃迟到文字；C四分支与缺席/不堆积规则复跑通过 | rest-priority-first-red/rerun；browser-after-pause.log；independent-c.log |
| 7 | 网络/模型超时、取消、迟到、双击、刷新、服务重启 | 通过：保存原尝试、恢复草稿和待重试包；重复ID不重计；needs_review可按原作答追加重新评分，不能靠重试改原事实 | controls/retry日志；browser failure-retry-result.json；process-restart.log |
| 8 | 历史报告/计划与更正 | 通过：快照追加、旧版本可选；更正追加grading/evidence与supersedes，旧报告basisRevised，新快照不覆盖旧报告；计划最新确认冲突受控 | retry-rerun-1.log；C修订/历史规则；04-history.png |
| 9 | 记忆关闭、更正、停用、删除、重置 | 浏览器下一次实际模拟provider调用上下文逐项核对通过；真实HTTP验证见下节；关闭不删必要作答/确认计划，重置清库和收据，刷新无复活 | memory-context-check.json；real-memory-context.json；controls SQLite reset；浏览器重置 |
| 10 | 工具注入、非法/越权/伪造、答案、预算 | 工具/HTTP边界通过：严格schema、loopback来源/CSRF、无role/learnerId/可信答案/评分/Clock输入；Tutor不能判题，模型不能确认计划/保存记忆；4轮6工具上限；答案文本拦截和未作答题帮助暴露均测试 | D http/controls，A23；answer-guard-red/rerun；真实原生tool轨迹 |
| 11 | 320/390/430手机页面与可操作滚动、无障碍 | 任务/报告/计划/记忆均有截图且无横溢；按钮经真实滚动点击，保留减少动效；新版四主页面+记忆及原四主页axe通过 | mobile-*-*.png；browser-full-final.log；browser-after-pause.log |
| 12 | 浏览器旧数据迁移与未知时间 | 通过：下载备份、预览1条、新增1再导入0；sourceTime.occurredAt/sessionId=null，exposureHistory=legacy_unknown，无跨天证据；坏题在同事务整批回滚 | legacy-browser-backup.json；migration-result.json；D http恶意/错误导入回滚 |

第10项的边界：新版完整题库答案/rubric留在服务端，工具公开视图不含评分密钥；但为兼容旧规则离线功能，同一前端包仍有旧固定题答案，部分与新版题相同。**不能把本版本称为对查看源码保密的考试系统，也不宣称已证明所有自然语言攻击无效。** 本轮的程序防护证据是权限、Schema、可信来源、文本拦截及暴露规则，非通用内容安全认证。

## 模型证据

- 模拟模型：ScenarioProvider确实消费真实工具/SQLite结果；并非把本地预设当真实推理。B自然语言评分中的合成引用只是测试模型输出校验。
- 真实GLM：real-model-first.json保留首次失败；基本请求、Assessor评分和PlannerReporter当时完成，Tutor错误地将已作答式子与另一未见题重合的答案拦截。修复后real-model.json为VERIFIED，real-model-rerun.log退出0：Assessor=correct/model_assisted且有定位引用，Tutor真实query_learning_evidence工具后完成，PlannerReporter结构校验完成，自动接受计划数量0。模型glm-5.3-flash，提供者real_http。
- 真实主路径在最终暂停优先与预览日期修补之前运行；暂停与预览日期修补未变更prompt/GLM传输/评分协议，之后以规则与完整浏览器实际复验覆盖，没有重复调用整套真实主路径。
- 真实记忆HTTP传输：由d-real-memory.ts从相同生产路径发合成偏好，记录每次请求体是否含三个标记及HTTP状态，不保存正文/头部。real-memory-context.json为VERIFIED；五项均completed且各次HTTP200请求体标记符合预期。首次开启场景未取得HTTP响应的失败保存在real-memory-context-first.json，断言不变的重跑见real-memory-context-rerun.log/退出0。
- 没有把“配置了Key”“生成了轨迹”代替真实调用成功；没有打印或导出GLM凭据。真实API脚本不是浏览器真实模型整条端到端验收；浏览器闭环使用模拟模型/真实规则与数据库。

## 失败保留及修复

所有证据相对本目录evidence/。测试失败不覆盖：integration-first-red.log（C500/B100）；flow-first-red.log（D模块未实现）；flow-first-implementation.log（夹具未做真实先修，后补先修）；controls-first.log（模型合成评分与程序冲突、超时分类、取消仍带旧文字、测试关闭两次DB）；retry-first-red.log（待核查重试未重跑分析）；answer-guard-first-red.log与real-model-first.json（已知表达式误拦）；rest-priority-first-red.log（忙时休息受锁阻挡）；preview-day-first-red.log（B认定前一天预览已见，C却仍进级）。修复后同类原命令复跑，原始尝试与失败资料保留。

浏览器初次错误、每轮修正及完整trace保留在browser-first*、browser-rerun-1/2*、browser-expanded-first*；真实缺陷包括预览多传operationId、立即刷新时开题状态错配、重连按钮对比度不足。测试自身修正包括状态栏在首次介绍之后才显示、异步复选框改为点击后等待服务确认、按实际可见按钮定位、注入旧进度后先刷新而非让旧React状态覆盖。原断言目标未放宽。23/23完整套通过后，暂停修补的6项相关套通过；最终预览日期修补后完整23项再跑，见browser-complete-delivery.log。

## 未验证与残留

- 真机iOS/Android、软键盘/浏览器工具栏、真实读屏、file://直接双击、长周期教学效果、真实学生/未成年人验证、整版第三方独立验收：未运行。
- 正式公网安全/账号/云同步、OCR、真实监护身份核验、真实通知：未实现/本批非目标；现有对应流程仍标模拟。
- SQLite无应用层加密；删除不承诺取证级擦除及撤回外部已发信息。长数据量超过冻结ID数组500项、分页、策略热迁移：未验证/未支持。
- C当前一个数据库固定同一复习策略；题库有限，耗尽会明说并保留原题回顾，不能无限复测。
- 个人Coding Plan的产品适用范围应按官方规则确认；接通不是正式教学产品可用套餐的证明。详见README官方来源，不擅改用户已确认的非密钥配置。

结论：受限本机版本的指定闭环、持久化、历史与受控角色协作已跑通。D交付是集成自验，不能称整版全量独立验收。源码考试保密与上述未验证项不在通过声明内。
