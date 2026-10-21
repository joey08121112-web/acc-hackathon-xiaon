# E1 交接：大模型受控出题

**结论：在现有应用里打通了“学习证据 → 模型给出参数候选 → 程序独立计算并校验 → 不可变发布 → 学生确认开题 → 正常的提示、判题、证据、报告、复习”。只开放去括号与合并同类项两个知识点。** 合成模型和真实 GLM 都已验证，结果分开报告。以下都是实现者自验，不是第三方验收。没有 commit、push、merge、发布或部署。

## 起点与工作区

- main @ `41dca8121ba820da3c44dabc88d7a10a81a2095c`，只有原工作区，没有 AGENTS.md。
- 已有的未跟踪材料（node_modules 链接、重复 ZIP、`文档/交接/`）都没有动。
- 5194/18931 端口上已有一个预览进程在运行，没有关闭；它仍是旧代码，重启后才包含本批功能。
- 所有测试都用独立端口和临时 SQLite，没有碰日常库，也没有改电脑时间。

## 学生能看到什么

1. 在去括号或合并同类项的题目页作答之后，或在成长页对应卡片、到期复习项上，点击“根据这个环节出一道新题”。题库里还有未做过的同类题时，会先提供原题。
2. 等待期间可以取消。出题结果会以下面几种状态之一呈现，不会假装成功：
   - 已发布
   - 校验未通过（列出原因，不发布任何题）
   - 失败或超时
   - 已取消
   - 达到出题上限
   - 未配置模型
3. 发布后，学生先看到这道题针对哪个环节、依据是什么、难度和预计用时，以及一句“同类换数，不代表更广泛迁移”。**确认后才展示题面并记录暴露。**
4. 之后与原题库完全同路：提示、判题、证据、报告、计划、到期复习，没有另建一套分数或复习。

## 代码地图

- `server/plugins/generation/`：模板、受限解析、校验器、prompt、限额、已发布题存储、TaskGenerator。
- 统一题目目录：`AssessmentCatalog(generated)`，生成题来自 SQLite 中的 `generations` 和 `tasks`。
- 学生事件：`LearningCoordinator.generateTask`，对应 `POST /api/learning/generate-task`。请求只允许四个字段：知识点（二选一）、用途、复习项、时间预算。
- Generator 角色：`ControlledRoles.generate`，不调用工具，最多 2 轮，有超时，授权变化时取消，并写入运行轨迹。
- 前端：`src/learning/generation/GenerationPanel.tsx`，挂在 `LearningPages.tsx` 的三处入口。

规则细节见 [GENERATION-RULES.md](GENERATION-RULES.md)；协议、迁移和改动文件见 [CHANGES.md](CHANGES.md)；验收、首次失败和未运行项见 [ACCEPTANCE.md](ACCEPTANCE.md)。prompt 与模板版本见 `prompt-and-templates.json`；哈希见 `source-hashes.json`，diff 见 `source.diff`。

## 运行与测试

```sh
cd '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon'
XIAON_DB_PATH=.local/my-synthetic-trial.sqlite XIAON_API_PORT=18935 XIAON_UI_PORT=5195 npm run dev:learning
npm run test:agent            # A–E 101 项
npm run test:agent:e:browser  # 5197/18938，临时库，模拟模型
npm run test:agent:e:real     # 真实 GLM，合成材料；无 Key 时退出 2
```

## 去敏样例

- 合成：`evidence/browser/mainline-chain.json`，含 GenerationRecord、尝试分类、复习项和 Generator 运行记录。
- 真实：`evidence/real-generation.json`。

## 截图

`evidence/browser/` 下：

- `01-generated-before-confirm.png`：已发布、尚未展示题面。
- `02-generated-graded.png`：看提示后答对。
- `03-review-generated.png`：到期复习时出的新题。
- `04-review-advanced.png`：复习阶段推进。
- `05-cancelled.png`：取消出题。

## 边界

- 只做 E 批：首页交互、语音、TTS、探索地图、题库后台、账号、部署都没有改。
- 真实模型只观察到“第一轮就通过”这一种情况；生成题的教学质量和难度是否合适，都没有经过真实学生验证。
- 单用户本机数据库，没有应用层加密。
- 候选题列表上限 100 道，没有分页。

交付后停止，不继续实施语音首页。
