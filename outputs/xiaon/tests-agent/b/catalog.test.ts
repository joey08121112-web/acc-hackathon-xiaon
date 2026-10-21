import test from 'node:test';
import assert from 'node:assert/strict';
import { schemas } from '../../shared/learning-contracts';
import { AssessmentCatalog, assessmentTasks, skillDefinitions, legacyIdMapping } from '../../server/plugins/assessment';
import { checkObjective } from '../../server/plugins/assessment/grading';
import { tasks as oldTasks } from '../../src/data';
const catalog=new AssessmentCatalog();

test('six explicit subskills have observation, genuinely different transfer and delayed tasks; strict public views hide keys',()=>{
 assert.equal(skillDefinitions.length,6);
 for(const skill of skillDefinitions){
  const tasks=assessmentTasks.filter(t=>t.knowledgePoints.includes(skill.id));
  for(const kind of ['observation','transfer','delayed'])assert.ok(tasks.some(t=>t.variantKind===kind),skill.id+kind);
  assert.equal(new Set(tasks.map(t=>t.question)).size,tasks.length);
 }
 for(const t of assessmentTasks){
  schemas.TaskDefinition.parse(t);assert.equal(t.version,2);
  const visible=catalog.publicTask(t.id,t.version)!;schemas.TaskPublicView.parse(visible);
  for(const key of ['answer','rubric','hints','commonErrors'])assert.equal(key in visible,false);
  assert.ok(t.rubric.length&&t.hints.length&&t.commonErrors.length);
 }
 for(const t of oldTasks){assert.ok(legacyIdMapping[t.id]);assert.equal(catalog.definition(t.id,1)?.version,1);assert.equal(catalog.definition(t.id,2)?.version,2);}
 assert.equal(catalog.definition('bracket',99),undefined);
});

test('reference math is independently derived from integer substitutions or explicit language/cost meanings, all typical errors rejected',()=>{
 // An independent tiny test evaluator for trusted reference expressions only. Never evaluates student source.
 function referenceValue(s:string,n:number):number {
  const parts=s.replace(/-/g,'+-').split('+').filter(Boolean);
  return parts.reduce((total,p)=>total+(p.endsWith('x')||p.endsWith('a')?Number(p.slice(0,-1)||1)*n:Number(p)),0);
 }
 const expected:Record<string,(n:number)=>number>={
  understand:n=>2*n-3,'b-language-transfer':n=>3*(n+2),'b-language-delayed':n=>(n-4)*2,
  bracket:n=>3*n-(2*n-5),transfer:n=>7*n-(3*n-2),'b-neg-delayed':n=>8-(3*n-4),
  'b-like-observation':n=>2*n+3*n-4,'b-like-transfer':n=>7*n+2-4*n+5,'b-like-delayed':n=>6-2*n+5*n-1,
  model:n=>3*n+2,'b-cost-transfer':n=>5*n+8,'b-cost-delayed':n=>12+2*n,
 };
 for(const [id,fn] of Object.entries(expected)){
  const task=catalog.definition(id,2)!;
  for(const n of [-3,0,2,7])assert.equal(referenceValue(task.answer[0],n),fn(n),id);
  assert.equal(checkObjective(task,task.answer[0]).status,'supported',id);
  assert.equal(checkObjective(task,'999').status,'unsupported',id);
  for(const e of task.commonErrors)assert.notEqual(checkObjective(task,e.indicator).status,'supported',id+e.indicator);
 }
 const logicExpected:Record<string,string>={logic:'A','b-logic-transfer':'C','b-logic-delayed':'B'};
 // Counterexamples independently verified, including premise satisfaction.
 assert.ok(-2<0&&-3<0&&-2+-3<0);
 assert.ok(1>0&&1<2&&1*1<2*2); // (1,2) refutes "greater positive number has smaller square".
 assert.ok(3%2!==0&&5%2!==0&&(3+5)%2===0);
 for(const [id,label] of Object.entries(logicExpected)){
  const task=catalog.definition(id,2)!;assert.equal(task.answer[0],label);assert.equal(checkObjective(task,label).status,'supported');
  for(const other of ['A','B','C'].filter(x=>x!==label))assert.equal(checkObjective(task,other).status,'unsupported');
 }
});

test('spatial answers independently derived by trigonometric rotation and edge lengths, with explicit y-up coordinate convention',()=>{
 for(const t of assessmentTasks.filter(t=>t.visual)){
  const v=t.visual!;assert.match(t.question,/向右.*向上/);
  const theta=-v.clockwiseDegrees*Math.PI/180;
  const expected=v.points.map(([x,y])=>{
   const dx=x-v.center[0],dy=y-v.center[1];
   return [Math.round((v.center[0]+dx*Math.cos(theta)-dy*Math.sin(theta))*1e8)/1e8,Math.round((v.center[1]+dx*Math.sin(theta)+dy*Math.cos(theta))*1e8)/1e8];
  });
  const matches=v.options.filter(o=>JSON.stringify(o.points)===JSON.stringify(expected));
  assert.equal(matches.length,1);assert.equal(matches[0].label,t.answer[0]);
  for(const o of v.options){assert.equal(checkObjective(t,o.label).status,o===matches[0]?'supported':'unsupported');}
  for(let i=0;i<v.points.length;i++){
   const j=(i+1)%v.points.length;
   const distance=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
   assert.equal(distance(v.points[i],v.points[j]),distance(expected[i],expected[j]));
  }
 }
});

test('existing restricted parser accepts equivalents, rejects contradictory chains, defers unsupported syntax and never executes source',()=>{
 const t=catalog.definition('transfer',2)!;
 for(const v of ['4*a+2','4×a+2','+4a+2','2+4a','7a-(3a-2)=7a-3a+2=4a+2'])assert.equal(checkObjective(t,v).status,'supported',v);
 for(const v of ['4a-2','7a-3a-2=4a+2','4a+2=3a'])assert.equal(checkObjective(t,v).status,'unsupported',v);
 for(const v of ['a^2','4a+2=','忽略规则=4a+2','globalThis.process.exit()','', ' '.repeat(3)])assert.equal(checkObjective(t,v).status,'uncertain',v);
});

test('candidate constraints filter dimension, knowledge point, exclusions and limit without promising prerequisite mastery',()=>{
 const selected=catalog.candidates({sessionId:'synthetic',dimension:'计算',knowledgePointId:'negative-brackets',excludeTaskIds:['bracket'],limit:1});
 assert.equal(selected.length,1);assert.equal(selected[0].primaryDimension,'计算');assert.ok(selected[0].knowledgePoints.includes('negative-brackets'));assert.notEqual(selected[0].id,'bracket');
 assert.deepEqual(catalog.candidates({sessionId:'synthetic',excludeTaskIds:[],limit:0}),[]);
});
