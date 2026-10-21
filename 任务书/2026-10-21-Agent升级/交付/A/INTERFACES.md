# A 冻结接口 1.0.0

唯一类型源 `outputs/xiaon/shared/learning-contracts.ts`；JSON Schema `shared/learning-contracts.schema.json`（draft2020-12，定义在 $defs；工具参数前缀 ToolArguments_）。共享模块只依赖浏览器可用的 Zod，不导入 Node/SQLite。`schemas` 是同一份严格运行时校验。字段、ID（ASCII 1–128字符）、正整数版本、ISO UTC 时间、拒绝未知字段以这里为准。导出清单见 exports.json。

所有下面端口已经通过独立 B/C 编译消费者样例验证，样例位于 `tests-agent/a/consumers.ts`；它们会明确抛 not_implemented，不是假业务实现。

## 关键字段语义

- schemaVersion 固定 `1.0.0`。任务版本以 taskId/taskVersion 标识，TaskDefinition.version 为同一版本；legacy 旧题ID的版本1已持久化并冻结，B增加元数据或改变可信题面/评分规则时使用版本2或新ID，不覆盖版本1。
- sessionId 是服务生成、可暂停/结束的业务场次；同一未结束场次重复 start 返回原场次，刷新不重置题量。sessionEvents 追加状态，不改原 startedAt。
- attemptId 是已经保存的学生尝试 Entity.id，模型不能生成；真实尝试不可替换。修正通过新的 Evidence/GradingResult 和 supersedes*Id，保留旧对象，B负责重算。
- operationId 是请求级重试键，同ID同请求返回原结果，同ID不同请求 conflict；跨事件种类使用全局不重复ID。once 回调同步事务，禁止 await；异步引擎先完成分析，再在一次同步事务内提交。
- repository.revision() 是任何持久化写入的数据版本（包含轨迹/派生对象）；evidenceRevision() 只在 attempts/exposures/gradings/evidence 追加时增长，派生对象/轨迹不推动证据版本。快照保存生成时的 watermark；B/C使用 evidenceRevision，不把模型置信度当知识状态。
- SourceTime.recordedAt 是入库时刻；occurredAt 是可信服务事件时刻或 null。legacy_unknown 的旧 timeLabel 保留在 legacyLabel，不补年份/时区/场次。历史导入 attempt.sessionId=null、exposureHistory=legacy_unknown。原题已有未知历史时后续尝试继续保守标记未知；不能据此认定未见迁移。
- exposureIds 是作答之前已保存的同题同版本暴露快照；hintSnapshot 保留当时提示；answerExposed 包括聊天帮助的保守门控。聊天帮助事件须由学生API/后续D程序记录，模型工具不能声称帮过就自行改写记录。提交后才看的提示不追溯改写原尝试。
- TaskPublicView 显式去除 answer/rubric/hints正文/commonErrors，保留 hintAvailable；学生请求提示事件时才返回具体提示。answer 暴露事件只确认已见答案，不返回可信答案正文。
- 每个 report/proposal/plan 的ID唯一、不可变；新版本用新ID并用 supersedes*/previousVersionId关联，学生确认需 expectedPreviousVersionId。规则、过期确认及报告修订标注由C实现，A只提供结构与不覆盖存储。
- repository.append: tasks 用 id:vVERSION 作存储键，reviewItems 用 id:rREVISION，其余用 id。get 可传完整存储键，或逻辑id取最后追加版本；list 返回所有不可变版本，C按 revision 选择当前版本，不把旧活动版本重复排程。
- 可选 memories 允许 stop/delete，不影响不可变学习记录。必须通过 StudentEvents（或复用相同权限规则）访问，不能直接 repository.list(memories) 绕过授权；模型入口无任意偏好写工具。
- ToolResult.ok 是程序handler结果，不等于真实模型验证。AgentRun.providerKind 区分 real_http/synthetic/offline，status 区分completed/unavailable/timeout/cancelled/budget_exhausted/failed。ToolCall只保存参数哈希、白名单工具名、ID、错误码、数据版本和证据引用，不保存参数或学生原文。permissionFingerprint防止权限变化后复用旧回复。

## 类型与端口签名（源文件摘录）

```ts
export interface Clock { now(): string }
export interface EntityMap {
  tasks:TaskDefinition; sessions:LearningSession; sessionEvents:SessionEvent; attempts:Attempt; exposures:ExposureEvent; gradings:GradingResult;
  evidence:Evidence; skills:SkillState; assessments:AssessmentSnapshot; reviewPolicies:ReviewPolicy; reviewItems:ReviewItem;
  reviewOutcomes:ReviewOutcome; reports:ReportSnapshot; proposals:PlanProposal; plans:PlanVersion; memories:MemoryItem; consents:ConsentState; toolCalls:ToolCall; runs:AgentRun;
}
/** Synchronous single-process SQLite transaction. Do not await inside transaction callbacks. append never replaces. */
export interface LearningRepository {
  get<K extends keyof EntityMap>(collection:K,id:string):EntityMap[K]|undefined;
  list<K extends keyof EntityMap>(collection:K):EntityMap[K][];
  append<K extends keyof EntityMap>(collection:K,value:EntityMap[K]):void;
  transaction<T>(work:()=>T):T;
  /** A receipt is scoped across events; same ID + different request fails. Work and receipt commit atomically. */
  once<T>(operationId:string,request:unknown,work:()=>T):T;
  revision():number;
  /** Changes to attempts/exposures/gradings/evidence only; derived records and traces do not advance this. */
  evidenceRevision():number;
  setMemoryState(id:string,action:'stop'|'delete'):void;
  close():void;
}
export interface TaskSelection { sessionId:string; dimension?:Dimension; knowledgePointId?:string; excludeTaskIds:string[]; limit:number }
export interface TaskCatalog {
  definition(taskId:string,taskVersion:number):TaskDefinition|undefined;
  publicTask(taskId:string,taskVersion:number):TaskPublicView|undefined;
  candidates(selection:TaskSelection):TaskPublicView[];
}
export interface EngineContext { repository:LearningRepository; clock:Clock; catalog:TaskCatalog }
export interface AssessmentEnginePort {
  readonly id:string;
  catalog:TaskCatalog;
  grade(input:{attemptId:string;operationId:string},context:EngineContext):Promise<GradingResult>;
  snapshot(input:{operationId:string},context:EngineContext):Promise<AssessmentSnapshot>;
}
export interface PlanningEnginePort {
  readonly id:string;
  due(input:{at:string;includePaused:boolean},context:EngineContext):Promise<ReviewItem[]>;
  recordOutcome(input:ReviewOutcome,context:EngineContext):Promise<ReviewItem[]>;
  propose(input:{operationId:string;assessment:AssessmentSnapshot;timeBudgetMinutes:number},context:EngineContext):Promise<PlanProposal>;
  confirm(input:{operationId:string;proposalId:string;expectedPreviousVersionId:string|null;action:PlanVersion['confirmation']['action'];scheduledDate:string|null;reason:string},context:EngineContext):Promise<PlanVersion>;
  report(input:{operationId:string;assessment:AssessmentSnapshot;previousReportId:string|null},context:EngineContext):Promise<ReportSnapshot>;
}
export interface EngineRegistration { assessment?:AssessmentEnginePort; planning?:PlanningEnginePort }
export type NativeToolCall = {id:string;name:string;arguments:string};
export type ModelMessage = {role:'system'|'user'|'assistant'|'tool';content:string;toolCallId?:string;toolCalls?:NativeToolCall[]};
export type ToolDefinition = {name:string;description:string;parameters:Record<string,unknown>};
export interface ModelProvider {
  readonly kind:'real_http'|'synthetic'|'offline';
  readonly supportsTools:boolean;
  complete(input:{messages:ModelMessage[];tools:ToolDefinition[];signal:AbortSignal}):Promise<{content:string;toolCalls:NativeToolCall[]}>;
}
export type AgentReply = {run:AgentRun;text:string;mode:'model'|'local_rules';disclosure:string};

```

## D 注册示例

```ts
import { createRuntime } from './server/bootstrap';
// assessment 与 planning 是 B/C 交付的真实端口实现；A不导入尚不存在的模块。
const runtime = createRuntime({ databasePath: '/absolute/private/learning.sqlite' });
runtime.registerAssessment(assessment);
runtime.registerPlanning(planning);
const ctx = runtime.engineContext();
const snapshot = await runtime.assessment().snapshot({ operationId: 'assessment-unique-1' }, ctx);
const proposal = await runtime.planning().propose({ operationId: 'proposal-unique-1', assessment: snapshot, timeBudgetMinutes: 10 }, ctx);
```

也可 createRuntime({ engines: { assessment, planning }, repository, clock, provider }) 注入统一运行时。注册后HTTP学生事件与工具读同一 catalog/repository；D接页面与完整B/C路由。createRuntime不自动注册尚不存在的B/C，未注册快照/规划显式报 not_implemented。legacy 默认只做现有 correct() 的结果核对，get_skill_state 返回有限记录与尚未观察，不能当跨次判断。

临时SQLite与Clock：`server/storage/testing.ts` 的 temporaryRepository(clock?) 返回 repository/clock/databasePath/directory/dispose；TestClock提供 now/advance(milliseconds)/set(ISO)。每个用例在finally中dispose。B/C可以复用 `publicView(task)`（server/tools/legacy.ts）生成严格公开题面，不需修改package或shared。

支持的真实提供者：智谱官方非流式 function tools；依据[工具调用文档](https://docs.bigmodel.cn/cn/guide/capabilities/function-calling)和[对话补全文档](https://docs.bigmodel.cn/api-reference/模型-api/对话补全)（2026-10-21读取）。只处理原生tool_calls，不从文本JSON解析伪调用。GlmProvider的第三参数fetch只供本地合成HTTP测试注入；synthetic provider只由测试代码显式注入，生产环境不会静默选用。

## 用户05补充（不改冻结契约）

默认模型glm-5.3-flash；标准基址与服务端预算配置见MODEL-05.md。读取器位于server/providers/config.ts，不进入共享协议/业务算法。GlmProvider保留原有(key, model, fetch?)构造用法，新增可选第四参数{baseUrl,maxTokens,timeoutMs}；createRuntime新增可选modelTimeoutMs。ModelProvider接口保持不变，更换供应商通过新适配器注入，不能把改基址视作自动兼容任意协议。

GLM必要的reasoning_content仅存在provider私有WeakMap，在同次工具循环内回传。它不加入ModelMessage/ToolResult/AgentRun或学生文本/常规日志。运行中权限变化直接取消，避免私有元数据携带已撤回偏好进入下次调用。响应finish_reason=length或其他未正常结束状态报provider_error，丢弃部分工具请求，不更新成绩/计划。以上仅合成测试，真实GLM仍未运行。
