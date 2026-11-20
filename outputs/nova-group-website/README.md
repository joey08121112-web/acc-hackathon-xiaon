# NOVA 教育科技集团官网（静态版）

本目录为 **NOVA Education Technology（学伴小N生态）** 的自包含静态集团官网，零外部构建依赖，可直接本地 HTTP 预览或静态托管部署（GitHub Pages / Cloudflare Pages / Vercel / Nginx）。

## 目录结构

```text
nova-group-website/
├── index.html          # 语义化 HTML5 结构、原创生态 SVG、原生 <dialog> 与可访问 Tab
├── styles.css          # 象牙宣纸 × 深森墨绿 × 暖金星辉视觉系统，含自动/手动深浅色主题
├── main.js             # 二态主题切换、原生 <dialog> 兜底、可访问 Tab、五维图谱与表单校验
├── README.md           # 预览与部署说明
└── assets/             # 本地自包含视觉素材（无外部图床依赖）
    ├── screen-start.jpg
    ├── screen-record.jpg
    ├── poster.jpg
    └── preview.png
```

## 本地预览

推荐使用任意轻量 HTTP 服务预览：

```sh
# 方式一：Python 内置服务器
cd /Users/ami/Documents/个人/ACC黑客松/outputs/nova-group-website
python3 -m http.server 8088 --bind 127.0.0.1
```

打开浏览器访问 `http://127.0.0.1:8088/`。

```sh
# 方式二：Node.js npx serve
npx -y serve /Users/ami/Documents/个人/ACC黑客松/outputs/nova-group-website -l 8088
```

## 静态部署

直接将整个 `nova-group-website/` 目录上传至任意静态托管平台即可（所有资源均使用相对路径，无需构建步骤）。

## 真实边界说明

- 站内展示的对话样例、家长周报示例数据均为合成演示材料，不含真实学生数据。
- 合作咨询弹窗在提交后生成本地静态回执与可复制联系模板，不向外部服务器上传数据。
