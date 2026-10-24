# 学伴小N · 部署指南

> 适用对象：没有服务器经验的队友。比赛（2026-10-22 20:00 截止）走「方式 A」拿公网 HTTPS 链接，现场演示用「方式 C」兜底。

## 1. 这个应用由什么组成

从 2026-10-21 起，学伴小N 不再是纯前端页面，而是三样东西，**必须住在同一台机器、同一个域名下**：

| 组成 | 位置 | 作用 |
|---|---|---|
| 前端静态文件 | `npm run build` 产出的 `dist/` | 浏览器里跑的页面 |
| Node 后端 | `server/`，默认端口 18920 | 提供 `/api/*`，替浏览器调用智谱 GLM，密钥只在这里 |
| SQLite 数据库 | `.local/*.sqlite` | 学习记录（单个学生） |

前端只请求「自己这个网址下的 `/api/...`」，所以**页面和 API 必须同源**。开发时由 Vite 把 `/api` 转给后端；部署时让 Node 自己托管 `dist/`，一个进程搞定，不需要再配 Nginx。

| 跑法 | 命令 | 谁能访问 | 用途 |
|---|---|---|---|
| 本机开发 | `npm run dev:learning` | 只有本机 | 日常开发 |
| 现场演示 | `./demo-tunnel.sh` | 任何人（临时 HTTPS 地址） | 比赛现场、手机扫码 |
| 公网部署 | Dockerfile → Railway（主）/ 腾讯云 CloudBase（国内，需实名） | 任何人（固定 HTTPS 域名） | 提交表里的部署链接 |

## 2. 三个可选环境变量（公网部署的开关）

**三项都不设置时，服务保持"只认本机"，行为与以前完全一致。** 完整模板见 `.env.example`。

| 变量 | 作用 | 示例 |
|---|---|---|
| `XIAON_STATIC_DIR` | 让 Node 进程托管构建好的前端目录，浏览器与 `/api` 同源 | `dist` |
| `XIAON_PUBLIC_ORIGIN` | 允许的 HTTPS 公网来源（部署平台或隧道分配的域名），多个用逗号分隔。设置后 cookie 带 `Secure`、信任代理的 `X-Forwarded-Host`、`/api/health` 对平台探针免 Host 检查 | `https://xiaon.zeabur.app` |
| `XIAON_API_HOST` | 监听地址。容器里必须是 `0.0.0.0`；本机开发不要设 | `0.0.0.0` |

另外：平台注入的 `PORT` 优先于 `XIAON_API_PORT`；模型相关变量（`XIAON_GLM_API_KEY` 等）与本机一致。**真实 Key 永远只填在平台的环境变量里或本机 `.env.server`，不进 Git。**

## 3. 方式 A：Railway 免费试用部署（主路径，2026-10-21 更新）

Railway 新账号送 **30 天试用 + $5 一次性额度**，用 GitHub 登录即可，**不需要信用卡**（[$5 试用额度够这个小服务跑数周](https://docs.railway.com/pricing/free-trial)，本次比赛全程免费）。试用与付费版功能基本一致：支持 Docker 部署、公网域名、持久卷。国内直连 `*.up.railway.com` 域名 2026-10-21 实测连通正常（首次字节约 1.1 秒）。

> **必须用 GitHub 账号登录**：未通过 GitHub 验证的「受限试用」会限制出站网络，服务将连不上智谱 API，模型模式直接失效（降级为本地规则回复）。

1. 确认 GitHub 仓库 `joey08121112-web/acc-hackathon-xiaon` 已包含本次改动（`outputs/xiaon/Dockerfile` 存在即可）。
2. 打开 [railway.com](https://railway.com)，用 GitHub 账号登录，即获完整试用。
3. New Project → **Deploy from GitHub repo** → 授权并选择仓库 `acc-hackathon-xiaon`。
4. 在服务 Settings 里把 **Root Directory** 设为 `outputs/xiaon`（仓库根目录不是应用目录，这一步不能漏）。平台按 `Dockerfile` 构建，自动注入 `PORT`，代码已兼容。
5. **Variables（环境变量）**逐条添加（值从本机 `outputs/xiaon/.env.server` 复制，不要截图或粘进聊天）：

   ```
   XIAON_GLM_API_KEY      = <你的 Coding Plan Key>
   XIAON_GLM_MODEL        = glm-5.3-flash
   XIAON_GLM_BASE_URL     = https://open.bigmodel.cn/api/coding/paas/v4
   XIAON_GLM_TIMEOUT_MS   = 120000
   XIAON_GLM_MAX_TOKENS   = 8192
   ```

   可选：`XIAON_GLM_HEDGE_MS`（默认 20000）——单次请求超过这么久没回就自动再发一次，用先回来的那个；设 0 关闭。

   `XIAON_API_HOST` / `XIAON_API_PORT` / `XIAON_STATIC_DIR` / `XIAON_DB_PATH` 已在 Dockerfile 里写好。
6. （可选，建议）按第 9 节给服务添加 Volume（Mount Path `/data`），学习记录在重新部署后保留。不加也能正常运行，只是每次重新部署记录清空——对比赛演示反而合适（见第 7 节）。
7. Settings → Networking → **Generate Domain**，得到 `https://xxx-production.up.railway.app`。
8. **回到 Variables 添加** `XIAON_PUBLIC_ORIGIN = https://xxx-production.up.railway.app`（和第 7 步域名一字不差、不带末尾斜杠）。这一步之前打开页面会白屏或 403，是预期行为。
9. 打开域名，按第 6 节自检，把地址填进比赛提交表。
10. 比赛结束不再需要时，项目 Settings → Delete Project 即可，全程不产生费用。

## 3A. 方式 A-国内：腾讯云开发 CloudBase 云托管（国内访问最优，需实名）

2026-10-21 验证可行后新增。免费体验版环境每月 3000 资源点（≈¥3）：0.25 核 0.5G 常驻约 714 点/天，够连续跑约 4 天；无人访问自动缩容到 0、不计费，覆盖比赛评审期足够。默认域名 `*.app.tcloudbase.com` 自带 HTTPS 且为腾讯已备案域名，**国内打开最快**。需要微信注册腾讯云 + 身份证实名；免费版超额不能补费（服务停），比赛期够用。阿里云函数计算不可选：默认域名会强制浏览器下载网页，必须绑已备案自定义域名。

1. **部署包**：`outputs/xiaon-cloudbase-deploy.zip`（已剔除 node_modules、dist、.local、.env.server；仅凭包内内容即可构建运行，已本机验证）。源码更新后重打：在 `outputs/xiaon` 执行 `zip -rq ../../outputs/xiaon-cloudbase-deploy.zip . -x "node_modules/*" -x ".local/*" -x "dist/*" -x ".env.server"`。
2. 腾讯云控制台搜「云开发 CloudBase」→ 创建环境 → 计费选**免费体验版** → 地域选**上海**（云托管计费项在上海地域）。
3. 环境内打开**云托管** → 创建服务：名称 `xiaon`，按量计费，规格 0.25 核 0.5G。
4. 服务里**部署新版本** → 上传方式选**本地代码** → 上传 zip → 等构建（几分钟）。
5. 服务设置：监听端口 `8080`；环境变量加模型五变量（同第 3 节）。
6. 开启公网访问/默认域名，得到 `https://xiaon-xxxx.sh.app.tcloudbase.com`。
7. 回环境变量加 `XIAON_PUBLIC_ORIGIN = 该域名`（一字不差、无末尾斜杠），重新部署。
8. 按第 6 节自检。**若首页 403 而 `/api/health` 正常**：网关未传 `X-Forwarded-Host`，补一条 `XIAON_ALLOWED_ORIGINS = https://该域名` 再重部署。
9. 控制台如有「请求超时」，调到 ≥120 秒（GLM 回复上限 120s）。

与 Railway 的差异：无持久卷，SQLite 随重新部署/缩容清空（演示期反而合适）；其余同第 7 节。

## 4. 方式 B：Render 免费版（备选）；Zeabur 已不可用

- **Render**（[免费政策](https://render.com/docs/free)）：New → Web Service → 连接仓库 → Root Directory `outputs/xiaon`、Runtime 选 Docker → Variables 同第 3 节 → 生成域名 → 回填 `XIAON_PUBLIC_ORIGIN`。不需要信用卡、**永久免费**；但免费服务 **15 分钟无访问会休眠**，下一次打开要等约 1 分钟才唤醒，**不建议作为交给评委的主链接**；也没有持久磁盘，SQLite 每次部署清空。作为 Railway 之外的兜底可用。
- **Zeabur（作废）**：共享集群 [2026-03-15 起停止接收新项目](https://zeabur.com/zh-CN/changelogs/phasing-out-shared-cluster)（免费托管同步取消，新用户须自带服务器）；平台已于 [2026-10-17 宣布整体关停](https://zeabur.com/zh-CN/blogs/zeabur-is-shutting-down)，2026-12-31 前全部下线。本文档此前的 Zeabur 部署步骤全部作废。

## 5. 方式 C：现场演示保底 `demo-tunnel.sh`

Mac 本机跑完整应用（真 AI），再借 Cloudflare 临时隧道拿一个 HTTPS 地址，评委手机直接访问。不需要任何账号。

```sh
brew install cloudflared          # 只装一次；可选 brew install qrencode 在终端打印二维码
cd outputs/xiaon
./demo-tunnel.sh
```

脚本会：构建前端 → 起隧道并拿到 `https://xxxx.trycloudflare.com` → 用这个地址作为唯一允许来源启动服务 → 打印地址（装了 qrencode 还会打印二维码）。Ctrl+C 一起停掉。

注意：
- **每次运行地址都不同**，演示前 5 分钟再起，不要提前几小时发出去。
- 默认数据库是 `.local/demo.sqlite`；想从空白开始，删掉它再运行。换端口：`XIAON_API_PORT=18950 ./demo-tunnel.sh`。
- 隧道走 Cloudflare 公网，依赖现场网络；提前在场地试一次。单次请求超过 100 秒会被 Cloudflare 切断（模型正常几秒内返回，一般不会碰到）。

## 6. 部署后自检（任何方式都做一遍）

1. 打开 `https://你的域名/api/health`：应返回 JSON，`"mode":"model"`、`"providerKind":"real_http"`。如果是 `local_rules` / `offline`，说明 `XIAON_GLM_API_KEY` 没传到服务端。
2. 打开首页：能看到小N 和首次介绍，而不是「学伴小N 还没有运行起来」提示页或 403。
3. 用手机打开同一地址，完成首次介绍后在首页直接发一句话，确认有模型回复（与本地规则回复明显不同）。
4. 发起一道题作答，刷新页面，记录仍在。

## 7. 已知边界与注意事项

- **匿名身份，每人独立数据**：不用登录。第一次打开时服务端发一个只属于这个浏览器的随机身份（HttpOnly cookie，一年有效），并为它单独建一个库 `<XIAON_DB_PATH 所在目录>/users/<身份>.sqlite`（可用 `XIAON_USERS_DIR` 改位置）。不同的人互相看不到、改不了、清不掉对方的记录；「我的与设置」里的重置只清空自己的。身份只登记在服务端的 `users/identities.sqlite`，伪造或过期的 cookie 只会得到一个新的空身份。代价：清除浏览器数据或换手机，原来的记录就找不回了；也拦不住拿到链接的陌生人进来（身份总数默认上限 1000，用 `XIAON_MAX_USERS` 调整；每分钟最多新建 30 个）。语音识别/朗读的频率限制按人计算。旧版本的共享库 `learning.sqlite` 不再被读取，留在原处，确认无用后可自行删除。
- **数据库必须挂卷**：镜像默认写 `/data/learning.sqlite`。没有实际挂载时，镜像启动命令会输出丢失记录的警告；整个卷（含 `users/`）都要在持久卷上。按第 9 节配置，并验证重启后记录仍在。
- **Coding Plan Key**：这个套餐面向个人编程工具，限流按一个人设计。几位评委体验没问题；若要长期对外开放，先核实套餐条款，或换标准 API Key（基址改为 `https://open.bigmodel.cn/api/paas/v4`）。
- **HTTPS 是硬要求**：前端用到的 `crypto.randomUUID()` 只在 HTTPS 或 localhost 下可用，裸 IP 的 http 地址会直接报错。上面三种方式都自带 HTTPS。
- `.env.server`、`.local/`、`dist/` 已被 `.gitignore` 和 `.dockerignore` 排除，不会进仓库或镜像。

## 8. 以后换服务器怎么办

代码在 GitHub，服务器只是「运行它的地方」。换到腾讯云/阿里云轻量服务器或任何其他平台时，只需：`git clone` → `npm ci` → `npm run build` → 设置第 2 节三个变量加模型变量 → `npm run server`（建议用 pm2 守护）。要带走的只有 `.env.server`（配置）和 `.local/*.sqlite`（数据，如果在乎）。有 Docker 的机器更简单：`docker build -t xiaon . && docker run -p 80:8080 -e ... xiaon`。前面放 Caddy 之类的反向代理即可拿到自动 HTTPS；国内服务器绑域名需先完成 ICP 备案。


## 9. 第一期：持久卷与可恢复备份

本机开发仍默认 `.local/learning.sqlite`；H 路仅使用自己 worktree 内的 `.local/h.sqlite`。容器默认 `/data/learning.sqlite`。`Dockerfile` 不声明匿名 VOLUME，避免把匿名磁盘误当成平台会持续复用的磁盘。启动命令先检查 Linux 的实际挂载；数据库不在独立挂载内时会输出「未检测到持久卷」。这项检查只能证明存在挂载，平台是否在下一次部署复用该卷仍需实际验证。若覆盖镜像的启动命令，须保留前置检查：

```sh
node --import tsx scripts/agent/backup.ts --check-volume
```

### Zeabur（已停运，仅存档）

Zeabur 已宣布关停、共享集群不再接收新项目（见第 4 节），以下步骤**作废**，仅作历史存档：在应用服务的 **Volumes** 页点击 **Mount Volumes**，Volume ID 填 `xiaon-data`，Mount Directory 填 `/data`；保存。Variables 设置 `XIAON_DB_PATH=/data/learning.sqlite`，再部署。

### Railway

在项目画布给应用服务添加 **Volume**，将其连接到这个服务，Mount Path 设 `/data`；服务 Variables 设置 `XIAON_DB_PATH=/data/learning.sqlite`，部署待应用的变更。平台卷与服务关联，保持单实例，不能再让另一个实例同时写这份 SQLite。卷中的数据只在运行时挂载，备份命令在运行中的容器执行，不能放在镜像构建步骤。

参见 [Railway 官方 Volumes](https://docs.railway.com/volumes) 与 [卷限制说明](https://docs.railway.com/volumes/reference)。界面名称可能调整；本路没有实际部署、挂卷或验证平台重启。

### 备份与恢复

脚本使用 Node 的 SQLite 一致性备份 API，支持 WAL 库运行中备份，不直接复制正在写入的数据库文件。需要 **Node >=22.16**，镜像的 `node:22-bookworm-slim` 支持该 API；现有页面服务的最低版本约束没有被本路修改。依据 [Node 官方 SQLite backup 文档](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html)。

在应用目录执行，不需要模型 Key：

```sh
# 本机 H 路；容器内改为 --db /data/learning.sqlite --out /data/backups
node --import tsx scripts/agent/backup.ts --db .local/h.sqlite --out .local/h-backups --keep 7
```

多用户部署时每个身份一个库，`users/` 下逐个备份（含身份登记表 `identities.sqlite`，丢了它所有人都会变成新用户）：

```sh
for db in /data/users/*.sqlite; do node --import tsx scripts/agent/backup.ts --db "$db" --out /data/backups --keep 7; done
```

恢复同理：只恢复某一个人时停服务后对那一个文件执行下面的恢复命令。

成功时打印备份绝对路径。文件名含源库标识、UTC 时间和随机标识，权限为仅当前用户可读写；完整性检查通过后，只轮换同一源库的最近 7 份，其他文件不会删除。备份是独立单文件，包含当时所有学习集合与幂等回执。还应把至少一份下载到卷以外的位置，防止整卷丢失。

恢复会覆盖目标库，**必须先停止所有使用该库的服务/浏览器测试进程**，并保持它们停止到恢复完成；`--stopped` 是操作者对此的明确确认，不是自动停服务。先备份当前库到同级 `backups/before-restore/`（保留最近 10 份），校验指定备份，再原子替换；失败时不显示成功。

```sh
node --import tsx scripts/agent/restore.ts --db .local/h.sqlite --from /absolute/path/to/backup.sqlite --stopped
```

恢复不接收模型输出，也不会读写任何 `.env.server`。恢复后重新启动同一数据库路径的服务，再核对记录。不要直接把单个运行中数据库文件拖走，也不要复制旧的 WAL/SHM 旁文件覆盖恢复结果。

### 部署后的持久化自检（待平台操作者执行）

1. 确认实际卷路径为 `/data`、启动日志没有缺卷警告。
2. 写入一条合成学习记录，刷新可见，记下记录数。
3. 对该库运行备份，下载输出的单文件到另一位置。
4. 重新部署同一服务，确认仍复用该卷且记录数相同。
5. 只在单独的演示库演练停服恢复，确认恢复前备份和恢复后记录都存在。

本地临时库测试与浏览器测试不能替代以上平台验收。
