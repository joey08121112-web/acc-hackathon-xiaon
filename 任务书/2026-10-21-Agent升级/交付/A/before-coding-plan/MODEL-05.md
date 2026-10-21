# 05 模型选择补充交付

已完整阅读用户05补充，沿用单套服务端 XIAON_GLM_* 变量。共享契约1.0.0的类型/Schema字节和哈希保持不变。

| 变量 | 缺省值 / 行为 |
| --- | --- |
| XIAON_GLM_API_KEY | 空；由用户在本机.env.server填写国内标准模型API的Key |
| XIAON_GLM_MODEL | glm-5.3-flash |
| XIAON_GLM_BASE_URL | https://open.bigmodel.cn/api/paas/v4（追加/chat/completions） |
| XIAON_GLM_TIMEOUT_MS | 120000；同时作为每次HTTP及整个本次Agent运行的上限 |
| XIAON_GLM_MAX_TOKENS | 8192；发送为max_tokens |

这些预算是初始配置选择，尚无真实性能验证；基址只允许不含内嵌凭据/查询参数的HTTPS，数值必须是合法正整数。模型和预算不进入评分/复习规则或共享契约。后续更换模型修改MODEL；更换供应商通过现有ModelProvider端口注入相应适配器，不自动改用代理或Coding专属产品。

实现：server/providers/config.ts统一读取；runtimeFromEnvironment与真实合成材料验收脚本使用相同配置。浏览器移除固定22秒中止，用户AbortSignal和服务端预算继续可取消。官方HTTP适配器拒绝截断或未正常结束的响应，不执行其中部分工具调用。原生tool_calls/tool_call_id和必要reasoning_content在内存内回传；内部思考不进入学生回复、共享协议或轨迹。没有设置thinking disabled。运行中授权变化取消当前循环，避免旧私有上下文继续回传。

官方核对（2026-10-21）：[模型说明](https://docs.z.ai/guides/vlm/glm-5.3-flash)、[国内标准API与Key类型](https://docs.bigmodel.cn/cn/api/introduction)、[思考模式](https://docs.bigmodel.cn/cn/guide/capabilities/thinking)。官方支持不是本机Key已获权限或项目实测成功。

先写tests-agent/a/glm-config.test.ts，再实施。首次失败model05-first-red.log保留；新增4个合成测试覆盖默认/覆盖配置、校验、原生多轮私有字段回传、截断拒绝、provider与runtime配置超时。最终A22/22、类型检查通过，原业务25/25、生产构建和26产物哨兵扫描通过；独立浏览器2/2、实际服务重启通过。真实API仍NOT_RUN（缺Key），没有索要/写入/打印真实凭据。

05后的浏览器使用独立UI5196/API18926，因5191已被其他操作占用；原5191进程保留。更新后的源文件哈希见final-files.json；旧版清单保存在before-model05/。本补充不进入B/C/D，不commit/push/发布。
