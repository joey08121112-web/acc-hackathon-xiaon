#!/bin/sh
# 现场演示保底：本机单进程跑学伴小N（静态站 + /api + 真 AI），再用 Cloudflare 临时隧道拿一个 HTTPS 地址。
# 前提：已装 cloudflared（brew install cloudflared），.env.server 已填 Key。可选：brew install qrencode 在终端打印二维码。
# 用法：./demo-tunnel.sh        结束：Ctrl+C（同时停掉隧道与服务）。每次运行地址都会变，演示前几分钟再起。
set -eu
cd "$(dirname "$0")"
PORT="${XIAON_API_PORT:-18940}"
DB="${XIAON_DB_PATH:-.local/demo.sqlite}"
[ -f .env.server ] || { echo "缺少 .env.server：cp .env.example .env.server 后填写 XIAON_GLM_API_KEY"; exit 1; }
command -v cloudflared >/dev/null 2>&1 || { echo "未安装 cloudflared：brew install cloudflared"; exit 1; }
echo "① 构建前端（npm run build）…"
npm run build >/dev/null
echo "② 启动 Cloudflare 临时隧道…"
LOG="$(mktemp -t xiaon-tunnel)"
cloudflared tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate >"$LOG" 2>&1 &
TUNNEL=$!
SERVER=""
cleanup(){ [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; kill "$TUNNEL" 2>/dev/null; }
trap cleanup INT TERM EXIT
URL=""
i=0
while [ $i -lt 40 ]; do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  i=$((i+1)); sleep 1
done
[ -n "${URL}" ] || { echo "隧道 40 秒内未就绪，看日志：${LOG}"; exit 1; }
echo "③ 启动学伴小N（只接受来源 ${URL}）…"
XIAON_API_PORT="${PORT}" XIAON_STATIC_DIR=dist XIAON_PUBLIC_ORIGIN="${URL}" XIAON_DB_PATH="${DB}" \
  node --env-file-if-exists=.env.server --import tsx server/index.ts &
SERVER=$!
sleep 2
kill -0 "${SERVER}" 2>/dev/null || { echo "服务启动失败（端口 ${PORT} 被占用？可用 XIAON_API_PORT=18950 ./demo-tunnel.sh 换端口）"; exit 1; }
printf '\n  手机 / 评委访问：  %s\n  本机访问：         http://127.0.0.1:%s\n  数据库：           %s（想从空白开始就删掉它再运行）\n\n' "${URL}" "${PORT}" "${DB}"
command -v qrencode >/dev/null 2>&1 && qrencode -t ANSIUTF8 "${URL}" || true
echo "  Ctrl+C 结束。"
wait "${SERVER}"
