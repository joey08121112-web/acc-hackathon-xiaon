import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { SCHEMA_VERSION,schemas,type EngineContext,type LearningSession,type MemoryItem } from '../../shared/learning-contracts';
import { serverTime } from './clock';
import { RuntimeError } from './errors';
export class StudentEvents {
 constructor(private ctx:()=>EngineContext){}
 private parse<T>(schema:z.ZodType<T>,value:unknown):T{const p=schema.safeParse(value);if(!p.success)throw new RuntimeError('invalid_params','请求字段或版本无效');return p.data;}
 sessions():LearningSession[]{const {repository}=this.ctx();return repository.list('sessions').map(s=>{const e=repository.list('sessionEvents').filter(e=>e.sessionId===s.id).at(-1);return e?{...s,status:e.status,endedAt:e.status==='closed'?e.at:null}:s;});}
 requireSession(id:string){const session=this.sessions().find(s=>s.id===id);if(!session)throw new RuntimeError('not_found','场次不存在');if(session.status!=='active')throw new RuntimeError('invalid_state','场次暂停或已结束');return session;}
 private task(id:string,v:number){const t=this.ctx().catalog.definition(id,v);if(!t)throw new RuntimeError('not_found','可信题目或版本不存在');this.ctx().repository.append('tasks',t);return t;}
 startSession(raw:z.infer<typeof schemas.StartSession>){const input=this.parse(schemas.StartSession,raw);const {repository,clock}=this.ctx();return repository.once(input.operationId,{kind:'start',...input},()=>{
  const existing=this.sessions().find(s=>s.status!=='closed');if(existing){if(existing.mode!==input.mode)throw new RuntimeError('invalid_state','请先结束当前场次');return existing;}
  const session=schemas.LearningSession.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,startedAt:clock.now(),endedAt:null,status:'active',timezone:'Asia/Shanghai'});repository.append('sessions',session);return session;
 });}
 sessionState(raw:z.infer<typeof schemas.SessionState>){const input=this.parse(schemas.SessionState,raw);const {repository,clock}=this.ctx();return repository.once(input.operationId,{kind:'session_state',...input},()=>{const s=this.sessions().find(s=>s.id===input.sessionId);if(!s||s.status==='closed')throw new RuntimeError('invalid_state');const e=schemas.SessionEvent.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,at:clock.now()});repository.append('sessionEvents',e);return e;});}
 expose(raw:z.infer<typeof schemas.Expose>){const input=this.parse(schemas.Expose,raw);const {repository,clock}=this.ctx();return repository.once(input.operationId,{eventType:'expose',...input},()=>{
  const s=this.requireSession(input.sessionId);const t=this.task(input.taskId,input.taskVersion);
  const exposures=repository.list('exposures').filter(e=>e.sessionId===s.id);
  if(input.kind==='task'){
   const seen=new Set(exposures.filter(e=>e.kind==='task'&&this.task(e.taskId,e.taskVersion).primaryDimension==='计算').map(e=>e.taskId));
   if(t.primaryDimension==='计算'&&!seen.has(t.id)&&seen.size>=10)throw new RuntimeError('invalid_state','本场次最多 10 道不同计算题');
   if(s.mode==='exploration'&&!['理解','逻辑'].includes(t.primaryDimension)){
    const attempted=repository.list('attempts').filter(a=>a.sessionId===s.id);
    if(!['理解','逻辑'].every(d=>attempted.some(a=>this.task(a.taskId,a.taskVersion).primaryDimension===d)))throw new RuntimeError('invalid_state','探索先进行理解和逻辑');
   }
  }else if(!exposures.some(e=>e.taskId===t.id&&e.taskVersion===t.version&&e.kind==='task'))throw new RuntimeError('invalid_state','请先打开题目');
  const h=input.kind==='hint'?t.hints.find(h=>h.id===input.hintId):undefined;
  if(input.kind==='hint'&&!h)throw new RuntimeError('invalid_params','提示编号不存在');
  if(input.kind!=='hint'&&input.hintId!==null)throw new RuntimeError('invalid_params');
  const event=schemas.ExposureEvent.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,contentSnapshot:h?.text??(input.kind==='answer'?'学生标记已看过答案':input.kind==='chat_help'?'学生标记从聊天获得帮助':null),sourceTime:serverTime(clock)});repository.append('exposures',event);return event;
 });}
 submit(raw:z.infer<typeof schemas.SubmitAttempt>){const input=this.parse(schemas.SubmitAttempt,raw);const {repository,clock}=this.ctx();return repository.once(input.operationId,{kind:'attempt',...input},()=>{
  this.requireSession(input.sessionId);this.task(input.taskId,input.taskVersion);
  // Prior exposures include other sessions: seeing an old answer cannot become unseen transfer after refresh.
  const prior=repository.list('exposures').filter(e=>e.taskId===input.taskId&&e.taskVersion===input.taskVersion);
  if(!prior.some(e=>e.sessionId===input.sessionId&&e.kind==='task'))throw new RuntimeError('invalid_state','作答前必须有本场次题目打开事件');
  const t=this.task(input.taskId,input.taskVersion);const hinted=new Set(prior.filter(e=>e.kind==='hint').map(e=>e.hintId));
  const a=schemas.Attempt.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,sourceTime:serverTime(clock),exposureIds:prior.map(e=>e.id),hintSnapshot:t.hints.filter(h=>hinted.has(h.id)),answerExposed:prior.some(e=>['answer','chat_help'].includes(e.kind)),origin:'student_api',exposureHistory:repository.list('attempts').some(a=>a.taskId===input.taskId&&a.taskVersion===input.taskVersion&&a.exposureHistory==='legacy_unknown')?'legacy_unknown':'complete',supersedesAttemptId:null});repository.append('attempts',a);return a;
 });}
 consent(raw:z.infer<typeof schemas.SetConsent>){const input=this.parse(schemas.SetConsent,raw);const {repository,clock}=this.ctx();return repository.once(input.operationId,{kind:'consent',...input},()=>{const state=schemas.ConsentState.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,updatedAt:clock.now()});repository.append('consents',state);return state;});}
 memoryEnabled(){return this.ctx().repository.list('consents').at(-1)?.optionalMemory===true;}
 remember(raw:z.infer<typeof schemas.Remember>):MemoryItem{
  const input=this.parse(schemas.Remember,raw);const {repository,clock}=this.ctx();if(!this.memoryEnabled())throw new RuntimeError('forbidden','可选长期偏好记忆关闭');
  const result=repository.once<MemoryItem>(input.operationId,{kind:'memory',...input},()=>{const m=schemas.MemoryItem.parse({schemaVersion:SCHEMA_VERSION,id:randomUUID(),...input,createdAt:clock.now(),active:true});repository.append('memories',m);return m;});
  const live=repository.get('memories',result.id);if(!live||!live.active)throw new RuntimeError('not_found','偏好条目已停止或删除');return live;
 }
 memoryState(raw:z.infer<typeof schemas.MemoryState>){const input=this.parse(schemas.MemoryState,raw);const {repository}=this.ctx();return repository.once(input.operationId,{kind:'memory_state',...input},()=>{if(!repository.get('memories',input.memoryId))throw new RuntimeError('not_found');repository.setMemoryState(input.memoryId,input.action);return{memoryId:input.memoryId,action:input.action};});}
 context(){const{repository,clock}=this.ctx();return{sessions:this.sessions(),attemptCount:repository.list('attempts').length,memories:this.memoryEnabled()?repository.list('memories').filter(m=>m.active&&m.purpose==='tutoring'&&(!m.expiresAt||m.expiresAt>clock.now())&&(!m.reviewAt||m.reviewAt>clock.now())):[]};}
}
