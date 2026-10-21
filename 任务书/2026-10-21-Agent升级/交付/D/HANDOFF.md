# D 三Agent集成与完整验收交付

> 后续更新：探索页已按用户要求恢复原五地点地图，当前验收和代码清单见[地图恢复记录](地图恢复-20261021/FIX-REPORT.md)。本文原验收数字／哈希为恢复前快照；原evidence中部分同名截图也已由后续回归更新，详见该记录。

**本机受限闭环已跑通，可运行交付；D集成自验完成，不代表整版全量独立验收。** 日期2026-10-21。没有commit/push/merge/部署/发送通知，没有覆盖原分享ZIP。

## 运行入口

应用：`/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon`。当前预览为 **http://127.0.0.1:5194/**，API127.0.0.1:18931；使用独立`.local/d-preview.sqlite`，不使用用户日常库。实际启动与HTTP核对见evidence/startup.json。重启：

```sh
cd '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon'
XIAON_DB_PATH=.local/d-preview.sqlite npm run dev:learning
```

新环境先npm ci；Node最低22.13（最低版本未另装验证，当前26.8.2）。若端口已有进程，不关闭别人的实例，使用README的端口覆盖方法。当前服务由本窗口启动，Ctrl+C只结束本命令自己的两个进程。模型配置只读服务端.env.server，未导出/提交Key；实际采用用户A阶段确认的glm-5.3-flash/Coding Plan配置，不另造变量体系。

体验路线：首次进入→可选记忆关闭→首页一起看题→先确认合并同类项并作答→负号题错答/提示后修改→查看证据→生成差异化报告/计划→学生确认→今日到期后确认未见复习题→回顾与状态/历史。正常体验使用真实日期；测试Clock仅在专用测试服务里，不开放正式路由。

## 前置与独立复核

完整读取00总控、04任务和05模型补充、两级README、阶段3审查、阶段2修复报告；检查父目录及工作区AGENTS（未发现）。随后按A→B→C读取HANDOFF、接口/整批清单、关键代码、首次失败/未完成项，核对62项哈希全部匹配；READY标记与真实交付同时成立，才写集成代码。A23、B25、C25定向独立复跑均退出0，证据independent-a/b/c.log。未发生“前置未就绪抢跑”，B/C无阻断共享接口缺口，未动用提前协调例外。

main，HEAD开始/结束均773e95ecc3063648a4ece1e67484c48f763ccaff，只有原worktree；保留原dirty/untracked。没有创建基于旧HEAD的worktree，没有清理原失败或用户材料。D未委派子任务/其他窗口。

## 最终实现

- `server/agents/roles.ts`：Tutor、Assessor、PlannerReporter三种独立prompt版本、输入构建、白名单、输出schema、去敏运行轨迹。运行时共享ModelProvider，不共享全部聊天或自由递归委派；每次学生操作最多两个专门执行记录，模型循环4轮/6工具上限。PlannerReporter用冻结枚举planner标识，前端显示完整角色名。
- `server/agents/learning.ts`：真实B/C组合、学生事件状态机、幂等/并发、按上海日期开始新场次、先修/计算10题/暴露门控、保存作答后分析、复习结果核验、草案/确认与历史、记忆更正、清库。取消保留已保存原尝试，迟到文字不发布；模型忙时休息优先。
- 工具真实注册：get_learning_context、query_learning_evidence、get_skill_state、select_task、grade_attempt、get_hint、get_due_reviews、propose_plan、propose_memory。grade_attempt仅Assessor按保存ID处理；get_hint需已有学生请求；propose_memory只候选，propose_plan不确认。旧request_hint继续显式unavailable。新增工具成功结果实际来自B/C/repository，未拿空stub成功替代。
- composition root与HTTP启用D后关闭旧的写入绕行；学生不能传role、learnerId、可信答案/rubric、评分、时钟。保留本机会话、Origin/Host/CSRF防护，无任意工具HTTP端点。
- `src/agents/useLearning.ts`、`src/components/learning/LearningPages.tsx`：接入现有App的聊天、任务、探索/成长、报告、计划/今日、回顾、记忆。沿用原导航、纸色/绿系与手机布局；没有另做脱离产品的演示站。旧规则路径继续保留，SQLite启用后断服务不悄悄用旧记录覆写事实。
- 报告仅渲染C受控事实/推断/未知及原始证据；模型只能组织合法引用。计划确认真实版本事件；今日呈现确认目标、当日安排及当前队列。题库不足明确说明、原题回顾不冒充未见检验。
- 旧记录先下载备份、预览后主动导入；不补造年份/时区/场次/跨天完成；重复去重、错误回滚。reset同时清SQLite与收据、旧本机记录/图片和新版草稿，服务不可用不假装成功。
- 单文件构建增加明确离线标记，只输出D/evidence/offline-candidate；不含Node/SQLite、新版可信题库或凭据，不声称有后台Agent。

## 必要集成修补

共享仍使用实体schemaVersion1.0.0，D1兼容扩展详见CONTRACT-CHANGE.md；新增严格ToolResult分支、工具参数及可选repository.receipt/reset，不宽化为任意JSON。JSON Schema重新生成，所有消费者复验。

两处C交叉缺陷均先保存失败再修：候选limit500与B上限100冲突；前一上海日期预览的题，B归为已见而C仍可能推进未见复习阶段。仅修C投影limit与attemptFacts暴露日期判断，不重写B/C架构。B13个交付文件保持原哈希；C仅这两个文件变化。A两条旧判题测试改由Assessor执行，保留原幂等/不可变/越权断言。最终清单及上游前后哈希见final-files.json、final-source.sha256、evidence/upstream-changes.json。

## 实测结论

| 层级 | 结果 | 证据 |
|---|---|---|
| A/B/C原模块独立复核 | 23/25/25均通过 | independent-a/b/c.log |
| 当前规则/HTTP/集成自验 | 原25/25；Agent88/88（A23/B25/C25/D15）；类型与生产构建退出0 | final-upstream-and-build.log、typecheck-delivery.log |
| 独立origin手机浏览器自验 | 完整23/23（新版5、原流程16、原无障碍1、离线1）；另有暂停修补后的6项通过 | browser-complete-delivery.log、browser-results.json |
| 真实服务重启与幂等 | 实际关闭/重启进程，记录与收据恢复，重复仍1条 | process-restart.log |
| 模拟模型 | 原生工具循环消费真实SQLite/B/C；跨两日期、刷新、失败/取消、记忆、历史、迁移等通过 | browser-chain.json、agent-tool-traces.json、failure-retry-result.json |
| 真实模型API | GLM基本请求、Tutor查证据原生工具、Assessor开放解释定位评分、PlannerReporter受控输出通过；没有自动确认计划 | real-model.json=VERIFIED、real-model-rerun.log退出0 |
| 真实记忆请求上下文 | 五阶段使用合成标记，实际HTTP请求体标记与权限一致；只保存布尔匹配与HTTP状态 | real-memory-context.json及重跑日志；首轮无响应失败另保留 |
| 构建/离线 | 构建及HTTP自包含规则体验通过，包扫描无GLM配置凭据、哨兵、node:sqlite或新版题库标记 | offline-current.log、final-artifact-scan.json、06-offline.png |

真实主链API在最终暂停与预览日期补丁前完成，之后相关规则/完整浏览器复验；没有为这两处不涉及GLM协议的变更重复整套真实调用。真实模型API脚本与浏览器模拟闭环分开报告，不宣称真实模型浏览器全链或真机已经验收。

## 证据索引与失败

- 完整验收12项及限制：[ACCEPTANCE.md](ACCEPTANCE.md)。
- 核心截图：evidence/01-task.png、02-report.png、03-plan.png、04-history.png、05-memory.png、06-offline.png。
- 320/390/430宽度：evidence/mobile-{320,390,430}-{task,report,plan,memory}.png。
- 原始作答/计划/复习接续：browser-chain.json；迁移备份/结果：legacy-browser-backup.json、migration-result.json。
- 去敏角色/工具轨迹：agent-tool-traces.json；真实模型运行/工具记录在real-model.json，不含Authorization/内部思考。
- 首次失败及修复同命令重跑：integration/flow/controls/retry/answer-guard/rest-priority/preview-day各组.log；原始浏览器trace在browser-first-artifacts、browser-rerun-1/2-artifacts、browser-expanded-first-artifacts。真实模型与真实记忆首轮失败均有first文件，不覆盖。
- 浏览器trace的临时会话/CSRF/授权头已去敏，失败事件与截图保留，去敏前后SHA见evidence/trace-redaction.json。
- 静态初错摘要：evidence/STATIC-FIRST-FAILURES.md（明确为回显摘录，不伪装完整原始日志）。

## 边界与未验证

本版本仍为单用户、本机合成材料产品。保留离线规则导致旧固定题的答案仍可查看前端源码，部分与新版题重合；不能宣称考试级答案保密或所有自然语言攻击都已证明防住。新版完整rubric/答案库不打入前端，接口权限/参数/可信来源/暴露和预算防护已实测。

真机、iOS软键盘/工具栏、人工读屏、file://直接双击、真实学生/长期教学效果、整版第三方独立验收：未运行。公网部署安全/账号/OCR/真实监护核验/通知/云同步非本批实现；原相应流程仍为演示。SQLite没有应用层加密，删除不承诺取证级擦除或撤回外部既发请求。ID数组超过500、长期大数据分页、多排程策略热迁移未验证或未支持。Coding Plan可用于正式教学产品的套餐适用性未证明，官方来源及配置说明在应用README。

交付后停止实施，不自动进入发布或部署。
