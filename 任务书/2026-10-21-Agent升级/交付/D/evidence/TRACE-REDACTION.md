# 浏览器trace去敏

失败日志、截图、时间线与事件保留。交付的trace.zip仅去除HTTP Authorization/Cookie/Set-Cookie/X-Xiaon-CSRF及local-session响应csrfToken的值，包括测试服务的临时本机会话凭据。去敏前后SHA256与修改条目数记录在trace-redaction.json，不保留或导出原凭据值。资源路径和事件数量保持，仍可使用Playwright trace viewer读取。没有操作仓库其他位置的历史trace或分享ZIP。
