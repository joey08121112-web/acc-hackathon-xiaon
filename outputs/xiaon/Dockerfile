# 学伴小N · 单进程镜像：Node 同时托管 dist/ 静态站与 /api；SQLite 必须挂载 /data 持久卷。
# 平台侧必须设置：XIAON_GLM_API_KEY、XIAON_PUBLIC_ORIGIN=https://<平台分配的域名>。其余说明见 DEPLOY.md。
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV XIAON_API_HOST=0.0.0.0 \
    XIAON_API_PORT=8080 \
    XIAON_STATIC_DIR=/app/dist \
    XIAON_DB_PATH=/data/learning.sqlite
EXPOSE 8080
CMD ["sh", "-c", "node --import tsx scripts/agent/backup.ts --check-volume && exec node --import tsx server/index.ts"]
