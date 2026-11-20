# 学伴小N（ACC 黑客松）

面向中小学生的语音学习陪伴应用。支持首页语音自由聊、个人学习档案、专业模式结构化测评与智能体辅导、记忆治理以及「星溪镇」学习小游戏联动。

> **项目入口提示**：应用的前后端源码全部位于 [`outputs/xiaon/`](outputs/xiaon/)，仓库根目录主要存放产品/工程文档、硬件外壳模型与黑客松历史交付材料。

---

## 核心能力与技术栈

| 模块 | 说明 |
|---|---|
| **前端** | React + TypeScript + Vite（手机端竖屏体验，桌面浏览器建议切至移动端视口） |
| **后端** | Node.js（`tsx` 直接运行 `.ts` 源码，无需预编译）+ SQLite（按账号隔离） |
| **模型与语音** | 对话/辅导大脑：智谱 GLM（`/api/coding/paas/v4`）；语音识别与合成：豆包 ASR / TTS |
| **主要功能** | 手机号 + 密码登录 · 首页语音自由聊与个人档案 · 专业模式（题库、受控出题与 `record_stuck_point` / `select_task` / `get_hint` / `grade_attempt` 工具链） · `fc_epoch` 双代次记忆治理 · 专业模式接入「星溪镇」网页小游戏（评价摘要写入档案） |

---

## 本地快速启动

前置要求：Node.js ≥ 22.13。

```sh
cd outputs/xiaon
npm ci
cp .env.example .env.server   # 按需填入 GLM / 豆包密钥（.env.server 已被忽略，绝不进 git）
npm run dev:learning          # 默认访问 http://127.0.0.1:5194，以终端输出为准
```

> 未配置模型 Key 时仍可运行离线规则与本地基础流程；详细运行、测试与打包命令见 [`outputs/xiaon/README.md`](outputs/xiaon/README.md)。

---

## 线上状态

当前演示服务运行于 2026-11-20 重建的阿里云香港 ECS 实例，公网入口通过 Cloudflare 临时隧道暴露（重启后 URL 会变化）；最新服务器信息、隧道地址查询方式与更新流程见 [`文档/交接/2026-11-20-新服务器部署信息.md`](文档/交接/2026-11-20-新服务器部署信息.md)，通用部署说明见 [`outputs/xiaon/DEPLOY.md`](outputs/xiaon/DEPLOY.md)。

---

## 仓库目录地图

| 路径 | 内容说明 |
|---|---|
| [`outputs/xiaon/`](outputs/xiaon/README.md) | **应用源码主目录**（前端、后端、SQLite 存储、测试与 Docker 部署文件） |
| [`文档/`](文档/) | 产品方案、工程审查与规划、架构设计、测试集、研究报告、宣传稿/PPT 与运维交接文档 |
| [`文档/交接/2026-11-20-新服务器部署信息.md`](文档/交接/2026-11-20-新服务器部署信息.md) | 最新线上服务器环境与维护交接文档 |
| [`MEMORY-DESIGN-GUIDE.md`](MEMORY-DESIGN-GUIDE.md) | 小N 记忆系统设计指南 |
| [`hardware/xiaon_round_shell/`](hardware/xiaon_round_shell/README.md) | 语音陪伴终端（M5Stack CoreS3）第一版 3D 打印圆形外壳模型与打印指南 |
| [`队友上手指南.md`](队友上手指南.md) | 早期纯前端原型阶段的队友快速体验说明（参考存档，当前运行方式以 [`outputs/xiaon/README.md`](outputs/xiaon/README.md) 为准） |
| [`任务书/`](任务书/) | 黑客松各阶段任务书与历史交付材料 |
| `audit-stage*/`、`fixes-stage*/` | 历史阶段独立审查报告、修复记录与原始证据（只读归档） |
