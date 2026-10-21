import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures';
import { PlanningEngine } from '../../server/plugins/planning';
import { selectReviewTarget, shanghaiDate, reportHistory } from '../../src/learning/review';
import { SqliteRepository } from '../../server/storage/repository';
import { schemas, type ReviewItem, type ReviewOutcome } from '../../shared/learning-contracts';

const DAY=86400000;
async function setup(f:ReturnType<typeof fixture>,e:PlanningEngine,profile:Parameters<typeof f.snapshot>[0]={brackets:'completed_with_help'}) {
 const proposal=await e.propose({operationId:randomUUID(),assessment:f.snapshot(profile),timeBudgetMinutes:9},f.ctx);
 const plan=await e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生接受'},f.ctx);
 return {proposal,plan,item:f.repository.list('reviewItems').at(-1)!};
}
function outcome(f:ReturnType<typeof fixture>,item:ReviewItem,attemptId:string):ReviewOutcome {
 const a=f.repository.get('attempts',attemptId)!;const g=f.repository.list('gradings').filter(g=>g.attemptId===a.id).at(-1)!;
 return {schemaVersion:'1.0.0',id:randomUUID(),operationId:randomUUID(),evidenceRevision:f.repository.evidenceRevision(),reviewItemId:item.id,reviewRevision:item.revision,attemptId,sessionId:a.sessionId!,verdict:g.verdict,independent:g.verdict==='correct'&&!a.hintSnapshot.length&&!a.answerExposed,taskNovelty:f.repository.list('attempts').filter(x=>x.taskId===a.taskId).length===1&&!a.hintSnapshot.length&&!a.answerExposed?'unseen':'seen',completedAt:a.sourceTime.occurredAt!,reason:'合成结果待程序核验'};
}

test('1/3/7/14 days, exact due boundary, absence and same-day repetition never fast-forward',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();let {item}=await setup(f,e,{brackets:'first_independent'});
  assert.equal(item.dueAt,new Date(Date.parse(f.clock.now())+DAY).toISOString());
  for(const [index,days] of [1,3,7,14].entries()){
   f.clock.set(item.dueAt);f.clock.advance(-1);assert.equal((await e.due({at:f.clock.now(),includePaused:false},f.ctx)).length,0);
   f.clock.advance(1);assert.equal((await e.due({at:f.clock.now(),includePaused:false},f.ctx)).length,1);
   f.clock.advance(1);assert.equal((await e.due({at:f.clock.now(),includePaused:false},f.ctx)).length,1);assert.equal(item.stage,index);
   f.nextSession();const a=f.attempt('brackets',index+1);const results=await e.recordOutcome(outcome(f,item,a.id),f.ctx);item=results[0];
   if(index<3){assert.equal(item.stage,index+1);assert.equal(Date.parse(item.dueAt)-Date.parse(a.sourceTime.occurredAt!),[3,7,14][index]*DAY);}
   else assert.equal(item.status,'completed');
   assert.ok(days>0);
  }
 }finally{f.dispose();}
});
test('same-day fresh tasks and repeated original cannot advance; attempts stay append-only',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();let {item}=await setup(f,e,{brackets:'first_independent'});f.nextSession();
  const a=f.attempt('brackets',1);item=(await e.recordOutcome(outcome(f,item,a.id),f.ctx))[0];assert.equal(item.stage,0);assert.match(item.reason,/间隔|到期/);
  f.clock.advance(2*DAY);f.nextSession();const repeat=f.attempt('brackets',1);const input=outcome(f,item,repeat.id);input.independent=false;
  item=(await e.recordOutcome(input,f.ctx))[0];assert.equal(item.stage,0);assert.match(item.reason,/原题|已见/);assert.equal(f.repository.list('attempts').length,3);
 }finally{f.dispose();}
});
test('help, incorrect and needs_review schedule differently; no outcome for absence',async()=>{
 const arrangements=[];
 for(const mode of ['help','incorrect','needs_review'] as const){const f=fixture(),e=new PlanningEngine();try{
  f.attempt();let {item}=await setup(f,e);f.clock.set(item.dueAt);f.nextSession();const a=f.attempt('brackets',1,mode==='help'?'correct':mode,mode==='help');
  item=(await e.recordOutcome(outcome(f,item,a.id),f.ctx))[0];assert.equal(item.stage,0);arrangements.push(item.dueAt);assert.match(item.reason,mode==='help'?/帮助|提示/:mode==='incorrect'?/支持|帮助/:/待核查/);
 }finally{f.dispose();}}
 assert.equal(new Set(arrangements).size,3);
});
test('four profiles differ, unknown is optional, stable avoids remedial practice; refresh is idempotent',async()=>{
 const goals=[];
 for(const [kp,status] of [['brackets','completed_with_help'],['relations','needs_support'],['brackets','cross_session_independent'],['meaning','unobserved']] as const){
  const f=fixture(),e=new PlanningEngine();try{
   if(status!=='unobserved')f.attempt(kp,0,status==='needs_support'?'incorrect':'correct',status==='completed_with_help');
   const s=f.snapshot({[kp]:status});const p=await e.propose({operationId:randomUUID(),assessment:s,timeBudgetMinutes:6},f.ctx);goals.push(p.goal);
   assert.ok(p.items.reduce((n,i)=>n+i.estimatedMinutes,0)<=6);assert.ok(p.items.every(i=>i.knowledgePointId===kp));
   if(status==='unobserved'){assert.match(p.goal,/可选|探索/);assert.ok(!JSON.stringify(p).includes('负号薄弱'));}
   if(status==='cross_session_independent')assert.ok(p.items.every(i=>i.taskType==='delayed_check'));
   assert.equal((await e.propose({operationId:randomUUID(),assessment:s,timeBudgetMinutes:6},f.ctx)).id,p.id);
  }finally{f.dispose();}
 }
 assert.equal(new Set(goals).size,4);
});
test('seen/chat-answer exposure never selected as unseen; catalog exhaustion is explicit',async()=>{
 const f=fixture();try{
  f.attempt();const s=f.snapshot();const session=f.repository.list('sessions')[0];
  f.events.expose({operationId:randomUUID(),sessionId:session.id,taskId:'synthetic-brackets-1',taskVersion:1,kind:'task',hintId:null});
  f.events.expose({operationId:randomUUID(),sessionId:session.id,taskId:'synthetic-brackets-1',taskVersion:1,kind:'chat_help',hintId:null});
  const choice=selectReviewTarget(s,9,f.ctx);assert.equal(choice.status,'available');assert.ok(choice.candidates.every(c=>!['synthetic-brackets-0','synthetic-brackets-1'].includes(c.id)));
  f.ctx.catalog={...f.catalog,candidates:s=>f.catalog.candidates(s).filter(t=>['synthetic-brackets-0','synthetic-brackets-1'].includes(t.id))};
  const exhausted=selectReviewTarget(s,9,f.ctx);assert.equal(exhausted.status,'exhausted');assert.match(exhausted.reason,/未见|耗尽/);assert.ok(exhausted.originalReviewOptions.length>0);
 }finally{f.dispose();}
});
test('defer/resume/reschedule/lighter keep immutable plans, postponement history and stale guards',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();const {proposal,plan,item}=await setup(f,e);const history=JSON.stringify(f.repository.get('plans',plan.id));let current=plan;
  for(const action of ['lighter','reschedule','defer','resume'] as const){
   const input={operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:current.id,action,scheduledDate:action==='reschedule'?'2026-10-25':null,reason:'合成学生实际选择'};
   current=await e.confirm(input,f.ctx);assert.deepEqual(await e.confirm(input,f.ctx),current);
   if(action==='lighter')assert.ok(current.items.reduce((s,i)=>s+i.estimatedMinutes,0)<plan.items.reduce((s,i)=>s+i.estimatedMinutes,0));
   if(action==='reschedule'){const latest=f.repository.get('reviewItems',item.id)!;assert.equal(latest.originalDueAt,item.originalDueAt);assert.equal(latest.postponements.length,1);}
   if(action==='defer'){f.clock.advance(20*DAY);assert.equal((await e.due({at:f.clock.now(),includePaused:false},f.ctx)).length,0);assert.equal((await e.due({at:f.clock.now(),includePaused:true},f.ctx))[0].status,'paused');}
   if(action==='resume')assert.equal((await e.due({at:f.clock.now(),includePaused:false},f.ctx)).length,0);
  }
  assert.equal(JSON.stringify(f.repository.get('plans',plan.id)),history);
  await assert.rejects(()=>e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:plan.id,action:'accept',scheduledDate:null,reason:'旧确认'},f.ctx),{code:'conflict'});
  assert.equal(f.repository.list('plans').length,5);
 }finally{f.dispose();}
});
test('Shanghai midnight, host TZ independence, legacy unknown never seeds due or stability',async()=>{
 assert.equal(shanghaiDate('2026-10-20T15:59:59.999Z'),'2026-10-20');assert.equal(shanghaiDate('2026-10-20T16:00:00.000Z'),'2026-10-21');
 const f=fixture(),e=new PlanningEngine();try{
  const a=f.attempt();f.repository.append('attempts',schemas.Attempt.parse({...a,id:'synthetic-legacy',operationId:'synthetic-legacy-op',taskId:'synthetic-relations-0',sessionId:null,sourceTime:{occurredAt:null,recordedAt:f.clock.now(),timezone:'Asia/Shanghai',trust:'legacy_unknown',legacyLabel:'10/20 12:00'},origin:'legacy_import',exposureHistory:'legacy_unknown'}));
  await setup(f,e,{relations:'unobserved'});assert.equal(f.repository.list('reviewItems').length,0);
 }finally{f.dispose();}
});
test('report immutability, correction annotations and queue replay from authoritative grades',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();let {item}=await setup(f,e,{brackets:'first_independent'});const old=await e.report({operationId:randomUUID(),assessment:f.snapshot({brackets:'first_independent'}),previousReportId:null},f.ctx);const serialized=JSON.stringify(f.repository.get('reports',old.id));
  f.clock.set(item.dueAt);f.nextSession();const a=f.attempt('brackets',1);item=(await e.recordOutcome(outcome(f,item,a.id),f.ctx))[0];assert.equal(item.stage,1);
  const r2=await e.report({operationId:randomUUID(),assessment:f.snapshot({brackets:'cross_session_independent'}),previousReportId:old.id},f.ctx);
  assert.match(r2.changes.join(' '),/first_independent.*cross_session_independent/);
  f.grade(a.id,'brackets','incorrect');const correction=f.snapshot({brackets:'needs_support'});
  await e.reconcile({operationId:randomUUID()},f.ctx);assert.equal(f.repository.get('reviewItems',item.id)!.stage,0);
  const r3=await e.report({operationId:randomUUID(),assessment:correction,previousReportId:r2.id},f.ctx);
  assert.equal(JSON.stringify(f.repository.get('reports',old.id)),serialized);assert.ok(reportHistory(f.ctx).find(r=>r.snapshot.id===r2.id)!.basisRevised);assert.equal(r3.supersedesReportId,r2.id);
  assert.match(r3.changes.join(' '),/修订/);assert.ok(!r3.statements.some(s=>s.kind==='fact'&&s.text.includes('跨次独立')));
 }finally{f.dispose();}
});
test('restart receipts, queue revisions and immutable snapshots survive real disk reopen',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();const {item,proposal,plan}=await setup(f,e);const input={operationId:randomUUID(),assessment:f.snapshot(),timeBudgetMinutes:6};const p=await e.propose(input,f.ctx);
  f.repository.close();const reopened=new SqliteRepository(f.databasePath);f.ctx.repository=reopened;
  try{assert.equal((await new PlanningEngine().propose(input,f.ctx)).id,p.id);assert.equal(reopened.get('reviewItems',item.id)!.revision,item.revision);assert.ok(reopened.get('proposals',proposal.id));assert.ok(reopened.get('plans',plan.id));}finally{reopened.close();}
 }finally{ /* original connection was explicitly closed */ const {rmSync}=await import('node:fs');rmSync(f.directory,{recursive:true,force:true});}
});
test('untrusted self-report, stale outcome, reused attempt and stale assessment fail without writes',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();const {item,proposal}=await setup(f,e);f.clock.set(item.dueAt);f.nextSession();const a=f.attempt('brackets',1,'incorrect');const input=outcome(f,item,a.id);const before=f.repository.list('reviewOutcomes').length;
  await assert.rejects(()=>e.recordOutcome({...input,verdict:'correct',independent:true},f.ctx),{code:'invalid_params'});assert.equal(f.repository.list('reviewOutcomes').length,before);
  await e.recordOutcome(input,f.ctx);assert.deepEqual(await e.recordOutcome(input,f.ctx),await e.recordOutcome(input,f.ctx));
  await assert.rejects(()=>e.recordOutcome({...input,id:randomUUID(),operationId:randomUUID()},f.ctx),{code:'conflict'});
  await assert.rejects(()=>e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:f.repository.list('plans').at(-1)!.id,action:'accept',scheduledDate:null,reason:'过期依据'},f.ctx),{code:'conflict'});
 }finally{f.dispose();}
});
test('constraints retain per-session ten calculation tasks and prerequisites; optional memories never read',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();const s=f.snapshot();const r=f.ctx.repository;
  f.ctx.repository={...r,get:r.get.bind(r),list:(collection)=>{assert.notEqual(collection,'memories');return r.list(collection);},append:r.append.bind(r),transaction:r.transaction.bind(r),once:r.once.bind(r),revision:r.revision.bind(r),evidenceRevision:r.evidenceRevision.bind(r),setMemoryState:r.setMemoryState.bind(r),close:r.close.bind(r)};
  const p=await e.propose({operationId:randomUUID(),assessment:s,timeBudgetMinutes:6},f.ctx);assert.equal(p.constraints.calculationLimit,10);assert.equal(p.constraints.requireUnderstandLogicFirst,true);
  for(let i=1;i<10;i++)f.attempt('brackets',i);
  const choice=selectReviewTarget(f.snapshot(),6,f.ctx);assert.equal(choice.status,'exhausted');assert.match(choice.reason,/10/);
  f.nextSession();assert.equal(selectReviewTarget(f.snapshot(),6,f.ctx).status,'available');
 }finally{f.dispose();}
});
