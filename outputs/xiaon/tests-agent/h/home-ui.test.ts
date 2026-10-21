/** 所有者：ChatGPT。合成数据的界面契约；交互另见本路 browser.spec.ts。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeedsCheckCard } from '../../src/components/learning/home/NeedsCheckCard';
import { ModeSwitchCard } from '../../src/components/learning/home/ModeSwitchCard';
import { ConversationSummaryView } from '../../src/components/learning/home/ConversationSummaryView';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository } from '../../server/storage/testing';
import type { LearningUI } from '../../src/agents/useLearning';
import type { ConversationSummary } from '../../shared/learning-contracts';
const navigate=()=>{};
test('需求卡只在程序发信号时展示三项选择',()=>{
 const props={open:true,disabled:false,onChoose:()=>{}};
 const html=renderToStaticMarkup(createElement(NeedsCheckCard,props));
 for(const text of ['继续聊聊','看看哪里没考好','做个正式测试'])assert.ok(html.includes(text));
 assert.equal(renderToStaticMarkup(createElement(NeedsCheckCard,{...props,open:false})), '');
});
test('专业模式说明包含五维和暂停；没有建议时不展示',()=>{
 const html=renderToStaticMarkup(createElement(ModeSwitchCard,{suggestion:{mode:'professional',reason:'学生主动选择'},navigate}));
 for(const text of ['理解','逻辑','计算','建模','空间想象','暂停','去专业模式','先不了'])assert.ok(html.includes(text));
 assert.equal(renderToStaticMarkup(createElement(ModeSwitchCard,{suggestion:null,navigate})), '');
});
test('小结引用当前场次观察和已确认进步卡，不混入其他场次',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);
 try{
  const summary:ConversationSummary={schemaVersion:'1.0.0',id:'summary-h',operationId:'end-h',sessionId:'chat-h',trigger:'student_end',topics:['合成应用题'],observationIds:['obs-h','obs-other'],comparedWithSummaryId:null,changes:[],planSuggestions:['明天圈出题目条件'],suggestProfessionalMode:true,progressCardId:'card-h',mode:'model',createdAt:f.clock.now()};
  const view=await d.view();
  view.observations=[{schemaVersion:'1.0.0',id:'obs-h',sessionId:'chat-h',dimension:'理解',signal:'partial',quote:'这里的每本是什么意思',note:'可以再核对单位',status:'unverified',at:f.clock.now()},{schemaVersion:'1.0.0',id:'obs-other',sessionId:'chat-other',dimension:'逻辑',signal:'clear',quote:'另一个场次原话',note:'不应出现',status:'unverified',at:f.clock.now()}];
  view.progressCards=[{schemaVersion:'1.0.0',id:'card-h',operationId:'card-op',sessionId:'chat-h',episodeId:null,aiDraft:null,breakthrough:'找到了条件',method:'圈出单位',nextTry:null,skipped:['nextTry'],confidence:'prefer_not',confirmedAt:f.clock.now()}];
  const html=renderToStaticMarkup(createElement(ConversationSummaryView,{summary,l:{view,busy:false} as LearningUI,navigate}));
  for(const text of ['聊了什么','对话观察','待专业模式确认','这里的每本是什么意思','和上次比','计划建议','转成正式计划','今天的小突破','圈出单位'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('另一个场次原话'));assert.ok(!html.includes('情绪标签'));
 }finally{f.dispose();}
});
