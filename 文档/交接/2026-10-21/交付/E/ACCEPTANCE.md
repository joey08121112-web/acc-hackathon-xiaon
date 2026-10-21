# E1 验收矩阵（实现者自验）

日期 2026-10-21。以下都是本窗口的实现者自验，没有第三方独立验收，也没有真实设备或真实学生测试。所有日志都在 `evidence/` 下。

## 命令与退出码

| 命令 | 结果 | 证据 |
|---|---|---|
| 实施前基线：`npm test` / `typecheck:agent` / `test:agent` / `build` | 全部退出 0；Agent 测试 88/88 | evidence/baseline/ |
| `npm test`（原规则 25 项） | 退出 0 | evidence/final/npm-test.log |
| `npm run typecheck:agent` | 退出 0 | evidence/final/typecheck-agent.log |
| `npm run test:agent`（A/B/C/D/E） | 退出 0，101/101（原 88 + E 13） | evidence/final/test-agent.log |
| `npm run build`（包含 `tsc -b`） | 退出 0 | evidence/final/build.log |
| 构建产物扫描 | prompt、模板、校验器标记与 GenerationRecord 均为 0 命中 | evidence/final/bundle-scan.txt |
| `npm run test:agent:e:browser` | 退出 0，2/2 | evidence/e-browser-final.log、browser/ |
| D 集成浏览器测试，独立端口重跑 | 退出 0，5/5（含自动无障碍检查） | evidence/d-regression/run.log |
| `npm run test:agent:e:real`（真实 GLM） | 首次退出 1（脚本顺序问题，见下文）；重跑退出 0，VERIFIED | evidence/real-generation-first.*、real-generation.* |

## 任务书 §9 逐项

| 要求 | 结果 | 证据位置 |
|---|---|---|
| 合成生成走完整链路：真实 handler → 校验 → SQLite → 统一目录 → 页面开题 → 实际判题 | 通过 | flow.test「synthetic generation…」；browser 主线 |
| 不合格题不发布：错答案、结果对但步骤错、越界参数、非法模板、畸形字段、额外字段、注入、超时、取消、迟到、连续失败、工具调用 | 通过 | templates.test 校验器用例；flow.test 修复轮与取消用例 |
| 用独立算法核对模板数学：数值代入，覆盖正负、零系数、抵消、x/a 切换 | 通过 | templates.test 第 1、2 项 |
| 去重：只换 ID、空格、项序、字母，与静态题重复；答案相同但题目不同不误判 | 通过 | templates.test 指纹用例；flow.test 重复发布被拒 |
| 重复 operationId、同 ID 不同请求冲突、并发发布 | 通过 | flow.test 幂等用例；http.test |
| 不能绕过题量、先修、休息、探索顺序、每日和场次上限 | 通过 | flow.test 门控用例 |
| 学生 API 和前端包里没有参考答案、rubric、prompt | 通过 | http.test；bundle-scan |
| 关闭记忆后出站请求不含偏好；授权或暂停变化会取消在途生成 | 通过 | flow.test 记忆用例与暂停取消用例 |
| 重启后仍能查题、评分；旧题兼容；重置清除新实体和缓存 | 通过 | flow.test 重启（同一 SQLite 文件、离线模型下重新评分）与重置用例；原 88 项回归 |
| 浏览器：独立 origin、临时库、负号主线；TestClock 推进到生成新题的复习；刷新保留草稿；提示暴露正确 | 通过 | browser 主线：stage 0→1，未见题新题独立完成，提示快照 1 条 |
| 真实 GLM：收到结构化候选 → 程序校验 → 持久化 → 判题 → 复习 | VERIFIED | real-generation.json |

## 首次失败与重跑（没有降低任何断言）

- `e-flow-first-run.log`：4 项失败，原因都是测试夹具写错：同一数据库关闭了两次；预期的拒绝原因写错；计算题曝光数量多算了 2 道；复习用例的计划指向了未观察的技能。修正夹具后 7/7（`e-flow-rerun.log`），产品代码没有为此改动。
- `real-generation-first.*`：真实练习生成已发布并判对，但脚本在独立做对之后才生成计划，计划因此指向了其他技能，没有产生复习项。调整为先计划后再出练习题，重跑 VERIFIED。两份结果都保留。
- 说明：模板、校验器和 HTTP 测试是在实现之后编写的，首次运行即通过，所以这几项没有“先失败”的记录。

## 真实模型结果（去敏）

- 共 3 次真实生成（首次运行 1 次，重跑 2 次），都在第一轮被接受，模板 nb-basic、入门难度，发布的题面如 `4x − (2x − 3)`、`5x − (3x − 4)`。
- 评分走程序 rubric；复习用生成的新题完成，结果为“未见、独立”，阶段 0→1。
- 证据不含 Key、请求头、推理内容或模型原文。
- 修复轮在真实模型下**没有被触发过**，只有合成模型覆盖。

## 未运行或未验证

- 真实设备、软键盘、读屏软件人工测试。
- 真实学生和教学效果。
- 真实模型下的修复轮和失败分布、长期成本。
- `map-restoration`、`legacy-experience`、`offline` 三个 D 浏览器测试：它们把截图硬写到 D 的历史证据目录，为了不覆盖 D 历史证据而没有重跑。这三项涉及的地图、旧流程和离线代码本批没有修改。
- 5194/18931 端口上用户已有的预览服务：没有关闭或改动，它仍在运行旧代码，需要重启后才会包含 E1。
