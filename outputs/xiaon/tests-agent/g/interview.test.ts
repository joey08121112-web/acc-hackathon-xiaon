/** 所有者：Claude。第二期：专业模式面试引擎（本地规则 + 合成模型）。只用题库题和合成作答。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { moduleBasis,levelOf,statedReason } from '../../server/plugins/interview/levels';
import { ASSESSOR_PROMPT } from '../../server/plugins/assessment';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,type InterviewStep,type ModelProvider,type ModuleLevelBasis } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const RIGHT:Record<string,string>={understand:'2x-3',logic:'A','b-like-observation':'5x-4','b-like-transfer':'3a+7',bracket:'x+5',model:'3x+2',space:'B','b-language-transfer':'3a+6','b-logic-transfer':'C','b-cost-transfer':'5a+8','b-space-transfer':'A','b-language-delayed':'2x-8','b-logic-delayed':'B'};
const WRONG:Record<string,string>={understand:'2x-6',logic:'C','b-like-observation':'x','b-like-transfer':'3a-3',bracket:'x-5',model:'3x+6',space:'A','b-language-transfer':'3a+2','b-logic-transfer':'A','b-cost-transfer':'13a','b-space-transfer':'B'};
const REASON='因为要先算两倍，再减去三，顺序不能反过来';
function setup(provider?:ModelProvider){
 const clock=new TestClock('2026-10-21T01:00:00.000Z'),f=temporaryRepository(clock),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r,{timeoutMs:2000});
 const answer=(step:InterviewStep,text:string)=>d.interviewAnswer({operationId:id(),interviewId:step.interview!.id,expectedRevision:step.interview!.revision,text});
 /** Answers the pending question and its follow-up. */
 const pass=async(step:InterviewStep,o:{wrong?:boolean;reason?:string}={})=>{
  const task=step.interview!.pending!.task.taskId;assert.ok(step.interview!.pending!.kind!=='follow_up');
  const asked=await answer(step,(o.wrong?WRONG:RIGHT)[task]??'不知道');assert.equal(asked.interview!.pending!.kind,'follow_up');assert.equal(asked.interview!.pending!.task.taskId,task);
  return answer(asked,o.reason??REASON);
 };
 const report=(step:InterviewStep)=>d.interviewReport({operationId:id(),interviewId:step.interview!.id});
 return {...f,clock,r,d,answer,pass,report,turns:()=>r.repository.list('interviewTurns')};
}
const level=(rep:{modules:{module:string;level:string;basis:string;suggestions:string[]}[]},m:string)=>rep.modules.find(x=>x.module===m)!;

test('level rule: every boundary maps through the program basis',()=>{
 const f=(resultOk:boolean,reasonClear=true,hinted=false)=>({resultOk,reasonClear,hinted});
 const cases:[Parameters<typeof moduleBasis>[0],ModuleLevelBasis,string][]=[
  [{observation:null,transfer:null},'not_tested','not_tested'],
  [{observation:f(true),transfer:null},'correct_with_reason','good'],
  [{observation:f(true,false),transfer:null},'correct_reason_incomplete','partial'],
  [{observation:f(true,true,true),transfer:null},'completed_with_hint','partial'],
  [{observation:f(true,false,true),transfer:null},'completed_with_hint','partial'],
  [{observation:f(false),transfer:f(true)},'correct_on_transfer','partial'],
  [{observation:f(false),transfer:f(false)},'incorrect_on_both','needs_work'],
  [{observation:f(false),transfer:null},'incorrect_on_both','needs_work'],
 ];
 for(const [facts,basis,lvl] of cases){assert.equal(moduleBasis(facts),basis);assert.equal(levelOf(basis),lvl);}
 assert.equal(statedReason('先合并x项再算常数'),true);assert.equal(statedReason('不知道'),false);assert.equal(statedReason('嗯'),false);
});

test('order is fixed: 理解 then 逻辑 then 计算 → 建模 → 空间想象; no report before 理解 and 逻辑; each answer asks one follow-up',async()=>{
 const t=setup();try{
  let step=await t.d.interviewStart({operationId:id()});
  assert.equal(step.interview!.currentModule,'理解');assert.equal(step.interview!.pending!.kind,'question');assert.ok(step.task&&!('answer' in step.task));
  assert.equal(step.interview!.pending!.mode,'local_rules');assert.match(step.interview!.pending!.prompt,/比 x 的 2 倍少 3/,'local rules: fixed lead + the catalog question');
  assert.equal(t.r.events.sessions().find(s=>s.id===step.interview!.learningSessionId)!.mode,'exploration');
  await assert.rejects(t.report(step),/理解和逻辑/);
  const seen:string[]=[];
  for(const m of INTERVIEW_MODULE_ORDER){assert.equal(step.interview!.currentModule,m);seen.push(m);step=await t.pass(step);if(m==='逻辑')assert.equal(step.reportReady,true);}
  assert.deepEqual(seen,[...INTERVIEW_MODULE_ORDER]);
  assert.equal(step.interview!.status,'completed');assert.equal(step.interview!.pending,null);assert.deepEqual(step.interview!.completedModules,[...INTERVIEW_MODULE_ORDER]);
  const turns=t.turns();assert.equal(turns.length,10,'five questions, five follow-ups, no transfer when right');
  assert.deepEqual(turns.map(x=>x.kind),Array(5).fill(['question','follow_up']).flat());
  for(const turn of turns)assert.equal(turn.attemptId===null,turn.kind!=='follow_up','the follow-up answer completes the graded attempt');
  const attempts=t.r.repository.list('attempts');assert.equal(attempts.length,5);
  assert.equal(attempts.find(a=>a.taskId==='understand')!.value,'2x-3\n'+REASON,'reason tasks: the follow-up goes to the Assessor as the explanation line');
  assert.equal(attempts.find(a=>a.taskId==='b-like-observation')!.value,'5x-4','calculation keeps only the answer lines');
  assert.ok(t.r.repository.list('exposures').filter(e=>e.kind==='task').length>=5,'every question opened as a task exposure');
 }finally{t.dispose();}
});

test('a transfer question is asked only after a wrong first answer, from the same family',async()=>{
 const t=setup();try{
  let step=await t.d.interviewStart({operationId:id()});
  step=await t.pass(step);assert.equal(step.interview!.currentModule,'逻辑','right answer: no transfer');
  step=await t.pass(step,{wrong:true});
  assert.equal(step.interview!.currentModule,'逻辑');assert.equal(step.interview!.pending!.kind,'transfer');assert.equal(step.interview!.pending!.task.taskId,'b-logic-transfer');
  assert.match(step.text,/类似/);
  step=await t.pass(step);assert.equal(step.interview!.currentModule,'计算');
  const rep=await t.report(step);
  assert.equal(level(rep,'理解').level,'partial',"offline: the reason point can't be verified, so a right result is partial, not good");
  assert.equal(level(rep,'理解').basis,'correct_reason_incomplete');
  assert.deepEqual([level(rep,'逻辑').basis,level(rep,'逻辑').level],['correct_on_transfer','partial']);
  for(const m of ['计算','建模','空间想象'])assert.deepEqual([level(rep,m).level,level(rep,m).basis],['not_tested','not_tested'],m);
  assert.equal(rep.mode,'local_rules');assert.ok(rep.modules.filter(x=>x.level!=='not_tested').every(x=>x.wording&&x.suggestions.length>0));
  assert.equal(t.r.repository.list('professionalReports').length,1,'the coordinator stored the checked report');
 }finally{t.dispose();}
});

test('calculation levels: stated reason → good, no reason → partial, hint → partial, both wrong → needs_work',async()=>{
 for(const [label,run,basis] of [
  ['good',async(t:ReturnType<typeof setup>,s:InterviewStep)=>t.pass(s,{reason:'先把x项合起来，再写常数'}),'correct_with_reason'],
  ['no reason',async(t:ReturnType<typeof setup>,s:InterviewStep)=>t.pass(s,{reason:'不知道'}),'correct_reason_incomplete'],
  ['hint',async(t:ReturnType<typeof setup>,s:InterviewStep)=>{const hinted=await t.answer(s,'给我一点提示');assert.match(hinted.text,/系数相加/);assert.equal(hinted.interview!.revision,s.interview!.revision,'a hint asks nothing new');return t.pass(hinted,{reason:'先把x项合起来，再写常数'});},'completed_with_hint'],
  ['both wrong',async(t:ReturnType<typeof setup>,s:InterviewStep)=>{const a=await t.pass(s,{wrong:true});assert.equal(a.interview!.pending!.task.taskId,'b-like-transfer');return t.pass(a,{wrong:true});},'incorrect_on_both'],
 ] as const){
  const t=setup();try{
   let step=await t.d.interviewStart({operationId:id()});step=await t.pass(step);step=await t.pass(step);
   assert.equal(step.interview!.pending!.task.taskId,'b-like-observation','bracket needs like-terms first (existing prerequisite rule)');
   step=await run(t,step);const rep=await t.report(step);assert.equal(level(rep,'计算').basis,basis,label);
   if(basis==='correct_with_reason')assert.deepEqual(level(rep,'计算').suggestions,[]);
  }finally{t.dispose();}
 }
});

test('pause keeps the pending question and pauses the session; resume (also next day) continues there without re-asking',async()=>{
 const t=setup();try{
  let step=await t.d.interviewStart({operationId:id()});step=await t.pass(step);
  const pending=step.interview!.pending!,firstSession=step.interview!.learningSessionId;
  const paused=await t.d.interviewPause({operationId:id(),interviewId:step.interview!.id});
  assert.equal(paused.status,'paused');assert.deepEqual(paused.pending,pending);assert.equal(paused.currentModule,'逻辑');
  assert.equal(t.r.events.sessions().find(s=>s.id===firstSession)!.status,'paused','pausing the interview also pauses the learning session');
  await assert.rejects(t.answer({...step,interview:paused},'A'),/暂停/);
  t.clock.advance(24*3600_000);
  const resumed=await t.d.interviewResume({operationId:id(),interviewId:paused.id});
  assert.equal(resumed.interview!.status,'in_progress');assert.match(resumed.text,/上次停在「逻辑」/);
  assert.deepEqual(resumed.interview!.pending!.task,pending.task);assert.notEqual(resumed.interview!.learningSessionId,firstSession,'a new day runs in a new exploration session');
  assert.equal(t.r.events.sessions().find(s=>s.id===resumed.interview!.learningSessionId)!.status,'active');
  step=await t.pass(resumed);assert.equal(step.interview!.currentModule,'计算','理解/逻辑 from the earlier session satisfy the exploration order');
  step=await t.pass(step);assert.equal(step.interview!.currentModule,'建模');
  const questions=t.turns().filter(x=>x.kind==='question').map(x=>x.module);assert.deepEqual(questions,['理解','逻辑','计算'],'nothing answered was asked again');
 }finally{t.dispose();}
});

test('rest words pause; safety words store nothing and leave the interview as it was',async()=>{
 const t=setup();try{
  const step=await t.d.interviewStart({operationId:id()});const before=t.r.repository.revision();
  const safe=await t.answer(step,'我不想活了');assert.equal(safe.safety,true);assert.equal(t.r.repository.revision(),before);assert.deepEqual(safe.interview,step.interview);
  const rest=await t.answer(step,'我想休息一下');assert.equal(rest.interview!.status,'paused');assert.equal(t.turns().length,0);
 }finally{t.dispose();}
});

test('report: comparison cites only real observations; a second interview compares with the last report; a re-report supersedes',async()=>{
 const t=setup();try{
  const at=t.clock.now();
  for(const [oid,dimension,signal] of [['obs-u','理解','partial'],['obs-l','逻辑','clear']] as const)t.r.repository.append('observations',{schemaVersion:SCHEMA_VERSION,id:oid,sessionId:'chat-1',dimension,signal,quote:'这句话的条件是哪几个',note:'合成',status:'unverified',at});
  let step=await t.d.interviewStart({operationId:id()});step=await t.pass(step,{wrong:true});step=await t.pass(step,{wrong:true});step=await t.pass(step);
  const first=await t.report(step);
  assert.deepEqual(first.observationChecks,[{observationId:'obs-u',dimension:'理解',result:'confirmed'},{observationId:'obs-l',dimension:'逻辑',result:'not_seen'}],'理解: struggling seen in chat and here; 逻辑: clear in chat, only partial here');
  step=await t.pass(step);
  const second=await t.report(step);assert.equal(second.version,2);assert.equal(second.supersedesReportId,first.id);assert.equal(second.comparedWithReportId,null);
  for(let i=0;i<2;i++)step=await t.pass(step);assert.equal(step.interview!.status,'completed');
  const again=await t.d.interviewStart({operationId:id()});let s2=again;for(let i=0;i<2;i++)s2=await t.pass(s2,{reason:'不知道'});
  const third=await t.report(s2);assert.equal(third.comparedWithReportId,second.id);assert.equal(third.version,1);
  assert.ok(third.changes.length>0&&third.changes.every(c=>c.from!==c.to));
 }finally{t.dispose();}
});

test('per-session calculation cap reached: 计算 is skipped and reported as not tested',async()=>{
 const t=setup();try{
  const support=await t.d.start({operationId:id(),mode:'support'});
  for(let i=0;i<10;i++)t.r.events.expose({operationId:id(),sessionId:support.id,taskId:`calc-${i}`,taskVersion:2,kind:'task',hintId:null});
  let step=await t.d.interviewStart({operationId:id()});assert.equal(step.interview!.learningSessionId,support.id);
  step=await t.pass(step);step=await t.pass(step);
  assert.equal(step.interview!.currentModule,'建模');assert.deepEqual(step.interview!.completedModules,['理解','逻辑']);
  const rep=await t.report(step);assert.equal(level(rep,'计算').level,'not_tested');
 }finally{t.dispose();}
});

/** Synthetic model: phrases questions, words levels (and tries to change one), and analyzes the reason point. */
class Script implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;systems:string[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.find(m=>m.role==='system')!.content;this.systems.push(system.split('\n')[0]);
  if(system.startsWith('interviewer-g2'))return{content:JSON.stringify({prompt:'来闯这一关吧，慢慢想！'}),toolCalls:[]};
  if(system.startsWith('report-wording-g2'))return{content:JSON.stringify({wordings:{'理解':'读题很仔细，理由也说清了。'},levels:{'理解':'needs_work'}}),toolCalls:[]};
  if(input.messages.some(m=>m.role==='system'&&m.content===ASSESSOR_PROMPT)){const {task,value}=JSON.parse(input.messages.find(m=>m.role==='user')!.content) as {task:{rubric:{id:string}[]};value:string};const nl=value.indexOf('\n'),first=value.slice(0,nl<0?value.length:nl);
   return{content:JSON.stringify({points:task.rubric.map(r=>r.id==='result'?{pointId:r.id,status:'supported',quote:first,location:{start:0,end:first.length},explanation:'合成'}:{pointId:r.id,status:'supported',quote:value.slice(nl+1),location:{start:nl+1,end:value.length},explanation:'合成'})}),toolCalls:[]};}
  return{content:JSON.stringify({message:'嗯。',taskIds:[]}),toolCalls:[]};
 }
}
test('with a model: questions are phrased by the model, the program keeps the level, a stated reason makes 理解 good',async()=>{
 const p=new Script(),t=setup(p);try{
  let step=await t.d.interviewStart({operationId:id()});
  assert.equal(step.interview!.pending!.mode,'model');assert.match(step.interview!.pending!.prompt,/^来闯这一关吧/);assert.match(step.interview!.pending!.prompt,/比 x 的 2 倍少 3/,'the catalog question itself is never rewritten');
  step=await t.pass(step);step=await t.pass(step);
  const rep=await t.report(step);
  assert.deepEqual([level(rep,'理解').level,level(rep,'理解').basis],['good','correct_with_reason'],'the model tried needs_work; the program basis wins');
  assert.equal(rep.modules[0].wording,'读题很仔细，理由也说清了。');assert.equal(rep.mode,'model');
  assert.ok(p.systems.includes('interviewer-g2')&&p.systems.includes('report-wording-g2'));
 }finally{t.dispose();}
});
