/** 所有者：Claude。契约冒烟（Claude 路：进步卡、对话观察与小结）。第一期起路由已实现，本文件只保留门禁与 schema 检查。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { temporaryRepository } from '../../server/storage/testing';
import { schemas,SCHEMA_VERSION } from '../../shared/learning-contracts';
const port=Number(process.env.XIAON_G_HTTP_PORT??18971),origin='http://127.0.0.1:5211',base=`http://127.0.0.1:${port}`,id=()=>crypto.randomUUID();
const at='2026-10-21T08:00:00.000Z';

test('G0 Claude-lane schemas parse synthetic records and reject extra or out-of-scope fields',()=>{
 const card={schemaVersion:SCHEMA_VERSION,id:'card-1',operationId:'op-card-1',sessionId:'chat-1',episodeId:null,aiDraft:{episodeId:null,breakthrough:'先把括号前的负号看清楚',method:null,nextTry:null},breakthrough:'我看清了负号',method:null,nextTry:null,skipped:['method','nextTry'],confidence:'more_sure',confirmedAt:at};
 assert.ok(schemas.ProgressCard.safeParse(card).success);assert.equal(schemas.ProgressCard.safeParse({...card,score:90}).success,false);
 const obs={schemaVersion:SCHEMA_VERSION,id:'obs-1',sessionId:'chat-1',dimension:'理解',signal:'partial',quote:'负号管后面所有的项吗',note:'合成观察',sceneId:null,status:'unverified',at};
 assert.ok(schemas.ChatObservation.safeParse(obs).success);
 assert.equal(schemas.ChatObservation.safeParse({...obs,dimension:'计算'}).success,false,'only 理解/逻辑 are observed in chat');
 assert.equal(schemas.ChatObservation.safeParse({...obs,status:'verified'}).success,false);
 const summary={schemaVersion:SCHEMA_VERSION,id:'sum-1',operationId:'op-sum-1',sessionId:'chat-1',trigger:'student_end',topics:['数学单元测，去括号'],observationIds:['obs-1'],comparedWithSummaryId:null,changes:[],planSuggestions:['明天做一道去括号小题'],suggestProfessionalMode:true,progressCardId:null,mode:'local_rules',createdAt:at};
 assert.ok(schemas.ConversationSummary.safeParse(summary).success);
 assert.equal(schemas.ConversationSummary.safeParse({...summary,planSuggestions:[]}).success,false,'1–3 plan suggestions');
 assert.equal(schemas.ConversationSummary.safeParse({...summary,mood:'焦虑'}).success,false,'no emotion labels');
 const episode={schemaVersion:SCHEMA_VERSION,id:'ep-1',revision:1,sessionId:'chat-1',problemId:null,task:{taskId:'bracket',taskVersion:2},stage:'think',helpLevelsUsed:[1],studentSolvedAt:null,endReason:null,status:'active',startedAt:at,updatedAt:at};
 assert.ok(schemas.LearningEpisode.safeParse(episode).success);
 assert.ok(schemas.EndConversation.safeParse({operationId:'op-end',sessionId:'chat-1',history:[]}).success);
});

test('Claude-lane routes sit behind the same session and CSRF gate and validate before acting',async()=>{
 const f=temporaryRepository(),r=createRuntime(f);installLearning(r);const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[origin]});await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
 try{
  assert.equal((await fetch(base+'/api/learning/conversation/end',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);
  const login=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});const token=(await login.json()).csrfToken,cookie=login.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Xiaon-CSRF':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  // Phase 1: both routes are implemented; an unknown chat session is not found, unknown keys are rejected first.
  for(const [path,body] of [
   ['learning/progress-card/confirm',{operationId:id(),sessionId:'chat-1',episodeId:null,aiDraft:null,breakthrough:'我自己想到了',method:null,nextTry:null,confidence:null}],
   ['learning/conversation/end',{operationId:id(),sessionId:'chat-1',history:[{role:'user',content:'今天先聊到这'}]}],
  ] as const){
   const res=await post(path,body);assert.equal(res.status,404,path);assert.equal((await res.json()).error.code,'not_found');
   assert.equal((await post(path,{...body,extra:true})).status,400,path+' rejects unknown keys');
  }
  assert.equal(r.repository.list('progressCards').length+r.repository.list('summaries').length,0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.dispose();}
});

test('problemSecrets never reaches view(); reset clears every G0 collection',async()=>{
 const f=temporaryRepository(),r=createRuntime(f),d=installLearning(r);try{
  r.repository.append('problems',{schemaVersion:SCHEMA_VERSION,id:'problem-1',operationId:'op-p1',source:'spoken',questionText:'化简 -(x-5)',studentWork:'-x-5',knowledgePointId:'negative-brackets',stuckQuote:'负号不知道管谁',stuckPointId:null,catalogTask:null,sessionId:null,answerStatus:'verified',confirmedAt:at});
  r.repository.append('problemSecrets',{schemaVersion:SCHEMA_VERSION,id:'secret-1',problemId:'problem-1',answer:['SECRET-ANSWER-7x'],origin:'student_provided',createdAt:at});
  const view=await d.view();assert.equal(view.problems.length,1);assert.equal('problemSecrets' in view,false);assert.doesNotMatch(JSON.stringify(view),/SECRET-ANSWER-7x/);
  await d.reset({operationId:id(),confirmation:'清除本机学习记录与偏好'});
  for(const c of ['problems','problemSecrets','episodes','progressCards','memoryMentions','observations','summaries','chatTurns'] as const)assert.equal(r.repository.list(c).length,0,c);
 }finally{f.dispose();}
});
