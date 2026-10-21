/** 所有者：zCode（第二期：长期趋势）。由 server/agents/learning.ts 委托调用（GET /api/learning/trend）；只读，不写库。
 * TrendPoint 由 professionalReports 推导：每个点取来源报告自己的等级，月份按报告时间的上海月份算；
 * latest 每月每模块一点、同月多次测评取最近一次，history 保留全部报告的全部模块点，按时间排列。 */
import { INTERVIEW_MODULE_ORDER,type TrendPoint,type TrendQuery } from '../../../shared/learning-contracts';
import { shanghaiDate } from '../../../src/learning/review';
import type { ProfessionalContext,TrendInput } from '../context';
const order=new Map(INTERVIEW_MODULE_ORDER.map((m,i)=>[m,i]));
const key=(p:TrendPoint)=>p.month+'|'+p.module;
export function trend(input:TrendInput,ctx:ProfessionalContext):TrendQuery{
 void ctx;
 const history=input.reports
  .flatMap(report=>{const month=shanghaiDate(report.createdAt).slice(0,7);return report.modules.map(m=>({month,module:m.module,level:m.level,sourceReportId:report.id,reportCreatedAt:report.createdAt}));})
  .sort((a,b)=>Date.parse(a.reportCreatedAt)-Date.parse(b.reportCreatedAt)||order.get(a.module)!-order.get(b.module)!);
 const latest=new Map<string,TrendPoint>();
 for(const point of history){
  const existing=latest.get(key(point));
  if(!existing||Date.parse(point.reportCreatedAt)>=Date.parse(existing.reportCreatedAt))latest.set(key(point),point);
 }
 return {latest:[...latest.values()].sort((a,b)=>a.month.localeCompare(b.month)||order.get(a.module)!-order.get(b.module)!),history};
}
