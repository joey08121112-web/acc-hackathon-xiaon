/** 所有者：Claude。首页 Tutor 读到专业模式近况：最近一次测评测到的模块等级 + 本月学生确认的目标；只在找卡点、一起想、看见进步阶段给，合成材料。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,type Dimension,type ModelProvider,type MonthStage,type ProfessionalReport } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const NOW='2026-10-21T00:00:00.000Z'; // 上海时间 2026-10-21，本月 2026-10
/** Records the system prompt and the data payload of every Tutor call. */
class Recorder implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;systems:string[]=[];data:Record<string,unknown>[]=[];
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.systems.push(input.messages.find(m=>m.role==='system')!.content);this.data.push(JSON.parse(input.messages.find(m=>m.role==='user')!.content));
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[]}),toolCalls:[]};
 }
}
const report=(rid:string,spec:Partial<Record<Dimension,'good'|'partial'|'needs_work'>>):ProfessionalReport=>schemas.ProfessionalReport.parse({schemaVersion:SCHEMA_VERSION,id:rid,operationId:'op-'+rid,evidenceRevision:1,interviewId:'iv-'+rid,version:1,supersedesReportId:null,comparedWithReportId:null,
 modules:INTERVIEW_MODULE_ORDER.map((module,i)=>{const level=spec[module]??'not_tested',tested=level!=='not_tested';
  return {module,level,basis:level==='good'?'correct_with_reason':level==='partial'?'completed_with_hint':level==='needs_work'?'incorrect_on_both':'not_tested',evidenceIds:tested?['ev-'+i]:[],attemptIds:tested?['att-'+i]:[],turnIds:[],quotes:tested?['我是先看括号的']:[],wording:null,suggestions:level==='good'||!tested?[]:['读题时先圈出全部条件'],scope:'this_interview'};}),
 observationChecks:[],changes:[],mode:'local_rules',createdAt:'2026-10-20T10:00:00.000Z'});
const stage=(sid:string,revision:number,month:string,status:MonthStage['status'],goal:string):MonthStage=>schemas.MonthStage.parse({schemaVersion:SCHEMA_VERSION,id:sid,operationId:'op-'+sid+revision,revision,month,module:'理解',goal,sourceReportId:'rep-1',weeks:[],
 retestSuggestedAt:month+'-28',status,confirmation:status==='confirmed'?{action:'accept',confirmedAt:month+'-02T00:00:00.000Z',actor:'student'}:null,retestDeclinedAt:null,mode:'local_rules',createdAt:month+'-01T00:00:00.000Z',updatedAt:month+'-02T00:00:00.000Z'});
function setup(){
 const p=new Recorder(),f=temporaryRepository(new TestClock(NOW)),r=createRuntime({...f,provider:p}),d=installLearning(r,{timeoutMs:2000});
 const history:{role:'user'|'assistant';content:string}[]=[];
 const say=async(text:string)=>{history.push({role:'user',content:text});const reply=await d.chat({operationId:id(),history:history.slice(-20),flow:'home'});history.push({role:'assistant',content:reply.text});return reply;};
 return{...f,p,r,d,say};
}
const GROWTH_LINE=/专业模式的近况/;

test('home Tutor gets the latest report levels and this month\'s confirmed goal on study stages only',async()=>{
 const f=setup();try{
  f.r.repository.append('professionalReports',report('rep-1',{理解:'needs_work',逻辑:'partial'}));
  f.r.repository.append('monthStages',stage('stage-sep',2,'2026-09','confirmed','上个月的目标'));
  f.r.repository.append('monthStages',stage('stage-oct',1,'2026-10','draft','草案措辞'));
  f.r.repository.append('monthStages',stage('stage-oct',2,'2026-10','confirmed','读题时能自己找出全部条件'));
  const stages=[await f.say('今天考砸了'),await f.say('数学，好多错题'),await f.say('周末去看了电影'),await f.say('第3题我做错了')].map(r=>r.stage);
  assert.deepEqual(stages,['listen','listen','companion','probe']);
  for(const i of [0,1,2]){assert.equal('growth' in f.p.data[i],false,`stage ${stages[i]} gets no growth`);assert.doesNotMatch(f.p.systems[i],GROWTH_LINE);}
  assert.deepEqual(f.p.data[3].growth,{
   report:{createdAt:'2026-10-20T10:00:00.000Z',modules:[{module:'理解',level:'需要加强'},{module:'逻辑',level:'部分掌握'}]},
   monthGoal:{month:'2026-10',module:'理解',goal:'读题时能自己找出全部条件'}},'only tested modules; the latest confirmed revision of this month');
  assert.match(f.p.systems[3],/^tutor-g0-probe-observe-growth$/m);assert.match(f.p.systems[3],GROWTH_LINE);
  assert.doesNotMatch(JSON.stringify(f.p.data[3].growth),/ev-|att-|我是先看括号的|上个月的目标|草案措辞/,'no evidence ids, quotes, other months or drafts');
  assert.equal(f.r.events.memoryEnabled(),false,'professional records are learning records: shown with the memory switch off');
 }finally{f.dispose();}
});

test('no confirmed goal this month: the report alone; no professional records: no growth block at all',async()=>{
 const f=setup();try{
  await f.say('今天考砸了');await f.say('数学，好多错题');await f.say('第3题我做错了');
  assert.equal('growth' in f.p.data[2],false);assert.match(f.p.systems[2],/^tutor-g0-probe-observe$/m,'prompt version unchanged without records');assert.doesNotMatch(f.p.systems[2],GROWTH_LINE);
  f.r.repository.append('professionalReports',report('rep-1',{理解:'good',逻辑:'needs_work'}));
  f.r.repository.append('monthStages',stage('stage-sep',2,'2026-09','confirmed','上个月的目标'));
  f.r.repository.append('monthStages',stage('stage-oct',1,'2026-10','draft','草案措辞'));
  await f.say('还是不会');
  assert.deepEqual(f.p.data[3].growth,{report:{createdAt:'2026-10-20T10:00:00.000Z',modules:[{module:'理解',level:'掌握得不错'},{module:'逻辑',level:'需要加强'}]},monthGoal:null});
  assert.match(f.p.systems[3],/-growth$/m);
 }finally{f.dispose();}
});

test('the legacy two-step flow is unchanged: no growth in its data',async()=>{
 const f=setup();try{
  f.r.repository.append('professionalReports',report('rep-1',{理解:'needs_work',逻辑:'partial'}));
  await f.d.chat({operationId:id(),history:[{role:'user',content:'今天考砸了'},{role:'assistant',content:'嗯'},{role:'user',content:'第3题我做错了'}]});
  assert.equal('growth' in f.p.data[0],false);assert.doesNotMatch(f.p.systems[0],GROWTH_LINE);
 }finally{f.dispose();}
});
