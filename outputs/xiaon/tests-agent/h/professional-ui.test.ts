/** H2: synthetic render checks; interaction and HTTP assertions live in professional.spec.ts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { temporaryRepository } from '../../server/storage/testing';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { INTERVIEW_MODULE_ORDER, type InterviewSession, type ProfessionalReport } from '../../shared/learning-contracts';
import type { LearningUI } from '../../src/agents/useLearning';
import { ProfessionalModeView } from '../../src/components/professional/ProfessionalModeView';
import { ProfessionalReportView } from '../../src/components/professional/ProfessionalReportView';
const navigate=()=>{};
test('entry explains order and pause, requires an explicit start, shows the map, and can pause',async()=>{
 const f=temporaryRepository();try{
  const view=await installLearning(createRuntime(f)).view(),l={view,connected:true,busy:false} as LearningUI;
  const html=renderToStaticMarkup(createElement(ProfessionalModeView,{l,navigate,safety:false}));
  // 2026-11-21：331601a 把入口文案从「大约 10–15 分钟」改为「按自己的节奏」（不再承诺用时），
  // 「随时暂停」改为「随时可停」，维度名「空间想象」在叙事里改称「空间」。断言对准新契约。
  for(const text of ['按自己的节奏','五站','随时可停','理解','逻辑','计算','建模','空间','不打总分','开始'])assert.ok(html.includes(text),text);
  // 五站在入口文案里必须按测评顺序出现（顺序本身是产品承诺，不能只是都出现过）。
  let cursor=-1;
  for(const station of ['理解《星溪镇》','逻辑《断桥真伪录》','计算《符号炼金台》','建模《星溪策算司》','空间《星象风车台》']){
   const at=html.indexOf(station,cursor+1);assert.ok(at>cursor,`顺序：${station}`);cursor=at;
  }
  view.interviews=[{schemaVersion:'1.0.0',id:'interview-h',operationId:'start-h',revision:3,learningSessionId:'ls-h',moduleOrder:[...INTERVIEW_MODULE_ORDER],currentModule:'计算',completedModules:['理解','逻辑'],status:'paused',pending:null,startedAt:view.now,pausedAt:view.now,completedAt:null,updatedAt:view.now} satisfies InterviewSession];
  const paused=renderToStaticMarkup(createElement(ProfessionalModeView,{l,navigate,safety:false}));
  assert.match(paused,/上次停在：计算/);assert.match(paused,/继续测评/);
  // 地图为主：走过的地点点亮，停下的地点标「在这里」，后面的待探索。
  assert.match(paused,/aria-label="五维地图"/);
  for(const [place,state] of [['理解花园','done'],['逻辑小桥','done'],['计算工坊','current'],['生活集市','waiting'],['空间山丘','waiting']])assert.match(paused,new RegExp(`data-state="${state}"[^>]*>(?:(?!</button>).)*${place}`),place);
 }finally{f.dispose();}
});
test('report shows all five fixed levels, raw quotes and comparisons, without numeric scoring',async()=>{
 const f=temporaryRepository();try{
  const view=await installLearning(createRuntime(f)).view();
  view.professionalReports=[{schemaVersion:'1.0.0',id:'report-h',operationId:'report-op-h',evidenceRevision:0,interviewId:'iv-h',version:1,supersedesReportId:null,comparedWithReportId:null,modules:INTERVIEW_MODULE_ORDER.map((module,i)=>({module,level:i<2?'partial':'not_tested',basis:i<2?'correct_reason_incomplete':'not_tested',evidenceIds:[],attemptIds:[],turnIds:[],quotes:i<2?['每本是一本的价格']:[],wording:null,suggestions:i<2?['先圈出单位']:[],scope:'this_interview'})),observationChecks:[],changes:[],mode:'local_rules',createdAt:view.now} satisfies ProfessionalReport];
  const html=renderToStaticMarkup(createElement(ProfessionalReportView,{l:{view} as LearningUI,navigate}));
  for(const text of ['本次观察','部分掌握','还没测到','每本是一本的价格','先圈出单位','综合模式观察','和上次比','月阶段规划','专业评测历史'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/[0-9]+\s*(分|名)|总分[:：]|排名[:：]|百分位/);
 }finally{f.dispose();}
});

test('monthly archive uses the Shanghai month across the UTC boundary; missing trends never fabricate levels',async()=>{
 const { archiveMonths,professionalMonth }=await import('../../src/components/professional/archive');
 assert.equal(professionalMonth('2026-09-30T15:59:59.000Z'),'2026-09');
 assert.equal(professionalMonth('2026-09-30T16:00:00.000Z'),'2026-10');
 const f=temporaryRepository();try{
  const view=await installLearning(createRuntime(f)).view();
  assert.deepEqual(archiveMonths(view,null),[]);
  const rows={history:[{month:'2026-09',module:'理解' as const,level:'partial' as const,sourceReportId:'report-sept',reportCreatedAt:'2026-09-01T00:00:00.000Z'}],latest:[]};
  assert.deepEqual(archiveMonths(view,rows),['2026-09']);
 }finally{f.dispose();}
});
