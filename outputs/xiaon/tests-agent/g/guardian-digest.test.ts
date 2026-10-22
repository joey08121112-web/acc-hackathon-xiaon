/** 所有者：Claude。监护人页学习概览与每周学习小结：走真实作答/计划流程，TestClock 跨天；页面与文字版不带聊天、记忆、错题原话和作答原文。合成材料。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { SCHEMA_VERSION } from '../../shared/learning-contracts';
import { guardianDigest,digestText,weekStart,addDays } from '../../src/components/guardian/digest';
import { GuardianOverview } from '../../src/components/guardian/GuardianOverview';
const id=()=>crypto.randomUUID();
const DAY=86400000;
const TUESDAY='2026-10-20T02:00:00.000Z'; // 上海时间 10月20日 周二 10:00，本周 10-19 ~ 10-25

async function practisedWeek(){
 const clock=new TestClock(TUESDAY),f=temporaryRepository(clock),r=createRuntime(f),d=installLearning(r);
 const s=await d.start({operationId:id(),mode:'support'});
 await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});
 await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});
 await d.open({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2});
 await d.submit({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x-5',reviewItemId:null,reviewRevision:null});
 await d.hint({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,level:1});
 await d.submit({operationId:id(),sessionId:s.id,taskId:'bracket',taskVersion:2,value:'x+5',reviewItemId:null,reviewRevision:null});
 const plan=await d.generate({operationId:id(),timeBudgetMinutes:6});
 await d.confirm({operationId:id(),proposalId:plan.proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生接受'});
 clock.advance(DAY);
 const next=await d.start({operationId:id(),mode:'review'});const item=(await d.view()).reviews.find(i=>i.knowledgePointId==='negative-brackets')!;
 await d.open({operationId:id(),sessionId:next.id,taskId:'transfer',taskVersion:2});
 const result=await d.submit({operationId:id(),sessionId:next.id,taskId:'transfer',taskVersion:2,value:'4*a+2',reviewItemId:item.id,reviewRevision:item.revision});
 assert.equal(result.classification.independent,true);
 return{clock,f,r,d};
}

test('calendar helpers: Monday-based weeks in plain dates',()=>{
 assert.equal(weekStart('2026-10-20'),'2026-10-19');assert.equal(weekStart('2026-10-19'),'2026-10-19');assert.equal(weekStart('2026-10-25'),'2026-10-19');
 assert.equal(addDays('2026-10-31',1),'2026-11-01');assert.equal(addDays('2026-01-01',-1),'2025-12-31');
});

test('overview and this week come from real attempts, plan and review queue',async()=>{
 const{f,d}=await practisedWeek();try{
  const g=guardianDigest(await d.view());
  assert.equal(g.week.start,'2026-10-19');assert.equal(g.week.end,'2026-10-25');
  assert.deepEqual(g.week.days,['2026-10-20','2026-10-21']);assert.equal(g.week.attempts,4);
  assert.equal(g.week.kinds.independent,2,'the first like-terms task and the next-day unseen task; the hinted bracket fix does not count');
  assert.equal(g.week.kinds.helped,1);
  assert.equal(g.week.kinds.incorrect,1);
  assert.deepEqual(g.week.changes,[{name:'去括号负号',fromDate:'2026-10-20',fromLabel:'看过提示后做对',toDate:'2026-10-21'}]);
  assert.deepEqual(g.week.practising,[],'a point solved independently this week is not listed as still practising');
  assert.deepEqual(g.week.plan,[{date:'2026-10-20',action:'接受了计划'}]);
  assert.ok(g.overview.planGoal&&!g.overview.planGoal.includes('negative-brackets'),'plan goal uses display names');
  assert.ok(g.overview.skills.some(s=>s.name==='去括号负号'));
  assert.ok(g.overview.nextReview,'an active review is in the queue');
  assert.match(g.week.tips[0],/去括号负号/);
  assert.equal(g.week.hasEarlier,false);
 }finally{f.dispose();}
});

test('next week is empty and says so gently; last week stays browsable',async()=>{
 const{clock,f,d}=await practisedWeek();try{
  clock.advance(7*DAY);
  const v=await d.view(),now=guardianDigest(v),last=guardianDigest(v,-1);
  assert.equal(now.week.attempts,0);assert.equal(now.week.hasEarlier,true);
  assert.ok(now.week.tips.some(t=>/休息也是允许的/.test(t)));
  assert.match(digestText(now),/这周没有留下做题记录/);
  assert.equal(last.week.start,'2026-10-19');assert.equal(last.week.attempts,4);
 }finally{f.dispose();}
});

test('page and copied text leave out chat, memories, problem quotes, card text and raw answers',async()=>{
 const{f,r,d}=await practisedWeek();try{
  const now=r.clock.now();
  r.repository.append('memories',{schemaVersion:SCHEMA_VERSION,id:'mem-g',operationId:'op-mem-g',text:'私密记忆不该出现',source:'student_explicit',purpose:'tutoring',createdAt:now,expiresAt:null,reviewAt:null,active:true});
  r.repository.append('problems',{schemaVersion:SCHEMA_VERSION,id:'pr-g',operationId:'op-pr-g',source:'spoken',questionText:'私密题面',studentWork:'私密过程',knowledgePointId:'negative-brackets',stuckQuote:'我妈肯定又要说我',stuckPointId:null,catalogTask:null,sessionId:null,answerStatus:'unknown',confirmedAt:now});
  r.repository.append('progressCards',{schemaVersion:SCHEMA_VERSION,id:'card-g',operationId:'op-card-g',sessionId:'chat-g',episodeId:null,aiDraft:null,breakthrough:'私密突破',method:'私密方法',nextTry:null,skipped:['nextTry'],confidence:'more_sure',confirmedAt:now});
  const v=await d.view();
  const html=renderToStaticMarkup(createElement(GuardianOverview,{view:v})),text=digestText(guardianDigest(v));
  for(const out of [html,text]){
   for(const secret of ['私密记忆','私密题面','私密过程','我妈肯定','私密突破','私密方法','x-5','x+5','4*a+2'])assert.ok(!out.includes(secret),secret);
   assert.ok(out.includes('去括号负号'));
  }
  for(const shown of ['学习概览','每周学习小结','这周的变化','记下了 1 道错题','更有把握 1 次','家长可以这样聊','复制文字版','不包含聊天'])assert.ok(html.includes(shown),shown);
 }finally{f.dispose();}
});
