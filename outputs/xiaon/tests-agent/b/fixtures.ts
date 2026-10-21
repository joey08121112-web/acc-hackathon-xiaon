/** All answers, dates, learners and provider outputs here are SYNTHETIC. */
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository, TestClock } from '../../server/storage/testing';
import { RubricAssessment } from '../../server/plugins/assessment';
import type { Attempt, ModelProvider } from '../../shared/learning-contracts';
export function fixture(options:ConstructorParameters<typeof RubricAssessment>[0]={}) {
 const clock=new TestClock('2026-10-20T02:00:00.000Z');
 const db=temporaryRepository(clock);
 const engine=new RubricAssessment(options);
 const runtime=createRuntime({repository:db.repository,clock,engines:{assessment:engine}});
 let seq=0;const op=()=>`synthetic-b-${++seq}`;
 let session=runtime.events.startSession({operationId:op(),mode:'support'});
 function open(taskId:string){runtime.events.expose({operationId:op(),sessionId:session.id,taskId,taskVersion:2,kind:'task',hintId:null});}
 function expose(taskId:string,kind:'hint'|'answer'|'chat_help'){
  runtime.events.expose({operationId:op(),sessionId:session.id,taskId,taskVersion:2,kind,hintId:kind==='hint'?'hint-1':null});
 }
 function submit(taskId:string,value:string){return runtime.events.submit({operationId:op(),sessionId:session.id,taskId,taskVersion:2,value});}
 const grade=(a:Attempt)=>engine.grade({attemptId:a.id,operationId:op()},runtime.engineContext());
 const snapshot=()=>engine.snapshot({operationId:op()},runtime.engineContext());
 function nextDay(at='2026-10-21T02:00:00.000Z'){
  runtime.events.sessionState({operationId:op(),sessionId:session.id,status:'closed'});clock.set(at);
  session=runtime.events.startSession({operationId:op(),mode:'support'});
 }
 return { ...db,clock,engine,runtime,op,open,expose,submit,grade,snapshot,nextDay,session:()=>session };
}
export const modelResponse=(points:unknown[]):ModelProvider=>({kind:'synthetic',supportsTools:true,async complete(){return{content:JSON.stringify({points}),toolCalls:[]};}});
