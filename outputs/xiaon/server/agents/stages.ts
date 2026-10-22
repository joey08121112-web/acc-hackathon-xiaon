/** 所有者：Claude（阶段 0 冻结）。首页综合模式的对话阶段机：纯函数，阶段只由程序按事件决定，模型和前端都不能自己跳。 */
import type { ChatIntent,ChatStage,StageField } from '../../shared/learning-contracts';
export const LISTEN_MIN_TURNS=2;
export const ASK_STUDY_AFTER_COMPANION_TURNS=6;
export const PROBE_GAP_TURNS=3;
export const THINK_MAX_TURNS=10;
/** A conversation idle this long starts a new chat session (same window the client uses). */
export const CHAT_STALE_MS=6*3600_000;
// Program gates on the student's own words. Safety and rest come first in every flow; nothing here is delegated to the model.
export const SAFETY_PATTERN=/自杀|不想活|想死|去死|自残|割腕|结束生命|伤害自己|活着(?:没|没有)意思|跳楼/;
export const REST_PATTERN=/休息|暂不看|不想看|只想聊|不想探索/;
export const STUDY_PATTERN=/考试|考砸|没考好|成绩|分数|错题|做错|算错|不会做|作业|题目|这道题|那道题|这题|数学|复习|测验|期中|期末|学习/;
export const DECLINE_PATTERN=/不想学|不学了|先不学|不想做题|不用了|别提学习/;
export const INTENSE_PATTERN=/崩溃|气死|烦死|想哭|哭了|难受死|委屈|绝望|受不了|好怕|害怕|焦虑|压力好大/;
export const PROBLEM_PATTERN=/(?:这|那)道题|(?:这|那)题|第\s*[0-9一二三四五六七八九十]+\s*(?:道|题)|错题|题.*(?:做错|算错|写错)|(?:做错|算错|写错).*题/;
export const UNDERSTOOD_PATTERN=/懂了|明白了|会了|我知道了|原来如此/;
/** A self-report can end discussion, never establish mastery. Mixed/quoted/negated reports need clarification. */
export const explicitUnderstanding=(text:string)=>/^(?:哦|噢|嗯|好|现在|这下|我|已经|都|真的|终于|算是|，|,|\s)*(?:懂了|明白了|会了|知道了|原来如此)[。！!\s]*$/.test(text);
export const STOP_THINK_PATTERN=/^(?:今天)?(?:先)?(?:不做了|不继续了|结束|到这里|停一下|跳过)(?:吧)?[。！!\s]*$/;
/** In think, an explicit request for more help (button "给我一点提示" or words). The program decides the level, never the model. */
export const HELP_PATTERN=/提示|帮帮我|帮我一下|没思路|想不出|怎么下手|给点思路/;
export const FAREWELL_PATTERN=/拜拜|再见|晚安|下次(?:再)?聊|今天先(?:聊)?到这|先聊到这|我先走了|886/;
/** Fields the model may output per stage. Anything else is dropped by the program and recorded on the turn. */
export const STAGE_FIELDS:Record<ChatStage,StageField[]>={companion:['memoryDraft'],listen:['memoryDraft'],probe:['problemDraft','observation'],think:[],reflect:['progressCardDraft','memoryDraft'],safety:[],rest:[]};
/** Student-selectable shortcuts per stage; plain student messages once clicked. */
export const HOME_QUICK_REPLIES:Record<ChatStage,string[]>={listen:['考试没考好','有题不会做','就是不想学','不想说'],companion:[],probe:['概念不太清楚','公式不会用','不知道从哪下手','说不清楚'],think:['我想想','给我一点提示','我算出来了','先停一下'],reflect:['我说说收获','先跳过'],safety:[],rest:[]};
export interface ChatStageState { sessionId:string;turn:number;stage:ChatStage;listenTurns:number;companionStreak:number;thinkTurns:number;lastProbeTurn:number|null;needsCheckAsked:boolean;askStudyAsked:boolean;studyDeclined:boolean;ended:boolean }
/** One student turn as the program sees it. hasProblem/hasActiveTask/solved/progressCardDone are computed by the coordinator from stored records. */
export interface StageEvent { sessionId:string;text:string;intent:ChatIntent|null;hasProblem:boolean;hasActiveTask:boolean;solved:boolean;progressCardDone:boolean;memoryEnabled:boolean }
export interface StageDecision { stage:ChatStage;state:ChatStageState;needsCheck:boolean;askStudy:boolean;askProblem:boolean;probeAllowed:boolean;modeSuggestion:boolean;end:boolean;intense:boolean;allowed:StageField[];
 /** G2 (REPORT-1): the probe turn right after a probe. The student's answer to it may be recorded (quoting this message only); no new probe. */
 answerTurn:boolean;
 /** think only: the student asked for the next help level this turn. */
 helpRequested:boolean }
export function initialStageState(sessionId:string):ChatStageState{
 return {sessionId,turn:0,stage:'listen',listenTurns:0,companionStreak:0,thinkTurns:0,lastProbeTurn:null,needsCheckAsked:false,askStudyAsked:false,studyDeclined:false,ended:false};
}
const quiet={needsCheck:false,askStudy:false,askProblem:false,probeAllowed:false,modeSuggestion:false,end:false,helpRequested:false,answerTurn:false};
/** previous=null (or an ended session) starts event.sessionId fresh. A safety decision returns the state unchanged: it is never persisted. */
export function decideStage(previous:ChatStageState|null,event:StageEvent):StageDecision{
 const prior=previous&&!previous.ended?previous:initialStageState(event.sessionId);const text=event.text;
 if(SAFETY_PATTERN.test(text))return {stage:'safety',state:prior,...quiet,intense:true,allowed:[]};
 const s:ChatStageState={...prior,turn:prior.turn+1};
 if(REST_PATTERN.test(text)){s.studyDeclined=true;s.companionStreak=0;s.stage='rest';return {stage:'rest',state:s,...quiet,intense:false,allowed:[]};}
 const intense=INTENSE_PATTERN.test(text);
 const declined=event.intent==='decline_study'||DECLINE_PATTERN.test(text);if(declined)s.studyDeclined=true;
 const study=!declined&&event.intent!=='life'&&(event.intent==='study'||event.intent==='start_together'||event.intent==='formal_test'||STUDY_PATTERN.test(text));
 const canThink=event.intent==='start_together'&&(event.hasProblem||event.hasActiveTask);
 let stage:ChatStage;
 if(s.listenTurns<LISTEN_MIN_TURNS){stage='listen';s.listenTurns++;}
 else if(prior.stage==='think'){
  if(event.intent==='life'||event.intent==='decline_study')stage='companion';
  else if(event.solved||explicitUnderstanding(text)||STOP_THINK_PATTERN.test(text)||s.thinkTurns>=THINK_MAX_TURNS)stage='reflect';
  else{stage='think';s.thinkTurns++;}
 }
 else if(prior.stage==='reflect')stage=!event.progressCardDone&&(HELP_PATTERN.test(text)||canThink)?'think':event.progressCardDone?(study?'probe':'companion'):'reflect';
 else if(prior.stage==='probe')stage=event.intent==='life'||declined?'companion':canThink?'think':'probe';
 else stage=study?'probe':'companion';
 if(stage==='think'&&prior.stage!=='think')s.thinkTurns=1;
 if(stage!=='think'&&stage!=='reflect')s.thinkTurns=0;
 s.companionStreak=stage==='companion'?s.companionStreak+1:0;
 // The need is settled once the student is working on study; otherwise ask once, after listening, on a calm turn.
 let needsCheck=false;
 if(stage==='probe'||stage==='think'||stage==='reflect')s.needsCheckAsked=true;
 else if(!s.needsCheckAsked&&s.listenTurns>=LISTEN_MIN_TURNS&&!intense){needsCheck=true;s.needsCheckAsked=true;}
 let askStudy=false;
 if(stage==='companion'&&!needsCheck&&!s.askStudyAsked&&!s.studyDeclined&&s.companionStreak>=ASK_STUDY_AFTER_COMPANION_TURNS){askStudy=true;s.askStudyAsked=true;}
 const askProblem=stage==='probe'&&!event.hasProblem&&PROBLEM_PATTERN.test(text);
 let probeAllowed=false;
 if(stage==='probe'&&!intense&&(s.lastProbeTurn===null||s.turn-s.lastProbeTurn>=PROBE_GAP_TURNS)){probeAllowed=true;s.lastProbeTurn=s.turn;}
 const answerTurn=stage==='probe'&&!intense&&!probeAllowed&&prior.lastProbeTurn!==null&&s.turn-1===prior.lastProbeTurn;
 const end=FAREWELL_PATTERN.test(text);if(end)s.ended=true;
 s.stage=stage;
 const allowed=STAGE_FIELDS[stage].filter(f=>(f!=='observation'||probeAllowed||answerTurn)&&(f!=='memoryDraft'||event.memoryEnabled));
 return {stage,state:s,needsCheck,askStudy,askProblem,probeAllowed,answerTurn,modeSuggestion:event.intent==='formal_test'&&!intense,end,intense,allowed,helpRequested:stage==='think'&&HELP_PATTERN.test(text)};
}
/** Splits model-proposed extra fields into allowed ones and the names the program discards (null/undefined count as absent). */
export function filterStageFields(allowed:StageField[],candidate:Partial<Record<StageField,unknown>>):{kept:Partial<Record<StageField,unknown>>;dropped:StageField[]}{
 const kept:Partial<Record<StageField,unknown>>={},dropped:StageField[]=[];
 for(const [field,value] of Object.entries(candidate) as [StageField,unknown][]){if(value===null||value===undefined)continue;if(allowed.includes(field))kept[field]=value;else dropped.push(field);}
 return {kept,dropped};
}
/** Program comparison of a student message with trusted reference answers (catalog answer or server-only ProblemSecret). */
export function matchesAnswer(text:string,answers:string[]):boolean{
 const clean=(v:string)=>v.normalize('NFKC').replace(/[\s−–—]/g,m=>/\s/.test(m)?'':'-').toLowerCase();
 const said=clean(text);
 return answers.some(a=>{const c=clean(a);return c.length>0&&(said===c||(c.length>2&&said.includes(c))||said.endsWith('='+c)||said.endsWith('是'+c));});
}
/** Program length gate for a Tutor reply: within max characters it is returned as is; otherwise cut at the last sentence end
 * (or last comma, closed with 。) inside the limit. Used after one model rewrite has already been tried. */
export function fitReply(text:string,max:number):string{
 const chars=Array.from(text);if(chars.length<=max)return text;
 const head=chars.slice(0,max).join('');
 const end=Math.max(...['。','！','？','!','?','…'].map(c=>head.lastIndexOf(c)));if(end>=0)return head.slice(0,end+1);
 const pause=Math.max(...['，',',','；',';'].map(c=>head.lastIndexOf(c)));if(pause>0)return head.slice(0,pause)+'。';
 return head;
}
export const replyLength=(text:string)=>Array.from(text).length;
/** Does a reply reveal a reference answer? Long answers by substring; short ones (≤2 chars) only as a standalone token. */
export function containsAnswer(text:string,answer:string):boolean{
 const clean=(v:string)=>v.normalize('NFKC').replace(/\s+/g,'').replace(/[−–—]/g,'-').toLowerCase();
 const t=clean(text),a=clean(answer);if(!a)return false;
 if(a.length>2)return t.includes(a);
 return new RegExp('(?<![0-9a-z.])'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![0-9a-z.])').test(t);
}
