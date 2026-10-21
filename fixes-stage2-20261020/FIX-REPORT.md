# 阶段2三项问题修复交付

日期：2026-10-20。用户本轮已授权「修复」。仅修复[阶段2审查报告](../audit-stage2-20261020/REPORT.md)确认的 S2-01（P1）、S2-02（P2）、S2-03（P3）及交付过程中发现的一处打包脚本缺陷，不进入阶段3功能开发。

## 结果与证据等级

四项均已修改并完成**修复者自验**（22/22 单元、18/18 浏览器全套、三问题定向复验、单文件版更新与逐字符核对）。这是修复自验，不是新的独立审查；原[阶段2审查报告](../audit-stage2-20261020/REPORT.md)保持原样，不因此改写为「通过」，待独立复验后再改判。

- **S2-01（P1）**：[data.ts](../outputs/xiaon/src/data.ts) 删除 `correct()` 中最后一步的字符串预筛（原 172 行），改由既有 `linear()` 一次式解析做全步骤等价判断。`4*a+2`、`4×a+2`、`+4a+2` 现均判对并如实记录首次独立完成；错误答案与矛盾等式（`3x-2x-5=x+5`）仍判错。
- **S2-02（P2）**：[App.tsx](../outputs/xiaon/src/App.tsx) `openTask` 的 `pushState` 携带 `taskId`，`popstate` 在历史条目含 `taskId` 且当前进度有该题记录时恢复 `activeTask`，否则回落原守护逻辑。跨题后浏览器返回现恢复上一题并保留其作答记录；进度被重置的边界回落主页。
- **S2-03（P3）**：休息主页「我想继续聊聊」入口在返回聊天时同时置 `questionInvitePaused`，复用既有暂缓 UI（「先聊聊，暂不邀请看题」＋「我想开始看题」主动入口）；刷新保留，学生主动开始看题后恢复邀请，S1-02 语义不变。
- **交付新发现（打包脚本缺陷，不占审查编号）**：`scripts/build-offline.mjs` 用字符串作为 `String.replace` 的替换串，JS 产物中的 `$&`、`$$` 等序列会被解释为替换模式。旧队友包的单文件版因此一直带有自洽损坏（30 处 `$$typeof`→`$typeof`，碰巧可运行）；本次重建后压缩器把 `$&` 排到代码位置，`<script>` 标签被插入代码导致白屏。已改为函数替换，内联产物与 dist 现在**逐字符一致**。旧包的隐患一并消除。

## 修改范围

- [data.ts](../outputs/xiaon/src/data.ts)：删除一处字符串预筛（-1 行）。
- [App.tsx](../outputs/xiaon/src/App.tsx)：pushState/popstate 两处与休息返回入口一处。
- [domain.test.ts](../outputs/xiaon/src/domain.test.ts)：新增 2 项回归（等价写法判对且错误仍判错；等价写法首次独立完成不退化为「需要继续观察」）。
- [scripts/build-offline.mjs](../outputs/xiaon/scripts/build-offline.mjs)：两处替换改为函数形式。
- [README.md](../outputs/xiaon/README.md)：等价写法说明、返回恢复上一题、休息返回暂缓邀请、测试数 17→22。

完整 [changes.diff](changes.diff)；修改前备份在本目录 `before/`。原审查与阶段1修复资料未改动。

## 实际验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 新增回归先行失败 | 22 项中 2 项失败（等价写法误判） | evidence/unit-before.log |
| 最终单元测试 | 22/22 通过 | evidence/unit-final.log |
| TypeScript 与生产构建 | 通过 | evidence/build-final.log |
| 浏览器全套（含无障碍与单文件分享） | 18/18 通过 | evidence/browser-suite-final2.log |
| 错误答案/矛盾等式仍判错（浏览器实作） | x−5 → 「先停在这一步」 | evidence/01-hinted-completion-intact |
| 提示后完成流程不受影响 | 提示后 x+5 → 「你在提示后完成了这一步」 | evidence/01 |
| S2-01 新题 `4*a+2` | 「这次，你独立完成了。」 | evidence/02-equivalent-accepted |
| S2-01 报告层 | 计算维度「本次独立完成」，展开依据含「首次：4*a+2 · 正确」 | evidence/04-report-independent |
| S2-02 返回恢复 | 补充题按返回 → 恢复进入的题且「1 次尝试」保留 | evidence/03a/03b |
| S2-03 休息返回 | 邀请条与「我愿意试试」消失，显示暂缓说明与主动入口 | evidence/05 |
| S2-03 刷新保留 | 重载后暂缓状态仍在 | evidence/06 |
| S2-03 主动恢复 | 「我想开始看题」仍能进入任务 | verify-fixes-results.json |
| 单文件版含修复 | `/offline.html` 上 `4*a+2` 判对、无页面错误 | evidence/07-offline-equivalent-accepted |
| 单文件内联完整性 | 内联 JS 与 dist 产物逐字符一致（含全部 `$$`） | 本轮 python 比对 |
| 分享包 | ZIP 重新生成，`public/team/` 下载副本同步 | evidence/fix-delivery.json |

本轮浏览器为 Playwright chromium 1248 无头桌面引擎手机视口（390×844），验证服务用独立端口 5179/5173 静态文件，测试进程各自独立浏览器上下文，未触碰用户浏览器中的演示进度。真机软键盘、系统字号与屏幕阅读器仍未验证。

## 交付入口

- 当前源码：`outputs/xiaon/`（5173 开发服务运行中，直接刷新即可体验修复）。
- [队友体验包](../outputs/学伴小N-队友体验包.zip)：已用修复后的单文件版重新打包（19:04）。
- [阶段2修复源码包](../outputs/学伴小N-阶段2修复源码.zip)：24 个文件，供继续开发。
- 哈希清单：[fix-delivery.json](evidence/fix-delivery.json)。`outputs/DELIVERY.json` 与阶段1的 `fix-delivery.json` 保持历史原样。

## 遗留与边界

- 阶段2结论仍以独立复验为准：建议由另一会话按报告第 5 节验收方法复跑 math-probe（应 9/9 PASS）与三问题定向链路后，将阶段2改判为通过。
- 打包脚本缺陷说明旧队友包（17:02 版）虽可运行但内联产物长期被 `$` 替换破坏；新包已根治，旧包已被替换，不再分发。
- 其余未验证范围（真机、读屏、真实后台）与[阶段2审查报告](../audit-stage2-20261020/REPORT.md)第 6 节一致。
