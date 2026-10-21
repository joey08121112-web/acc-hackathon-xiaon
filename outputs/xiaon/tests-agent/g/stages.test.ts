/** 所有者：Claude。G0 对话阶段机单测：纯函数，合成对话。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideStage,filterStageFields,initialStageState,ASK_STUDY_AFTER_COMPANION_TURNS,THINK_MAX_TURNS,type ChatStageState,type StageDecision,type StageEvent } from '../../server/agents/stages';
type Step=string|(Partial<StageEvent>&{text:string});
const event=(step:Step):StageEvent=>({sessionId:'chat-test',intent:null,hasProblem:false,hasActiveTask:false,solved:false,progressCardDone:false,memoryEnabled:true,...(typeof step==='string'?{text:step}:step)});
/** Threads the program state through a scripted conversation, exactly like the coordinator does. */
function play(steps:Step[],start:ChatStageState|null=null):StageDecision[]{
 let state=start;const out:StageDecision[]=[];
 for(const s of steps){const d=decideStage(state,event(s));out.push(d);if(d.stage!=='safety')state=d.state;}
 return out;
}
const life=(n:number)=>Array.from({length:n},(_,i)=>'今天放学去打球了'+i);

test('listen lasts at least 2 turns even when the student already talks about exams or clicks study',()=>{
 const d=play([{text:'数学考试没考好',intent:'study'},'错题好多']);
 assert.deepEqual(d.map(x=>x.stage),['listen','listen']);
 assert.equal(d[1].state.listenTurns,2);
 assert.equal(play(['数学考试没考好','错题好多','这道题我做错了'])[2].stage,'probe');
});

test('needs-check is offered exactly once, after 2 listen turns, and waits while the latest message is intense',()=>{
 const calm=play(['今天还行','有点累',...life(10)]);
 assert.deepEqual(calm.map(x=>x.needsCheck).filter(Boolean).length,1);
 assert.equal(calm[0].needsCheck,false);assert.equal(calm[1].needsCheck,true);
 const upset=play(['今天考砸了','烦死了，想哭','嗯','还好',...life(4)]);
 assert.equal(upset[1].needsCheck,false,'intense wording at turn 2 defers the needs-check');
 assert.equal(upset[2].needsCheck,true);assert.equal(upset.filter(x=>x.needsCheck).length,1);
});

test('companion stays companion until a study intent appears; study intent moves to probe and resets the streak',()=>{
 const d=play(['你好','还行',...life(4),'对了，数学作业有题不会做']);
 assert.deepEqual(d.slice(2,6).map(x=>x.stage),['companion','companion','companion','companion']);
 assert.equal(d[5].state.companionStreak,4);
 assert.equal(d[6].stage,'probe');assert.equal(d[6].state.companionStreak,0);
 assert.equal(play(['你好','还行',{text:'嗯',intent:'study'}])[2].stage,'probe');
});

test(`after ${ASK_STUDY_AFTER_COMPANION_TURNS} consecutive companion turns the reply asks about study once, never again`,()=>{
 const d=play(['你好','还行',...life(20)]);
 const asked=d.map((x,i)=>x.askStudy?i:-1).filter(i=>i>=0);
 assert.deepEqual(asked,[2+ASK_STUDY_AFTER_COMPANION_TURNS-1]);
 assert.equal(d[2+ASK_STUDY_AFTER_COMPANION_TURNS-2].askStudy,false);
});

test('a decline (button or words) means study is never asked again in this session',()=>{
 for(const decline of [{text:'嗯',intent:'decline_study' as const},'我不想学，就想随便聊聊']){
  const d=play(['你好','还行',decline,...life(20)]);
  assert.equal(d.some(x=>x.askStudy),false);assert.equal(d.at(-1)!.state.studyDeclined,true);
 }
 const after=play(['你好','还行',...life(ASK_STUDY_AFTER_COMPANION_TURNS),{text:'不用了',intent:'decline_study'},...life(10)]);
 assert.equal(after.filter(x=>x.askStudy).length,1);
});

test(`understanding/logic probing only in probe, at least every 3 turns, never while intense or listening`,()=>{
 const d=play(['数学考砸了','错题好多','这道题我做错了','嗯','还是不懂','我想想','好像明白一点','气死了，崩溃','再看看']);
 assert.equal(d[0].probeAllowed||d[1].probeAllowed,false,'listen never probes');
 // turns 3..9: open at 3, gap at 4–5, open at 6, gap at 7, intense at 8, open again at 9
 assert.deepEqual(d.slice(2).map(x=>x.probeAllowed),[true,false,false,true,false,false,true]);
 assert.ok(d[2].allowed.includes('observation'));assert.ok(!d[3].allowed.includes('observation'));
 assert.equal(d[7].intense,true);assert.equal(d[7].probeAllowed,false);
 for(const x of d)if(x.probeAllowed)assert.equal(x.stage,'probe');
});

test('safety and rest outrank every stage; a safety message does not advance the conversation',()=>{
 const think=play(['考砸了','错题','这道题我做错了',{text:'一起看吧',intent:'start_together',hasProblem:true}]);
 assert.equal(think.at(-1)!.stage,'think');
 const state=think.at(-1)!.state;
 for(const prior of [null,state]){
  const s=decideStage(prior,event({text:'我真的不想活了',intent:'study'}));
  assert.equal(s.stage,'safety');assert.deepEqual(s.allowed,[]);assert.equal(s.needsCheck||s.askStudy||s.askProblem||s.probeAllowed||s.modeSuggestion,false);
 }
 assert.deepEqual(decideStage(state,event('我真的不想活了')).state,state);
 const rest=decideStage(state,event('我想休息一下'));assert.equal(rest.stage,'rest');assert.deepEqual(rest.allowed,[]);assert.equal(rest.state.studyDeclined,true);
});

test('probe asks for the concrete problem only when a specific wrong problem is mentioned and none is recorded yet',()=>{
 const d=play(['考砸了','有点烦','数学考试的事','第3题我做错了']);
 assert.equal(d[2].stage,'probe');assert.equal(d[2].askProblem,false);assert.equal(d[3].askProblem,true);
 assert.equal(play(['考砸了','有点烦','数学考试的事',{text:'第3题我做错了',hasProblem:true}])[3].askProblem,false);
 assert.ok(play(['你好','还行',...life(8),'这道菜好吃']).every(x=>!x.askProblem),'companion never asks for a problem');
});

test('probe → think needs a confirmed problem or active task plus start_together; think → reflect → companion',()=>{
 const base=['考砸了','有点烦','这道题我做错了'];
 assert.equal(play([...base,{text:'好',intent:'start_together'}]).at(-1)!.stage,'probe');
 const think=play([...base,{text:'好',intent:'start_together',hasActiveTask:true}]);assert.equal(think.at(-1)!.stage,'think');assert.deepEqual(think.at(-1)!.allowed,[]);
 const s=think.at(-1)!.state;
 assert.equal(decideStage(s,event({text:'x+5',solved:true})).stage,'reflect');
 assert.equal(decideStage(s,event('哦我懂了')).stage,'reflect');
 const long=play(Array.from({length:THINK_MAX_TURNS},()=>'嗯'),s);
 assert.ok(long.slice(0,THINK_MAX_TURNS-1).every(x=>x.stage==='think'));assert.equal(long.at(-1)!.stage,'reflect');
 const reflect=decideStage(s,event('懂了'));assert.deepEqual(reflect.allowed.sort(),['memoryDraft','progressCardDraft']);
 assert.equal(decideStage(reflect.state,event('嗯')).stage,'reflect');
 assert.equal(decideStage(reflect.state,event({text:'好了',progressCardDone:true})).stage,'companion');
});

test('each stage allows only its own model fields; memory drafts disappear when memory is off',()=>{
 const d=play(['你好','还行','今天打球了','这道题我做错了']);
 assert.deepEqual(d[0].allowed,['memoryDraft']);assert.deepEqual(d[2].allowed,['memoryDraft']);
 assert.deepEqual(d[3].allowed.sort(),['observation','problemDraft']);
 assert.deepEqual(play([{text:'你好',memoryEnabled:false}])[0].allowed,[]);
 const {kept,dropped}=filterStageFields(['memoryDraft'],{memoryDraft:{text:'喜欢打球'},problemDraft:{x:1},observation:null});
 assert.deepEqual(Object.keys(kept),['memoryDraft']);assert.deepEqual(dropped,['problemDraft']);
});

test('formal test choice suggests professional mode (not while intense); farewell ends the session',()=>{
 const d=play(['考砸了','还好',{text:'做个正式测试',intent:'formal_test'}]);
 assert.equal(d[2].modeSuggestion,true);assert.equal(d[2].stage,'probe');
 assert.equal(play(['考砸了','还好',{text:'烦死了，测就测',intent:'formal_test'}])[2].modeSuggestion,false);
 const bye=play(['你好','还行','今天先聊到这，拜拜']);assert.equal(bye[2].end,true);assert.equal(bye[2].state.ended,true);
 const next=decideStage(bye[2].state,event({text:'我又来了',sessionId:'chat-next'}));
 assert.equal(next.state.sessionId,'chat-next');assert.equal(next.state.turn,1);assert.equal(next.stage,'listen');
 assert.deepEqual(initialStageState('chat-x'),{sessionId:'chat-x',turn:0,stage:'listen',listenTurns:0,companionStreak:0,thinkTurns:0,lastProbeTurn:null,needsCheckAsked:false,askStudyAsked:false,studyDeclined:false,ended:false});
});
