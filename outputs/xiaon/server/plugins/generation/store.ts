import { schemas,type LearningRepository,type TaskDefinition } from '../../../shared/learning-contracts';
import { fingerprint,parseExpression,questionExpression } from './expression';
import type { KnowledgePointId } from './templates';
/**
 * Published generated tasks, read from SQLite through their GenerationRecord. A TaskDefinition row alone
 * (e.g. the exposure snapshot of a static task) never enters the catalog; rejected candidates never exist.
 */
export class GeneratedTaskStore {
 private cache:{key:string;tasks:readonly TaskDefinition[]}|null=null;
 constructor(private repository:()=>LearningRepository,private epoch:()=>number){}
 published():readonly TaskDefinition[]{
  const repo=this.repository();const key=`${this.epoch()}:${repo.revision()}`;
  if(this.cache?.key===key)return this.cache.tasks;
  const tasks=repo.list('generations').filter(g=>g.status==='published'&&g.taskId&&g.taskVersion).flatMap(g=>{
   const row=repo.get('tasks',`${g.taskId}:v${g.taskVersion}`);
   const parsed=row?schemas.TaskDefinition.safeParse(row):undefined;
   return parsed?.success&&parsed.data.id===g.taskId?[deepFreeze(parsed.data)]:[];
  });
  this.cache={key,tasks:Object.freeze(tasks)};return this.cache.tasks;
 }
}
/** Fingerprints of every known "化简：…" task for this knowledge point's content space (static, legacy, generated). */
export function knownFingerprints(knowledgePointId:KnowledgePointId,definitions:readonly TaskDefinition[]):Set<string>{
 const out=new Set<string>();
 for(const t of definitions){if(t.primaryDimension!=='计算')continue;const expression=questionExpression(t.question);const items=expression?parseExpression(expression):null;if(items)out.add(fingerprint(knowledgePointId,items));}
 return out;
}
function deepFreeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const c of Object.values(v))deepFreeze(c);}return v;}
