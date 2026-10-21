/** 所有者：zCode（第二期：月阶段目标、拆周任务、月底复测提醒）。函数体由本路实现；由 server/agents/learning.ts 委托调用。
 * 月阶段、复测提醒都是学习记录，不受记忆开关影响。四个函数都只返回值，由协调器过程序门控（server/agents/professional.ts）后写 monthStages。
 * 模块选择（需要加强优先、其次部分掌握）是这里的程序规则，模型只负责目标措辞；周计划一律通过 ctx.planning() 的现有计划引擎生成，不另建版本历史。 */
import { randomUUID } from 'node:crypto';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,MODULE_LEVEL_LABELS,RETEST_REMIND_DAYS_BEFORE,type MonthStage,type ModuleLevel,type RetestReminder,type PlanVersion,type EngineContext } from '../../../shared/learning-contracts';
import { shiftDate,mondayOf,monthEnd,monthWeeks } from '../../../src/components/plan/calendar';
import { shanghaiDate } from '../../../src/learning/review';
import type { MonthStageConfirmInput,MonthStageDraftInput,ProfessionalContext,RetestDeclineInput,RetestReminderInput } from '../context';
import { RuntimeError } from '../../core/errors';
/** 各模块没有报告建议时的默认月目标（程序措辞，模型不可用或失败时使用）。 */
const DEFAULT_SUGGESTION:Record<ModuleLevel['module'],string>={理解:'读题时能自己找出全部条件',逻辑:'能把每一步的理由说清楚',计算:'算完能自己回头核对一遍',建模:'能把题目里的情境写成算式',空间想象:'能先在脑子里转一转再动笔'};
/** 确认月目标时给现有计划引擎的时间预算（与计划页默认值一致；引擎自己决定题量与类型）。 */
export const WEEK_TIME_BUDGET_MINUTES=6;
const trimTo=(s:string,max:number)=>Array.from(s.trim()).slice(0,max).join('');
/** 程序规则：从报告的五个模块里选本月聚焦的模块——「需要加强」优先，其次「部分掌握」，同级按固定顺序；没有就不出月目标。 */
export function focusModule(modules:readonly ModuleLevel[]):ModuleLevel|null{
 for(const level of ['needs_work','partial'] as const){
  const hit=INTERVIEW_MODULE_ORDER.flatMap(name=>modules.filter(m=>m.module===name&&m.level===level)).at(0);
  if(hit)return hit;
 }
 return null;
}
const fallbackGoal=(focus:ModuleLevel,previous:MonthStage|null)=>{
 const hint=focus.suggestions[0]??DEFAULT_SUGGESTION[focus.module];
 const carry=previous&&previous.module===focus.module;
 return trimTo(carry?`继续上个月在${focus.module}上的脚步：${hint}`:`这个月在${focus.module}上往前一步：${hint}`,200);
};
/** 模型只措辞：模块、等级都由程序给定；输出过长、带分数排名或不是 JSON 时回退程序措辞。 */
async function wordGoal(input:MonthStageDraftInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<{goal:string;mode:'model'|'local_rules'}>{
 const focus=focusModule(input.report.modules)!;
 const fallback=fallbackGoal(focus,input.previous);
 if(ctx.providerKind==='offline')return {goal:fallback,mode:'local_rules'};
 try{
  const {content}=await ctx.model({operationId:input.operationId+'-goal',prompt:{version:'stage-goal-i2',text:[
   '你是小N，七年级学生的学习伙伴，说话像温和的同学。程序已经按评测等级选定了这个月要练的模块，你只负责把它写成一句本月目标。',
   `模块：${focus.module}（${MODULE_LEVEL_LABELS[focus.level]}）。报告建议：${focus.suggestions.join('；')||DEFAULT_SUGGESTION[focus.module]}。${input.previous?`上个月的目标是「${input.previous.goal}」（${input.previous.module}）。`:''}`,
   '要求：20到60个字，说这个月学生能做到的一件具体的事；不打分、不排名、不评价人，不改模块。输出严格JSON {"goal":"..."}，不要任何其他文字。',
  ].join('\n')},data:{module:focus.module,level:focus.level,suggestions:focus.suggestions,previousGoal:input.previous?.goal??null},timeoutMs:20_000},signal);
  const match=content.match(/\{[\s\S]*\}/);const value=match?JSON.parse(match[0]) as {goal?:unknown}:null;
  if(typeof value?.goal==='string'){
   const goal=trimTo(value.goal,200);
   if(goal&&!/总分|排名|名次|\d+\s*分/.test(goal))return {goal,mode:'model'};
  }
 }catch{/* 模型失败用程序措辞，草案照样能出 */}
 return {goal:fallback,mode:'local_rules'};
}
/** 未确认的第 1 版草案：模块由程序按等级选，目标一句话（模型措辞或程序措辞），复测建议在月底，weeks 是本周到月底各周的脚手架。 */
export async function draftMonthStage(input:MonthStageDraftInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<MonthStage>{
 const focus=focusModule(input.report.modules);
 if(!focus)throw new RuntimeError('invalid_state','评测报告里没有需要加强或部分掌握的模块，本月不用定目标');
 const now=ctx.clock.now();
 const {goal,mode}=await wordGoal(input,ctx,signal);
 return schemas.MonthStage.parse({schemaVersion:SCHEMA_VERSION,id:'stage-'+randomUUID(),operationId:input.operationId,revision:1,
  month:input.month,module:focus.module,goal,sourceReportId:input.report.id,
  weeks:monthWeeks(shanghaiDate(now),input.month).map(weekStart=>({weekStart,proposalId:null,planVersionId:null})),
  retestSuggestedAt:monthEnd(input.month),status:'draft',confirmation:null,retestDeclinedAt:null,mode,createdAt:now,updatedAt:now});
}
/** 学生点「确认」后用现有计划引擎出本周草案并记入 weeks；planVersionId 留空——周计划的确认走现有 learning/confirm，由学生在计划页选择接受 / 减量 / 改期 / 暂不开始。 */
async function weekPlan(input:MonthStageConfirmInput,ctx:ProfessionalContext,weeks:MonthStage['weeks']):Promise<MonthStage['weeks']>{
 const weekStart=mondayOf(shanghaiDate(ctx.clock.now()));
 if(weeks.some(w=>w.weekStart===weekStart&&w.proposalId))return weeks;
 const assessment=await ctx.assessment(input.operationId+'-snap');
 const proposal=await ctx.planning().propose({operationId:input.operationId+'-week',assessment,timeBudgetMinutes:WEEK_TIME_BUDGET_MINUTES,focus:{module:input.stage.module,goal:input.goal}},ctx);
 const entry={weekStart,proposalId:proposal.id,planVersionId:null};
 return (weeks.some(w=>w.weekStart===weekStart)?weeks.map(w=>w.weekStart===weekStart?entry:w):[...weeks,entry].sort((a,b)=>a.weekStart.localeCompare(b.weekStart))).slice(0,6);
}
/** 新修订：确认记录由程序按本次点击写（action、目标文字、程序时钟）；「暂不开始」不安排任务。 */
export async function confirmMonthStage(input:MonthStageConfirmInput,ctx:ProfessionalContext):Promise<MonthStage>{
 const stage=input.stage,now=ctx.clock.now();
 const weeks=input.action==='accept'?await weekPlan(input,ctx,stage.weeks):stage.weeks;
 return schemas.MonthStage.parse({...stage,operationId:input.operationId,revision:stage.revision+1,
  status:input.action==='accept'?'confirmed':'deferred',confirmation:{action:input.action,confirmedAt:now,actor:'student'},goal:input.goal,weeks,updatedAt:now});
}
/** 学生拒绝复测：只写拒绝时间，其余保持，本月不再提醒。 */
export async function declineRetest(input:RetestDeclineInput,ctx:ProfessionalContext):Promise<MonthStage>{
 const stage=input.stage,now=ctx.clock.now();
 return schemas.MonthStage.parse({...stage,operationId:input.operationId,revision:stage.revision+1,retestDeclinedAt:now,updatedAt:now});
}
/** 只读：已确认、未拒绝的月阶段，从建议日期前 RETEST_REMIND_DAYS_BEFORE 天起到建议日期当天提醒；多个月阶段同时进窗口时取最近的那个。 */
export function retestReminder(input:RetestReminderInput,ctx:ProfessionalContext):RetestReminder|null{
 void ctx;
 const today=shanghaiDate(input.at);
 let pick:MonthStage|null=null;
 for(const stage of input.stages){
  if(stage.status!=='confirmed'||stage.retestDeclinedAt)continue;
  const remindFrom=shiftDate(stage.retestSuggestedAt,-RETEST_REMIND_DAYS_BEFORE);
  if(today<remindFrom||today>stage.retestSuggestedAt)continue;
  if(!pick||stage.month>pick.month||(stage.month===pick.month&&stage.retestSuggestedAt>pick.retestSuggestedAt))pick=stage;
 }
 return pick?{stageId:pick.id,month:pick.month,retestSuggestedAt:pick.retestSuggestedAt,remindFrom:shiftDate(pick.retestSuggestedAt,-RETEST_REMIND_DAYS_BEFORE)}:null;
}

/** Explicit student click only. A later week gets a draft, never a confirmed plan. */
export async function draftStageWeek(input:{operationId:string;stage:MonthStage},ctx:ProfessionalContext):Promise<MonthStage>{
 const stage=input.stage,today=shanghaiDate(ctx.clock.now()),weekStart=mondayOf(today);
 if(stage.status!=='confirmed'||stage.retestDeclinedAt||stage.month!==today.slice(0,7)||!stage.weeks.some(w=>w.weekStart===weekStart))throw new RuntimeError('invalid_state','这个月阶段现在不能安排周任务');
 const weeks=await weekPlan({...input,stageId:stage.id,expectedRevision:stage.revision,action:'accept',goal:stage.goal},ctx,stage.weeks);
 if(weeks===stage.weeks)return stage;
 return schemas.MonthStage.parse({...stage,weeks,operationId:input.operationId,revision:stage.revision+1,updatedAt:ctx.clock.now()});
}
/** Return a revision for the coordinator to validate/save after the existing student confirmation. */
export function linkWeekPlan(plan:PlanVersion,ctx:EngineContext):MonthStage|null{
 const latest=new Map<string,MonthStage>();for(const s of ctx.repository.list('monthStages'))latest.set(s.id,s);
 const stage=[...latest.values()].find(s=>s.status==='confirmed'&&s.weeks.some(w=>w.proposalId===plan.proposalId));
 if(!stage||stage.weeks.some(w=>w.proposalId===plan.proposalId&&w.planVersionId===plan.id))return null;
 return schemas.MonthStage.parse({...stage,operationId:plan.operationId,revision:stage.revision+1,updatedAt:ctx.clock.now(),weeks:stage.weeks.map(w=>w.proposalId===plan.proposalId?{...w,planVersionId:plan.id}:w)});
}
