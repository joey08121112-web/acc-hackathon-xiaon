# 题库覆盖矩阵与数学核对

以下全部是原创合成示例。v2核心18题=6个子技能×观察/同类新题/延迟复测各1；另有10道兼容计算补充题。题目的稳定ID/版本、主要/辅助维度、知识点、题族、难度、先修、rubric、提示、常见错误均在服务端TaskDefinition中，不写入浏览器展示标签。

| 维度 / 子技能 | 观察题ID | 同类新题ID | 延迟题ID | 参考结果（按列顺序） | 证据范围 |
| --- | --- | --- | --- | --- | --- |
| 理解 / math-language | understand | b-language-transfer | b-language-delayed | 2x−3；3a+6；2x−8 | 运算关系与条件解释，需学生表达 |
| 逻辑 / counterexample | logic | b-logic-transfer | b-logic-delayed | A；C；B | 前提成立且结论被否定，需解释 |
| 计算 / negative-brackets | bracket | transfer | b-neg-delayed | x+5；4a+2；12−3x | 负号处理的一次式结果，不据此猜心理过程 |
| 计算 / like-terms | b-like-observation | b-like-transfer | b-like-delayed | 5x−4；3a+7；3x+5 | 系数与常数合并，独立记录 |
| 建模 / fixed-variable-cost | model | b-cost-transfer | b-cost-delayed | 3x+2；5a+8；2x+12 | 一次费用与数量费用，需解释各项 |
| 空间想象 / rotation-2d | space | b-space-transfer | b-space-delayed | B；A；C | 坐标系、中心与方向明确的折线旋转识别 |

每行familyId为`family-<子技能ID>`；variantKind为observation / transfer / delayed，均为introductory。建模辅助维度为理解；其他题没有额外辅助维度，不让同一答案充当多个维度的整体测量。去括号的先修元数据为like-terms；候选接口不据元数据自行声称先修已掌握。C/D决定支持顺序，A守卫探索流程和10计算题预算。

`calc-0`至`calc-9`的v2定义沿用旧实际题面：`(i+5)x − ((i+2)x − (i+1))`，化简为`3x+i+1`；同属negative-brackets题族。只是有限简单换数补充，不计为新的核心覆盖子技能，不当广泛迁移证据。

所有16个旧ID都有v1原定义与v2新定义：understand / logic / bracket / transfer / model / space / calc-0…9。原题ID兼容不表示旧记录可自动升级到新版rubric。旧version1不会被覆盖。

## 核对方法

`tests-agent/b/catalog.test.ts`不只把答案常量再交给同一判题器：

- 数学语句独立按题意写出`2*n−3`、`3*(n+2)`、`(n−4)*2`。
- 费用独立按物品价格/小时费用/件数费用加一次费用计算。
- 计算题独立用未化简的原式，在−3、0、2、7等数值下与参考一次式比较。补充题在−5、0、3核对原式族；依据它们均为一次式，此核对不同于调用同一答案比较器自证。
- 逻辑独立核验前提和反例：−2、−3为负数且和−5非正；1、2为正且较大数平方4并非较小；3、5为奇数且和8为偶数。其他选项或前提不符，或运算/结论不对应。
- 同时检查典型错误被拒绝、所有空间错误选项被拒绝、支持等价写法接受、矛盾等号链拒绝、范围外语法待核查。

上述为开发者规则自验，非外部数学专家/测量学独立验收。

## 空间独立推导

坐标x向右、y向上。先减旋转中心c，对相对向量应用顺时针旋转，再加c。90°用`(dx,dy)→(dy,−dx)`；180°用`(−dx,−dy)`；270°用`(−dy,dx)`。

| ID | 原始有序点 | 中心 / 顺时针角度 | 推导出的对应点 | 唯一匹配 |
| --- | --- | --- | --- | --- |
| space | (0,0),(0,3),(1,3) | (0,0) / 90° | (0,0),(3,0),(3,−1) | B |
| b-space-transfer | (1,1),(3,1),(3,2) | (1,1) / 180° | (1,1),(−1,1),(−1,0) | A |
| b-space-delayed | (−1,0),(−1,2),(2,2) | (−1,0) / 270° | (−1,0),(−3,0),(−3,3) | C |

测试另外通过通用cos/sin矩阵独立计算每个点，逐项比较所有选项并要求唯一匹配；核对相邻边长在旋转前后不变。题库只保存显式坐标，没有调用同一生成旋转函数产生答案和证明。D渲染须处理SVG的y轴反向，本批未做页面渲染验证。

## 必须验收用例的落点

| B任务要求 | 测试文件 / 主要结果 |
| --- | --- |
| 参考答案、典型错误、空间独立推导 | catalog.test.ts、boundaries.test.ts |
| `4*a+2`/`4×a+2`/`+4a+2`与矛盾等式 | catalog.test.ts、boundaries.test.ts |
| 首错修改、提示完成、原题重做、新题独立分别留证 | evidence.test.ts，synthetic-scenario.json |
| 提交后提示不改过去，聊天帮助阻止独立 | evidence.test.ts |
| 同日不升级、跨可信日期升级、旧时间未知不升级 | evidence.test.ts |
| 空白、暂停不记弱；模型无引用/错引/畸形/冲突 | evidence.test.ts、model.test.ts |
| 幂等、评分修订重算、成功和后续困难并存 | evidence.test.ts、model.test.ts、boundaries.test.ts |
| 公开视图无密钥、旧ID兼容、真实A注册器消费 | catalog.test.ts、boundaries.test.ts、consumer.ts |
| 跨版本已见原题、跨午夜、同毫秒未知 | boundaries.test.ts |
| 真实临时SQLite关闭重开后的证据/快照/收据 | evidence.test.ts |

25项测试中包含多个并列输入场景，不把输入数量再报成“独立25位学生”或长期效果证据。
