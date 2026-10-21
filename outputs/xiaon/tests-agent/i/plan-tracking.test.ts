/** 所有者：zCode。第二期：月阶段目标、拆周任务、月底复测提醒、长期趋势。合成材料，TestClock 推进日期，不依赖真实模型。
 * 覆盖任务书测试要求：模块选择符合等级优先级；不确认不生效；周任务走现有计划版本；拒绝复测后本月不再提醒；趋势同月取最近一次且历史可查。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRuntime,type LearningRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { draftMonthStage,confirmMonthStage,declineRetest,retestReminder,focusModule } from '../../server/plugins/stages';
import { trend } from '../../server/plugins/tracking';
import type { ProfessionalContext } from '../../server/plugins/context';
import { freePort,temporaryRepository,TestClock } from '../../server/storage/testing';
import { draftProblems,revisionProblems,trendProblems } from '../../server/agents/professional';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,RETEST_REMIND_DAYS_BEFORE,type Dimension,type ModuleLevel,type MonthStage,type ProfessionalReport,type TrendPoint } from '../../shared/learning-contracts';
import { shanghaiDate } from '../../src/learning/review';
import type { LearningUI } from '../../src/agents/useLearning';
import { MonthStageView } from '../../src/components/plan/MonthStageView';
import { WeeklyTasksView } from '../../src/components/plan/WeeklyTasksView';
import { RetestReminder } from '../../src/components/plan/RetestReminder';
const id=()=>crypto.randomUUID(),DAY=86_400_000;
const SUGGESTIONS:Record<Dimension,string>={理解:'读题时先圈出全部条件',逻辑:'把理由一步一步说清楚',计算:'先准后快，算完回看一步',建模:'把生活情境先翻译成算式',空间想象:'在脑子里先转一转，再动笔画'};
/** 按固定顺序生成五个模块等级；未给的模块记 not_tested（basis/作答依据与等级保持一致）。 */
const levels=(spec:Partial<Record<Dimension,'good'|'partial'|'needs_work'>>):ModuleLevel[]=>INTERVIEW_MODULE_ORDER.map((name,index)=>{
 const level=spec[name]??'not_tested';
 const basis=level==='good'?'correct_with_reason':level==='partial'?'completed_with_hint':level==='needs_work'?'incorrect_on_both':'not_tested';
 const tested=level!=='not_tested';
 return {module:name,level,basis,evidenceIds:[] as string[],attemptIds:tested?['att-'+index]:[],turnIds:[] as string[],quotes:[] as string[],wording:null,suggestions:level==='needs_work'||level==='partial'?[SUGGESTIONS[name]]:[],scope:'this_interview' as const};
});
const report=(rid:string,createdAt:string,spec:Partial<Record<Dimension,'good'|'partial'|'needs_work'>>):ProfessionalReport=>
 ({schemaVersion:SCHEMA_VERSION,id:rid,operationId:'op-'+rid,evidenceRevision:1,interviewId:'iv-'+rid,version:1,supersedesReportId:null,comparedWithReportId:null,modules:levels(spec),observationChecks:[],changes:[],mode:'local_rules',createdAt});
/** 离线 ProfessionalContext：不调用模型；planning/assessment 用注册引擎。 */
const offline=(r:LearningRuntime):ProfessionalContext=>({...r.engineContext(),events:r.events,providerKind:'offline' as const,memoryEnabled:()=>r.events.memoryEnabled(),
 model:()=>{throw new Error('本测试不调用模型');},submitAttempt:async()=>{throw new Error('本测试不作答');},
 planning:()=>r.planning(),assessment:operationId=>r.assessment().snapshot({operationId},r.engineContext())});

test('模块选择是程序规则：需要加强优先，其次部分掌握，同级按固定顺序',()=>{
 assert.equal(focusModule(levels({理解:'good',逻辑:'needs_work',计算:'partial'}))?.module,'逻辑','需要加强排在部分掌握之前');
 assert.equal(focusModule(levels({理解:'partial',逻辑:'good',计算:'partial'}))?.module,'理解','同级按固定顺序');
 assert.equal(focusModule(levels({计算:'needs_work',建模:'needs_work'}))?.module,'计算');
 assert.equal(focusModule(levels({理解:'good',逻辑:'good'})),null,'没有需要加强或部分掌握的模块时没有月目标');
});

test('draftMonthStage：离线草案（revision 1、未确认、月底复测、周一脚手架），过 draftProblems 门控',async()=>{
 const f=temporaryRepository(new TestClock('2026-10-21T00:00:00.000Z'));try{
 const r=createRuntime(f),ctx=offline(r);
 const draft=await draftMonthStage({operationId:id(),report:report('rep-1','2026-10-20T10:00:00.000Z',{理解:'needs_work',逻辑:'partial'}),month:'2026-10',previous:null},ctx);
 assert.equal(draft.revision,1);assert.equal(draft.status,'draft');assert.equal(draft.confirmation,null);assert.equal(draft.retestDeclinedAt,null);
 assert.equal(draft.module,'理解','等级优先级决定模块，不由模型决定');
 assert.equal(draft.sourceReportId,'rep-1');
 assert.equal(draft.retestSuggestedAt,'2026-10-31','复测建议在月底');
 assert.deepEqual(draft.weeks.map(w=>w.weekStart),['2026-10-19','2026-10-26'],'本月剩余各周从本周周一开始');
 assert.ok(draft.weeks.every(w=>w.proposalId===null&&w.planVersionId===null),'草案阶段还没生成周计划');
 assert.ok(draft.goal.length>0&&draft.goal.length<=200);assert.equal(draft.mode,'local_rules','离线用程序措辞');
 assert.deepEqual(draftProblems(draft,{reportId:'rep-1',month:'2026-10'}),[],'契约门控通过');
 // 上个月同模块：措辞接续上个月
 const carry=await draftMonthStage({operationId:id(),report:report('rep-2','2026-10-20T10:00:00.000Z',{理解:'partial'}),month:'2026-10',
  previous:{...draft,id:'stage-9',month:'2026-09',status:'confirmed'}},ctx);
 assert.ok(carry.goal.includes('继续'),'与上月同模块时接续措辞');
 // 没有可聚焦模块：明确拒绝，不出空目标
 await assert.rejects(draftMonthStage({operationId:id(),report:report('rep-3','2026-10-20T10:00:00.000Z',{理解:'good',逻辑:'good'}),month:'2026-10',previous:null},ctx),{code:'invalid_state'});
 }finally{f.dispose();}
});

test('draftMonthStage：模型只负责措辞，模块与结构不由模型决定；模型失败回退程序措辞',async()=>{
 const f=temporaryRepository(new TestClock('2026-10-21T00:00:00.000Z'));try{
 const r=createRuntime(f);
 const goalText='这个月读题时，先自己圈出全部条件再动笔';
 const withModel=(content:string):ProfessionalContext=>({...offline(r),providerKind:'synthetic' as const,
  model:async()=>({content,run:{} as never})});
 const viaModel=await draftMonthStage({operationId:id(),report:report('rep-1','2026-10-20T10:00:00.000Z',{计算:'needs_work'}),month:'2026-10',previous:null},withModel(JSON.stringify({goal:goalText})));
 assert.equal(viaModel.mode,'model');assert.equal(viaModel.goal,goalText);assert.equal(viaModel.module,'计算');
 const broken=await draftMonthStage({operationId:id(),report:report('rep-2','2026-10-20T10:00:00.000Z',{计算:'needs_work'}),month:'2026-10',previous:null},withModel('不是JSON'));
 assert.equal(broken.mode,'local_rules');assert.ok(broken.goal.includes(SUGGESTIONS.计算),'回退用程序措辞');
 }finally{f.dispose();}
});

test('confirmMonthStage：学生点击才生效；accept 生成本周计划草案并记入 weeks；defer 不安排任务',async()=>{
 const f=temporaryRepository(new TestClock('2026-10-21T00:00:00.000Z'));try{
 const r=createRuntime(f),d=installLearning(r,{timeoutMs:2000}),ctx=offline(r);
 const draft=await draftMonthStage({operationId:id(),report:report('rep-1','2026-10-20T10:00:00.000Z',{理解:'needs_work'}),month:'2026-10',previous:null},ctx);
 // 插件不写库：直接调用后仓库里没有月阶段
 assert.equal(r.repository.list('monthStages').length,0,'不确认不生效，草案不落库');
 const accepted=await confirmMonthStage({operationId:id(),stageId:draft.id,expectedRevision:draft.revision,action:'accept',goal:'读题时能自己找出全部条件',stage:draft},ctx);
 assert.equal(accepted.revision,draft.revision+1);assert.equal(accepted.status,'confirmed');
 assert.deepEqual(accepted.confirmation,{action:'accept',confirmedAt:ctx.clock.now(),actor:'student'},'确认记录来自程序时钟与学生点击');
 assert.equal(accepted.goal,'读题时能自己找出全部条件','目标用学生确认的文字');
 const week=accepted.weeks.find(w=>w.weekStart==='2026-10-19')!;
 assert.ok(week.proposalId,'接受后本周记录现有计划引擎的草案 id');
 const proposal=r.repository.list('proposals').find(p=>p.id===week.proposalId)!;
 assert.ok(proposal,'周计划草案走现有计划引擎');
 assert.deepEqual(revisionProblems(accepted,draft,{now:ctx.clock.now(),confirm:{action:'accept',goal:accepted.goal}}),[],'契约门控通过');
 assert.equal(r.repository.list('monthStages').length,0,'确认新修订同样由协调器写库，插件不写');
 const deferred=await confirmMonthStage({operationId:id(),stageId:draft.id,expectedRevision:draft.revision,action:'defer',goal:draft.goal,stage:draft},ctx);
 assert.equal(deferred.status,'deferred');assert.ok(deferred.weeks.every(w=>w.proposalId===null),'暂不开始不安排任务');
 // 学生随后用现有 learning/confirm 确认周计划：出现正式计划版本， weeks[].planVersionId 仍为空（无挂载路由，前端按 proposalId 对应）
 const plan=await d.confirm({operationId:id(),proposalId:week.proposalId,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'学生接受本周任务'});
 assert.equal(plan.proposalId,week.proposalId);assert.equal(plan.confirmation.actor,'student');
 assert.ok(r.repository.list('plans').some(p=>p.proposalId===week.proposalId),'周任务进入现有计划版本历史');
 assert.equal(accepted.weeks.find(w=>w.weekStart==='2026-10-19')!.planVersionId,null);
 }finally{f.dispose();}
});

test('retestReminder：到期前 3 天起提醒；拒绝后、未确认、非本月窗口都不提醒',()=>{
 const stage=(over:Partial<MonthStage>={}):MonthStage=>({schemaVersion:SCHEMA_VERSION,id:'stage-1',operationId:'op-st-1',revision:1,month:'2026-10',module:'理解',goal:'读题时能自己找出全部条件',sourceReportId:'rep-1',
  weeks:[],retestSuggestedAt:'2026-10-31',status:'confirmed',confirmation:{action:'accept',confirmedAt:'2026-10-21T00:00:00.000Z',actor:'student'},retestDeclinedAt:null,mode:'local_rules',createdAt:'2026-10-21T00:00:00.000Z',updatedAt:'2026-10-21T00:00:00.000Z',...over});
 const at=(day:string)=>({at:day+'T04:00:00.000Z',stages:null as unknown as MonthStage[]});
 const ctx=null as unknown as ProfessionalContext;
 const confirmed=stage();
 assert.equal(retestReminder({...at('2026-10-26'),stages:[confirmed]},ctx),null,'窗口前不提醒');
 assert.equal(retestReminder({...at('2026-10-27'),stages:[confirmed]},ctx),null);
 const inWindow=retestReminder({...at('2026-10-28'),stages:[confirmed]},ctx);
 assert.deepEqual(inWindow,{stageId:'stage-1',month:'2026-10',retestSuggestedAt:'2026-10-31',remindFrom:shanghaiDate(new Date(Date.parse('2026-10-31T00:00:00Z')-RETEST_REMIND_DAYS_BEFORE*DAY).toISOString())});
 assert.equal(retestReminder({...at('2026-10-31'),stages:[confirmed]},ctx)?.stageId,'stage-1','到期当天仍提醒');
 assert.equal(retestReminder({...at('2026-11-01'),stages:[confirmed]},ctx),null,'过了建议日期不再提醒');
 assert.equal(retestReminder({...at('2026-10-29'),stages:[stage({retestDeclinedAt:'2026-10-28T01:00:00.000Z'})]},ctx),null,'学生拒绝后本月不再提');
 assert.equal(retestReminder({...at('2026-10-29'),stages:[stage({status:'draft',confirmation:null})]},ctx),null,'未确认的草案不提醒');
 assert.equal(retestReminder({...at('2026-10-29'),stages:[stage({status:'deferred'})]},ctx),null,'暂不开始不提醒');
 assert.equal(retestReminder({...at('2026-10-29'),stages:[stage({status:'superseded'})]},ctx),null,'被取代的旧草案不提醒');
 const november=stage({id:'stage-11',month:'2026-11',retestSuggestedAt:'2026-11-30'});
 assert.equal(retestReminder({...at('2026-10-29'),stages:[confirmed,november]},ctx)?.stageId,'stage-1','只提进入窗口的那个');
 assert.equal(retestReminder({...at('2026-11-28'),stages:[confirmed,november]},ctx)?.stageId,'stage-11');
});

test('declineRetest：新修订只写拒绝时间，其余不变',async()=>{
 const f=temporaryRepository(new TestClock('2026-10-28T04:00:00.000Z'));try{
 const ctx=offline(createRuntime(f));
 const prev:MonthStage={schemaVersion:SCHEMA_VERSION,id:'stage-1',operationId:'op-st-1',revision:2,month:'2026-10',module:'理解',goal:'读题时能自己找出全部条件',sourceReportId:'rep-1',
  weeks:[{weekStart:'2026-10-19',proposalId:'prop-1',planVersionId:null}],retestSuggestedAt:'2026-10-31',status:'confirmed',confirmation:{action:'accept',confirmedAt:'2026-10-21T00:00:00.000Z',actor:'student'},retestDeclinedAt:null,mode:'local_rules',createdAt:'2026-10-21T00:00:00.000Z',updatedAt:'2026-10-21T00:00:00.000Z'};
 const next=await declineRetest({operationId:id(),stage:prev},ctx);
 assert.equal(next.revision,prev.revision+1);assert.equal(next.retestDeclinedAt,ctx.clock.now());
 assert.equal(next.status,prev.status);assert.equal(next.goal,prev.goal);assert.deepEqual(next.confirmation,prev.confirmation);
 assert.deepEqual(revisionProblems(next,prev,{now:ctx.clock.now(),decline:true}),[]);
 }finally{f.dispose();}
});

test('trend：同月多次测评取最近一次；保留全部历史；月份按上海时间；过 trendProblems 门控',()=>{
 const oct1=report('rep-o1','2026-10-08T02:00:00.000Z',{理解:'needs_work',逻辑:'partial'});
 const oct2=report('rep-o2','2026-10-20T02:00:00.000Z',{理解:'partial',逻辑:'good'});
 // UTC 还是 10 月底，上海时间已到 11 月：月份应为 2026-11
 const nov=report('rep-n1','2026-10-31T18:00:00.000Z',{理解:'good'});
 const ctx=null as unknown as ProfessionalContext;
 const out=trend({at:'2026-11-02T00:00:00.000Z',reports:[oct1,oct2,nov]},ctx);
 assert.deepEqual(trendProblems(out,[oct1,oct2,nov]),[],'每个点都能对上来源报告');
 assert.equal(out.history.length,15,'全部报告 × 5 个模块都保留');
 const latest=new Map(out.latest.map(p=>[p.month+'|'+p.module,p]));
 assert.equal(latest.get('2026-10|理解')?.sourceReportId,'rep-o2','同月取最近一次');
 assert.equal(latest.get('2026-10|理解')?.level,'partial');
 assert.equal(latest.get('2026-10|逻辑')?.level,'good');
 assert.equal(latest.get('2026-11|理解')?.month,'2026-11','月份按上海时间');
 assert.ok([...latest.values()].every(p=>out.history.some(h=>h.sourceReportId===p.sourceReportId&&h.month===p.month&&h.module===p.module)),'latest 出自 history');
 assert.deepEqual(trend({at:'2026-11-02T00:00:00.000Z',reports:[]},ctx),{latest:[],history:[]});
});

test('HTTP 端到端：草案→确认→周计划→提醒→拒绝；记忆关闭不影响；重置清除',async()=>{
 const clock=new TestClock('2026-10-21T00:00:00.000Z');
 const f=temporaryRepository(clock),r=createRuntime(f),d=installLearning(r,{timeoutMs:2000});
 const port=await freePort(),base=`http://127.0.0.1:${port}`,origin='http://127.0.0.1:5213';
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
  const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=async(path:string,body:unknown)=>{const res=await fetch(base+'/api/learning/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json() as Record<string,unknown>};};
  // 客户端不能替程序选模块
  assert.equal((await post('stage/draft',{operationId:id(),reportId:'rep-1',module:'计算'})).status,400);
  r.repository.append('professionalReports',report('rep-1','2026-10-20T10:00:00.000Z',{理解:'needs_work',逻辑:'partial'}));
  const draft=await post('stage/draft',{operationId:id(),reportId:'rep-1'});
  assert.equal(draft.status,200);assert.equal((draft.body as MonthStage).status,'draft');assert.equal((draft.body as MonthStage).module,'理解');
  const stageId=(draft.body as MonthStage).id;
  const accepted=await post('stage/confirm',{operationId:id(),stageId,expectedRevision:1,action:'accept',goal:'读题时能自己找出全部条件'});
  assert.equal(accepted.status,200);assert.equal((accepted.body as MonthStage).status,'confirmed');
  const saved=r.repository.list('monthStages');
  assert.ok(saved.some(s=>s.status==='confirmed'),'协调器写库');
  const week=(accepted.body as MonthStage).weeks.find(w=>w.weekStart==='2026-10-19')!;
  assert.ok(week.proposalId,'确认即用现有引擎出本周草案');
  // 学生按现有流程确认周计划
  const plan=await post('confirm',{operationId:id(),proposalId:week.proposalId,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'学生接受本周任务'});
  assert.equal(plan.status,200);
  // 记忆关闭：月阶段与提醒照常
  r.events.consent({operationId:id(),optionalMemory:false});
  let view=await d.view();
  assert.equal(view.monthStages.length,1);assert.equal(view.retestReminder,null,'还没到提醒窗口');
  // 同月再出草案：已确认 → 409
  assert.equal((await post('stage/draft',{operationId:id(),reportId:'rep-1'})).status,409);
  clock.set('2026-10-27T04:00:00.000Z');view=await d.view();assert.equal(view.retestReminder,null,'提前 4 天不提醒');
  clock.set('2026-10-28T04:00:00.000Z');view=await d.view();
  assert.deepEqual(view.retestReminder,{stageId,month:'2026-10',retestSuggestedAt:'2026-10-31',remindFrom:'2026-10-28'});
  const trendRes=await fetch(base+'/api/learning/trend',{headers:{Cookie:cookie}});
  assert.equal(trendRes.status,200);
  const trendBody=await trendRes.json() as {latest:TrendPoint[];history:TrendPoint[]};
  assert.equal(trendBody.latest.length,5);assert.equal(trendBody.history.length,5);
  // 集成修复：存库与 schema 的确认字段键序不同，仍应允许拒绝并保持幂等。
  const declined=await post('stage/retest-decline',{operationId:id(),stageId});
  assert.equal(declined.status,200);
  assert.equal((declined.body as MonthStage).retestDeclinedAt,clock.now());
  view=await d.view();assert.equal(view.retestReminder,null,'拒绝后本月不再提醒');
  const revisions=r.repository.list('monthStages').length;
  const repeated=await post('stage/retest-decline',{operationId:id(),stageId});
  assert.equal(repeated.status,200);assert.deepEqual(repeated.body,declined.body);
  assert.equal(r.repository.list('monthStages').length,revisions,'重复拒绝不追加修订');
  clock.set('2026-10-31T04:00:00.000Z');assert.equal((await d.view()).retestReminder,null,'月底仍不再提醒');
  await d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});
  assert.equal(r.repository.list('monthStages').length,0);assert.equal(r.repository.list('professionalReports').length,0,'重置清除学习记录');
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});

test('三个挂载位组件渲染：草案卡可确认、今日页有本周任务、复测提醒有入口；无提醒时不渲染',()=>{
 const stageDraft:MonthStage={schemaVersion:SCHEMA_VERSION,id:'stage-1',operationId:'op-st-1',revision:1,month:'2026-10',module:'理解',goal:'读题时能自己找出全部条件',sourceReportId:'rep-1',
  weeks:[{weekStart:'2026-10-19',proposalId:null,planVersionId:null},{weekStart:'2026-10-26',proposalId:null,planVersionId:null}],retestSuggestedAt:'2026-10-31',status:'draft',confirmation:null,retestDeclinedAt:null,mode:'local_rules',createdAt:'2026-10-21T00:00:00.000Z',updatedAt:'2026-10-21T00:00:00.000Z'};
 const rep=report('rep-1','2026-10-20T10:00:00.000Z',{理解:'needs_work',逻辑:'partial'});
 const view={now:'2026-10-21T00:00:00.000Z',session:null,paused:false,monthStages:[stageDraft],professionalReports:[rep],proposal:null,plans:[],attempts:[],reviews:[],tasks:[],exposures:[]} as unknown as Parameters<typeof MonthStageView>[0]['l']['view'];
 const ui={view,busy:false,run:async()=>({})} as unknown as LearningUI,navigate=()=>{};
 const draft=renderToStaticMarkup(createElement(MonthStageView,{l:ui,navigate,safety:false}));
 assert.ok(draft.includes('本月目标'));assert.ok(draft.includes('理解'));assert.ok(draft.includes('需要加强'));
 assert.ok(draft.includes('定下这个目标'));assert.ok(draft.includes('暂不开始'));assert.ok(draft.includes('2026-10-31'));
 const stageConfirmed={...stageDraft,revision:2,status:'confirmed' as const,confirmation:{action:'accept' as const,confirmedAt:'2026-10-21T00:00:00.000Z',actor:'student' as const},
  weeks:[{weekStart:'2026-10-19',proposalId:'prop-1',planVersionId:null},{weekStart:'2026-10-26',proposalId:null,planVersionId:null}]};
 const proposal={schemaVersion:SCHEMA_VERSION,id:'prop-1',operationId:'op-p1',evidenceRevision:1,createdAt:'2026-10-21T00:00:00.000Z',assessmentSnapshotId:'as-1',goal:'可选探索',items:[{id:'it-1',knowledgePointId:'math-language',taskType:'explore',task:null,estimatedMinutes:3,scheduledDate:'2026-10-21',evidenceIds:[],goal:'读题时圈出条件',status:'proposed' as never}],statements:[],alternatives:[],constraints:{calculationLimit:10 as never,requireUnderstandLogicFirst:true,timeBudgetMinutes:6},supersedesProposalId:null};
 const viewToday={...view,monthStages:[stageConfirmed],proposal} as typeof view;
 const uiToday={view:viewToday,busy:false,run:async()=>({})} as unknown as LearningUI;
 const today=renderToStaticMarkup(createElement(WeeklyTasksView,{l:uiToday,navigate,safety:false}));
 assert.ok(today.includes('本周任务'));assert.ok(today.includes('读题时圈出条件'));
 const reminder={stageId:'stage-1',month:'2026-10',retestSuggestedAt:'2026-10-31',remindFrom:'2026-10-28'};
 const home=renderToStaticMarkup(createElement(RetestReminder,{reminder,where:'home',l:ui,navigate}));
 assert.ok(home.includes('复测'));assert.ok(home.includes('本月先不做'));
 assert.equal(renderToStaticMarkup(createElement(RetestReminder,{reminder:null,where:'home',l:ui,navigate})),'','没有提醒就不渲染');
 // 没有可聚焦模块的报告：不出「生成本月目标」入口
 const goodReport=report('rep-2','2026-10-20T10:00:00.000Z',{理解:'good',逻辑:'good'});
 const noFocus=renderToStaticMarkup(createElement(MonthStageView,{l:{...ui,view:{...view,monthStages:[],professionalReports:[goodReport]} as typeof view},navigate,safety:false}));
 assert.ok(noFocus.includes('本月不用定加强目标'));
});
