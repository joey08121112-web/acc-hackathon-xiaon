/** H2 UI fixture ONLY: real session/CSRF HTTP + temporary SQLite, scripted interview/report/trend.
 * Replaces coordinator methods in this test process. Does NOT validate Claude/zCode engines,
 * grading, evidence, report gates or a real model. Task exposures are synthetic seeds for the real hint route. No .env.server or ordinary database is read. */
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { RuntimeError } from '../../server/core/errors';
import { SAFETY_PATTERN, REST_PATTERN } from '../../server/agents/stages';
import { INTERVIEW_MODULE_ORDER, schemas, type InterviewSession, type InterviewStep, type ProfessionalReport, type TrendQuery, type InterviewModule } from '../../shared/learning-contracts';
import { professionalMonth } from '../../src/components/professional/archive';
const api=Number(process.env.XIAON_H2_API_PORT??18952),ui=Number(process.env.XIAON_H2_UI_PORT??5212);
const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r),at='2026-10-21T00:00:00.000Z';
const find=(id:string)=>{const iv=r.repository.get('interviews',id);if(!iv)throw new RuntimeError('not_found');return iv;};
const save=(iv:InterviewSession)=>{r.repository.append('interviews',schemas.InterviewSession.parse(iv));return iv;};
async function pending(module:InterviewModule,kind:'question'|'follow_up'='question'){
 const task=(await d.view()).tasks.find(t=>t.primaryDimension===module)!;
 return {module,task:{taskId:task.id,taskVersion:task.version},kind,prompt:kind==='follow_up'?'你是怎么想的？慢慢说说理由。':'一起看看这个小问题：'+task.title,mode:'local_rules' as const,askedAt:new Date(Date.parse(at)+r.repository.revision()*1000).toISOString()};
}
async function step(iv:InterviewSession,text=iv.pending?.prompt??'今天先到这里，休息一下。'):Promise<InterviewStep>{
 const task=iv.pending?r.catalog.publicTask(iv.pending.task.taskId,iv.pending.task.taskVersion)??null:null;
 // Scripted task-open fact, not an acceptance of production interview exposure/selection rules.
 if(task&&iv.pending?.kind!=='follow_up'&&!r.repository.list('exposures').some(e=>e.sessionId===iv.learningSessionId&&e.taskId===task.id&&e.kind==='task'))r.repository.append('exposures',schemas.ExposureEvent.parse({schemaVersion:'1.0.0',id:'fixture-exposure-'+iv.id+'-'+task.id,operationId:iv.operationId,sessionId:iv.learningSessionId,taskId:task.id,taskVersion:task.version,kind:'task',hintId:null,contentSnapshot:null,sourceTime:{occurredAt:f.clock.now(),recordedAt:f.clock.now(),timezone:'Asia/Shanghai',trust:'server',legacyLabel:null}}));
 return schemas.InterviewStep.parse({text,safety:false,interview:iv,task,turn:null,reportReady:['理解','逻辑'].every(m=>iv.completedModules.includes(m as InterviewModule)),run:null});
}
function report(iv:InterviewSession,operationId:string,createdAt=at):ProfessionalReport{
 const existing=r.repository.list('professionalReports'),same=existing.filter(x=>x.interviewId===iv.id).at(-1),prev=existing.filter(x=>x.interviewId!==iv.id).at(-1);
 return schemas.ProfessionalReport.parse({schemaVersion:'1.0.0',id:'report-'+operationId,operationId,evidenceRevision:r.repository.revision(),interviewId:iv.id,version:(same?.version??0)+1,supersedesReportId:same?.id??null,comparedWithReportId:prev?.id??null,modules:INTERVIEW_MODULE_ORDER.map((module,i)=>{const done=iv.completedModules.includes(module),turns=r.repository.list('interviewTurns').filter(t=>t.interviewId===iv.id&&t.module===module);return{module,level:done?(i===0?'good':'partial'):'not_tested',basis:done?(i===0?'correct_with_reason':'correct_reason_incomplete'):'not_tested',evidenceIds:[],attemptIds:[],turnIds:turns.map(t=>t.id),quotes:done?turns.map(t=>t.answer).slice(0,5):[],wording:null,suggestions:done&&i>0?['先圈出条件，再说说为什么。']:[],scope:'this_interview'};}),observationChecks:[{observationId:'obs-fixture',dimension:'理解',result:'confirmed'}],changes:prev?[{module:'理解',from:'partial',to:'good',note:'这次说清了单位。'}]:[],mode:'local_rules',createdAt});
}
d.interviewStart=async raw=>{
 const p=schemas.InterviewStart.parse(raw);
 if((await d.view()).interviews.some(i=>i.status!=='completed'))throw new RuntimeError('conflict');
 const session=await d.start({operationId:p.operationId+'-session',mode:'exploration',switchMode:true});
 const iv=save({schemaVersion:'1.0.0',id:'iv-'+p.operationId,operationId:p.operationId,revision:1,learningSessionId:session.id,moduleOrder:[...INTERVIEW_MODULE_ORDER],currentModule:'理解',completedModules:[],status:'in_progress',pending:await pending('理解'),startedAt:at,pausedAt:null,completedAt:null,updatedAt:at});
 return step(iv);
};
d.interviewPause=async raw=>{const p=schemas.InterviewPause.parse(raw),iv=find(p.interviewId);return save({...iv,operationId:p.operationId,revision:iv.revision+1,status:'paused',pausedAt:at});};
d.interviewResume=async raw=>{const p=schemas.InterviewResume.parse(raw),iv=find(p.interviewId);return step(save({...iv,operationId:p.operationId,revision:iv.revision+1,status:'in_progress',pausedAt:null}));};
d.interviewAnswer=async raw=>{
 const p=schemas.InterviewAnswer.parse(raw);
 if(SAFETY_PATTERN.test(p.text))return schemas.InterviewStep.parse({text:'先暂停学习。请找身边信任的大人陪你，也可以打开求助与安全支持。',safety:true,interview:null,task:null,turn:null,reportReady:false,run:null});
 const iv=find(p.interviewId);
 if(p.expectedRevision!==iv.revision||iv.status!=='in_progress')throw new RuntimeError('conflict');
 if(REST_PATTERN.test(p.text))return step(await d.interviewPause({operationId:p.operationId,interviewId:iv.id}));
 const q=iv.pending!,seq=r.repository.list('interviewTurns').filter(t=>t.interviewId===iv.id).length+1;
 r.repository.append('interviewTurns',schemas.InterviewTurn.parse({schemaVersion:'1.0.0',id:'turn-'+p.operationId,operationId:p.operationId,interviewId:iv.id,seq,...q,answer:p.text,attemptId:null,answeredAt:at}));
 const completedModules=q.kind==='follow_up'?[...iv.completedModules,q.module]:iv.completedModules;
 const nextModule=INTERVIEW_MODULE_ORDER[completedModules.length]??null;
 const next=save({...iv,operationId:p.operationId,revision:iv.revision+1,completedModules,currentModule:nextModule,status:nextModule?'in_progress':'completed',pending:nextModule?await pending(nextModule,q.kind==='question'?'follow_up':'question'):null,completedAt:nextModule?null:at});
 return step(next,nextModule?undefined:'五站都走过啦，来看看这次的观察。');
};
const scriptedAnswer=d.interviewAnswer;
d.interviewAnswer=async(...args)=>{try{return await scriptedAnswer(...args);}catch(error){console.error('H2 fixture answer failure',error);throw error;}};
d.interviewReport=async raw=>{const p=schemas.InterviewReportRequest.parse(raw),iv=find(p.interviewId);if(!['理解','逻辑'].every(m=>iv.completedModules.includes(m as InterviewModule)))throw new RuntimeError('conflict');const out=report(iv,p.operationId);r.repository.append('professionalReports',out);return out;};
d.trend=async()=>{
 const history=r.repository.list('professionalReports').flatMap(report=>report.modules.map(m=>({month:professionalMonth(report.createdAt),module:m.module,level:m.level,sourceReportId:report.id,reportCreatedAt:report.createdAt})));
 const latest=INTERVIEW_MODULE_ORDER.flatMap(m=>history.filter(p=>p.module===m).slice(-1));
 return schemas.TrendQuery.parse({history,latest}) satisfies TrendQuery;
};
async function reset(){
 r.repository.reset!();
 const old=save({schemaVersion:'1.0.0',id:'iv-sept',operationId:'op-sept',revision:1,learningSessionId:'session-sept',moduleOrder:[...INTERVIEW_MODULE_ORDER],currentModule:null,completedModules:[...INTERVIEW_MODULE_ORDER],status:'completed',pending:null,startedAt:'2026-09-30T15:50:00.000Z',pausedAt:null,completedAt:'2026-09-30T15:55:00.000Z',updatedAt:'2026-09-30T15:55:00.000Z'});
 const previous=report(old,'previous','2026-09-30T15:55:00.000Z');previous.modules[0]={...previous.modules[0],level:'partial',basis:'correct_reason_incomplete'};previous.observationChecks=[];r.repository.append('professionalReports',previous);
 r.repository.append('observations',schemas.ChatObservation.parse({schemaVersion:'1.0.0',id:'obs-fixture',sessionId:'chat-fixture',dimension:'理解',signal:'partial',quote:'每本是一本的价格',note:'核对单位',status:'unverified',at}));
 r.repository.append('summaries',schemas.ConversationSummary.parse({schemaVersion:'1.0.0',id:'summary-fixture',operationId:'end-fixture',sessionId:'chat-fixture',trigger:'student_end',topics:['应用题的条件'],observationIds:['obs-fixture'],comparedWithSummaryId:null,changes:[],planSuggestions:['先圈出单位'],suggestProfessionalMode:true,progressCardId:null,mode:'local_rules',createdAt:'2026-09-30T16:05:00.000Z'}));
 r.repository.append('progressCards',schemas.ProgressCard.parse({schemaVersion:'1.0.0',id:'card-fixture',operationId:'card-op-fixture',sessionId:'chat-fixture',episodeId:null,aiDraft:null,breakthrough:'找到了条件',method:'圈出单位',nextTry:null,skipped:['nextTry'],confidence:null,confirmedAt:at}));
}
await reset();
const server=createHttpServer(r,{host:`127.0.0.1:${api}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.url==='/__h2/reset'&&req.method==='POST'&&req.headers['x-xiaon-test']==='synthetic-h2-only'){await reset();res.end('{}');return;}
 listener.call(server,req,res);
});
server.listen(api,'127.0.0.1',()=>console.log('H2 scripted coordinator fixture; temporary SQLite; NOT production interview/tracking'));
process.once('SIGTERM',()=>{server.close(()=>{f.dispose();process.exit(0);});server.closeAllConnections();});
