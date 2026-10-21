/** 所有者：Claude。第二期契约冒烟（Claude 路：专业模式面试与报告）。面试引擎已实现：程序门控先生效，之后交给引擎；完整流程见 interview.test.ts。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { reportProblems } from '../../server/agents/professional';
import { freePort,temporaryRepository } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,LEVEL_BY_BASIS,type InterviewSession,type ProfessionalReport } from '../../shared/learning-contracts';
const origin='http://127.0.0.1:5211',id=()=>crypto.randomUUID(),at='2026-10-21T00:00:00.000Z';
const interview=(over:Partial<InterviewSession>={}):InterviewSession=>({schemaVersion:SCHEMA_VERSION,id:'iv-1',operationId:'op-iv-1',revision:1,learningSessionId:'ls-1',moduleOrder:[...INTERVIEW_MODULE_ORDER],currentModule:'理解',completedModules:[],status:'in_progress',
 pending:{module:'理解',task:{taskId:'math-language',taskVersion:2},kind:'question',prompt:'先来一道读题的小关卡：这句话里哪些是条件？',mode:'local_rules',askedAt:at},startedAt:at,pausedAt:null,completedAt:null,updatedAt:at,...over});
const untested=(module:typeof INTERVIEW_MODULE_ORDER[number])=>({module,level:'not_tested' as const,basis:'not_tested' as const,evidenceIds:[],attemptIds:[],turnIds:[],quotes:[],wording:null,suggestions:[],scope:'this_interview' as const});
const report=(over:Partial<ProfessionalReport>={}):ProfessionalReport=>({schemaVersion:SCHEMA_VERSION,id:'rep-1',operationId:'op-rep-1',evidenceRevision:2,interviewId:'iv-1',version:1,supersedesReportId:null,comparedWithReportId:null,
 modules:[{module:'理解',level:'good',basis:'correct_with_reason',evidenceIds:['ev-1'],attemptIds:['att-1'],turnIds:['turn-1'],quotes:['先把条件圈出来'],wording:'读题时能自己找出条件',suggestions:[],scope:'this_interview'},
  {module:'逻辑',level:'partial',basis:'correct_reason_incomplete',evidenceIds:[],attemptIds:['att-2'],turnIds:[],quotes:[],wording:null,suggestions:['说理由时把每一步的依据讲出来'],scope:'this_interview'},untested('计算'),untested('建模'),untested('空间想象')],
 observationChecks:[{observationId:'obs-1',dimension:'理解',result:'confirmed'}],changes:[],mode:'local_rules',createdAt:at,...over});

test('G2 interview and report schemas: fixed module order, four levels, 「本次观察」, no score or rank',()=>{
 assert.deepEqual([...INTERVIEW_MODULE_ORDER],['理解','逻辑','计算','建模','空间想象']);
 assert.ok(schemas.InterviewSession.safeParse(interview()).success);
 assert.equal(schemas.InterviewSession.safeParse(interview({moduleOrder:['逻辑','理解','计算','建模','空间想象'] as never})).success,false,'the order is fixed');
 assert.equal(schemas.InterviewSession.safeParse(interview({status:'abandoned' as never})).success,false);
 const turn={schemaVersion:SCHEMA_VERSION,id:'turn-1',operationId:'op-t1',interviewId:'iv-1',seq:1,module:'理解',task:{taskId:'math-language',taskVersion:2},kind:'follow_up',prompt:'你是怎么想的？',answer:'我先把条件圈出来',attemptId:null,mode:'local_rules',askedAt:at,answeredAt:at};
 assert.ok(schemas.InterviewTurn.safeParse(turn).success);assert.equal(schemas.InterviewTurn.safeParse({...turn,kind:'hint'}).success,false);
 assert.ok(schemas.ProfessionalReport.safeParse(report()).success);
 assert.equal(schemas.ProfessionalReport.safeParse({...report(),score:86}).success,false,'no total score');
 assert.equal(schemas.ProfessionalReport.safeParse({...report(),rank:3}).success,false,'no ranking');
 assert.equal(schemas.ProfessionalReport.safeParse(report({modules:report().modules.slice(0,4)})).success,false,'every module appears, untested ones too');
 assert.equal(schemas.ModuleLevel.safeParse({...untested('计算'),scope:'overall'}).success,false,'each level is marked as this interview only');
 for(const [basis,level] of Object.entries(LEVEL_BY_BASIS))assert.ok(schemas.ModuleLevel.safeParse({...untested('计算'),basis,level}).success,basis);
 assert.ok(schemas.InterviewAnswer.safeParse({operationId:'op',interviewId:'iv-1',expectedRevision:1,text:'x=3'}).success);
 assert.equal(schemas.InterviewAnswer.safeParse({operationId:'op',interviewId:'iv-1',expectedRevision:1,text:'x=3',level:'good'}).success,false,'the client never sends a level');
});

test('report gate: levels follow the program basis, untested stays untested, citations must exist',()=>{
 const facts={interview:interview({completedModules:['理解','逻辑'],currentModule:'计算'}),observations:[{schemaVersion:SCHEMA_VERSION,id:'obs-1',sessionId:'chat-1',dimension:'理解' as const,signal:'partial' as const,quote:'条件是哪几个',note:'合成',status:'unverified' as const,at}],
  reportIds:new Set<string>(),supersedes:null,attemptIds:new Set(['att-1','att-2']),evidenceIds:new Set(['ev-1']),turnIds:new Set(['turn-1'])};
 assert.deepEqual(reportProblems(report(),facts),[]);
 const modules=report().modules;
 assert.ok(reportProblems(report({modules:[{...modules[0],level:'needs_work'},...modules.slice(1)]}),facts).some(p=>p.includes('程序依据')),'a model-picked level that disagrees with the basis is refused');
 assert.ok(reportProblems(report({modules:[untested('理解'),...modules.slice(1)]}),facts).some(p=>p.includes('理解')),'理解 must be tested');
 assert.ok(reportProblems(report({modules:[modules[0],modules[1],{...untested('计算'),suggestions:['多练']},...modules.slice(3)]}),facts).length>0,'untested carries no suggestion');
 assert.ok(reportProblems(report({observationChecks:[{observationId:'obs-made-up',dimension:'理解',result:'confirmed'}]}),facts).some(p=>p.includes('观察')),'only real observations are cited');
 assert.ok(reportProblems(report({observationChecks:[{observationId:'obs-1',dimension:'逻辑',result:'not_seen'}]}),facts).length>0,'dimension must match the observation');
 assert.ok(reportProblems(report({modules:[{...modules[0],attemptIds:['att-ghost']},...modules.slice(1)]}),facts).length>0);
 assert.ok(reportProblems(report({version:2}),facts).length>0,'first report of an interview is version 1');
});

test('interview routes over HTTP: gates first (session, schema, safety, existence, state, revision), then the engine',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r,{timeoutMs:2000});const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  assert.equal((await fetch(base+'/api/learning/interview/start',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/learning/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const code=async(res:Response)=>({status:res.status,code:(await res.json()).error?.code});
  assert.equal((await post('interview/start',{operationId:id(),extra:1})).status,400);
  // Safety comes before everything and stores nothing, even for an unknown interview.
  const safe=schemas.InterviewStep.parse(await (await post('interview/answer',{operationId:id(),interviewId:'iv-none',expectedRevision:1,text:'我不想活了'})).json());
  assert.equal(safe.safety,true);assert.equal(safe.interview,null);assert.equal(safe.reportReady,false);
  assert.deepEqual(await code(await post('interview/answer',{operationId:id(),interviewId:'iv-none',expectedRevision:1,text:'x=3'})),{status:404,code:'not_found'});
  for(const path of ['interview/pause','interview/resume','interview/report'])assert.deepEqual(await code(await post(path,{operationId:id(),interviewId:'iv-none'})),{status:404,code:'not_found'},path);
  // Start reuses the phase-1 explicit mode switch: the open support session becomes exploration (same id).
  const support=await (await post('start',{operationId:id(),mode:'support'})).json();
  const started=schemas.InterviewStep.parse(await (await post('interview/start',{operationId:id()})).json());
  assert.equal(started.interview!.learningSessionId,support.id);assert.equal(started.interview!.currentModule,'理解');assert.equal(started.task!.id,started.interview!.pending!.task.taskId);
  const open=r.events.sessions().filter(s=>s.status!=='closed');assert.equal(open.length,1);assert.equal(open[0].mode,'exploration');
  assert.deepEqual(await code(await post('interview/start',{operationId:id()})),{status:409,code:'invalid_state'},'one unfinished interview at a time');
  const iv=started.interview!;
  assert.deepEqual(await code(await post('interview/answer',{operationId:id(),interviewId:iv.id,expectedRevision:iv.revision+1,text:'2x-3'})),{status:409,code:'conflict'},'stale revision');
  assert.deepEqual(await code(await post('interview/report',{operationId:id(),interviewId:iv.id})),{status:409,code:'invalid_state'},'理解 and 逻辑 first');
  const asked=schemas.InterviewStep.parse(await (await post('interview/answer',{operationId:id(),interviewId:iv.id,expectedRevision:iv.revision,text:'2x-3'})).json());
  assert.equal(asked.interview!.pending!.kind,'follow_up');
  const paused=schemas.InterviewSession.parse(await (await post('interview/pause',{operationId:id(),interviewId:iv.id})).json());assert.equal(paused.status,'paused');
  assert.equal((await (await post('interview/pause',{operationId:id(),interviewId:iv.id})).json()).revision,paused.revision,'pausing a paused interview is a no-op');
  assert.deepEqual(await code(await post('interview/answer',{operationId:id(),interviewId:iv.id,expectedRevision:paused.revision,text:'先翻倍'})),{status:409,code:'invalid_state'},'no answers while paused');
  const resumed=schemas.InterviewStep.parse(await (await post('interview/resume',{operationId:id(),interviewId:iv.id})).json());
  assert.equal(resumed.interview!.pending!.kind,'follow_up');assert.equal(resumed.interview!.status,'in_progress');
  assert.equal(r.repository.list('interviewTurns').length,1);assert.equal(r.repository.list('professionalReports').length,0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});

test('professional records ignore the memory switch and are cleared by reset',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);try{
  r.events.consent({operationId:id(),optionalMemory:false});
  r.repository.append('interviews',interview());r.repository.append('interviews',interview({revision:2,status:'paused',pausedAt:at}));r.repository.append('professionalReports',report());
  const view=await d.view();assert.equal(view.optionalMemory,false);
  assert.deepEqual(view.interviews.map(i=>[i.id,i.revision]),[['iv-1',2]],'view lists the latest revision');assert.equal(view.professionalReports.length,1);
  await d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});
  for(const c of ['interviews','interviewTurns','professionalReports','monthStages'] as const)assert.equal(r.repository.list(c).length,0,c);
 }finally{f.dispose();}
});
