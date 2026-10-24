import type { ModelProvider } from '../../shared/learning-contracts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { decideStage,initialStageState } from '../../server/agents/stages';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { draftProgressCard } from '../../server/plugins/progress';
const id=()=>crypto.randomUUID();
const event=(text:string,solved=false)=>({sessionId:'chat-test',text,intent:null,hasProblem:true,hasActiveTask:true,solved,progressCardDone:false,memoryEnabled:false});
test('A01/A02 partial, negated, quoted or reported understanding stays in think',()=>{
 const s={...initialStageState('chat-test'),stage:'think' as const,listenTurns:2,thinkTurns:3};
 for(const text of ['公式我明白了，但这道题还是不会做','我还没懂了什么','我没有明白了','他说“懂了”，我还是不会','老师说懂了就好','“懂了”是什么意思','懂了？我还需要提示'])assert.equal(decideStage(s,event(text)).stage,'think',text);
 assert.equal(decideStage(s,event('哦我懂了')).stage,'reflect');
 assert.equal(decideStage(s,event('x+5',true)).stage,'reflect');
});
test('B01 production interview report: no reason rubric never upgrades unrelated or unverified prose',async()=>{
 for(const reason of ['今天阳光真好','先把x项合起来，再写常数','我不确定为什么']){
 const f=temporaryRepository(new TestClock('2026-10-22T01:00:00.000Z')),r=createRuntime(f),d=installLearning(r);
 try{
 let step=await d.interviewStart({operationId:id()});
 for(const result of ['B','A','B']){
 step=await d.interviewAnswer({operationId:id(),interviewId:step.interview!.id,expectedRevision:step.interview!.revision,text:result});
 step=await d.interviewAnswer({operationId:id(),interviewId:step.interview!.id,expectedRevision:step.interview!.revision,text:reason});
 }
 const report=await d.interviewReport({operationId:id(),interviewId:step.interview!.id});
 assert.equal(report.modules.find(m=>m.module==='计算')!.basis,'correct_reason_incomplete',reason);
 }finally{f.dispose();}}
});
test('A03/E01 unverified budget ending and unsupported AI facts fall back to saved process',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);
 try{
 const e={schemaVersion:'1.0.0' as const,id:'episode-budget',revision:1,sessionId:'chat-test',problemId:null,task:null,stage:'reflect' as const,helpLevelsUsed:[],studentSolvedAt:null,endReason:'turn_limit' as const,status:'reflecting' as const,startedAt:f.clock.now(),updatedAt:f.clock.now()};r.repository.append('episodes',e);
 const ctx={...r.engineContext(),events:r.events,providerKind:'offline' as const,memoryEnabled:()=>false,model:async()=>{throw Error('offline');}};
 const {draft}=await draftProgressCard({sessionId:e.sessionId,episode:e,studentTexts:['还是不会'],candidate:{episodeId:e.id,breakthrough:'已经掌握负号规律',method:'一次就独立完成了所有题',nextTry:null}},ctx);
 assert.doesNotMatch(draft.breakthrough??'',/掌握|想通|从头想/);assert.doesNotMatch(draft.method??'',/独立完成/);
 }finally{f.dispose();}
});

test('C01/C02/D02 real loop saves first error, help, correction and a first independent unseen check',async()=>{
 const f=temporaryRepository(new TestClock('2026-10-22T01:00:00.000Z')),r=createRuntime(f),d=installLearning(r);
 try{
 const s=await d.start({operationId:id(),mode:'support'});
 await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});
 await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});
 let v=await d.loopEvent({operationId:id(),action:'start',quote:'我总是漏掉第二项的负号'});
 const act=async(action:string,extra:Record<string,unknown>={})=>{v=await d.loopEvent({operationId:id(),action,episodeId:v.episode.id,expectedRevision:r.repository.get('episodes',v.episode.id)!.revision,...extra} as never);return v;};
 assert.equal(v.episode.loop!.hypotheses.at(-1)!.status,'proposed');
 await act('correct',{text:'其实我是不知道负号管着哪几项'});
 assert.equal(v.episode.loop!.hypotheses.at(-1)!.source,'student');
 await act('submit',{value:'x-5'});await act('help');
 assert.equal(v.episode.loop!.help.length,1);
 const answer=r.catalog.definition(v.task!.id,v.task!.version)!.answer[0];await act('submit',{value:answer});
 assert.match(v.summary,/提示后/);
 const request={operationId:id(),action:'verify' as const,episodeId:v.episode.id,expectedRevision:v.episode.revision};
 v=await d.loopEvent(request);const n=r.repository.list('exposures').length;
 assert.deepEqual(await d.loopEvent(request),v);assert.equal(r.repository.list('exposures').length,n);
 assert.notEqual(v.task!.id,'bracket');
 await act('submit',{value:r.catalog.definition(v.task!.id,v.task!.version)!.answer[0]});
 assert.match(v.summary,/本次同类新题首次无提示完成/);
 assert.equal(r.repository.list('attempts').filter(a=>a.taskId==='bracket')[0].value,'x-5');
 assert.equal(r.repository.list('progressCards').length,0);
 }finally{f.dispose();}
});

test('A01 coordinator revises neither completion nor end reason for mixed understanding',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);const history:{role:'user';content:string}[]=[];
 try{
 const s=await d.start({operationId:id(),mode:'support'});await d.open({operationId:id(),sessionId:s.id,taskId:'model',taskVersion:2});
 let reply;for(const text of ['考砸了','好多了','这道题不会','一起看','公式我明白了，但这道题还是不会做']){history.push({role:'user',content:text});reply=await d.chat({operationId:id(),flow:'home',history,...(text==='一起看'?{intent:'start_together' as const}:{})});}
 assert.equal(reply!.stage,'think');const e=r.repository.list('episodes').at(-1)!;assert.equal(e.studentSolvedAt,null);assert.equal(e.endReason,null);
 }finally{f.dispose();}
});

async function loopFixture(provider?:ModelProvider){
 const f=temporaryRepository(new TestClock('2026-10-22T01:00:00.000Z')),r=createRuntime({...f,...(provider?{provider}:{})}),d=installLearning(r);
 const s=await d.start({operationId:id(),mode:'support'});
 await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});
 await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});
 let v=await d.loopEvent({operationId:id(),action:'start',quote:'我总漏改括号里第二项的符号'});
 const act=async(action:string,extra:Record<string,unknown>={})=>{v=await d.loopEvent({operationId:id(),action,episodeId:v.episode.id,expectedRevision:r.repository.get('episodes',v.episode.id)!.revision,...extra} as never);return v;};
 await act('confirm');
 return {...f,r,d,s,act,current:()=>v,right:()=>r.catalog.definition(v.task!.id,v.task!.version)!.answer[0]};
}
test('C03 verification help or wrong first answer cannot become first independent on correction',async()=>{
 for(const mode of ['help','wrong']){const f=await loopFixture();try{
 await f.act('submit',{value:f.right()});await f.act('verify');
 if(mode==='help')await f.act('help');else await f.act('submit',{value:'0'});
 const v=await f.act('submit',{value:f.right()});assert.equal(v.independent,false);assert.match(v.summary,/不算首次独立/);
 assert.equal(v.episode.loop!.verification.status,'completed');
 await f.act('end');await f.act('help');assert.equal(f.current().episode.stage,'think','not trapped in reflect');
 }finally{f.dispose();}}
});
test('A04 help uses the corrected hypothesis; three levels then alternative representation; budget allows ending',async()=>{
 const f=await loopFixture();try{
 await f.act('correct',{text:'我不明白负号作用到哪些项'});
 for(let i=0;i<4;i++)await f.act('help');
 const v=f.current();assert.deepEqual(v.help.map(h=>h.level),[1,2,3,3]);assert.equal(v.help[3].representation,'sign_table');assert.ok(v.help.every(h=>h.text.includes('我不明白负号作用到哪些项')));
 for(const h of v.help)assert.equal(f.r.repository.get('exposures',h.exposureId)!.kind,'chat_help');
 for(let i=4;i<11;i++)await f.act('help');assert.equal(f.current().episode.endReason,'turn_limit');assert.equal(f.current().episode.loop!.ending,'budget');
 assert.doesNotMatch(f.current().summary,/掌握|想通/);await f.act('continue');assert.equal(f.current().episode.stage,'think');
 }finally{f.dispose();}
});
test('C04 original, seen and alias fingerprints are rejected; exhausted catalog produces no pretend unseen task',async()=>{
 const { unseenTask }=await import('../../server/plugins/learning-loop');const f=await loopFixture();try{
 const original=f.r.catalog.definition('bracket',2)!;
 assert.equal(unseenTask(f.r,original),false);
 assert.equal(unseenTask(f.r,{...original,id:'alias',question:'化简：3a - (2a - 5)。'}),false);
 const engine=f.r.assessment(),catalog=engine.catalog;
 const only=catalog.candidates.bind(catalog);
 catalog.candidates=input=>only(input).filter(t=>t.id==='bracket');
 const n=f.r.repository.list('exposures').length;const v=await f.act('verify');assert.equal(v.episode.loop!.verification.status,'unavailable');assert.equal(f.r.repository.list('exposures').length,n);assert.match(v.summary,/暂时没有合适的新题/);
 await f.act('end');assert.equal(f.current().episode.stage,'reflect');
 }finally{f.dispose();}
});
test('D01/D02 SQLite restart retains task, draft, attempts and receipts; conflicting operation/revision rejected',async()=>{
 const {SqliteRepository}=await import('../../server/storage/repository');const f=await loopFixture();let reopened:InstanceType<typeof SqliteRepository>|undefined;
 try{
 await f.act('draft',{value:'3x-2x+'});await f.act('submit',{value:'x-5'});await f.act('help');await f.act('draft',{value:'x+'});
 reopened=new SqliteRepository(f.databasePath);const r=createRuntime({repository:reopened,clock:f.clock}),d=installLearning(r);const restored=(await d.view()).learningLoops[0];
 assert.equal(restored.draft,'x+');assert.equal(restored.attempts[0].value,'x-5');assert.equal(restored.help.length,1);
 const p={operationId:id(),action:'submit' as const,episodeId:restored.episode.id,expectedRevision:restored.episode.revision,value:'x+5'};
 const result=await d.loopEvent(p);const n=r.repository.list('attempts').length;
 assert.deepEqual(await d.loopEvent(p),result);assert.equal(r.repository.list('attempts').length,n);
 await assert.rejects(d.loopEvent({...p,value:'x-5'}),{code:'conflict'});
 await assert.rejects(d.loopEvent({...p,operationId:id()}),{code:'conflict'});
 }finally{reopened?.close();f.dispose();}
});
test('D03 additive optional loop reads old episode/report without inventing or rewriting evidence',async()=>{
 const {schemas}=await import('../../shared/learning-contracts');const {SqliteRepository,hash}=await import('../../server/storage/repository');const f=temporaryRepository();let reopened:InstanceType<typeof SqliteRepository>|undefined;
 try{
 const e={schemaVersion:'1.0.0' as const,id:'old-episode',revision:1,sessionId:'old-chat',problemId:null,task:null,stage:'reflect' as const,helpLevelsUsed:[],studentSolvedAt:null,endReason:'understood' as const,status:'reflecting' as const,startedAt:f.clock.now(),updatedAt:f.clock.now()};f.repository.append('episodes',e);
 const report=schemas.ProfessionalReport.parse({schemaVersion:'1.0.0',id:'old-report',operationId:'old-report-op',evidenceRevision:0,interviewId:'old-interview',version:1,supersedesReportId:null,comparedWithReportId:null,modules:['理解','逻辑','计算','建模','空间想象'].map(module=>({module,level:'not_tested',basis:'not_tested',evidenceIds:[],attemptIds:[],turnIds:[],quotes:[],wording:null,suggestions:[],scope:'this_interview'})),observationChecks:[],changes:[],mode:'local_rules',createdAt:f.clock.now()});f.repository.append('professionalReports',report);
 const before=hash({e:f.repository.list('episodes'),report:f.repository.list('professionalReports')});
 reopened=new SqliteRepository(f.databasePath);const r=createRuntime({repository:reopened,clock:f.clock}),d=installLearning(r);const v=await d.view();
 assert.equal(v.learningLoops.length,0);assert.equal(schemas.LearningEpisode.parse(v.episodes[0]).loop,undefined);
 assert.equal(hash({e:reopened.list('episodes'),report:reopened.list('professionalReports')}),before);
 }finally{reopened?.close();f.dispose();}
});
test('E01/E02 skip verification/card/confidence, optional memory off and student edits never change scoring',async()=>{
 const f=await loopFixture();try{
 await f.act('submit',{value:'x-5'});await f.act('skip');const draft=await f.act('draft_card');
 assert.match(draft.summary,/尚未用新题核实/);assert.equal(f.r.events.memoryEnabled(),false);
 const before=f.r.repository.evidenceRevision();const p={operationId:id(),episodeId:draft.episode.id,sessionId:draft.episode.sessionId,aiDraft:null,breakthrough:'我觉得自己完全学会了',method:null,nextTry:null,confidence:null};
 await f.d.confirmProgressCard(p);assert.equal(f.r.repository.evidenceRevision(),before);assert.equal(f.r.repository.list('progressCards')[0].confidence,null);assert.equal(f.r.repository.list('memories').length,0);
 assert.equal(f.r.repository.get('episodes',draft.episode.id)!.status,'closed');
 }finally{f.dispose();}
});
test('E03 safety stores nothing, pause rejects new tasks/help, resumed fragment uses same task',async()=>{
 const f=await loopFixture();try{
 const e=f.current().episode,n=f.r.repository.revision();
 await assert.rejects(f.act('submit',{value:'我不想活了'}),{code:'forbidden'});assert.equal(f.r.repository.revision(),n);
 await f.d.preference({operationId:id(),rest:true,questionInvitePaused:true});
 await assert.rejects(f.act('verify'),{code:'invalid_state'});await assert.rejects(f.act('help'),{code:'invalid_state'});
 await f.d.start({operationId:id(),mode:'support'});await f.act('continue');assert.equal(f.current().task!.id,e.loop!.practice.taskId);
 }finally{f.dispose();}
});
test('HTTP loop uses authentication, CSRF, strict schema, revision and operation receipts',async()=>{
 const {createHttpServer}=await import('../../server/http/server');const {freePort}=await import('../../server/storage/testing');const f=await loopFixture();const port=await freePort(),base=`http://127.0.0.1:${port}`,origin='http://127.0.0.1:5318';
 const server=createHttpServer(f.r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
 const req={operationId:id(),action:'help',episodeId:f.current().episode.id,expectedRevision:f.current().episode.revision};
 const unauth=await fetch(base+'/api/learning/loop',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(req)});assert.equal(unauth.status,403);
 const auth=await fetch(base+'/api/local-session',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});const csrf=(await auth.json()).csrfToken,cookie=auth.headers.get('set-cookie')!.split(';')[0];
 const post=(body:unknown,token=csrf)=>fetch(base+'/api/learning/loop',{method:'POST',headers:{origin,cookie,'x-xiaon-csrf':token,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post(req,'wrong')).status,403);assert.equal((await post({...req,mastered:true})).status,400);
 const response=await post(req);assert.equal(response.status,200);const data=await response.json();const n=f.r.repository.list('exposures').length;
 assert.deepEqual(await(await post(req)).json(),data);assert.equal(f.r.repository.list('exposures').length,n);
 assert.equal((await post({...req,operationId:id()})).status,409);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});

test('F01 existing planner with TestClock creates confirmed review, next-day due is distinct from same-day new task',async()=>{
 const f=await loopFixture();try{
 await f.act('submit',{value:'x-5'});await f.act('help');await f.act('submit',{value:f.right()});await f.act('verify');await f.act('submit',{value:f.right()});
 const beforePlans=f.r.repository.list('plans').length;
 const generated=await f.d.generate({operationId:id(),timeBudgetMinutes:6,knowledgePointId:'negative-brackets'} as never);
 assert.equal(f.r.repository.list('plans').length,beforePlans,'proposal is not an accepted plan');
 const plan=await f.d.confirm({operationId:id(),proposalId:generated.proposal.id,expectedPreviousVersionId:null,action:'accept',scheduledDate:null,reason:'合成学生选择隔天复习'});
 assert.ok(plan.id);const items=f.r.repository.list('reviewItems');assert.ok(items.some(i=>i.knowledgePointId==='negative-brackets'));
 const target=items.filter(i=>i.knowledgePointId==='negative-brackets').at(-1)!;
 assert.ok(Date.parse(target.dueAt)>Date.parse(f.clock.now()));
 assert.equal((await f.r.planning().due({at:f.clock.now(),includePaused:false},f.r.engineContext())).some(i=>i.id===target.id),false);
 (f.clock as TestClock).set(target.dueAt);assert.equal((await f.d.view()).reviews.some(i=>i.id===target.id),true);
 assert.match(f.current().summary,/隔天表现还要观察/);assert.equal(f.r.repository.list('reviewOutcomes').length,0,'time alone never fabricates a cross-day result');
 }finally{f.dispose();}
});

test('D02 leaving during submission retains raw attempt and the original operation can finish after restart',async()=>{
 const {SqliteRepository}=await import('../../server/storage/repository');const f=await loopFixture();let reopened:InstanceType<typeof SqliteRepository>|undefined;
 try{
 const v=f.current(),p={operationId:id(),action:'submit' as const,episodeId:v.episode.id,expectedRevision:v.episode.revision,value:'x+5'};
 const controller=new AbortController();const pending=f.d.loopEvent(p,controller.signal);controller.abort();await assert.rejects(pending);
 const attempts=f.r.repository.list('attempts').filter(a=>a.operationId===p.operationId+'-attempt');assert.equal(attempts.length,1);
 reopened=new SqliteRepository(f.databasePath);const r=createRuntime({repository:reopened,clock:f.clock}),d=installLearning(r);
 const restored=await d.loopEvent(p);assert.equal(restored.currentGrade?.verdict,'correct');assert.equal(r.repository.list('attempts').filter(a=>a.operationId===p.operationId+'-attempt').length,1);
 assert.deepEqual(await d.loopEvent(p),restored);
 }finally{reopened?.close();f.dispose();}
});

test('E03 natural refusal and farewell leave the exercise; pure chat is usable even after pausing',async()=>{
 for(const text of ['不学了，今天只聊聊天','再见']){const f=await loopFixture();try{
 await f.d.preference({operationId:id(),rest:true,questionInvitePaused:true});
 const reply=await f.d.chat({operationId:id(),flow:'home',history:[{role:'user',content:text}]});
 assert.equal(reply.stage,'companion');assert.equal(f.r.repository.get('episodes',f.current().episode.id)!.status,'closed');
 const next=await f.d.chat({operationId:id(),flow:'home',history:[{role:'user',content:text},{role:'assistant',content:reply.text},{role:'user',content:'说说今天的篮球'}]});assert.ok(next.text);
 }finally{f.dispose();}}
});

test('C03 a model reply during verification is conservatively recorded as help before the next attempt',async()=>{
 const provider:ModelProvider={kind:'synthetic',supportsTools:true,async complete(){return {content:JSON.stringify({message:'括号前的负号要作用到每一项，你想先检查哪一项？',taskIds:[]}),toolCalls:[]};}};
 const f=await loopFixture(provider);try{
 await f.act('submit',{value:f.right()});await f.act('verify');
 const before=f.r.repository.list('exposures').length;
 const reply=await f.d.chat({operationId:id(),flow:'home',history:[{role:'user',content:'我再想想'}]});assert.equal(reply.run?.status,'completed');
 assert.ok(f.r.repository.list('exposures').length>before,'model chat content must not be invisible to evidence classification');
 const v=await f.act('submit',{value:f.right()});assert.equal(v.independent,false);
 }finally{f.dispose();}
});

test('A04 proposed hypothesis cannot reveal a whitespace-normalized reference answer',async()=>{
 const provider:ModelProvider={kind:'synthetic',supportsTools:true,async complete(){return {content:JSON.stringify({hypothesis:'你是不是不知道怎样算到 x + 5 呢？'}),toolCalls:[]};}};
 const f=await loopFixture(provider);try{assert.equal(f.current().episode.loop!.hypotheses[0].source,'program');assert.doesNotMatch(f.current().episode.loop!.hypotheses[0].text,/x\s*\+\s*5/);}finally{f.dispose();}
});
