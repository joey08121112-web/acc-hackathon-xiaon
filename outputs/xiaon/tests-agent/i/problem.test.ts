/** 所有者：zCode。第一期 A：错题记录——草稿程序校验、学生确认、参考答案两次解题与保密、离线可用。合成材料。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { validateProblemDraft } from '../../server/plugins/problems';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import type { ModelProvider,ProblemDraft } from '../../shared/learning-contracts';
const id=()=>crypto.randomUUID();
const TEXTS=['那道题是化简 3x − (2x − 5)','我算到 3x − 2x − 5 这里就不知道了','括号前面是负号我就懵了'];
/** 解题队列：solve1、solve2 依次出队；其他角色按系统提示词回固定 JSON。 */
class LaneProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;solves:string[]=[];solveCalls=0;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  if(system.includes('problem-solve-i1')){this.solveCalls++;return{content:JSON.stringify({answer:this.solves.shift()??'x+5'}),toolCalls:[]};}
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[]}),toolCalls:[]};
 }
}
const setup=(provider?:ModelProvider,clock:TestClock=new TestClock())=>{
 const f=temporaryRepository(clock),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r,{timeoutMs:2000});
 return{...f,r,d};
};
const draft=(over:Partial<ProblemDraft>={}):ProblemDraft=>({source:'spoken',questionText:'化简 3x − (2x − 5)',studentWork:'3x − 2x − 5',knowledgePointId:'negative-brackets',stuckQuote:'括号前面是负号我就懵了',stuckPointId:null,catalogTask:null,...over});
const check={sessionId:'chat-x',stage:'probe' as const,studentTexts:TEXTS};

test('validateProblemDraft: 出处核对、知识点归一、不完整草稿不通过',()=>{
 // 全部字段都能在学生原话里找到出处 → 通过
 const good=validateProblemDraft(draft(),check);
 assert.equal(good.ok,true);if(good.ok){assert.equal(good.value.questionText,'化简 3x − (2x − 5)');assert.equal(good.value.knowledgePointId,'negative-brackets');}
 // 知识点不在 6 个之内 → other
 const other=validateProblemDraft(draft({knowledgePointId:'quadratic-equations' as ProblemDraft['knowledgePointId']}),check);
 assert.equal(other.ok,true);if(other.ok)assert.equal(other.ok&&other.value.knowledgePointId,'other');
 // 模型编造的卡点（学生没说过）→ 整份丢弃
 assert.equal(validateProblemDraft(draft({stuckQuote:'移项要变号但我总忘记'}),check).ok,false);
 // 只有标点的“原话”归一后为空，不能冒充出处
 assert.equal(validateProblemDraft(draft({stuckQuote:'。。。'}),check).ok,false,'空串出处不算找到');
 // 编造的题目文字被丢弃；只剩卡点没有题目/作答 → 草稿不完整
 const noQuestion=validateProblemDraft(draft({questionText:'解方程 2x+1=7',studentWork:null}),check);
 assert.equal(noQuestion.ok,false,'题目与作答都找不到出处时不展示确认卡');
 // 题目文字有空格/标点差异但确实出自学生 → 保留
 const spaced=validateProblemDraft(draft({questionText:'化简3x−(2x−5)'}),check);
 assert.equal(spaced.ok,true);if(spaced.ok)assert.equal(spaced.value.questionText,'化简3x−(2x−5)');
 // studentWork 找不到出处 → 只丢这个字段，其余保留
 const work=validateProblemDraft(draft({studentWork:'我先去了括号'}),check);
 assert.equal(work.ok,true);if(work.ok)assert.equal(work.value.studentWork,null);
});

/** 首页流程里模型提议了一份合法草稿：程序放行到确认卡，但没点「记下」之前什么都不写。 */
class ProposingProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const extra=system.includes('tutor-g0-probe')?{problemDraft:{source:'spoken',questionText:'化简 3x − (2x − 5)',studentWork:null,knowledgePointId:'negative-brackets',stuckQuote:'括号前面是负号我就懵了',stuckPointId:null,catalogTask:null}}:{};
  return{content:JSON.stringify({message:'嗯，我在听。',taskIds:[],...extra}),toolCalls:[]};
 }
}
test('首页流程：合法草稿透传到确认卡，未点「记下」不写入；确认后才落库并与场次关联',async()=>{
 const f=setup(new ProposingProvider());try{
  const history:{role:'user'|'assistant';content:string}[]=[];
  const say=async(text:string)=>{history.push({role:'user',content:text});const r=await f.d.chat({operationId:id(),history:history.slice(-20),flow:'home'});history.push({role:'assistant',content:r.text});return r;};
  await say('今天考砸了');await say('数学');
  const probe=await say('第3题我做错了：化简 3x − (2x − 5)，括号前面是负号我就懵了');
  assert.equal(probe.stage,'probe');assert.equal(probe.askProblem,true);
  assert.ok(probe.problemDraft,'合法草稿经程序校验后下发');
  assert.equal(probe.problemDraft?.stuckQuote,'括号前面是负号我就懵了');
  assert.equal(f.r.repository.list('chatTurns').at(-1)!.dropped.some(d=>d.field==='problemDraft'),false,'没有被丢弃');
  assert.equal(f.r.repository.list('problems').length,0,'未确认的草稿不写入');
  const record=await f.d.confirmProblem({operationId:id(),sessionId:probe.sessionId,draft:probe.problemDraft!,referenceAnswer:null});
  assert.equal(record.sessionId,probe.sessionId);assert.equal('answer' in record,false,'确认响应里没有参考答案字段');
  assert.equal(f.r.repository.list('problems').length,1);
  // 下一轮：本场次已有错题，不再追问要不要记
  const next=await say('嗯');assert.equal(next.askProblem,false);
 }finally{f.dispose();}
});

test('confirmProblem: 两次解题一致且 expression 核对一致 → verified，秘密只在服务端',async()=>{
 const p=new LaneProvider(),f=setup(p);try{
  p.solves=['x+5','x + 5'];
  const record=await f.d.confirmProblem({operationId:id(),sessionId:'chat-x',draft:draft(),referenceAnswer:null});
  assert.equal(record.answerStatus,'verified');
  assert.equal(p.solveCalls,2,'两次独立解题');
  const secret=f.r.repository.list('problemSecrets');
  assert.equal(secret.length,1);assert.equal(secret[0].origin,'program_computed');assert.deepEqual(secret[0].answer,['x+5']);
  const view=await f.d.view();
  assert.equal('problemSecrets' in view,false);
  assert.equal(JSON.stringify(view).includes('x+5'),false,'参考答案不进 view');
 }finally{f.dispose();}
});

test('confirmProblem: 两次解题不一致 → unknown 且不写 ProblemSecret',async()=>{
 const p=new LaneProvider(),f=setup(p);try{
  p.solves=['x+5','x-5'];
  const record=await f.d.confirmProblem({operationId:id(),sessionId:null,draft:draft(),referenceAnswer:null});
  assert.equal(record.answerStatus,'unknown');
  assert.equal(f.r.repository.list('problemSecrets').length,0);
 }finally{f.dispose();}
});

test('confirmProblem: 两次一致但与题目算不出同一结果 → unknown（不写秘密）',async()=>{
 const p=new LaneProvider(),f=setup(p);try{
  p.solves=['5x+9','5x+9'];// 3x-(2x-5) 的正确结果是 x+5
  const record=await f.d.confirmProblem({operationId:id(),sessionId:null,draft:draft(),referenceAnswer:null});
  assert.equal(record.answerStatus,'unknown');
  assert.equal(f.r.repository.list('problemSecrets').length,0);
 }finally{f.dispose();}
});

test('confirmProblem: 学生改后的文字被保存；模型离线仍能确认（无参考答案）',async()=>{
 const p=new LaneProvider(),f=setup(p);try{
  const edited=await f.d.confirmProblem({operationId:id(),sessionId:null,draft:draft({questionText:'化简 3x-(2x-5)'}) ,referenceAnswer:null});
  assert.equal(edited.questionText,'化简 3x-(2x-5)','保存的是学生改后的文字');
  assert.equal(p.solveCalls,2,'按改后的题目解题');assert.equal(edited.answerStatus,'verified');
 }finally{f.dispose();}
 const f2=setup();try{
  const offline=await f2.d.confirmProblem({operationId:id(),sessionId:null,draft:draft({questionText:'化简 3x − (2x − 5)'}),referenceAnswer:null});
  assert.equal(offline.answerStatus,'unknown','离线不生成参考答案');
  assert.equal(f2.r.repository.list('problemSecrets').length,0);
  assert.equal(f2.r.repository.list('problems').length,1,'记录仍然保存');
 }finally{f2.dispose();}
});

test('confirmProblem: 题库题用题库答案（verified）；错题确认同时确认被引用的卡点',async()=>{
 const p=new LaneProvider(),f=setup(p);try{
  await f.r.tools.execute({id:'call-1',name:'record_stuck_point',arguments:JSON.stringify({knowledgePointId:'negative-brackets',kind:'concept',studentQuote:'括号前面是负号我就懵了',summary:'负号管着谁不清楚',studentConfirmed:true})},{role:'tutor',runId:'run-1',signal:new AbortController().signal,studentTexts:TEXTS});
  const sp=f.r.repository.list('stuckPoints')[0];assert.equal(sp.studentConfirmed,false,'模型参数不能确认');
  const record=await f.d.confirmProblem({operationId:id(),sessionId:'chat-x',draft:draft({stuckPointId:sp.id,catalogTask:{taskId:'bracket',taskVersion:2}}),referenceAnswer:null});
  assert.equal(record.answerStatus,'verified');
  assert.equal(p.solveCalls,0,'题库题不调模型');
  assert.equal(f.r.repository.list('problemSecrets')[0].origin,'catalog');
  assert.equal((await f.d.view()).stuckPoints[0].studentConfirmed,true,'学生确认错题即确认卡点');
 }finally{f.dispose();}
});

test('confirmProblem: 学生自带参考答案记 student_provided，不冒充已核验',async()=>{
 const f=setup();try{
  const record=await f.d.confirmProblem({operationId:id(),sessionId:null,draft:draft({questionText:null,studentWork:null,stuckQuote:'括号前面是负号我就懵了'}),referenceAnswer:'x+5'});
  assert.equal(record.answerStatus,'unknown');
  const secret=f.r.repository.list('problemSecrets');
  assert.equal(secret.length,1);assert.equal(secret[0].origin,'student_provided');
  const view=await f.d.view();
  assert.equal(JSON.stringify(view).includes('x+5'),false,'学生自带答案同样不出服务端');
 }finally{f.dispose();}
});

test('重置整个演示：错题记录与参考答案一并清除',async()=>{
 const p=new LaneProvider(),f=setup(p);try{
  p.solves=['x+5','x+5'];
  await f.d.confirmProblem({operationId:id(),sessionId:null,draft:draft(),referenceAnswer:null});
  assert.equal(f.r.repository.list('problems').length+f.r.repository.list('problemSecrets').length,2);
  await f.d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});
  assert.equal(f.r.repository.list('problems').length+f.r.repository.list('problemSecrets').length,0);
 }finally{f.dispose();}
});
