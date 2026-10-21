import { z } from 'zod';
import { SCHEMA_VERSION,schemas,type EngineContext,type EngineRegistration,type NativeToolCall,type RolePolicy,type ToolResult,type ToolDefinition } from '../../shared/learning-contracts';
import { hash } from '../storage/repository';
import { RuntimeError,failure } from '../core/errors';
import type { StudentEvents } from '../core/events';
import { legacySkills } from './legacy';
export const ROLE_POLICIES:Record<RolePolicy['role'],RolePolicy>={
 tutor:{role:'tutor',allowedTools:['get_learning_context','query_learning_evidence','get_skill_state','select_task','get_hint','get_due_reviews','propose_memory'],maxRounds:4,maxToolExecutions:6},
 assessor:{role:'assessor',allowedTools:['query_learning_evidence','get_skill_state','grade_attempt'],maxRounds:4,maxToolExecutions:6},
 planner:{role:'planner',allowedTools:['get_learning_context','query_learning_evidence','get_skill_state','select_task','get_due_reviews','propose_plan'],maxRounds:4,maxToolExecutions:6},
 reporter:{role:'reporter',allowedTools:['query_learning_evidence','get_skill_state'],maxRounds:4,maxToolExecutions:6},
};
const descriptions:Record<string,string>={get_hint:'只读取学生已主动请求的提示；不能暗中揭示提示',get_due_reviews:'读取真实到期队列，不自动开题',propose_plan:'从有效证据生成计划草案；不能确认计划',propose_memory:'仅提出可选偏好候选；必须学生另行确认',get_learning_context:'读取当前本机学习场次、尝试数量与获准使用的有效辅导偏好',query_learning_evidence:'读取已保存学生作答和评分证据；不能创建作答',get_skill_state:'读取有限观察；未注册五维引擎时明确标记 legacy',select_task:'只返回可信题库的公开候选题，不含答案、rubric或提示正文；学生还需通过 API 打开题目',grade_attempt:'仅按已保存 attemptId 从可信题库核对；不能接收答案或伪造学生提交'};
export type ToolContext={role:RolePolicy['role'];runId:string;signal:AbortSignal};
export class ToolRegistry {
 constructor(private ctx:()=>EngineContext,private engines:()=>EngineRegistration,private events:StudentEvents){}
 definitions(role:RolePolicy['role']):ToolDefinition[]{return ROLE_POLICIES[role].allowedTools.map(name=>({name,description:descriptions[name],parameters:z.toJSONSchema(schemas.ToolArguments[name as keyof typeof schemas.ToolArguments])}));}
 async execute(call:NativeToolCall,access:ToolContext):Promise<ToolResult>{
  const ctx=this.ctx();let result:ToolResult;
  try{
   if(access.signal.aborted)throw new RuntimeError('cancelled');
   if(!Object.hasOwn(schemas.ToolArguments,call.name))throw new RuntimeError('unknown_tool','未注册的工具');
   const schema=schemas.ToolArguments[call.name as keyof typeof schemas.ToolArguments];let raw:unknown;
   try{raw=JSON.parse(call.arguments);}catch{throw new RuntimeError('invalid_params','工具参数必须是 JSON 对象');}
   const parsed=schema.safeParse(raw);if(!parsed.success)throw new RuntimeError('invalid_params','工具含未知字段或无效参数');
   if(call.name==='request_hint')throw new RuntimeError('unavailable','模型提示工具尚未实现；由学生提示事件入口处理');
   const policy=ROLE_POLICIES[access.role];if(!policy?.allowedTools.includes(call.name))throw new RuntimeError('forbidden','当前程序角色没有此权限');
   const previous=ctx.repository.get('toolCalls','call-'+hash({runId:access.runId,callId:call.id}).slice(0,48));
   if(previous&&(previous.argumentsHash!==hash(call.arguments)||previous.name!==call.name))throw new RuntimeError('conflict','工具调用ID与参数冲突');
   let data:Extract<ToolResult,{ok:true}>['data'];let evidenceIds:string[]=[];
   switch(call.name){
    case 'get_learning_context': data=this.events.context();break;
    case 'query_learning_evidence':{
     const args=schemas.ToolArguments.query_learning_evidence.parse(raw);
     const attempts=ctx.repository.list('attempts').filter(a=>!args.taskId||a.taskId===args.taskId);
     const ids=new Set(attempts.map(a=>a.id));const gradings=ctx.repository.list('gradings').filter(g=>ids.has(g.attemptId));const evidence=ctx.repository.list('evidence').filter(e=>ids.has(e.attemptId));
     evidenceIds=[...new Set([...attempts.map(a=>a.id),...evidence.map(e=>e.id)])];data={attempts,gradings,evidence};break;
    }
    case 'get_skill_state':{
     const args=schemas.ToolArguments.get_skill_state.parse(raw);const engine=this.engines().assessment;
     const skills=engine&&engine.id!=='legacy-v1'?(await engine.snapshot({operationId:'snapshot-'+hash({run:access.runId,call:call.id}).slice(0,40)},ctx)).skills:legacySkills(ctx);
     data={skills:skills.filter(s=>!args.knowledgePointId||s.knowledgePointId===args.knowledgePointId),limitations:engine?.id==='legacy-v1'?['仅 legacy 有限观察，B 五维证据规则尚未注册']:[]};evidenceIds=data.skills.flatMap(s=>s.evidenceIds);break;
    }
    case 'select_task':{
     const args=schemas.ToolArguments.select_task.parse(raw);const session=this.events.requireSession(args.sessionId);
     const exposed=ctx.repository.list('exposures').filter(e=>e.sessionId===session.id&&e.kind==='task');
     const calc=new Set(exposed.filter(e=>ctx.catalog.definition(e.taskId,e.taskVersion)?.primaryDimension==='计算').map(e=>e.taskId));
     const candidate=ctx.catalog.candidates({sessionId:session.id,dimension:args.dimension,excludeTaskIds:exposed.map(e=>e.taskId),limit:100}).find(t=>{
      if(t.primaryDimension==='计算'&&calc.size>=10)return false;
      const attemptedPoints=new Set(ctx.repository.list('attempts').flatMap(a=>ctx.catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));if(t.prerequisites.some(k=>!attemptedPoints.has(k)))return false;
      if(session.mode==='exploration'&&!['理解','逻辑'].includes(t.primaryDimension))return ['理解','逻辑'].every(d=>ctx.repository.list('attempts').some(a=>a.sessionId===session.id&&ctx.catalog.definition(a.taskId,a.taskVersion)?.primaryDimension===d));
      return true;
     });
     if(!candidate)throw new RuntimeError('unavailable','题库耗尽或当前场次先修/题量约束不满足');data=candidate;break;
    }
    case 'get_hint':{
     const args=schemas.ToolArguments.get_hint.parse(raw);this.events.requireSession(args.sessionId);
     const event=ctx.repository.list('exposures').filter(e=>e.sessionId===args.sessionId&&e.taskId===args.taskId&&e.taskVersion===args.taskVersion&&e.kind==='hint').find(e=>ctx.catalog.definition(e.taskId,e.taskVersion)?.hints.some(h=>h.id===e.hintId&&h.level===args.level));
     if(!event)throw new RuntimeError('forbidden','学生尚未主动请求这级提示');data={hint:event.contentSnapshot??'',level:args.level,exposureId:event.id};break;
    }
    case 'get_due_reviews':{
     const engine=this.engines().planning;if(!engine)throw new RuntimeError('not_implemented');data={reviews:await engine.due({at:ctx.clock.now(),includePaused:false},ctx)};break;
    }
    case 'propose_plan':{
     const engine=this.engines().planning,assessment=this.engines().assessment;if(!engine||!assessment)throw new RuntimeError('not_implemented');
     const snap=await assessment.snapshot({operationId:'ts-'+hash({run:access.runId,call:call.id}).slice(0,40)},ctx);
     data=await engine.propose({operationId:'tp-'+hash({run:access.runId,call:call.id}).slice(0,40),assessment:snap,...schemas.ToolArguments.propose_plan.parse(raw)},ctx);evidenceIds=snap.evidenceIds;break;
    }
    case 'propose_memory':{
     if(!this.events.memoryEnabled())throw new RuntimeError('forbidden','可选记忆关闭');data={candidate:schemas.ToolArguments.propose_memory.parse(raw).text,requiresStudentConfirmation:true};break;
    }
    case 'grade_attempt':{
     const args=schemas.ToolArguments.grade_attempt.parse(raw);const engine=this.engines().assessment;if(!engine)throw new RuntimeError('not_implemented');
     if(!ctx.repository.get('attempts',args.attemptId))throw new RuntimeError('not_found','没有已保存学生作答');
     data=await engine.grade({...args,operationId:'grade-'+hash({run:access.runId,call:call.id}).slice(0,48)},ctx);evidenceIds=data.evidenceIds;break;
    }
    default:throw new RuntimeError('unavailable');
   }
   if(access.signal.aborted)throw new RuntimeError('cancelled');
   result=schemas.ToolResult.parse({schemaVersion:SCHEMA_VERSION,callId:call.id,ok:true,data,evidenceIds,dataVersion:ctx.repository.revision()});
  }catch(error){result={schemaVersion:SCHEMA_VERSION,callId:call.id,ok:false,error:failure(error),evidenceIds:[],dataVersion:ctx.repository.revision()};}
  const traceId='call-'+hash({runId:access.runId,callId:call.id}).slice(0,48);
  if(!ctx.repository.get('toolCalls',traceId))ctx.repository.append('toolCalls',{schemaVersion:SCHEMA_VERSION,id:traceId,runId:access.runId,callId:call.id,name:Object.hasOwn(schemas.ToolArguments,call.name)?call.name:'unknown_tool',argumentsHash:hash(call.arguments),status:result.ok?'succeeded':'failed',errorCode:result.ok?null:result.error.code,evidenceIds:result.evidenceIds,dataVersion:result.dataVersion,at:ctx.clock.now()});
  return result;
 }
}
