# 探索地图恢复 · 2026-10-21

用户要求恢复先前的探索地图形式。已对照原 App 探索页、MapArt 和 outputs/evidence/08-map.png，复用原插画、样式、五个地点与进入弹窗。

## 变更

- 恢复理解花园、逻辑小桥、计算工坊、生活集市、空间山丘，以及地图／列表切换、地点状态与学习观察入口。
- 新版地图从 SQLite 学习视图读取作答与暴露状态，不再显示旧浏览器记录。地点“完成”仅概括已观察任务，沿用“结果只代表这些任务中的表现”的提示。
- 进入沿用原确认弹窗；探索先尝试理解和逻辑，两站不要求答对。最终确认后才调用真实任务激活，普通选择清除旧复习关联。
- 新组件 ExplorationMap.tsx 复用现有 MapArt、dimensionDetails、CSS。成长页仍展示知识点与证据，未改服务端协议与模型逻辑。

## 当前启动

```sh
cd '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon'
XIAON_DB_PATH=.local/d-preview.sqlite npm run dev:learning
```

当前预览 http://127.0.0.1:5194/#explore 。测试另用5196／18936，未关闭当前预览、清理用户浏览器或用户数据库。

## 本次验收

| 检查 | 结果与证据 |
| --- | --- |
| TypeScript／Vite构建 | PASS，evidence/build.log |
| Agent类型检查 | PASS，evidence/typecheck.log |
| 地图／列表、五地点、原弹窗、探索顺序、SQLite状态刷新 | PASS，地图专项2项，evidence/map-and-learning-flow.log |
| 做题→证据→报告／确认计划→跨天未见复习→状态／历史 | PASS，模拟模型＋真实工具／SQLite，浏览器完整链 |
| 记忆更正／关闭／停止／删除、刷新恢复、旧导入去重与未知日期、网络重试／超时／取消 | PASS，同次7项浏览器检查的一部分 |
| 320／390／430宽度、大字体与自动无障碍检查 | PASS，evidence/map-*.png及browser-results.json；浏览器视口不代表实体手机验收 |
| 真实模型 | 本次未重跑；原D真实模型证据仅对应当时版本 |
| 独立复核／人工验收／实体设备 | 本次未执行；以上为实现者自验 |

复现：在应用目录执行 `npx playwright test -c playwright.map.config.ts`，7/7通过。完整轨迹见 evidence/agent-tool-traces.json，链路数据见 evidence/browser-chain.json。

## 失败与证据边界

先新增地图测试，两项在恢复前失败，保留 first-red.log 和 first-red-artifacts；恢复后专项2/2通过。扩展完整回归首跑因测试控制请求仍指向旧端口18931而非独立18936，4项失败，保留 map-and-learning-flow-first-red.log 和 flow-first-red-artifacts；修正测试地址后7/7通过，未放宽产品或验收断言。

首轮完整回归曾把任务／报告／计划截图和旧导入备份写入原D/evidence目录的同名路径；这些文件已是本轮快照，不能再用原D清单的旧哈希作为当前证明。最终回归已改为本目录独立保存，原D清单保留为历史记录；当前六个变更文件的哈希见 source-hashes.json。未commit／push／部署，未重打或覆盖分享ZIP。
