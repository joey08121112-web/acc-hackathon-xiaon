import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { document } from '../../scripts/agent/schema';
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';
import { assessmentConsumer,planningConsumer,registerExample } from './consumers';

test('JSON Schema artifact exactly matches runtime schemas, all object boundaries reject extras',()=>{
 assert.deepEqual(JSON.parse(readFileSync('shared/learning-contracts.schema.json','utf8')),document);
 function walk(v:unknown):void{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}const o=v as Record<string,unknown>;if(o.type==='object')assert.equal(o.additionalProperties,false);Object.values(o).forEach(walk);}
 walk(document);
});
test('B/C consumers register independently, unimplemented ports fail explicitly',async()=>{
 const f=temporaryRepository();const r=createRuntime(f);try{
  assert.throws(()=>r.planning(),/尚未注册/);
  registerExample(r,assessmentConsumer(r.catalog),planningConsumer);
  await assert.rejects(()=>r.assessment().snapshot({operationId:'b'},r.engineContext()),{code:'not_implemented'});
  await assert.rejects(()=>r.planning().due({at:f.clock.now(),includePaused:true},r.engineContext()),{code:'not_implemented'});
 }finally{f.dispose();}
});

test('report/plan/evidence storage retains old immutable revisions without claiming B/C recomputation',()=>{
 const f=temporaryRepository();try{
  const r=f.repository;const report={schemaVersion:'1.0.0' as const,id:'report-1',operationId:'report-op',evidenceRevision:0,createdAt:f.clock.now(),assessmentSnapshotId:'synthetic-assessment',statements:[{text:'合成示例，无作答依据',kind:'unknown' as const,evidenceIds:[]}],coverage:[],changes:[],recommendations:[],supersedesReportId:null};
  r.append('reports',report);assert.throws(()=>r.append('reports',{...report,changes:['mutated']}),{code:'conflict'});
  r.append('reports',{...report,id:'report-2',operationId:'report-op-2',supersedesReportId:report.id});assert.equal(r.list('reports').length,2);assert.deepEqual(r.get('reports',report.id),report);
  const plan={schemaVersion:'1.0.0' as const,id:'plan-1',operationId:'plan-op',evidenceRevision:0,version:1,proposalId:'synthetic-proposal',previousVersionId:null,goal:'合成计划',items:[],changes:[],confirmation:{action:'defer' as const,confirmedAt:f.clock.now(),actor:'student' as const,expectedPreviousVersionId:null,reason:'学生合成事件'},createdAt:f.clock.now()};
  r.append('plans',plan);assert.throws(()=>r.append('plans',{...plan,goal:'mutated'}),{code:'conflict'});
  assert.equal(r.evidenceRevision(),0);
 }finally{f.dispose();}
});
