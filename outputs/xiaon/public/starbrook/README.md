# 此目录存放星溪镇网页游戏（Godot 4.6 Web 导出）

实际文件（index.html / index.js / index.wasm ~36MB / index.pck ~19MB 等，共约 55MB）
**不进 git**（见根 .gitignore），来源与再生成方式：

- 当前线上构建：Godot 4.6 "Web NoThreads" 导出（无线程版，iframe 内嵌无需 COOP/COEP 响应头）
- 源工程与导出产物在维护机的 `~/Documents/Starbrook-Web/`（project/ 为源工程，web-nothreads/ 为本目录内容）
- 更新方法：在源工程改完后 `--export-release "Web NoThreads"`，把 web-nothreads/ 内容整个拷进本目录，
  再按部署流程打 zip 上服务器；注意 server/http/static.ts 对本目录 .wasm/.pck 缓存一年，换版本需改文件名或查询参数
- 组件侧入口：`src/components/game/StarbrookGame.tsx`（挂专业模式地图下方）
