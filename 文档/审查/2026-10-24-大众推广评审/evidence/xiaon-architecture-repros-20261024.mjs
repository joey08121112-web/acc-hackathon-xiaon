// Read-only product audit. Only temporary synthetic SQLite databases; no real model or environment keys.
const root='/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon';
const {createRuntime}=await import(root+'/server/bootstrap.ts');
const {installLearning}=await import(root+'/server/agents/learning.ts');
const {temporaryRepository,TestClock}=await import(root+'/server/storage/testing.ts');
const {matchesAnswer}=await import(root+'/server/agents/stages.ts');
const {draftProgressCard}=await import(root+'/server/plugins/progress/index.ts');
const id=()=>crypto.randomUUID();
{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);
 try {
  const text='我不知道是不是 x+5，也可能是 x-5',accepted=matchesAnswer(text,['x+5']);
  const e={schemaVersion:'1.0.0',id:'episode-audit',revision:1,sessionId:'chat-audit',problemId:null,task:null,stage:'reflect',helpLevelsUsed:[],studentSolvedAt:accepted?f.clock.now():null,endReason:accepted?'solved':null,status:'reflecting',startedAt:f.clock.now(),updatedAt:f.clock.now()};r.repository.append('episodes',e);
  const card=await draftProgressCard({sessionId:e.sessionId,episode:e,studentTexts:[text],candidate:null},{...r.engineContext(),events:r.events,providerKind:'offline',memoryEnabled:()=>false,model:async()=>{throw Error('forbidden real model');}});
  console.log(JSON.stringify({case:'R1_ambiguous_answer_substring',input:text,accepted,programCard:card.draft.breakthrough}));
 }finally{f.dispose();}
}
{
 const f=temporaryRepository(),r=createRuntime({...f,provider:{kind:'synthetic',supportsTools:true,async complete(){return {content:JSON.stringify({answer:'x+5'}),toolCalls:[]};}}}),d=installLearning(r);
 try {const p=await d.confirmProblem({operationId:id(),sessionId:null,draft:{source:'spoken',questionText:'求圆周率的第十位小数',studentWork:null,knowledgePointId:'other',stuckQuote:'我不知道怎么算',stuckPointId:null,catalogTask:null},referenceAnswer:null});console.log(JSON.stringify({case:'R2_model_agreement_unparsed_question',answerStatus:p.answerStatus,secrets:r.repository.list('problemSecrets').map(s=>({answer:s.answer,origin:s.origin}))}));}finally{f.dispose();}
}
{
 const clock=new TestClock('2026-10-22T01:00:00.000Z'),f=temporaryRepository(clock),r=createRuntime(f),d=installLearning(r);
 try {const s=await d.start({operationId:id(),mode:'support'});await d.open({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2});await d.submit({operationId:id(),sessionId:s.id,taskId:'b-like-observation',taskVersion:2,value:'5x-4',reviewItemId:null,reviewRevision:null});let v=await d.loopEvent({operationId:id(),action:'start',quote:'括号负号不明白'});v=await d.loopEvent({operationId:id(),action:'confirm',episodeId:v.episode.id,expectedRevision:v.episode.revision});clock.advance(86400000);const next=await d.start({operationId:id(),mode:'support'});try{await d.loopEvent({operationId:id(),action:'help',episodeId:v.episode.id,expectedRevision:v.episode.revision});console.log(JSON.stringify({case:'R3_cross_day_loop_help',unexpectedSuccess:true}));}catch(e){console.log(JSON.stringify({case:'R3_cross_day_loop_help',newSessionCreated:next.id!==s.id,error:e.code,message:e.message}));}}finally{f.dispose();}
}
