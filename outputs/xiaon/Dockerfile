# 学伴小N · 多阶段镜像：Node 同时托管 dist/ 静态站与 /api；SQLite 必须挂载 /data 持久卷。
# 平台侧必须设置：XIAON_GLM_API_KEY、XIAON_PUBLIC_ORIGIN=https://<平台分配的域名>。其余说明见 DEPLOY.md。
#
# 2026-11-21 改造（安全审查 T1-6）：
#   原来单一阶段，`npm ci` 把 devDeps（typescript/vite/playwright/tsx）全装进镜像，
#   CMD 用 `node --import tsx` 直跑 .ts 源码，容器还是 root。
#   现在：构建阶段装全工具链并产出静态站与服务端 JS；运行阶段只有生产依赖和产物，
#   服务端跑编译后的 CommonJS，入口脚本把权限降到 node 用户。
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# 只有生产依赖：镜像里不再有 typescript / vite / playwright / tsx。
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/docker-entrypoint.sh /usr/local/bin/xiaon-entrypoint
RUN chmod 755 /usr/local/bin/xiaon-entrypoint \
 && mkdir -p /data \
 && chown -R node:node /app /data
ENV XIAON_API_HOST=0.0.0.0 \
    XIAON_API_PORT=8080 \
    XIAON_STATIC_DIR=/app/dist \
    XIAON_DB_PATH=/data/learning.sqlite
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/xiaon-entrypoint"]
CMD ["node", "dist-server/server/index.js"]
