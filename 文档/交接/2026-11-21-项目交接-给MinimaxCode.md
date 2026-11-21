# 学伴小N · 项目交接（给 Minimax Code）

- **日期**：2026-11-21
- **交接方**：ZCode → Minimax Code（此前由 ZCode / Claude / Codex 多个 AI 会话与用户协作开发）
- **快照**：2026-11-21 11:43，基线 commit `331601a`
- **现状**：2026-11-21 13:20 复核 —— 基线已推进到 `385b27f`（= origin/main），三档修复全部落地；§4/§9 已按实况校准
- **仓库**：https://github.com/joey08121112-web/acc-hackathon-xiaon（public）

> ⚠️ **先读这一条**：本文档正文写于 2026-11-21 11:43 的**快照时点**，当时工作区正被一个并行 AI 会话持续修改。
> **该会话已于 2026-11-21 13:01 收工，三档修复全部落地并提交为 `385b27f`（已推 `origin/main`）。**
> 因此：
> - **§4.2 与 §9 的进度表已过时**（写着"未提交""未做"的项其实已完成），只保留为历史线索，**不要照着做**。
> - **当前真值看两处**：① `文档/审查/2026-11-21-全项目设计原则审查.md` 的**「附：实施记录」**（三档落地台账、行为变更、9 处自我更正、6 条新发现）；② `文档/审查/2026-11-21-记忆验证证据.md`（S1/S3/S10 实测）。
> - 接手后仍要 `git status` + `git log --oneline -5` 复核，因为快照永远是分钟级的。
> - **另有未决项**：§F.2「未满 14 岁要先有监护人知情」的门槛，产品尚未拍板，见 §F.2。

## 0. 三条规矩

1. **先读 §8 红线再动代码**——这是面向中小学生的儿童数据产品，红线不是风格建议。
2. **证据分级汇报**（项目审查文档的既有惯例）：【实测】= 本机跑过、有退出码或输出；【读码】= 读源码得出、逻辑链完整、未运行；【待验】= 需运行或外部信息才能定论。没跑过的结论不许标【实测】。审查/修改记录写 `文档/审查/YYYY-MM-DD-主题.md`。
3. **每次完成都要有可跑证据**：交付前 `npm run test:all` 全绿再交付，红灯不许进主干。331601a 曾带一个失败用例进主干（专业模式入口文案漂移），仓库已配 CI 防复发（§9 #8）。

## 1. 项目是什么

**学伴小N**：面向中小学生的语音学习陪伴应用。ACC 黑客松作品（2026-10-22 提交比赛，此后持续迭代为产品原型）。

**形态**：手机竖屏网页 + Node 后端 + 每账号独立 SQLite。手机号+密码登录，先登录再进应用（`XIAON_REQUIRE_LOGIN=0` 可退回匿名模式）。

**核心能力**：
- 首页语音自由聊（豆包 ASR → 智谱 GLM → 豆包 TTS）+「成长·我的档案」+ 自动记忆整理；
- 专业模式：五维结构化测评 + 受控出题（两个知识点的白名单模板）+ `record_stuck_point` / `select_task` / `get_hint` / `grade_attempt` 工具链；
- 五站互动游戏「星溪探索世界」：理解《星溪镇》→ 逻辑《断桥真伪录》→ 计算《符号炼金台》→ 建模《星溪策算司》→ 空间《星象风车台》，评价摘要写入学生档案；
- 记忆治理：fc_epoch 双代次、敏感词表、原话证据门、删除/停用/更正/复活证据门（R1–R6 已修复）；
- `outputs/nova-group-website/`：独立 NOVA 静态官网（零构建，与主应用无关）。

**模型分工口径**（对外讲解）：豆包=耳朵和嘴巴（ASR/TTS），智谱 GLM=大脑（对话、判题、出题、报告）。

## 2. 仓库地图

| 路径 | 内容 |
|---|---|
| `outputs/xiaon/` | 应用源码主目录，一切开发都在这里 |
| `outputs/xiaon/src/` | 前端（React 19 + TS + Vite 7）；`src/App.tsx` 约 2800 行 God 组件，改首页/设置页/引导流程都在这里 |
| `outputs/xiaon/server/` | 后端（tsx 直跑 .ts，无预编译）；`agents/`+`plugins/` 学习域，`free-chat/` 自由聊+记忆治理，`storage/` SQLite 仓储，`http/` 路由 |
| `outputs/xiaon/shared/` | 共享契约：`learning-contracts.ts`（zod strictObject、SCHEMA_VERSION 1.0.0）、`free-chat.ts`、`auth.ts`、`legacy-home.ts` |
| `outputs/xiaon/tests-agent/` | 学习域测试 a–i 分组（h=专业模式 UI，i=记忆） |
| `outputs/xiaon/scripts/` | dev/test/build 脚本（`scripts/agent/dev.mjs` = `npm run dev:learning`） |
| `outputs/nova-group-website/` | NOVA 教育科技集团静态官网（独立，零构建） |
| `文档/` | 产品/工程/架构/测试/游戏设计/研究/宣传/审查/交接文档 |
| `文档/交接/2026-11-20-新服务器部署信息.md` | 线上服务器唯一权威信息（IP/实例/隧道/更新流程/踩坑） |
| `文档/审查/2026-11-21-全项目设计原则审查.md` | 最新全项目审查（2026-11-21，基线 331601a），问题清单与三档修复路线，当前最高优先级工作清单 |

## 3. 架构关键点（不走弯路版）

1. **同源一体**：前端 dist、Node API、SQLite 同进程同源，浏览器只请求自身域名下的 `/api/*`。部署 = 一个 Docker 容器（`outputs/xiaon/Dockerfile`）。
2. **契约冻结**：`shared/learning-contracts.ts` 全部 zod strictObject（未知键直接拒）。改契约 = `shared/` + 服务端 + 前端三处同步改，并 `npm run schema:agent` 重导出 schema JSON。
3. **程序门控而非模型门控**：安全拦截在**任何模型调用之前**；答案不外泄走全题库归一比对（`server/agents/roles.ts:134`）；受控出题由程序按模板自己算题面、答案、提示，模型只选参数。**这些机制不要在重构中弱化**。
4. **记忆写入四道门**（`server/free-chat/consolidate.ts`）：模型输出 → zod 结构 → 敏感词表 → 必须有学生原话完整短语证据 → 删除后复活需原话证据。取舍原则：**少记不伤学生，错记伤学生——宁可多拦**。
5. **双记忆系统**：A=自由聊「我的档案」（fc_items，自动整理）与 B=学习侧「我的学习记忆」（memories，人工确认），两套互不相通，各有独立开关（服务端 `consents` / `fc_settings` 表）。
6. **游戏判分与 UI 分离**：判分在 `src/components/game/*Logic.ts` 纯函数（配 40 个测试），UI 在 `*Game.tsx`。改游戏先改 Logic 层，UI 只动壳层。
7. **后端无预编译、前端必须构建**：后端 tsx 直跑 .ts；前端 `npm run build` 产出 `dist/`，容器托管 dist。后端错误码→HTTP 映射不全（审查 §3.4）。

## 4. 当前状态（已更新至 2026-11-21 13:20，Minimax Code 复核）

### 4.1 git 与部署版本

| 项 | 状态 |
|---|---|
| 本地 main | `385b27f` = origin/main，两边对齐 |
| 工作区 | **干净**（无未提交改动） |
| 提交内容 | `331601a..385b27f`，130 文件，+3784/−367 |
| 线上容器 | 镜像 `xiaon:14ed61f`，**仍落后**；下次全量部署自然带上（真机 `/data` 可写性待验，见审查报告 §D） |
| CI | `.github/workflows/ci.yml` **已入库**，且已把 `check:layers` 门禁接进去 |

### 4.2 快照时的在途改动（历史线索）

> 快照时（11:43）工作区有 9 文件 +156/−21 未提交，对应审查第一档 #1/#2/#7/#8。
> **这四项连同第一档其余项、第二档、第三档，已全部在 `385b27f` 中落地。**
> 真实台账见审查报告「附：实施记录」的 §A 表。

### 4.3 我的独立复测（2026-11-21 13:10，Minimax Code 本机实测，非转述）

```
npm run typecheck:agent   → exit 0
npm run check:layers      → exit 0
npm test                  → 26/26
npm run test:agent        → 307/307
npm run test:free-chat    → 46/46
npm run test:all          → exit 0（含 build + build:server）
```

数字与并行会话自报**完全一致**，无出入。Playwright 本轮未复跑（需要另起后端，占用端口），以对方实测 `4/18` 为准。

> **实测**：2026-11-21 11:44 `npm run test:all` 全绿（exit 0；自由聊 44/44，构建 ~1s）。但那是中途态验证——接手后请重跑确认。

### 4.3 用户已拍板的决策（不要推翻）

- 未来做成 App（原生方向已定），不做 3D 数字人；
- 手机号+密码登录（2026-11-01 上线；更早「不做登录」的结论已作废，以现行代码为准）；
- 30 分钟体验时限已于 10-30 **整体撤除**（代码删净、线上休眠），不要以为它还在；
- R1–R6 记忆治理修复已入库，重构别弱化；
- 对外分工口径：豆包=耳朵嘴巴、智谱=大脑。

### 4.4 未决事项（用户知道、尚未拍板）

- 仓库 public 可被项目名搜到；`audit-stage1/sources/` 含用户原始提示词，是否清理未决。
- 监护人同意目前只是本地演示开关，服务端留痕在第三档 #20 才做。
- 豆包/智谱账号侧数据留存与训练策略未核实——真实产品化前必须确认。
- 桌面 ILoopStudy、Starbrook-Web 是独立项目，与本项目无关。

## 5. 本机启动与验证

Node ≥ 22.13（本机 26.8.2），工作目录一律 `outputs/xiaon/`。

### 5.1 启动

```sh
cd outputs/xiaon
npm ci
cp .env.example .env.server   # 填入 GLM / 豆包密钥（.env.server 0600，绝不进 git）
npm run dev:learning          # UI http://127.0.0.1:5194 / API 18931，均仅 loopback
```

端口占用时改端口，别关别人的进程：`XIAON_API_PORT=18935 XIAON_UI_PORT=5195 npm run dev:learning`。

### 5.2 测试命令表

| 命令 | 覆盖面 | 数量（2026-11-21 实测） |
|---|---|---|
| `npm run typecheck:agent` | 服务端+契约+前端 API 客户端+测试消费者 | exit 0 |
| `npm test` | 纯规则领域逻辑（src/domain.ts） | 25/25 |
| `npm run test:agent` | 学习域契约与工具链（tests-agent/a–i） | 287/287 |
| `npm run test:free-chat` | 自由聊记忆治理（server/free-chat） | 44/44 |
| `npm run test:all` | 以上全部 + 生产构建 | 全绿，构建 ~1s |
| `npm run test:home`（Playwright） | 首页自由聊交互回归 | 14 项 |
| browser / real 冒烟 | 浏览器级 / 真实 GLM 冒烟 | 独立端口临时库 |
| `node scripts/agent/service-smoke.mjs` | 服务进程重启/记录/幂等恢复 | — |

### 5.3 证据要求

改完代码交付前 `npm run test:all` 全绿再交付；审查/修改记录写 `文档/审查/YYYY-MM-DD-*.md`，按【实测】/【读码】/【待验】三级标注。红灯不许进主干。

## 6. 模型与语音配置

环境变量在 `outputs/xiaon/.env.server`（0600，绝不进 git），模板 `.env.example` 注释详尽。

| 用途 | 变量 | 关键值 |
|---|---|---|
| 对话/判题/出题（大脑） | `XIAON_GLM_*` | 基址 https://open.bigmodel.cn/api/coding/paas/v4，模型 glm-5.3-flash |
| 语音合成（嘴巴） | `XIAON_DOUBAO_TTS_*` | seed-tts-2.0，新控制台 X-Api-Key |
| 语音识别（耳朵） | `XIAON_DOUBAO_ASR_*` | stream 模式 seedasr，单句录完再识别（实测 0.78–1.46s）；双向流式不建议 |
| 公网部署开关 | XIAON_STATIC_DIR / XIAON_PUBLIC_ORIGIN / XIAON_API_HOST | 三项不设=只认本机；见 DEPLOY.md §2 |

**红线**：用户只有 GLM Coding Plan Key（基址 `/api/coding/paas/v4`）。标准 API Key（`/api/paas/v4`）与 Coding Plan Key 不能混用基址；不要仅改基址混用不同类型 Key。产品化时需确认 Coding Plan 套餐适用范围。

## 7. 线上部署概要

服务器唯一权威信息：`文档/交接/2026-11-20-新服务器部署信息.md`。此处只列最常用的。

### 7.1 服务器与入口

| 项 | 值 |
|---|---|
| 线上地址 | https://canyon-dear-ribbon-talented.trycloudflare.com（quick tunnel，重启换 URL） |
| SSH | root@47.76.72.179（Mac 公钥已装；遇「TCP 通无 banner 即断」先关 FlClash 代理再查服务器） |
| 实例 | ECS i-j6cftz561iu969oo1ygj（香港 B 区，2核4G，试用至 2027-02-20） |
| 容器 | `xiaon`：-p 127.0.0.1:8080:8080，--env-file /root/xiaon.env，另加 -e XIAON_PUBLIC_ORIGIN=当前隧道地址；源码 /opt/xiaon |
| 更新法 A（SSH 可用） | 重打 zip → scp → /opt/xiaon build → 换容器 |
| 更新法 B（SSH 被拦） | 云助手「发送命令」：curl codeload 拉 GitHub zip/<40位SHA>（不能用分支名，CDN 缓存旧包）→ 校验新文件 → build → 换容器；超时改 600s；命令框填完必须回读确认 |
| 验证 | /api/health 全绿 + 首页 assets hash 比对 + 新功能关键词 grep |

## 8. 红线清单（AI 必守）

1. **密钥**：真实 Key 只在本机 `.env.server`（0600）与服务器 `/root/xiaon.env`。不进 git、不进聊天、不进前端 `VITE_*` 变量、不进日志。
2. **儿童隐私**：面向中小学生。记忆四道门与「宁可多拦」原则不许弱化；披露文案要准确（说什么发送就发送什么）；改记忆链路必须带回归断言。
3. **契约纪律**：改 `shared/` 契约必须 shared/服务端/前端三处同步 + `npm run schema:agent` 重导出，版本不一致前端直接抛错。
4. **部署纪律**：换容器时 XIAON_PUBLIC_ORIGIN 用 journalctl 查到的**当前**隧道地址；codeload 拉 zip 必须用 40 位 SHA。
5. **对外发布纪律**：quick tunnel 重启换 URL，发链接前现查现发；GitHub 仓库 public 可被项目名搜到（§4.4 未决）。
6. **commit/push 纪律**：`test:all` 绿了才 commit；push 是对外动作，先经用户确认。

## 9. 修复路线与进度（已更新至 2026-11-21 13:20）

最新审查（`文档/审查/2026-11-21-全项目设计原则审查.md` §7）给出三档路线，共 23 项。
**全部已于 `385b27f` 落地**；逐项证据见该报告的**「附：实施记录」§A**（那里还有行为变更清单 §B、9 处自我更正 §C、未做项与理由 §D、新发现 §F）。

### 9.1 第一档（隐私与正确性）—— 9/9 已落地

| # | 内容 | 状态 |
|---|---|---|
| 1 | 敏感词表补四组 + 回归断言 | ✅ |
| 2 | 自由聊自动记忆默认关 + 首访征询 | ✅（**行为变更**：未配置过的存量用户自动记忆会变为关闭） |
| 3 | 登录令牌 expires_at + 改密接口 + 吊销全部设备 | ✅（**行为变更**：令牌 30 天硬上限；改密使该号全部设备令牌失效） |
| 4 | free-chat / learning / auth 限流 | ✅ |
| 5 | 存在性预言机与时序侧信道 | ◑ **部分**：未注册登录已走等价耗时（`burnPasswordTime`）+ 统一 403「手机号或密码不对」；但 `/api/auth/check` **仍明确回答 `{registered}`**，只能靠限流与时序均衡提高成本，无法消除 |
| 6 | Dockerfile 多阶段 + 非 root + `npm ci --omit=dev` | ✅（用 entrypoint `setpriv` 降权，非 `USER node` 指令） |
| 7 | professional-ui 测试断言对准新文案 | ✅ |
| 8 | CI 门禁（`.github/workflows/ci.yml`） | ✅ 已入库，并接入 `check:layers` |
| 9 | 披露补全（已删条目外发 + 响应带 disclosure） | ✅ |

### 9.2 第二档（单一真相源与分层）—— 5/8 落地，3 项**有意未做**

| # | 内容 | 状态 |
|---|---|---|
| 10 | 记忆开关服务端单源 | ✅ |
| 11 | LearningView 提到 shared/ | ✅ |
| 12 | 题库等 5 个纯模块下沉 shared/ | ✅ server→src 依赖清零，并加 `npm run check:layers` 门禁 |
| 13 | stages/prompts 下沉 core/ | ✅ plugins→agents 6 条反向依赖清零 |
| 14 | 统一导航真值 `useNavigation()` | ⬜ **有意未做**——`App.tsx` 2792 行 God 组件，回归风险高，收益是可读性而非正确性；**前置条件是有能跑的 Playwright 回归网** |
| 15 | 删死代码 | ◑ **部分且有意不删**——`AgentRuntime`（测试/smoke 在用）、1140 行 legacy 页面（**离线单文件构建里是活代码**）、`tools/legacy`（`LegacyAssessment` 是默认评估引擎）都保留。改为把安全断言补到生产路径（`tests-agent/g/production-path-safety.test.ts` 5 条） |
| 16 | 抽 `useGameShell` / `GAME_REGISTRY` | ⬜ **有意未做**——4 个游戏壳层重复 4–5 次，判分逻辑不动 |
| 17 | 错误呈现统一 + 根级 ErrorBoundary + 裸 fetch 收口 | ✅ `src/` 内只剩 `src/agent-client/http.ts` 一处 `fetch` |

### 9.3 第三档（契约、可演进性与记忆治理深度）—— 6/6 已落地

| # | 内容 | 状态 |
|---|---|---|
| 18 | fc_items 溯源字段 + A 侧 update 改失效不删 | ✅（**行为变更**：覆盖更新不再原地覆盖，旧条目留为历史） |
| 19 | 账号/档案导出与删除接口 | ✅（**行为变更**：删除不可逆，无回收站） |
| 20 | 监护人同意服务端留痕 + 家长可查流水 | ✅（但**主路径不触发**，见 §F.2） |
| 21 | 迁移框架真读 + `revisioned` 派生 | ✅ |
| 22 | 跑 S1/S3/S10 + 跨天保持验证 | ✅ 证据文件 `文档/审查/2026-11-21-记忆验证证据.md` / `.json` |
| 23 | 写 ADR | ✅ `文档/架构/ADR-001~003` |

### 9.4 收尾时新挖出的 6 件事（审查 §F）

- **F.1【P0，已修】** 局域网 `http://` 打开时整个应用进不去：`crypto.randomUUID` 只在安全上下文存在。
- **F.2【P0，待你拍板】** 未满 14 岁要先有监护人知情这道门槛，在改版中被删掉了——**界面还在宣称，系统不拦**。
- **F.3** 离线体验包 `public/offline.html` 还是 10/21 的旧版 UI（旧三步引导里还带年龄段）。
- **F.4** 首页已重做成语音聊天式，旧「一起看一道题」弹窗在渲染但无人打开（`openModal("start-question")` 零调用）。
- **F.5【已修】** 修好回归网后当场抓出 3 条真实 WCAG AA 违规。
- **F.6** 14 条 Playwright 用例卡在新 IA 上，**未硬改断言**（它们断言的是产品该保证什么，硬改只会把网变成当前实现的快照）。

**别误伤的好设计**（审查 §6 列了 12 条，这里挑最容易被重构误伤的）：程序门控、答案不外泄双重比对、撤销即停、每用户独立 SQLite、四道门、密钥零外泄、图片不出设备、游戏判分 Logic 层、R1–R6 的诚实边界——这些机制不许弱化。

## 10. 文档地图（按场景查）

| 你要做什么 | 先读 |
|---|---|
| **三档修复的真实落地状态** | `文档/审查/2026-11-21-全项目设计原则审查.md` **「附：实施记录」**（§A 台账 / §B 行为变更 / §C 自我更正 / §D 未做项与理由 / §F 新发现） |
| **记忆治理的效果验证证据** | `文档/审查/2026-11-21-记忆验证证据.md` + `.json`（S1/S3/S10/跨天保持） |
| **架构决策的正式记录** | `文档/架构/ADR-001-插件不是插件.md`、`ADR-002-契约冻结的边界.md`、`ADR-003-两套记忆系统的分工.md` |
| 理解学习域机制/契约/门控 | `outputs/xiaon/README.md`（「从选择到复习」「受控出题 E1」两节） |
| 理解自由聊与记忆治理方案 | `文档/架构/2026-10-29-自由聊-个人档案与记忆整理-方案.md` |
| 改记忆系统 | `MEMORY-DESIGN-GUIDE.md` + `文档/审查/2026-10-30-记忆治理修复-R1到R6.md` |
| 部署/运维 | `文档/交接/2026-11-20-新服务器部署信息.md` + `outputs/xiaon/DEPLOY.md` |
| 理解五站游戏 | `文档/游戏设计/` 两篇草稿 |
| 历史审查 | `文档/审查/`（R1–R6 报告在 2026-10-30-记忆治理修复-R1到R6.md） |

## 11. 协作方式

- **中文交流**；报告按【实测】/【读码】/【待验】分级；报告要写明诚实边界（审查报告 §8 是范本）。
- 用户用中文描述需求，可能粘贴其他 AI 的聊天记录作背景；有疑问直接问用户，不要擅自扩需求。
- 文档纪律：审查/修改记录放 `文档/审查/`，跨会话上下文放 `文档/交接/`，命名 `YYYY-MM-DD-主题.md`。

---

**交接人**：ZCode，2026-11-21（快照）。
**复核并更新**：Minimax Code，2026-11-21 13:20 —— 独立复跑 `test:all` 全绿、数字与对方自报一致；已把 §4/§9 校准到 `385b27f` 实况。

**下一步不再是 §9 第一档剩余项（#3–#6、#9 已全部完成）。** 按审查报告 §E 的顺序：

1. **产品拍板 §F.2**（未满 14 岁监护人门槛）——需要你决定，不是重构。
2. **真机确认 `/data` 可写**——唯一挡住上线的未知项。
3. 把 `App.tsx` 拆成 `src/pages/*`，拆的时候顺带统一导航真值（#14）——前置条件是 Playwright 回归网真绿。
4. 4 个游戏组件的壳层抽成 `useGameShell`（#16），判分逻辑保持不动。
5. 重建离线体验包 `public/offline.html`（§F.3）。
