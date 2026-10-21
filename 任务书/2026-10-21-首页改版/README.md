# 首页改版：三路并行怎么启动

按产品海报《心事有人听，进步有人记》和团队后续定下的「综合模式 / 专业模式」改版，分给 Claude、ChatGPT、zCode 三个开发工具并行完成。优先级：首页综合模式 → 专业模式 → 拍照识题与出题。题库扩充本轮暂缓。

| 文件 | 给谁 |
| --- | --- |
| [00-总控与共同约束](00-总控与共同约束.md) | 三路都读：决定、分工、分支、文件所有权、测试约束 |
| [01-Claude-契约冻结与一起思考进步卡](01-Claude-契约冻结与一起思考进步卡.md) | Claude |
| [02-ChatGPT-首页陪聊与记忆](02-ChatGPT-首页陪聊与记忆.md) | ChatGPT（首页综合模式界面、专业模式界面、出题审核） |
| [03-zCode-错题记录与拍照识题](03-zCode-错题记录与拍照识题.md) | zCode（错题记录、记忆、周月规划、拍照识题） |
| [04-集成与验收](04-集成与验收.md) | Claude（每期集成时） |

## 每一路做什么

| 阶段 | Claude | ChatGPT | zCode |
| --- | --- | --- | --- |
| 阶段 0 | 契约冻结与骨架 | 读代码、列测试用例 | 读代码、列测试用例；可选：视觉模型冒烟测试 |
| 第一期：综合模式 | 对话观察与小结后端；一起思考与进步卡 | 首页综合模式界面、模式切换、小结界面、首次介绍与隐私说明 | 口述卡点与错题记录；记忆与开场问候 |
| 第二期：专业模式 | 契约补丁；面试引擎 | 面试式界面、评测报告页、成长档案 | 月阶段目标、周任务、复测提醒、长期趋势 |
| 第三期：拍照与出题 | 集成准备、回归、PRD 同步草案 | 模型出题与审核 | 拍照识题与隐私遮挡 |

每期结束由 Claude 集成。

## 启动顺序

1. **现在**：Claude 开始阶段 0；ChatGPT 和 zCode 读代码、列测试用例。
2. **阶段 0 完成后**：用户确认，把 `revamp/g0-contracts` 合入 main 并打 tag `revamp-base`。
3. **第一期**：三路各自从 `revamp-base` 建 worktree 并行开发；完成后 Claude 集成，用户确认后打 tag `revamp-phase1`。
4. **第二期**：Claude 先做契约补丁，用户确认后打 tag `revamp-base2`；三路并行，再集成，打 tag `revamp-phase2`。
5. **第三期**：三路并行，再集成，打 tag `revamp-phase3`。

## 启动句

把下面对应的一段发给各工具。任务书里有完整要求，工具必须实际读文件，不能只凭启动句动手。

### Claude

请完整阅读 `/Users/ami/Documents/个人/ACC黑客松/任务书/2026-10-21-首页改版/00-总控与共同约束.md` 和 `01-Claude-契约冻结与一起思考进步卡.md`，先执行阶段 0：在 `revamp/g0-contracts` 分支的独立 worktree 里完成契约冻结与骨架，测试通过后写 `交付/claude/CONTRACT.md`，然后停下等我确认合入 main。

### ChatGPT

请完整阅读 `/Users/ami/Documents/个人/ACC黑客松/任务书/2026-10-21-首页改版/00-总控与共同约束.md` 和 `02-ChatGPT-首页陪聊与记忆.md`。在 tag `revamp-base` 出现前，只阅读代码、列出本路测试用例，不改代码。`revamp-base` 出现后，读 `交付/claude/CONTRACT.md`，在 `revamp/h-home-memory` 分支的独立 worktree 里执行第一期，只改任务书分给你的文件，完成后写 HANDOFF 并停下。

### zCode

请完整阅读 `/Users/ami/Documents/个人/ACC黑客松/任务书/2026-10-21-首页改版/00-总控与共同约束.md` 和 `03-zCode-错题记录与拍照识题.md`。在 tag `revamp-base` 出现前，只阅读代码、列出本路测试用例（可选：做视觉模型冒烟测试，只新增 `scripts/agent/vision-smoke.ts`）。`revamp-base` 出现后，读 `交付/claude/CONTRACT.md`，在 `revamp/i-problem-vision` 分支的独立 worktree 里执行第一期（口述卡点与错题记录、记忆与开场问候），只改任务书分给你的文件，完成后写 HANDOFF 并停下。

## 需要用户自己做的事

- 阶段 0 和每期集成后，确认是否合入 main、打 tag。
- 需要真实模型时，自己把 `outputs/xiaon/.env.server` 复制到各 worktree 的同一位置（Key 不要贴进任何聊天）。
- 如果 ChatGPT 或 zCode 只能在云端通过 GitHub 工作，把 `revamp-base` 和该路分支推到 GitHub。
- 收到某一路的 `CONTRACT-REQUEST.md` 时，转给 Claude 处理。
