/** 所有者：zCode（第二期：月阶段 / 周任务共用的日历规则）。纯函数、无依赖，服务端插件和浏览器组件都从这里取，
 * 与 src/learning/review 的 browser-safe 定位一致。日期一律是上海时区的 YYYY-MM-DD 字符串。 */
const parts=(date:string):[number,number,number]=>{const [y,m,d]=date.split('-').map(Number);return [y,m,d];};
const format=(y:number,m:number,d:number)=>new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10);
/** 日期加减天数（按日历日，不涉时区换算）。 */
export const shiftDate=(date:string,days:number)=>{const [y,m,d]=parts(date);return format(y,m,d+days);};
/** 这一一周的周一（ISO 周，周一为一周开始）。 */
export const mondayOf=(date:string)=>{const [y,m,d]=parts(date);const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();return format(y,m,d-((weekday+6)%7));};
/** 某月最后一天（也是月底复测的建议日期）。 */
export const monthEnd=(month:string)=>{const [y,m]=month.split('-').map(Number);return format(y,m+1,0);};
/** 从本周到月底的各周周一（含跨月的当前周），最多 6 项。 */
export function monthWeeks(today:string,month:string):string[]{
 const end=monthEnd(month),weeks:string[]=[];
 for(let w=mondayOf(today);w<=end&&weeks.length<6;w=shiftDate(w,7))weeks.push(w);
 return weeks;
}
/** 给学生看的周标签，如「10-19 那一周」。 */
export const weekLabel=(weekStart:string)=>`${weekStart.slice(5)} 那一周`;
