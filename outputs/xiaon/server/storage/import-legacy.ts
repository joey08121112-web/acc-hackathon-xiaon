import { z } from 'zod';
import { SCHEMA_VERSION,schemas,type EngineContext } from '../../shared/learning-contracts';
import { hash } from './repository';
import { RuntimeError } from '../core/errors';
const oldAttempt=z.object({id:z.string().min(1).max(128),value:z.string().min(1).max(8000),time:z.string().max(100),hinted:z.boolean()});
// Only this explicit legacy adapter accepts ignored legacy fields; all new wire contracts are strict.
const oldProgress=z.object({version:z.literal(1),records:z.record(z.string(),z.object({attempts:z.array(oldAttempt).max(200)}))});
export class LegacyImporter{
 constructor(private ctx:()=>EngineContext){}
 private read(source:string){const parsed=oldProgress.safeParse(JSON.parse(source));if(!parsed.success)throw new RuntimeError('invalid_params','不是支持的旧进度');return parsed.data;}
 preview(source:string){const p=this.read(source);return{hash:hash(source),attemptCount:Object.values(p.records).reduce((n,r)=>n+r.attempts.length,0),scope:'attempts_only' as const,excluded:['聊天','图片','长期偏好','旧计划','旧 correct 布尔值'],warnings:['旧时间缺年份/时区，场次和发生时刻均保留未知；不计跨天证据','保留原浏览器数据，导入不读取或清空 localStorage']};}
 import(raw:z.infer<typeof schemas.ImportRequest>){const p=schemas.ImportRequest.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params');const input=p.data;const {repository,clock,catalog}=this.ctx();
  if(input.previewHash!==this.preview(input.source).hash)throw new RuntimeError('conflict','导出预览已变更，请重新核对范围');
  return repository.once(input.operationId,{kind:'import',...input},()=>{
   const progress=this.read(input.source);let count=0;
   for(const[taskId,r]of Object.entries(progress.records)){
    if(!catalog.definition(taskId,1))throw new RuntimeError('not_found','旧题目不在可信题库');
    for(const old of r.attempts){
     const stableId='legacy-'+hash({taskId,old}).slice(0,48);if(repository.get('attempts',stableId))continue;
     const task=catalog.definition(taskId,1)!;
     repository.append('attempts',schemas.Attempt.parse({schemaVersion:SCHEMA_VERSION,id:stableId,operationId:'import-'+stableId,sessionId:null,taskId,taskVersion:1,value:old.value,sourceTime:{occurredAt:null,recordedAt:clock.now(),timezone:'Asia/Shanghai',trust:'legacy_unknown',legacyLabel:old.time},exposureIds:[],hintSnapshot:old.hinted?task.hints:[],answerExposed:false,origin:'legacy_import',exposureHistory:'legacy_unknown',supersedesAttemptId:null}));count++;
    }
   }
   return{imported:count,scope:input.scope,sourceHash:input.previewHash,warnings:this.preview(input.source).warnings};
  });
 }
}
