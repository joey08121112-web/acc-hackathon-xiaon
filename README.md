# ACC黑客松 · 学伴小N

本次小N项目和交付材料已迁至这个目录。`audit-stage1-20261020/` 为另外新增的审计资料，迁移时保留未改动。

- **打开体验**：http://localhost:5173/
- **打开与分享说明**：http://localhost:5173/share.html
- **源码**：[outputs/xiaon](outputs/xiaon/README.md)
- **发给队友**：[队友体验包](outputs/学伴小N-队友体验包.zip)，解压后按包内说明用电脑浏览器打开。
- **截图**：[手机截图索引](outputs/SCREENSHOTS.md)
- **验证记录**：[VALIDATION.md](outputs/VALIDATION.md)
- **原始失败与工作资料**：`work/`

## 重新启动

依赖已一起迁移，无需重复安装。打开终端执行：

```sh
cd '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon'
npm run dev
```

请通过上面的 HTTP 地址体验，不要直接双击源码里的 `index.html`。队友包的单文件版与源码入口不同。

## 迁移说明

实际文件存放于当前目录。旧工作目录仅保留 `outputs`、`work` 两个兼容链接，让此前对话里的文件链接继续可用，不是另一份项目副本。旧日志、trace 和解压出的历史交付包保留原始内容及当时路径，不对历史证据做批量替换。

迁移复核：发布清单中的14个源码文件SHA一致，19份ZIP通过CRC检查；迁移后文件清单和详细核对记录在 `work/migration/`。这不是整套功能的重新验收，功能测试范围仍以原验证记录为准。
