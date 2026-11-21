#!/bin/sh
# 学伴小N 容器入口：检查持久卷 → 必要时修好 /data 属主 → 降权到非 root 运行真正的服务。
# 2026-11-21：原来容器以 root 运行，镜像里还带着 typescript/vite/playwright/tsx，
# 服务端直接跑 .ts 源码。现在改成多阶段构建 + 编译后的 CommonJS + 非 root。
set -e

# 持久卷检查（DEPLOY.md 第 9 节要求保留：覆盖启动命令时也要留着这一步）。
# 检查本身只打印警告，不决定退出码。
node dist-server/scripts/agent/backup.js --check-volume || true

if [ "$(id -u)" = "0" ]; then
  # 平台挂进来的持久卷可能是 root 所有；先修好属主，否则降权后写不进去。
  mkdir -p /data 2>/dev/null || true
  chown -R node:node /data 2>/dev/null || true
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=node --regid=node --init-groups "$@"
  fi
  # 没有 setpriv 就别拦住服务启动：可用性优先，但把这件事说清楚。
  echo "警告：镜像内缺少 setpriv，本次仍以 root 运行（降权未生效）。" >&2
fi

exec "$@"
