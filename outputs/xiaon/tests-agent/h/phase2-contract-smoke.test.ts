/** 所有者：ChatGPT（第二期契约补丁时由 Claude 写的冒烟，可整体替换）。专业模式界面、报告页、成长档案要用到的契约：view 字段、等级文字、挂载位、趋势路由。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { freePort,temporaryRepository } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,MODULE_LEVEL_LABELS,type InterviewSession } from '../../shared/learning-contracts';
import type { LearningUI } from '../../src/agents/useLearning';
import { ProfessionalModeView } from '../../src/components/professional/ProfessionalModeView';
import { ProfessionalReportView } from '../../src/components/professional/ProfessionalReportView';
import { GrowthArchive } from '../../src/components/professional/GrowthArchive';
const origin='http://127.0.0.1:5212',at='2026-10-21T00:00:00.000Z';
const interview=(over:Partial<InterviewSession>={}):InterviewSession=>({schemaVersion:SCHEMA_VERSION,id:'iv-1',operationId:'op-iv-1',revision:1,learningSessionId:'ls-1',moduleOrder:[...INTERVIEW_MODULE_ORDER],currentModule:'计算',completedModules:['理解','逻辑'],status:'paused',pending:null,startedAt:at,pausedAt:at,completedAt:null,updatedAt:at,...over});

test('student-facing level names are fixed; the report carries no score or rank field',()=>{
 assert.deepEqual(MODULE_LEVEL_LABELS,{good:'掌握得不错',partial:'部分掌握',needs_work:'需要加强',not_tested:'还没测到'});
 const keys=Object.keys(schemas.ProfessionalReport.shape);
 for(const k of keys)assert.doesNotMatch(k,/score|rank|total/i,k);
 assert.ok(keys.includes('observationChecks')&&keys.includes('changes')&&keys.includes('supersedesReportId'));
});

test('view() gives the UI interviews (latest revision), turns, reports, month stages and the retest reminder',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);try{
  const empty=await d.view();
  assert.deepEqual([empty.interviews,empty.interviewTurns,empty.professionalReports,empty.monthStages],[[],[],[],[]]);assert.equal(empty.retestReminder,null);
  r.repository.append('interviews',interview({status:'in_progress',pausedAt:null,completedModules:['理解'],currentModule:'逻辑'}));r.repository.append('interviews',interview({revision:2}));
  const view=await d.view();assert.equal(view.interviews.length,1);assert.equal(view.interviews[0].currentModule,'计算','"上次停在：计算" comes from the latest revision');
 }finally{f.dispose();}
});

test('H2 mount points render entry, report and archive without starting an interview',()=>{
 const l={view:null} as unknown as LearningUI,navigate=()=>{};
 assert.match(renderToStaticMarkup(createElement(ProfessionalModeView,{l,navigate,safety:false})),/开始/);
 assert.match(renderToStaticMarkup(createElement(ProfessionalReportView,{l,navigate})),/专业评测报告/);
 assert.match(renderToStaticMarkup(createElement(GrowthArchive,{l,navigate})),/成长档案/);
});

test('GET /api/learning/trend sits behind the local session and derives monthly points from professional reports',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  assert.equal((await fetch(base+'/api/learning/trend')).status,403);
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const cookie=login.headers.get('set-cookie')!.split(';')[0];
  const get=()=>fetch(base+'/api/learning/trend',{headers:{Cookie:cookie}});
  const empty=await get();assert.equal(empty.status,200);assert.deepEqual(await empty.json(),{latest:[],history:[]});
  let step=await d.interviewStart({operationId:crypto.randomUUID()});
  for(const text of ['B','先翻倍再减三','A','先检查前提和反例'])step=await d.interviewAnswer({operationId:crypto.randomUUID(),interviewId:step.interview!.id,expectedRevision:step.interview!.revision,text});
  const report=await d.interviewReport({operationId:crypto.randomUUID(),interviewId:step.interview!.id});
  const res=await get();assert.equal(res.status,200);
  const body=schemas.TrendQuery.parse(await res.json());assert.equal(body.history.length,5);assert.deepEqual(body.latest,body.history);
  for(const [i,point] of body.history.entries())assert.deepEqual(point,{month:'2026-10',module:report.modules[i].module,level:report.modules[i].level,sourceReportId:report.id,reportCreatedAt:report.createdAt});
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});
