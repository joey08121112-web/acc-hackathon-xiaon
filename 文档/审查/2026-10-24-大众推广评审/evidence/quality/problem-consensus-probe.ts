import { createRuntime } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/bootstrap.ts';
import { SqliteRepository } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/storage/repository.ts';
import { installLearning } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/agents/learning.ts';
import { confirmProblem } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/plugins/problems/index.ts';
async function main(){const repo=new SqliteRepository(':memory:');const r=createRuntime({repository:repo});installLearning(r);let calls=0;
const ctx={...r.engineContext(),providerKind:'synthetic',events:r.events,memoryEnabled:()=>false,model:async()=>{calls++;return {content:'{"answer":"平的"}'};}} as any;
try{const result=await confirmProblem({operationId:'consensus-probe',sessionId:'s-probe',draft:{source:'spoken',questionText:'地球是平的还是圆的？',studentWork:null,knowledgePointId:'other',stuckQuote:'这题我不会',stuckPointId:null,catalogTask:null},referenceAnswer:null},ctx);console.log(JSON.stringify({probe:'same-wrong-model-answer-is-verified',modelCalls:calls,answerStatus:result.answerStatus,secretOrigin:repo.list('problemSecrets')[0]?.origin,answer:repo.list('problemSecrets')[0]?.answer}));}finally{repo.close();}}
main();
