/** 学习记录导出：把服务端存着的这个学生的全部学习记录交出来。
 *
 * 2026-11-21 加。审查发现记忆治理七条红线里第 7 条「无查看/删除/导出入口」命中 ——
 * 界面有查看和删除，但没有导出。对未成年人数据来说，「拿得走」和「看得见」缺一不可。
 *
 * 唯一不导出的是 learning.problemSecrets：那是判题用的参考答案，不是「关于学生的记录」。
 * 这一条在导出的 note 里写明，不做静默省略。
 */
import { entitySchemas } from '../storage/repository';
import type { LearningRepository } from '../../shared/learning-contracts';

export const EXPORT_EXCLUDED_COLLECTIONS=['problemSecrets'] as const;

export function exportLearning(repository:LearningRepository){
 const collections:Record<string,unknown[]>={};
 for(const name of Object.keys(entitySchemas)){
  if((EXPORT_EXCLUDED_COLLECTIONS as readonly string[]).includes(name))continue;
  collections[name]=repository.list(name as keyof typeof entitySchemas);
 }
 return collections;
}
