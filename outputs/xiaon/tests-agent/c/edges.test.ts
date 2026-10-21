import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures';
import { PlanningEngine } from '../../server/plugins/planning';
import { selectReviewTarget, currentReviewItems, planHistory } from '../../src/learning/review';
import { attemptFacts } from '../../server/plugins/planning/evidence';
import { schemas, type ReviewItem } from '../../shared/learning-contracts';

async function start(f:ReturnType<typeof fixture>,e:PlanningEngine) {
 const initial=f.attempt();
 const proposal=await e.propose({operationId:randomUUID(),assessment:f.snapshot({brackets:'first_independent'}),timeBudgetMinutes:9},f.ctx);
 const plan=await e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生选择'},f.ctx);
 return {initial,proposal,plan,item:currentReviewItems(f.ctx)[0]};
}
function result(f:ReturnType<typeof fixture>,item:ReviewItem,id:string) {
 const facts=attemptFacts(id,item.knowledgePointId,f.ctx);
 return {schemaVersion:'1.0.0' as const,id:randomUUID(),operationId:randomUUID(),evidenceRevision:f.repository.evidenceRevision(),reviewItemId:item.id,reviewRevision:item.revision,attemptId:id,sessionId:facts.attempt.sessionId!,verdict:facts.grade.verdict,independent:facts.independent,taskNovelty:facts.novelty,completedAt:facts.time!,reason:'合成复习'};
}

test('absence and queries are read-only; UTC strings with omitted milliseconds compare by instant',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const {item}=await start(f,e);f.clock.set(item.dueAt);
  assert.equal((await e.due({at:item.dueAt.replace('.000Z','Z'),includePaused:false},f.ctx)).length,1);
  const before=f.repository.revision();f.clock.advance(90*86400000);
  for(let i=0;i<3;i++)assert.equal((await e.due({at:f.clock.now(),includePaused:false},f.ctx))[0].stage,0);
  assert.equal(f.repository.revision(),before);assert.equal(f.repository.list('reviewOutcomes').length,0);
 }finally{f.dispose();}
});
test('initial anchoring attempt cannot be recycled as a later review outcome',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const {initial,item}=await start(f,e);
  await assert.rejects(()=>e.recordOutcome(result(f,item,initial.id),f.ctx),{code:'invalid_state'});
 }finally{f.dispose();}
});
test('a completed review never schedules the same seen task as the next unseen check',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  let {item}=await start(f,e);f.clock.set(item.dueAt);f.nextSession();const a=f.attempt('brackets',1);
  item=(await e.recordOutcome(result(f,item,a.id),f.ctx))[0];assert.equal(item.stage,1);
  assert.ok(item.task===null||item.task.taskId!==a.taskId);
 }finally{f.dispose();}
});
test('future plan date and queued due cannot silently diverge after rescheduling',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const {proposal,plan,item}=await start(f,e);
  const rescheduled=await e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:plan.id,action:'reschedule',scheduledDate:'2026-10-25',reason:'合成学生改期'},f.ctx);
  const before=f.repository.get('reviewItems',item.id)!;assert.equal(rescheduled.items[0].scheduledDate,'2026-10-25');
  f.clock.set('2026-10-21T04:00:00.000Z');f.nextSession();const a=f.attempt('brackets',1);
  const after=(await e.recordOutcome(result(f,before,a.id),f.ctx))[0];assert.equal(after.stage,0);
  f.grade(a.id,'brackets','correct');await e.reconcile({operationId:randomUUID()},f.ctx);
  assert.equal(f.repository.get('reviewItems',item.id)!.stage,0,'replay must honor actual student postponement before the outcome');
 }finally{f.dispose();}
});
test('out-of-order completion cannot roll due backwards',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  let {item}=await start(f,e);f.clock.set(item.dueAt);f.nextSession();const first=f.attempt('brackets',1,'incorrect');
  f.clock.advance(3600000);const later=f.attempt('brackets',2,'incorrect');
  item=(await e.recordOutcome(result(f,item,later.id),f.ctx))[0];
  await assert.rejects(()=>e.recordOutcome(result(f,item,first.id),f.ctx),{code:'invalid_state'});
 }finally{f.dispose();}
});
test('corrected evidence marks old plans as revised without rewriting student confirmation',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const {initial,plan}=await start(f,e);const before=f.repository.get('plans',plan.id);
  f.grade(initial.id,'brackets','incorrect');await e.due({at:f.clock.now(),includePaused:true},f.ctx);
  const history=planHistory(f.ctx);assert.ok(history.find(p=>p.snapshot.id===plan.id)!.basisRevised);assert.deepEqual(f.repository.get('plans',plan.id),before);
  assert.match(currentReviewItems(f.ctx)[0].reason,/修订/);
 }finally{f.dispose();}
});
test('stale evidence references in a snapshot cannot be relabelled as current facts',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const a=f.attempt();const s=f.snapshot();f.grade(a.id,'brackets','incorrect');
  const stale=schemas.AssessmentSnapshot.parse({...s,id:randomUUID(),evidenceRevision:f.repository.evidenceRevision()});f.repository.append('assessments',stale);
  await assert.rejects(()=>e.report({operationId:randomUUID(),assessment:stale,previousReportId:null},f.ctx),{code:'conflict'});
 }finally{f.dispose();}
});
test('task prerequisite shortage is explicit, budget one never claims a three-minute task fits',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();f.tasks.forEach(t=>{if(t.knowledgePoints.includes('brackets'))t.prerequisites=['logic'];});
  const s=f.snapshot();assert.equal(selectReviewTarget(s,9,f.ctx).status,'exhausted');
  const p=await e.propose({operationId:randomUUID(),assessment:s,timeBudgetMinutes:1},f.ctx);
  assert.equal(p.items.length,1);assert.equal(p.items[0].estimatedMinutes,1);assert.equal(p.items[0].task,null);
 }finally{f.dispose();}
});
test('due support priority and explicit student choice retain alternative evidence',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.attempt();const {item}=await start(f,e);f.attempt('relations',0,'incorrect');const s=f.snapshot({brackets:'completed_with_help',relations:'needs_support'});
  f.clock.set(item.dueAt);const choice=selectReviewTarget(s,9,f.ctx);assert.equal(choice.knowledgePointId,'brackets');assert.ok(choice.evidenceIds.length>0);
  const chosen=selectReviewTarget(s,9,f.ctx,'relations');assert.equal(chosen.knowledgePointId,'relations');assert.ok(chosen.alternatives.some(x=>x.knowledgePointId==='brackets'));
 }finally{f.dispose();}
});
test('calendar validation rejects impossible dates and configurable clock intervals are persisted',async()=>{
 const f=fixture(),e=new PlanningEngine({id:'c-test-policy',intervalDays:[2,4],minimumAdvanceHours:48});try{
  const {proposal,plan,item}=await start(f,e);assert.equal(Date.parse(item.dueAt)-Date.parse(f.clock.now()),2*86400000);
  await assert.rejects(()=>e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:plan.id,action:'reschedule',scheduledDate:'2026-02-30',reason:'合成无效日期'},f.ctx),{code:'invalid_params'});
  assert.deepEqual(f.repository.list('reviewPolicies')[0].intervalDays,[2,4]);
 }finally{f.dispose();}
});
test('Shanghai midnight alone cannot advance a review stage; a real day can',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  f.clock.set('2026-10-20T15:59:59.000Z');let {item}=await start(f,e);
  f.clock.advance(1000);f.nextSession();const early=f.attempt('brackets',1);
  item=(await e.recordOutcome(result(f,item,early.id),f.ctx))[0];assert.equal(item.stage,0);
  f.clock.set(item.dueAt);f.nextSession();const delayed=f.attempt('brackets',2);
  item=(await e.recordOutcome(result(f,item,delayed.id),f.ctx))[0];assert.equal(item.stage,1);
 }finally{f.dispose();}
});
test('a new calendar day refreshes a draft without overwriting the accepted plan',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const {plan,proposal}=await start(f,e);const s=f.snapshot({brackets:'first_independent'});
  f.clock.advance(5*86400000);const p=await e.propose({operationId:randomUUID(),assessment:s,timeBudgetMinutes:9},f.ctx);
  assert.notEqual(p.id,proposal.id);assert.equal(p.items[0].scheduledDate,'2026-10-25');assert.equal(f.repository.list('plans').at(-1)!.id,plan.id);
  assert.equal((await e.propose({operationId:randomUUID(),assessment:s,timeBudgetMinutes:9},f.ctx)).id,p.id);
 }finally{f.dispose();}
});
test('fractional minute budgets remain within budget and produce valid integer estimates',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const p=await e.propose({operationId:randomUUID(),assessment:f.snapshot({meaning:'unobserved'}),timeBudgetMinutes:1.5},f.ctx);
  assert.equal(p.items[0].estimatedMinutes,1);assert.ok(schemas.PlanProposal.safeParse(p).success);
 }finally{f.dispose();}
});
test('new evidence or an unaccepted draft never prevents the student pausing the current confirmed plan',async()=>{
 const f=fixture(),e=new PlanningEngine();try{
  const {plan,proposal,item}=await start(f,e);f.attempt('relations',0,'incorrect');
  await e.propose({operationId:randomUUID(),assessment:f.snapshot({relations:'needs_support'}),timeBudgetMinutes:6},f.ctx);
  const paused=await e.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:plan.id,action:'defer',scheduledDate:null,reason:'合成学生现在想休息'},f.ctx);
  assert.equal(paused.proposalId,proposal.id);assert.ok(paused.items.every(i=>i.status==='paused'));
  assert.equal(f.repository.get('reviewItems',item.id)!.status,'paused');
 }finally{f.dispose();}
});
