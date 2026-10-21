/** 所有者：ChatGPT。只做上海日历分组；趋势等级直接使用服务端返回值。 */
import type { LearningUI } from '../../agents/useLearning';
import type { TrendQuery } from '../../../shared/learning-contracts';
export const professionalDate=(at:string)=>at?new Date(at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'日期暂缺';
export function professionalMonth(at:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(new Date(at));
 return parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value;
}
export function archiveMonths(view:NonNullable<LearningUI['view']>,trend:TrendQuery|null){
 return [...new Set([...(trend?.history??[]).map(p=>p.month),...view.summaries.map(s=>professionalMonth(s.createdAt)),...view.progressCards.map(c=>professionalMonth(c.confirmedAt))])].sort().reverse();
}
