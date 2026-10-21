/** SYNTHETIC ONLY. Emits reproducible four-profile and virtual-clock examples, not real learning evidence. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixtures';
import { PlanningEngine } from '../../server/plugins/planning';
import { currentReviewItems } from '../../src/learning/review';
import { attemptFacts } from '../../server/plugins/planning/evidence';

const output=resolve('../../任务书/2026-10-21-Agent升级/交付/C/evidence');
const profiles=[];
for(const [name,kp,status] of [
 ['去括号提示依赖','brackets','completed_with_help'],['建模关系困难','relations','needs_support'],['已有跨次独立记录','brackets','cross_session_independent'],['完全无记录','meaning','unobserved'],
] as const) {
 const f=fixture(),engine=new PlanningEngine();try {
  if(status==='cross_session_independent'){
   f.attempt(kp);f.clock.advance(3*86400000);f.nextSession();f.attempt(kp,1);
  }else if(status!=='unobserved')f.attempt(kp,0,status==='needs_support'?'incorrect':'correct',status==='completed_with_help');
  const assessment=f.snapshot({[kp]:status});
  const proposal=await engine.propose({operationId:randomUUID(),assessment,timeBudgetMinutes:6},f.ctx);
  const report=await engine.report({operationId:randomUUID(),assessment,previousReportId:null},f.ctx);
  profiles.push({name,synthetic:true,input:{assessment,timeBudgetMinutes:6},output:{proposal,report}});
 }finally{f.dispose();}
}
writeFileSync(resolve(output,'four-profiles.json'),JSON.stringify({synthetic:true,description:'预设 AssessmentSnapshot/评分；不代表 B 或真实学生/模型验证',profiles},null,2)+'\n');

const f=fixture(),engine=new PlanningEngine();try {
 const first=f.attempt();const assessment=f.snapshot({brackets:'first_independent'});
 const proposal=await engine.propose({operationId:randomUUID(),assessment,timeBudgetMinutes:6},f.ctx);
 await engine.confirm({operationId:randomUUID(),proposalId:proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生明确接受'},f.ctx);
 let item=currentReviewItems(f.ctx)[0];const timeline:unknown[]=[{event:'initial',completedAt:first.sourceTime.occurredAt,item}];
 for(let stage=0;stage<4;stage++){
  f.clock.set(item.dueAt);f.nextSession();const attempt=f.attempt('brackets',stage+1);const facts=attemptFacts(attempt.id,'brackets',f.ctx);
  item=(await engine.recordOutcome({schemaVersion:'1.0.0',id:randomUUID(),operationId:randomUUID(),evidenceRevision:f.repository.evidenceRevision(),reviewItemId:item.id,reviewRevision:item.revision,attemptId:attempt.id,sessionId:attempt.sessionId!,verdict:facts.grade.verdict,independent:facts.independent,taskNovelty:facts.novelty,completedAt:facts.time!,reason:'合成独立延迟复查'},f.ctx))[0];
  timeline.push({event:'virtual-clock-review',completedAt:f.clock.now(),item});
 }
 writeFileSync(resolve(output,'virtual-timeline.json'),JSON.stringify({synthetic:true,clock:'TestClock',policy:engine.policy,timeline},null,2)+'\n');
}finally{f.dispose();}
console.log('Synthetic four-profile outputs and 25-day virtual timeline written to C/evidence; no actual waiting.');
