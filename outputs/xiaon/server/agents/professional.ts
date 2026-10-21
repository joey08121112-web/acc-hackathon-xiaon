/** 所有者：Claude（第二期契约补丁）。专业模式的程序门控：插件（interview、stages、tracking）的输出在写库或出服务端前必须通过这里。
 * 只检查事实与引用（模块顺序、等级与依据一致、引用存在、确认由学生写），不替插件做选题、判级或选模块。 */
import { INTERVIEW_MODULE_ORDER,INTERVIEW_REQUIRED_MODULES,LEVEL_BY_BASIS,type ChatObservation,type InterviewSession,type MonthStage,type ProfessionalReport,type TrendQuery } from '../../shared/learning-contracts';
import { RuntimeError } from '../core/errors';
import { shanghaiDate } from '../../src/learning/review';
/** 理解和逻辑都测完才能出报告（decision 15）。 */
export const reportReady=(interview:Pick<InterviewSession,'completedModules'>|null)=>!!interview&&INTERVIEW_REQUIRED_MODULES.every(m=>interview.completedModules.includes(m));
/** Latest revision of each id, in first-seen order (interviews and monthStages are append-only revisions). */
export function latestRevisions<T extends {id:string;revision:number}>(rows:readonly T[]):T[]{
 const out=new Map<string,T>();for(const row of rows){const prev=out.get(row.id);if(!prev||row.revision>prev.revision)out.set(row.id,row);}return [...out.values()];
}
export interface ReportFacts { interview:InterviewSession;observations:readonly ChatObservation[];reportIds:ReadonlySet<string>;supersedes:ProfessionalReport|null;attemptIds:ReadonlySet<string>;evidenceIds:ReadonlySet<string>;turnIds:ReadonlySet<string> }
/** Reasons a plugin report must be refused; empty = acceptable. The level always follows the program basis, never the model. */
export function reportProblems(report:ProfessionalReport,facts:ReportFacts):string[]{
 const problems:string[]=[];
 if(report.interviewId!==facts.interview.id)problems.push('interviewId 与测评不一致');
 report.modules.forEach((m,i)=>{
  if(m.module!==INTERVIEW_MODULE_ORDER[i])problems.push(`第${i+1}个模块应为${INTERVIEW_MODULE_ORDER[i]}`);
  if(m.level!==LEVEL_BY_BASIS[m.basis])problems.push(`${m.module}的等级与程序依据不一致`);
  const tested=facts.interview.completedModules.includes(m.module);
  if(m.level==='not_tested'){
   if(tested)problems.push(`${m.module}已测完，不能标还没测到`);
   if(m.evidenceIds.length||m.attemptIds.length||m.turnIds.length||m.quotes.length||m.suggestions.length)problems.push(`${m.module}还没测到，不能附依据或建议`);
  }else{
   if(!tested)problems.push(`${m.module}没有测完，只能标还没测到`);
   if(!m.attemptIds.length)problems.push(`${m.module}缺少作答依据`);
  }
  if(m.level==='good'&&m.suggestions.length)problems.push(`${m.module}掌握得不错，不附学习建议`);
  for(const a of m.attemptIds)if(!facts.attemptIds.has(a))problems.push(`${m.module}引用了不存在的作答`);
  for(const e of m.evidenceIds)if(!facts.evidenceIds.has(e))problems.push(`${m.module}引用了不存在的证据`);
  for(const t of m.turnIds)if(!facts.turnIds.has(t))problems.push(`${m.module}引用了不属于本次测评的问答`);
 });
 for(const required of INTERVIEW_REQUIRED_MODULES)if(report.modules.find(m=>m.module===required)?.level==='not_tested')problems.push(`${required}必须测完才能出报告`);
 const observations=new Map(facts.observations.map(o=>[o.id,o]));
 for(const c of report.observationChecks){const o=observations.get(c.observationId);if(!o)problems.push('对照引用了不存在的观察');else if(o.dimension!==c.dimension)problems.push('对照的维度与观察不一致');}
 if(report.comparedWithReportId&&!facts.reportIds.has(report.comparedWithReportId))problems.push('和上次比引用了不存在的报告');
 if(report.supersedesReportId!==(facts.supersedes?.id??null))problems.push('supersedesReportId 应为本测评上一份报告');
 if(report.version!==(facts.supersedes?facts.supersedes.version+1:1))problems.push('报告版本号不连续');
 return problems;
}
export const refuse=(problems:string[])=>{if(problems.length)throw new RuntimeError('internal_error','插件结果未通过程序校验：'+problems.slice(0,5).join('；'));};
/** A new draft: revision 1, unconfirmed, for the program's month and the given report. */
export function draftProblems(stage:MonthStage,facts:{reportId:string;month:string}):string[]{
 const problems:string[]=[];
 if(stage.sourceReportId!==facts.reportId)problems.push('来源报告不一致');
 if(stage.month!==facts.month)problems.push('月份应为当前月');
 if(stage.revision!==1||stage.status!=='draft'||stage.confirmation!==null||stage.retestDeclinedAt!==null)problems.push('草案应为未确认的第 1 版');
 if(!stage.retestSuggestedAt.startsWith(facts.month))problems.push('复测建议日期应在本月');
 return problems;
}
/** A follow-up revision of the same stage. The student's click is the only source of confirmation, written with the program clock. */
export function revisionProblems(next:MonthStage,prev:MonthStage,expect:{now:string;confirm?:{action:'accept'|'defer';goal:string};decline?:true}):string[]{
 const problems:string[]=[];
 if(next.id!==prev.id||next.revision!==prev.revision+1)problems.push('应为同一月阶段的下一版');
 if(next.sourceReportId!==prev.sourceReportId||next.month!==prev.month||next.createdAt!==prev.createdAt)problems.push('来源报告、月份和创建时间不可改');
 if(expect.confirm){
  const c=next.confirmation;
  if(!c||c.action!==expect.confirm.action||c.confirmedAt!==expect.now)problems.push('确认记录必须来自本次学生点击');
  if(next.status!==(expect.confirm.action==='accept'?'confirmed':'deferred'))problems.push('状态与学生的选择不一致');
  if(next.goal!==expect.confirm.goal)problems.push('目标应为学生确认的文字');
 }else if(JSON.stringify(next.confirmation)!==JSON.stringify(prev.confirmation)||next.status!==prev.status||next.goal!==prev.goal)problems.push('没有学生确认时不能改确认、状态或目标');
 if(expect.decline&&next.retestDeclinedAt!==expect.now)problems.push('拒绝复测时间应为本次点击');
 if(!expect.decline&&next.retestDeclinedAt!==prev.retestDeclinedAt)problems.push('不能改拒绝复测记录');
 return problems;
}
/** Every trend point must come from an existing report and carry exactly that report's level; latest must be part of history. */
export function trendProblems(trend:TrendQuery,reports:readonly ProfessionalReport[]):string[]{
 const byId=new Map(reports.map(r=>[r.id,r]));const problems:string[]=[];
 const key=(p:TrendQuery['history'][number])=>`${p.month}|${p.module}|${p.sourceReportId}`;const history=new Set(trend.history.map(key));
 for(const p of [...trend.latest,...trend.history]){const r=byId.get(p.sourceReportId);if(!r){problems.push('趋势引用了不存在的报告');continue;}if(r.modules.find(m=>m.module===p.module)?.level!==p.level)problems.push('趋势等级与来源报告不一致');if(r.createdAt!==p.reportCreatedAt||shanghaiDate(r.createdAt).slice(0,7)!==p.month)problems.push('趋势月份或时间与来源报告不一致');}
 for(const p of trend.latest)if(!history.has(key(p)))problems.push('latest 必须出自 history');
 return problems;
}
