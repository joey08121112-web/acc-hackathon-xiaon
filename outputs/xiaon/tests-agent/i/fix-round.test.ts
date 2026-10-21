import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime,type LearningRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { TestClock,temporaryRepository } from '../../server/storage/testing';
import { draftMonthStage,confirmMonthStage } from '../../server/plugins/stages';
import { shouldOfferMemory } from '../../server/plugins/memory-flow';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,type ProfessionalReport } from '../../shared/learning-contracts';
import type { ProfessionalContext } from '../../server/plugins/context';
const id=()=>crypto.randomUUID();
const report=(at:string):ProfessionalReport=>schemas.ProfessionalReport.parse({schemaVersion:SCHEMA_VERSION,id:'fix-report',operationId:id(),evidenceRevision:0,interviewId:'fix-interview',version:1,supersedesReportId:null,comparedWithReportId:null,modules:INTERVIEW_MODULE_ORDER.map(module=>({module,level:module==='逻辑'?'partial':'good',basis:module==='逻辑'?'correct_on_transfer':'correct_with_reason',evidenceIds:[],attemptIds:[],turnIds:[],quotes:[],wording:null,suggestions:module==='逻辑'?['用反例检查条件']:[],scope:'this_interview'})),observationChecks:[],changes:[],mode:'local_rules',createdAt:at});
const context=(r:LearningRuntime):ProfessionalContext=>({...r.engineContext(),events:r.events,providerKind:'offline',memoryEnabled:()=>r.events.memoryEnabled(),model:async()=>{throw Error('offline');},submitAttempt:async()=>{throw Error('not used');},planning:()=>r.planning(),assessment:operationId=>r.assessment().snapshot({operationId},r.engineContext())});
test('修复：月目标限定逻辑子技能，不能复用同日全局草案，旧调用行为不变',async()=>{
 const f=temporaryRepository(new TestClock('2026-10-05T01:00:00.000Z'));try{
  const r=createRuntime(f);installLearning(r);const ctx=context(r);const session=r.events.startSession({operationId:id(),mode:'support'});
  r.events.expose({operationId:id(),sessionId:session.id,taskId:'b-like-observation',taskVersion:2,kind:'task',hintId:null});
  const attempt=r.events.submit({operationId:id(),sessionId:session.id,taskId:'b-like-observation',taskVersion:2,value:'0'});
  await r.assessment().grade({operationId:id(),attemptId:attempt.id},ctx);
  const assessment=await ctx.assessment(id()),oldInput={assessment,timeBudgetMinutes:6};
  const old=await r.planning().propose({operationId:id(),...oldInput},ctx);
  assert.ok(old.items.every(i=>i.knowledgePointId==='like-terms'),'用真实计算错答复现全局计划选择合并同类项');
  const draft=await draftMonthStage({operationId:id(),report:report(f.clock.now()),month:'2026-10',previous:null},ctx);
  const goal='用反例检查每一步的条件';
  const stage=await confirmMonthStage({operationId:id(),stageId:draft.id,expectedRevision:1,action:'accept',goal,stage:draft},ctx);
  const p=r.repository.get('proposals',stage.weeks[0].proposalId!)!;
  assert.ok(p.items.length);assert.ok(p.items.every(i=>i.knowledgePointId==='counterexample'),'逻辑月目标的周任务不能选合并同类项');
  assert.notEqual(p.id,old.id,'不能命中未限定模块的旧缓存');
  assert.ok(p.items.every(i=>i.goal.includes(goal)));assert.ok(p.goal.includes(goal));
  for(const i of p.items)if(i.task)assert.equal(r.catalog.definition(i.task.taskId,i.task.taskVersion)?.primaryDimension,'逻辑');
  const legacy=await r.planning().propose({operationId:id(),...oldInput},ctx);
  assert.deepEqual(legacy.items.map(i=>[i.knowledgePointId,i.taskType,i.goal]),old.items.map(i=>[i.knowledgePointId,i.taskType,i.goal]),'省略可选限定仍保持旧规则');
  assert.equal((await r.planning().propose({operationId:id(),...oldInput},ctx)).id,legacy.id,'旧调用仍按同日预算缓存');
 }finally{f.dispose();}
});
test('修复：后续第二周、第三周均可生成草案并由学生确认，记录 weeks，拒绝与暂缓不生成',async()=>{
 const clock=new TestClock('2026-10-05T01:00:00.000Z'),f=temporaryRepository(clock);try{
  const r=createRuntime(f),d=installLearning(r);r.events.startSession({operationId:id(),mode:'support'});r.repository.append('professionalReports',report(clock.now()));
  const draft=await d.stageDraft({operationId:id(),reportId:'fix-report'});
  let stage=await d.stageConfirm({operationId:id(),stageId:draft.id,expectedRevision:1,action:'accept',goal:draft.goal});
  for(const [at,weekStart] of [['2026-10-05','2026-10-05'],['2026-10-12','2026-10-12'],['2026-10-19','2026-10-19']]){
   clock.set(at+'T01:00:00.000Z');
   if(at!=='2026-10-05'){
    const before=r.repository.list('plans').length;
    assert.equal(typeof d.stageWeekDraft,'function','协调器必须提供后续周草案入口');
    stage=await d.stageWeekDraft({operationId:id(),stageId:stage.id,expectedRevision:stage.revision});
    assert.equal(r.repository.list('plans').length,before,'生成草案不能自动确认');
   }
   const week=stage.weeks.find(w=>w.weekStart===weekStart)!;assert.ok(week.proposalId);assert.equal(week.planVersionId,null);
   const p=r.repository.get('proposals',week.proposalId!)!;assert.ok(p.items.every(i=>i.knowledgePointId==='counterexample'));
   const prev=r.repository.list('plans').at(-1)?.id??null;
   const plan=await d.confirm({operationId:id(),proposalId:p.id,expectedPreviousVersionId:prev,action:at==='2026-10-12'?'lighter':'accept',scheduledDate:null,reason:'学生亲自确认'});
   stage=r.repository.get('monthStages',stage.id)!;
   assert.equal(stage.weeks.find(w=>w.weekStart===weekStart)?.planVersionId,plan.id,'实际确认版本回记到 weeks');
  }
  const confirmedAt=stage.confirmation!.confirmedAt;
  stage=await d.retestDecline({operationId:id(),stageId:stage.id});clock.set('2026-10-26T01:00:00.000Z');
  await assert.rejects(d.stageWeekDraft({operationId:id(),stageId:stage.id,expectedRevision:stage.revision}),{code:'invalid_state'});
  assert.equal(stage.confirmation!.confirmedAt,confirmedAt,'后续周不重写月目标的学生确认');
  const deferred={...stage,id:'deferred-stage',status:'deferred' as const,revision:1};r.repository.append('monthStages',deferred);
  await assert.rejects(d.stageWeekDraft({operationId:id(),stageId:deferred.id,expectedRevision:1}),{code:'invalid_state'});
 }finally{f.dispose();}
});
test('修复：shouldOfferMemory 是纯判断，不写假 memoryId 或消耗提议次数',()=>{
 const f=temporaryRepository();try{
  const r=createRuntime(f),ctx=context(r);r.events.consent({operationId:id(),optionalMemory:true});
  const before=r.repository.revision();
  for(let n=0;n<4;n++)assert.equal(shouldOfferMemory({sessionId:'chat-fix',stage:'companion',turn:1},ctx),true);
  assert.equal(r.repository.revision(),before,'判断不能有任何写入');assert.equal(r.repository.list('memoryMentions').length,0);
 }finally{f.dispose();}
});

test('修复：第二周、第三周都有草案入口；未确认不生成正式计划',async()=>{
 const clock=new TestClock('2026-10-05T01:00:00.000Z'),f=temporaryRepository(clock);try{
  const r=createRuntime(f),d=installLearning(r);r.events.startSession({operationId:id(),mode:'support'});r.repository.append('professionalReports',report(clock.now()));
  const draft=await d.stageDraft({operationId:id(),reportId:'fix-report'});let stage=await d.stageConfirm({operationId:id(),stageId:draft.id,expectedRevision:1,action:'accept',goal:draft.goal});
  for(const date of ['2026-10-12','2026-10-19']){
   clock.set(date+'T01:00:00.000Z');assert.equal(typeof d.stageWeekDraft,'function','缺少后续周入口');
   stage=await d.stageWeekDraft({operationId:id(),stageId:stage.id,expectedRevision:stage.revision});assert.ok(stage.weeks.find((w:any)=>w.weekStart===date)?.proposalId);assert.equal(r.repository.list('plans').length,0);
  }
 }finally{f.dispose();}
});
test('修复：只有实际提议才计数，重试不重复，关闭记忆和重置都正确处理',async()=>{
 const f=temporaryRepository();let calls=0;const seen:any[]=[];try{
  const r=createRuntime({...f,provider:{kind:'synthetic',supportsTools:true,async complete(input){calls++;seen.push(JSON.parse(input.messages.find(m=>m.role==='user')!.content));return {content:JSON.stringify({message:'我在听。',taskIds:[],...(calls>2?{memoryDraft:{text:'下周有篮球赛',kind:'event'}}:{})}),toolCalls:[]};}}}),d=installLearning(r);
  r.events.consent({operationId:id(),optionalMemory:true});let history:any[]=[];
  for(let n=0;n<5;n++){
   history.push({role:'user',content:'下周有篮球赛'});const operationId=id();const reply=await d.chat({operationId,history,flow:'home'});history.push({role:'assistant',content:reply.text});
   assert.equal(!!reply.memoryDraft,n===2||n===3,'未给草稿的前两轮不能消耗机会');
   if(n===2){const count=r.repository.list('memoryOffers').length;await d.chat({operationId,history:history.slice(0,-1),flow:'home'});assert.equal(r.repository.list('memoryOffers').length,count);}
  }
  assert.equal(r.repository.list('memoryOffers').length,2);assert.equal(r.repository.list('memoryMentions').length,0);assert.equal(r.repository.list('memories').length,0,'提议不等于学生确认');
  r.events.consent({operationId:id(),optionalMemory:false});history.push({role:'user',content:'下周有篮球赛'});assert.equal((await d.chat({operationId:id(),history,flow:'home'})).memoryDraft,null);
  await d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});assert.equal(r.repository.list('memoryOffers').length,0);
 }finally{f.dispose();}
});

test('修复：限定模块题库不足时明说，不从别的模块凑题',async()=>{
 const f=temporaryRepository();try{
  const r=createRuntime(f);installLearning(r);const ctx=context(r);r.events.startSession({operationId:id(),mode:'support'});
  const assessment=await ctx.assessment(id());
  const empty={...ctx,catalog:{...ctx.catalog,definition:ctx.catalog.definition.bind(ctx.catalog),publicTask:ctx.catalog.publicTask.bind(ctx.catalog),candidates:()=>[]}};
  const p=await r.planning().propose({operationId:id(),assessment,timeBudgetMinutes:6,focus:{module:'逻辑',goal:'用反例检查条件'}},empty);
  assert.ok(p.items.every(i=>i.knowledgePointId==='counterexample'&&i.task===null));assert.match(p.goal,/题库不足/);
 }finally{f.dispose();}
});

test('修复：周草案 HTTP 路由保留认证、严格入参、状态与修订门控，重复请求不新建',async()=>{
 const {createHttpServer}=await import('../../server/http/server');const {freePort}=await import('../../server/storage/testing');
 const clock=new TestClock('2026-10-05T01:00:00.000Z'),f=temporaryRepository(clock),r=createRuntime(f),d=installLearning(r),port=await freePort(),origin='http://127.0.0.1:5214';
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(base+'/api/learning/stage/week-draft',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=async(body:unknown)=>{const res=await fetch(base+'/api/learning/stage/week-draft',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};};
  r.repository.append('professionalReports',report(clock.now()));const draft=await d.stageDraft({operationId:id(),reportId:'fix-report'});
  assert.equal((await post({operationId:id(),stageId:draft.id,expectedRevision:1})).status,409);
  const accepted=await d.stageConfirm({operationId:id(),stageId:draft.id,expectedRevision:1,action:'accept',goal:draft.goal});clock.set('2026-10-12T01:00:00.000Z');
  const body={operationId:id(),stageId:accepted.id,expectedRevision:accepted.revision};
  assert.equal((await post({...body,expectedRevision:1})).status,409);
  assert.equal((await post({...body,module:'计算'})).status,400,'客户端不能选模块');
  const result=await post(body);assert.equal(result.status,200);assert.equal(r.repository.list('plans').length,0);
  const count=r.repository.list('monthStages').length;assert.deepEqual(await post(body),result);assert.equal(r.repository.list('monthStages').length,count);
  assert.equal((await post({operationId:id(),stageId:accepted.id,expectedRevision:result.body.revision})).body.revision,result.body.revision,'本周已有草案时不重复追加');
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});

test('修复：今日和计划页仅为已确认未拒绝阶段提示缺少的当前周',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {WeeklyTasksView}=await import('../../src/components/plan/WeeklyTasksView');const {MonthStageView}=await import('../../src/components/plan/MonthStageView');
 const clock=new TestClock('2026-10-05T01:00:00.000Z'),f=temporaryRepository(clock);try{
  const r=createRuntime(f),d=installLearning(r);r.repository.append('professionalReports',report(clock.now()));const draft=await d.stageDraft({operationId:id(),reportId:'fix-report'});const stage=await d.stageConfirm({operationId:id(),stageId:draft.id,expectedRevision:1,action:'accept',goal:draft.goal});clock.set('2026-10-12T01:00:00.000Z');const view=await d.view();
  for(const component of [WeeklyTasksView,MonthStageView])for(const [row,shown] of [[stage,true],[{...stage,status:'deferred'},false],[{...stage,retestDeclinedAt:clock.now()},false]] as const){
   const ui={view:{...view,monthStages:[row]},busy:false} as any;
   const html=renderToStaticMarkup(createElement(component,{l:ui,navigate:()=>{},safety:false}));assert.equal(html.includes('生成这一周的任务'),shown);
  }
 }finally{f.dispose();}
});
