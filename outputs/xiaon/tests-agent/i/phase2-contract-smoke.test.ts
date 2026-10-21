/** 所有者：zCode（第二期契约补丁时由 Claude 写的冒烟，可整体替换）。月阶段、复测提醒、趋势的契约：schema、程序门控、路由在桩阶段如实返回 501。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { draftProblems,revisionProblems,trendProblems } from '../../server/agents/professional';
import { freePort,temporaryRepository } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION,RETEST_REMIND_DAYS_BEFORE,type MonthStage,type ProfessionalReport } from '../../shared/learning-contracts';
import type { LearningUI } from '../../src/agents/useLearning';
import { MonthStageView } from '../../src/components/plan/MonthStageView';
import { WeeklyTasksView } from '../../src/components/plan/WeeklyTasksView';
import { RetestReminder } from '../../src/components/plan/RetestReminder';
const origin='http://127.0.0.1:5213',id=()=>crypto.randomUUID(),at='2026-10-21T00:00:00.000Z';
const untested=(module:'计算'|'建模'|'空间想象')=>({module,level:'not_tested' as const,basis:'not_tested' as const,evidenceIds:[],attemptIds:[],turnIds:[],quotes:[],wording:null,suggestions:[],scope:'this_interview' as const});
const report:ProfessionalReport={schemaVersion:SCHEMA_VERSION,id:'rep-1',operationId:'op-rep-1',evidenceRevision:2,interviewId:'iv-1',version:1,supersedesReportId:null,comparedWithReportId:null,
 modules:[{module:'理解',level:'needs_work',basis:'incorrect_on_both',evidenceIds:[],attemptIds:['att-1','att-2'],turnIds:[],quotes:[],wording:null,suggestions:['读题时先圈出全部条件'],scope:'this_interview'},
  {module:'逻辑',level:'partial',basis:'completed_with_hint',evidenceIds:[],attemptIds:['att-3'],turnIds:[],quotes:[],wording:null,suggestions:[],scope:'this_interview'},untested('计算'),untested('建模'),untested('空间想象')],
 observationChecks:[],changes:[],mode:'local_rules',createdAt:at};
const stage=(over:Partial<MonthStage>={}):MonthStage=>({schemaVersion:SCHEMA_VERSION,id:'stage-1',operationId:'op-st-1',revision:1,month:'2026-10',module:'理解',goal:'读题时能自己找出全部条件',sourceReportId:'rep-1',
 weeks:[{weekStart:'2026-10-19',proposalId:null,planVersionId:null}],retestSuggestedAt:'2026-10-31',status:'draft',confirmation:null,retestDeclinedAt:null,mode:'local_rules',createdAt:at,updatedAt:at,...over});

test('G2 month stage, trend and reminder schemas; confirmation can only be the student',()=>{
 assert.equal(RETEST_REMIND_DAYS_BEFORE,3);
 assert.ok(schemas.MonthStage.safeParse(stage()).success);
 assert.equal(schemas.MonthStage.safeParse(stage({confirmation:{action:'accept',confirmedAt:at,actor:'model' as never}})).success,false);
 assert.equal(schemas.MonthStage.safeParse(stage({month:'2026-13'})).success,false);
 assert.ok(schemas.TrendPoint.safeParse({month:'2026-10',module:'理解',level:'needs_work',sourceReportId:'rep-1',reportCreatedAt:at}).success);
 assert.ok(schemas.RetestReminder.safeParse({stageId:'stage-1',month:'2026-10',retestSuggestedAt:'2026-10-31',remindFrom:'2026-10-28'}).success);
 assert.equal(schemas.ConfirmMonthStage.safeParse({operationId:'op',stageId:'stage-1',expectedRevision:1,action:'accept',goal:'x',confirmedBy:'student'}).success,false,'the client cannot send a confirmation record');
});

test('stage and trend gates: drafts unconfirmed, confirmations from this click, trend levels equal the report',()=>{
 assert.deepEqual(draftProblems(stage(),{reportId:'rep-1',month:'2026-10'}),[]);
 assert.ok(draftProblems(stage({status:'confirmed',confirmation:{action:'accept',confirmedAt:at,actor:'student'}}),{reportId:'rep-1',month:'2026-10'}).length>0,'a draft is never born confirmed');
 assert.ok(draftProblems(stage({month:'2026-09',retestSuggestedAt:'2026-09-30'}),{reportId:'rep-1',month:'2026-10'}).length>0);
 const now='2026-10-22T01:00:00.000Z',ok=stage({revision:2,status:'confirmed',confirmation:{action:'accept',confirmedAt:now,actor:'student'},updatedAt:now});
 assert.deepEqual(revisionProblems(ok,stage(),{now,confirm:{action:'accept',goal:ok.goal}}),[]);
 assert.ok(revisionProblems({...ok,goal:'模型改过的目标'},stage(),{now,confirm:{action:'accept',goal:ok.goal}}).length>0,'goal is the text the student confirmed');
 assert.ok(revisionProblems(ok,stage(),{now:'2026-10-23T00:00:00.000Z',confirm:{action:'accept',goal:ok.goal}}).length>0,'confirmedAt is the program clock of this click');
 assert.ok(revisionProblems({...ok,revision:2},stage(),{now}).length>0,'no confirmation without a click');
 const point={month:'2026-10',module:'理解' as const,level:'needs_work' as const,sourceReportId:'rep-1',reportCreatedAt:at};
 assert.deepEqual(trendProblems({latest:[point],history:[point]},[report]),[]);
 assert.ok(trendProblems({latest:[{...point,level:'good'}],history:[{...point,level:'good'}]},[report]).length>0,'trend never disagrees with its report');
 assert.ok(trendProblems({latest:[point],history:[]},[report]).length>0,'latest comes from history');
});

test('stage routes: existence, revision and state checks first, then 501 from the stubs; reminder stays hidden',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/learning/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const code=async(res:Response)=>({status:res.status,code:(await res.json()).error?.code});
  assert.deepEqual(await code(await post('stage/draft',{operationId:id(),reportId:'rep-none'})),{status:404,code:'not_found'});
  assert.deepEqual(await code(await post('stage/confirm',{operationId:id(),stageId:'stage-none',expectedRevision:1,action:'accept',goal:'x'})),{status:404,code:'not_found'});
  assert.equal((await post('stage/draft',{operationId:id(),reportId:'rep-1',module:'计算'})).status,400,'the client never picks the module');
  r.repository.append('professionalReports',report);r.repository.append('monthStages',stage());
  assert.deepEqual(await code(await post('stage/draft',{operationId:id(),reportId:'rep-1'})),{status:501,code:'not_implemented'});
  assert.deepEqual(await code(await post('stage/confirm',{operationId:id(),stageId:'stage-1',expectedRevision:2,action:'accept',goal:'读题时能自己找出全部条件'})),{status:409,code:'conflict'});
  assert.deepEqual(await code(await post('stage/confirm',{operationId:id(),stageId:'stage-1',expectedRevision:1,action:'accept',goal:'读题时能自己找出全部条件'})),{status:501,code:'not_implemented'});
  assert.deepEqual(await code(await post('stage/retest-decline',{operationId:id(),stageId:'stage-1'})),{status:409,code:'invalid_state'},'only a confirmed stage has a reminder');
  r.repository.append('monthStages',stage({revision:2,status:'confirmed',confirmation:{action:'accept',confirmedAt:at,actor:'student'}}));
  assert.deepEqual(await code(await post('stage/retest-decline',{operationId:id(),stageId:'stage-1'})),{status:501,code:'not_implemented'});
  assert.deepEqual(await code(await post('stage/draft',{operationId:id(),reportId:'rep-1'})),{status:409,code:'invalid_state'},'a confirmed month is not redrafted');
  const res=await fetch(base+'/api/learning/trend',{headers:{Cookie:cookie}});assert.deepEqual(await code(res),{status:501,code:'not_implemented'});
  const view=await d.view();assert.equal(view.retestReminder,null);assert.deepEqual(view.monthStages.map(s=>[s.id,s.revision,s.status]),[['stage-1',2,'confirmed']]);
  assert.equal(r.repository.list('monthStages').length,2,'stubs wrote nothing');
  await d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});assert.equal(r.repository.list('monthStages').length,0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});

test('plan mount points are stubs that render nothing until zCode fills them',()=>{
 const l={view:null} as unknown as LearningUI,navigate=()=>{};
 assert.equal(renderToStaticMarkup(createElement(MonthStageView,{l,navigate,safety:false})),'');
 assert.equal(renderToStaticMarkup(createElement(WeeklyTasksView,{l,navigate,safety:false})),'');
 assert.equal(renderToStaticMarkup(createElement(RetestReminder,{reminder:{stageId:'stage-1',month:'2026-10',retestSuggestedAt:'2026-10-31',remindFrom:'2026-10-28'},where:'home',l,navigate})),'');
});
