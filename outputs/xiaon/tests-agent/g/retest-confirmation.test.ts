/** 集成回归：仓库 canonical 键序与 schema 键序不同，不能视作学生更改确认。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionProblems } from '../../server/agents/professional';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas,type MonthStage } from '../../shared/learning-contracts';
test('拒绝复测允许 confirmation 换键序，但拒绝真正篡改确认字段',()=>{
 const f=temporaryRepository();try{
  const at=f.clock.now(),now='2026-10-31T01:00:00.000Z';
  const stage:MonthStage={schemaVersion:'1.0.0',id:'stage-regression',operationId:'stage-confirm',revision:2,month:'2026-10',module:'逻辑',goal:'先核对前提再举反例',sourceReportId:'report-regression',weeks:[],retestSuggestedAt:'2026-10-31',status:'confirmed',confirmation:{action:'accept',confirmedAt:at,actor:'student'},retestDeclinedAt:null,mode:'local_rules',createdAt:at,updatedAt:at};
  f.repository.append('monthStages',stage);const prev=f.repository.get('monthStages',stage.id)!;
  const next=schemas.MonthStage.parse({...prev,revision:3,operationId:'stage-decline',retestDeclinedAt:now,updatedAt:now});
  assert.notEqual(JSON.stringify(next.confirmation),JSON.stringify(prev.confirmation),'复现存库与 schema 键序差异');
  assert.deepEqual(revisionProblems(next,prev,{now,decline:true}),[]);
  assert.ok(revisionProblems({...next,confirmation:{...next.confirmation!,confirmedAt:now}},prev,{now,decline:true}).length>0,'字段真正变化仍拒绝');
 }finally{f.dispose();}
});
