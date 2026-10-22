# 本轮加法契约

基于 06048b6，SCHEMA_VERSION 仍为 1.0.0。旧行与旧报告不迁写，SQLite 不新建权威评分/排程表。

- `LearningEpisode.loop?`：只在新闭环存在。引用原 LearningSession；保存学生原话、待确认/确认/更正的假设历史（model/program/student 来源），练习/核对题引用及原始 attemptIds，实际显示帮助文本/等级/representation/exposureId，核对进度、输入草稿、结束原因。修订仍为 `id:rN`。
- `help.level=0, representation=dialogue`：模型普通回复可能含有提示，保守记录为帮助，不推进学生主动请求的 1/2/3 级阶梯。其他表示为 ladder/sign_table。此分类可能低估独立表现，不会把有帮助说成无帮助。
- `LearningEpisode.endReason` 加 `student_end`；结束和学习结论分开。
- `PlanFocus.knowledgePointId?`：原 focus 的子技能限定；完整可信 assessment 仍先校验，限定只影响选择投影和缓存。旧调用不变。
- `learning/generate` 可带白名单 `knowledgePointId:'negative-brackets'`，复用原引擎创建提案；仍由 `learning/confirm` 学生确认，才产生正式计划/复习项。
- 新 `POST /api/learning/loop`：同原 Cookie / Origin / CSRF / operationId 收据 / 串行保护。start 带 quote；其他事件带 episodeId、expectedRevision；动作 confirm/correct(text)/draft(value)/submit(value)/help/verify/skip/end/leave/continue/draft_card。严格拒绝额外字段。
- `view.learningLoops`：每个片段的最新修订、公开题面、相关尝试、最新评分和帮助；结论通过原 classifyAttempt 和正式评分推导。无可信答案、Key或新评分权威。
- 提交先由 StudentEvents 保存原答及当时暴露，再评分；异步取消后保留引用，原 operationId 可接续。相同 operationId 参数变化与过期修订报冲突。
- 静态可信未见题优先；静态不足才调用原 TaskGenerator（含校验器），再作已见/原题/跨版本/内容指纹过滤；无合适题明确 unavailable，不用原题冒充。
- 回顾事实由当前片段已存事件兜底。学生编辑与 aiDraft 分开，编辑不生成评分/evidence。确认或全跳过进步卡关闭片段；直接退出不强制保存卡片。

目标入口是首页“一起看看去括号的负号”。保留先修尝试要求，已有记录直接使用；无记录可先试一道合并同类项，不要求重新测评。不扩展任意 OCR/口述式子的判题范围。
