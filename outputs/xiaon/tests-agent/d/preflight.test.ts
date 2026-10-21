import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { RubricAssessment } from '../../server/plugins/assessment';
import { PlanningEngine } from '../../server/plugins/planning';
import { temporaryRepository } from '../../server/storage/testing';
test('B real catalog and C proposal interoperate without fixture catalog',async()=>{
 const f=temporaryRepository();try{
 const r=createRuntime({...f,engines:{assessment:new RubricAssessment(),planning:new PlanningEngine()}});
 r.events.startSession({operationId:'start',mode:'support'});
 const assessment=await r.assessment().snapshot({operationId:'snapshot'},r.engineContext());
 const p=await r.planning().propose({operationId:'proposal',assessment,timeBudgetMinutes:6},r.engineContext());
 assert.ok(p.id);assert.equal(p.items.length>0,true);
 }finally{f.dispose();}
});
