# 阶段1两项P2修复交付

日期：2026-10-20。用户本轮已授权修复。仅修复原审查S1-01、S1-02及相关回归，不进入后续阶段功能开发。

## 结果与证据等级

两项均已修改并完成**修复者自验**。不是新的独立审查，不覆盖原审查记录，也不宣布其他阶段通过。

- S1-01：地点名普通字号14.1px、状态12px；大字体18px、15.12px。地图保留地图/列表两入口，增加竖向空间，并明确宽度避免宽高比导致横向撑开。
- S1-02：点击“现在先不看”后，当前聊天暂停看题邀请与“我愿意试试”快捷项，显示接受选择的说明，保留“我想开始看题”的主动入口。后续本地回复也不再邀请。该状态随本机进度保存，刷新和往返页面不会清除；学生主动确认进入任务后恢复邀请。休息仍优先。
- 明确输入“不想看题 / 不想做题 / 不想探索 / 只想聊聊”等示例表达也进入暂缓状态。它只是本地规则，不宣称理解任意否定表达或已经接入模型。
- 旧进度不含新增字段时默认正常进入，已有作答、提示和草稿不清空。

## 修改范围

产品源码仅涉及：
- [App.tsx](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/App.tsx)：拒绝按钮、提示及快捷项、后续回复状态。
- [domain.ts](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/domain.ts)：持久化选择、示例文字拒绝、主动重启与本地回复。
- [style.css](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/style.css)：地图关键文字字号与布局约束。
- [domain.test.ts](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/src/domain.test.ts)：新增3项有意义的状态/兼容回归。
- [README.md](/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/README.md)：说明选择范围、示例规则和地图阅读。

完整[修改diff](/Users/ami/Documents/个人/ACC黑客松/fixes-stage1-20261020/changes.diff)及修改前备份在本目录，原审查资料保留不改写。

## 实际验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 先添加邀请状态回归，保留修复前失败 | 新增3项失败，原17项通过 | evidence/unit-before.log |
| 最终规则测试 | 20/20通过 | evidence/unit-final.log |
| TypeScript与生产构建 | 通过 | evidence/build-final.log |
| 320/390/430px普通地图 | 地点14.1px、状态12px，scrollWidth等于视口，节点均在地图内且不相交 | evidence/map-normal-checks.json |
| 320/390/430px大字体地图 | 地点18px、状态15.12px，无横向溢出、节点越界或节点重叠 | evidence/map-large-checks.json；05、06截图 |
| 地图原有列表入口 | 实际点击可用，暂停/完成等已有状态仍显示 | 07截图及txt |
| 点击“现在先不看” | 邀请和同义快捷项消失，保留主动重启入口 | 01、02的DOM及09完整截图 |
| 拒绝后的普通回复 | 本地回复继续倾听，没有再次邀请看题 | 01的DOM及09截图 |
| 拒绝后刷新 | 状态和新入口仍在 | 02的DOM；最终单文件版也重新加载核查 |
| 主动重新开始 | 确认后进入原任务，原草稿、提示、2次作答仍在 | 本轮实际浏览器操作；新增规则回归也核对草稿及计题不变 |
| 文字“我只想聊聊” | 主动重启后再次输入，立即暂停邀请，后续回复不邀请 | 09截图及DOM |
| 拒绝后休息 | 今日页显示任务暂停；最终单文件版输入“今天先休息”检查本地回复 | 08、10及txt；规则测试 |
| 更新后的单文件版HTTP检查 | 能加载，页面无外部script或stylesheet引用，具有暂缓状态 | evidence/offline-check.json及09、10 |
| 分享包内容 | ZIP内HTML与最新单文件逐字节一致 | evidence/fix-delivery.json及打包核对 |

本轮浏览器均为Codex内置浏览器的桌面引擎手机视口，不是实体手机。沿用原审查的5178端口虚构演示状态，不触碰原5173端口的浏览器进度。没有运行原18条浏览器全套用例，本轮只做上述定向复验。

## 失败保留与限制

首次放大地图只设置最小高度时，宽高比反向撑宽地图：320px视口的scrollWidth达到489。已增加width:100%约束并重新检查全部6种尺寸/字号组合；首次失败保留在03截图、map-first-failure.json与说明中。

04截图发生在连续改变尺寸后的绘制过渡中，不作为稳定视觉验收；以05、06稳定截图和相应DOM测量为准。02刷新后截图停在长聊天中部，因此用其DOM核对状态，不单凭图片推断下方入口缺失。09为完整长页截图，固定底栏在长图中的位置不代表真实窗口遮挡。

真实iOS/Android软键盘、系统字号、屏幕阅读器和减少动效运行验证仍未完成；file://直接双击模式本轮仍未实测。没有真实学生试用、教学效果或合规认证结论。

## 交付入口

- 当前可编辑源码：`outputs/xiaon/`。
- 当前队友包：[学伴小N-队友体验包.zip](/Users/ami/Documents/个人/ACC黑客松/outputs/学伴小N-队友体验包.zip)，解压后使用其中的HTML；单文件页与开发/生产分享下载均已同步。
- 旧HTML、旧队友ZIP已备份在本目录before/outputs/；原`xiaon-prototype.zip`及`xiaon-prototype/`保留为修复前历史交付，不冒充新版。
- 新增[阶段1修复源码包](/Users/ami/Documents/个人/ACC黑客松/outputs/学伴小N-阶段1修复源码.zip)用于继续开发，包含最新源码，排除依赖和生成目录。
- 新版哈希、范围与验证级别：[fix-delivery.json](/Users/ami/Documents/个人/ACC黑客松/fixes-stage1-20261020/evidence/fix-delivery.json)。原outputs/DELIVERY.json保持历史原始清单，不作为修复版哈希清单。

![320px大字体地图修复](/Users/ami/Documents/个人/ACC黑客松/fixes-stage1-20261020/evidence/06-map-320-large-scrolled.png)

