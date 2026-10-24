/** 所有者：Claude（第二期：专业模式面试引擎）。由 server/agents/learning.ts 委托调用。
 * 安全拦截、休息、面试是否存在、状态与 expectedRevision 由协调器先查；插件返回值出服务端前再按 schema 解析，报告另过 server/agents/professional.ts 的程序门控。
 * 每题流程：小N出题（打开题目，记 task 暴露）→ 学生作答 → 追问一次「你是怎么想的」→ 合成一次作答走 ctx.submitAttempt 照常判分 → 答错且是第一题时加问同类题 → 下一模块。
 * 题目只来自题库里的生活故事题（life-*，不含旧题和模型生成的 gen- 题）；先修规则、每场次计算题上限和探索顺序由现有的打开题目事件把关。 */
import { z } from 'zod';
import { schemas,SCHEMA_VERSION,INTERVIEW_MODULE_ORDER,MODULE_LEVEL_LABELS,type ChatObservation,type GradingResult,type InterviewModule,type InterviewPending,type InterviewSession,type InterviewStep,type InterviewTurn,type InterviewTurnKind,type ModuleLevel,type ProfessionalReport,type TaskDefinition } from '../../../shared/learning-contracts';
import { RuntimeError } from '../../core/errors';
import { HELP_PATTERN,containsAnswer } from '../../agents/stages';
import { INTERVIEWER_PROMPT,REPORT_WORDING_PROMPT } from '../../agents/prompts/interviewer';
import type { InterviewAnswerInput,InterviewPauseInput,InterviewResumeInput,InterviewStartInput,ProfessionalContext,ReportInput } from '../context';
import { LOCAL_WORDING,levelOf,moduleBasis,statedReason,suggestionsFor,type AttemptFact } from './levels';
export { moduleBasis,levelOf,statedReason,REASON_MIN_CHARS,NO_REASON_PATTERN,SUGGESTIONS } from './levels';
const LEAD:Record<InterviewModule,string>={'理解':'第一站，理解花园。先听我讲件小事——\n','逻辑':'第二站，逻辑小桥。又是一件身边的小事——\n','计算':'第三站，计算工坊。这回帮家里算笔小账——\n','建模':'第四站，生活集市。帮家里想个算钱的办法——\n','空间想象':'最后一站，空间山丘。在脑子里转一转——\n'};
const TRANSFER_LEAD='我们再看一件类似的小事，慢慢来：\n';
/** Fixed follow-ups (no model, or the model's phrasing failed the program check). */
export const FOLLOW_UPS:Record<'question'|'transfer',string>={question:'你是怎么想的？想到哪说到哪就好，说不会也没关系。',transfer:'这道你又是怎么想的呢？用自己的话说说。'};
/** A choice in a life story: ask why this choice, not "how did you solve it". */
export const CHOICE_FOLLOW_UPS:Record<'question'|'transfer',string>={question:'你为什么这么选？想到哪说到哪就好，说不清也没关系。',transfer:'这次你又为什么这么选呢？用自己的话说说。'};
const BANK_SHORT='这个小故事你以前听过，新的故事暂时用完了（题库不足），这次就当回顾。';
const MODEL_INTRO_MAX=120;
const MODEL_LEAD_MAX=40;
/** 专业模式只出生活故事题（catalog 里的 life-*）：见过一组还有下一组，全见过时回顾一道故事题，不退回旧的做题式题目。 */
export const isStoryTask=(t:{id:string})=>t.id.startsWith('life-');
const hasReasonPoint=(t:TaskDefinition)=>t.rubric.some(r=>r.requiresExplanation);
const turnsOf=(ctx:ProfessionalContext,interviewId:string)=>ctx.repository.list('interviewTurns').filter(t=>t.interviewId===interviewId);
/** Ever opened or answered (any session): such a task is not unseen. */
const seenTask=(ctx:ProfessionalContext,taskId:string)=>ctx.repository.list('exposures').some(e=>e.kind==='task'&&e.taskId===taskId)||ctx.repository.list('attempts').some(a=>a.taskId===taskId);
const prerequisitesMet=(ctx:ProfessionalContext,t:{prerequisites:string[]})=>{const done=new Set(ctx.repository.list('attempts').flatMap(a=>ctx.catalog.definition(a.taskId,a.taskVersion)?.knowledgePoints??[]));return t.prerequisites.every(k=>done.has(k));};
interface Picked { task:TaskDefinition;bankShort:boolean }
/** Opens the first acceptable task: unseen first; a first question may fall back to a seen observation task and says so (never passed off as unseen).
 * The existing expose event enforces the per-session calculation cap and the exploration order; a refusal there moves on to the next candidate. */
function openTask(ctx:ProfessionalContext,input:{operationId:string;sessionId:string;module:InterviewModule;purpose:'question'|'transfer';familyId?:string;exclude:string[]}):Picked|null{
 const kinds=input.purpose==='question'?['observation','delayed','transfer']:['transfer','delayed'];
 const all=ctx.catalog.candidates({sessionId:input.sessionId,dimension:input.module,excludeTaskIds:input.exclude,limit:100}).filter(isStoryTask)
  .map(t=>ctx.catalog.definition(t.id,t.version)!).filter(t=>t&&(!input.familyId||t.familyId===input.familyId)&&kinds.includes(t.variantKind)&&prerequisitesMet(ctx,t));
 const byKind=(list:TaskDefinition[])=>kinds.flatMap(k=>list.filter(t=>t.variantKind===k));
 const unseen=byKind(all.filter(t=>!seenTask(ctx,t.id))).map(task=>({task,bankShort:false}));
 const fallback=input.purpose==='question'?all.filter(t=>t.variantKind==='observation'&&seenTask(ctx,t.id)).map(task=>({task,bankShort:true})):[];
 for(const c of [...unseen,...fallback]){
  try{ctx.events.expose({operationId:`${input.operationId}-open-${c.task.id}`,sessionId:input.sessionId,taskId:c.task.id,taskVersion:c.task.version,kind:'task',hintId:null});return c;}
  catch(e){if(!(e instanceof RuntimeError)||e.code!=='invalid_state')throw e;}
 }
 return null;
}
const promptOutput=z.object({prompt:z.string().min(1).max(MODEL_INTRO_MAX)});
/** 小N's wording. The model only writes the intro or the follow-up line; the catalog question is appended by the program, never rewritten.
 * Offline, a failed call or a line that could reveal the answer → the fixed wording. */
async function ask(ctx:ProfessionalContext,input:{operationId:string;module:InterviewModule;task:TaskDefinition;kind:InterviewTurnKind;followUpOf?:'question'|'transfer';previousAnswer?:string},signal?:AbortSignal):Promise<{pending:InterviewPending;run:InterviewStep['run']}>{
 const {module,task,kind}=input,now=ctx.clock.now();
 const fixed=kind==='follow_up'?(task.choices.length?CHOICE_FOLLOW_UPS:FOLLOW_UPS)[input.followUpOf??'question']:'';
 const compose=(line:string)=>kind==='follow_up'?line:`${line}${task.question}`.slice(0,300);
 const local={module,task:{taskId:task.id,taskVersion:task.version},kind,prompt:compose(kind==='follow_up'?fixed:kind==='transfer'?TRANSFER_LEAD:LEAD[module]),mode:'local_rules' as const,askedAt:now};
 if(ctx.providerKind==='offline')return {pending:local,run:null};
 try{
  const {content,run}=await ctx.model({operationId:`${input.operationId}-ask`,prompt:INTERVIEWER_PROMPT,data:{module,kind,question:task.question,choices:task.choices,studentAnswer:input.previousAnswer??null},timeoutMs:20_000},signal);
  const parsed=promptOutput.safeParse(JSON.parse(content));
  const line=parsed.success?parsed.data.prompt.trim():'';
  if(!line||task.answer.some(a=>containsAnswer(line,a))||/答案/.test(line))return {pending:local,run};
  // An opening only sets the scene: a question in it ("为什么这么选？") or a retold story would come before the student has chosen.
  if(kind!=='follow_up'&&(/为什么|[？?]/.test(line)||Array.from(line).length>MODEL_LEAD_MAX))return {pending:local,run};
  return {pending:{...local,prompt:compose(kind==='follow_up'?line:line+'\n'),mode:'model'},run};
 }catch(e){if(e instanceof RuntimeError||e instanceof SyntaxError)return {pending:local,run:null};throw e;}
}
const publicTask=(ctx:ProfessionalContext,p:InterviewPending|null)=>p?ctx.catalog.publicTask(p.task.taskId,p.task.taskVersion)??null:null;
function save(ctx:ProfessionalContext,prev:InterviewSession,change:Partial<InterviewSession>):InterviewSession{
 const next=schemas.InterviewSession.parse({...prev,...change,revision:prev.revision+1,updatedAt:ctx.clock.now()});ctx.repository.append('interviews',next);return next;
}
/** Opens the next module's first question, skipping a module whose tasks cannot be opened (e.g. calculation cap). null pending = all done. */
async function nextModule(ctx:ProfessionalContext,input:{operationId:string;sessionId:string;after:InterviewModule|null;exclude:string[]},signal?:AbortSignal){
 const skipped:InterviewModule[]=[];
 for(const module of INTERVIEW_MODULE_ORDER.slice(input.after?INTERVIEW_MODULE_ORDER.indexOf(input.after)+1:0)){
  const picked=openTask(ctx,{operationId:input.operationId,sessionId:input.sessionId,module,purpose:'question',exclude:input.exclude});
  if(!picked){skipped.push(module);continue;}
  const asked=await ask(ctx,{operationId:input.operationId,module,task:picked.task,kind:'question'},signal);
  return {module,pending:asked.pending,run:asked.run,bankShort:picked.bankShort,skipped};
 }
 return {module:null,pending:null,run:null,bankShort:false,skipped};
}
const step=(ctx:ProfessionalContext,s:{text:string;interview:InterviewSession;turn?:InterviewTurn|null;run?:InterviewStep['run']}):InterviewStep=>
 schemas.InterviewStep.parse({text:s.text,safety:false,interview:s.interview,task:publicTask(ctx,s.interview.pending),turn:s.turn??null,reportReady:false,run:s.run??null});
const skippedNote=(skipped:InterviewModule[])=>skipped.length?`「${skipped.join('、')}」这次没法出新题，先跳过，报告里会标「还没测到」。`:'';

export async function startInterview(input:InterviewStartInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<InterviewStep>{
 const now=ctx.clock.now();
 const first=await nextModule(ctx,{operationId:input.operationId,sessionId:input.learningSession.id,after:null,exclude:[]},signal);
 if(!first.pending)throw new RuntimeError('unavailable','题库里暂时没有可以打开的题');
 const interview=schemas.InterviewSession.parse({schemaVersion:SCHEMA_VERSION,id:'interview-'+input.operationId,operationId:input.operationId,revision:1,learningSessionId:input.learningSession.id,moduleOrder:[...INTERVIEW_MODULE_ORDER],
  currentModule:first.module,completedModules:[],status:'in_progress',pending:first.pending,startedAt:now,pausedAt:null,completedAt:null,updatedAt:now});
 ctx.repository.append('interviews',interview);
 const intro='我们开始吧！一共五关：理解、逻辑、计算、建模、空间想象，可以随时暂停，不打总分。';
 return step(ctx,{text:[intro,first.bankShort?BANK_SHORT:'',first.pending.prompt].filter(Boolean).join('\n'),interview,run:first.run});
}

export async function answerInterview(input:InterviewAnswerInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<InterviewStep>{
 const iv=input.interview,p=iv.pending!,now=ctx.clock.now(),op=input.operationId,sessionId=iv.learningSessionId;
 const task=ctx.catalog.definition(p.task.taskId,p.task.taskVersion);if(!task)throw new RuntimeError('not_found','题目版本不存在');
 const turns=turnsOf(ctx,iv.id);
 // A small hint on the open question is recorded as a hint exposure; the graded attempt then counts as 提示后完成. Nothing new is asked.
 if(p.kind!=='follow_up'&&HELP_PATTERN.test(input.text)){
  const given=new Set(ctx.repository.list('exposures').filter(e=>e.kind==='hint'&&e.taskId===task.id&&e.sessionId===sessionId).map(e=>e.hintId));
  const hint=task.hints.find(h=>!given.has(h.id));
  if(hint)ctx.events.expose({operationId:op+'-hint',sessionId,taskId:task.id,taskVersion:task.version,kind:'hint',hintId:hint.id});
  return step(ctx,{text:hint?`小提示：${hint.text}想好了再告诉我。`:'提示只有这一条啦，按你的想法写就好，写错也没关系。',interview:iv});
 }
 const turn=schemas.InterviewTurn.parse({schemaVersion:SCHEMA_VERSION,id:'iturn-'+op,operationId:op,interviewId:iv.id,seq:turns.length+1,module:p.module,task:p.task,kind:p.kind,prompt:p.prompt,answer:input.text,attemptId:null,mode:p.mode,askedAt:p.askedAt,answeredAt:now});
 if(p.kind!=='follow_up'){
  ctx.repository.append('interviewTurns',turn);
  const asked=await ask(ctx,{operationId:op,module:p.module,task,kind:'follow_up',followUpOf:p.kind,previousAnswer:input.text},signal);
  return step(ctx,{text:asked.pending.prompt,interview:save(ctx,iv,{pending:asked.pending}),turn,run:asked.run});
 }
 // Follow-up answered: one attempt = the answer (+ the follow-up as the explanation line when the task has a reason point). Graded like learning/submit.
 const question=turns.filter(t=>t.task.taskId===task.id&&t.kind!=='follow_up').at(-1);if(!question)throw new RuntimeError('invalid_state','找不到这道题的作答');
 const value=hasReasonPoint(task)?`${question.answer}\n${input.text}`:question.answer;
 const {attempt,grading}=await ctx.submitAttempt({operationId:op+'-submit',sessionId,taskId:task.id,taskVersion:task.version,value},signal);
 const done={...turn,attemptId:attempt.id};ctx.repository.append('interviewTurns',done);
 const exclude=[...turns.map(t=>t.task.taskId),task.id];
 if(question.kind==='question'&&!resultOk(task,grading)){
  const transfer=openTask(ctx,{operationId:op,sessionId,module:p.module,purpose:'transfer',familyId:task.familyId,exclude});
  if(transfer){const asked=await ask(ctx,{operationId:op,module:p.module,task:transfer.task,kind:'transfer'},signal);
   return step(ctx,{text:asked.pending.prompt,interview:save(ctx,iv,{pending:asked.pending}),turn:done,run:asked.run});}
 }
 const completedModules=[...iv.completedModules,p.module];
 const next=await nextModule(ctx,{operationId:op,sessionId,after:p.module,exclude},signal);
 if(!next.pending){
  const interview=save(ctx,iv,{completedModules,currentModule:null,pending:null,status:'completed',completedAt:now});
  return step(ctx,{text:[`「${p.module}」这一关完成！`,skippedNote(next.skipped),'五关都走完啦，辛苦了！现在可以看看这次的报告。'].filter(Boolean).join(''),interview,turn:done});
 }
 const interview=save(ctx,iv,{completedModules,currentModule:next.module,pending:next.pending});
 return step(ctx,{text:[`好，记下了。「${p.module}」这一关完成！`+skippedNote(next.skipped),next.bankShort?BANK_SHORT:'',next.pending.prompt].filter(Boolean).join('\n'),interview,turn:done,run:next.run});
}
const resultOk=(task:TaskDefinition,g:GradingResult|undefined)=>g?.points.find(p=>p.pointId===task.rubric[0].id)?.status==='supported';

/** Pausing the interview also pauses the learning session (same meaning as 休息 elsewhere); resume reactivates it through learning/start. */
export async function pauseInterview(input:InterviewPauseInput,ctx:ProfessionalContext):Promise<InterviewSession>{
 const session=ctx.events.sessions().find(s=>s.id===input.interview.learningSessionId);
 if(session?.status==='active')ctx.events.sessionState({operationId:input.operationId+'-session',sessionId:session.id,status:'paused'});
 return save(ctx,input.interview,{status:'paused',pausedAt:ctx.clock.now()});
}

/** Continues at the stopped module with the same pending question; a new day records the new session and reopens that question there. */
export async function resumeInterview(input:InterviewResumeInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<InterviewStep>{
 void signal;const iv=input.interview,sessionId=input.learningSession.id;
 const interview=iv.status==='paused'||iv.learningSessionId!==sessionId?save(ctx,iv,{status:'in_progress',pausedAt:null,learningSessionId:sessionId}):iv;
 const p=interview.pending;
 if(p&&!ctx.repository.list('exposures').some(e=>e.kind==='task'&&e.sessionId===sessionId&&e.taskId===p.task.taskId))
  ctx.events.expose({operationId:`${input.operationId}-reopen-${p.task.taskId}`,sessionId,taskId:p.task.taskId,taskVersion:p.task.taskVersion,kind:'task',hintId:null});
 return step(ctx,{text:p?`上次停在「${interview.currentModule}」，我们接着来。\n${p.prompt}`:'这次测评已经走完了。',interview});
}

const wordingOutput=z.object({wordings:z.record(z.string(),z.string())});
const FORBIDDEN_WORDING=/总分|排名|名次|打败|超过.*同学|百分|分数/;
/** The program decides each level from this interview's graded attempts; the model may only word the tested ones. Returned, never stored here. */
export async function buildReport(input:ReportInput,ctx:ProfessionalContext,signal?:AbortSignal):Promise<ProfessionalReport>{
 const iv=input.interview,repo=ctx.repository,turns=turnsOf(ctx,iv.id),now=ctx.clock.now();
 const fact=(followUp:InterviewTurn|undefined):AttemptFact|null=>{
  if(!followUp?.attemptId)return null;const attempt=repo.get('attempts',followUp.attemptId),task=attempt&&ctx.catalog.definition(attempt.taskId,attempt.taskVersion);if(!attempt||!task)return null;
  const grading=repo.list('gradings').filter(g=>g.attemptId===attempt.id).at(-1);
  const reasonClear=hasReasonPoint(task)?task.rubric.filter(r=>r.requiresExplanation).every(r=>grading?.points.find(p=>p.pointId===r.id)?.status==='supported'):statedReason(followUp.answer);
  return {resultOk:resultOk(task,grading),reasonClear,hinted:attempt.hintSnapshot.length>0||attempt.answerExposed};
 };
 const modules:ModuleLevel[]=INTERVIEW_MODULE_ORDER.map(module=>{
  const mine=turns.filter(t=>t.module===module),followUps=mine.filter(t=>t.kind==='follow_up'&&t.attemptId);
  const firstTask=mine.find(t=>t.kind==='question')?.task.taskId,transferTask=mine.find(t=>t.kind==='transfer')?.task.taskId;
  const tested=iv.completedModules.includes(module);
  const basis=tested?moduleBasis({observation:fact(followUps.find(t=>t.task.taskId===firstTask)),transfer:transferTask?fact(followUps.find(t=>t.task.taskId===transferTask)):null}):'not_tested';
  const level=levelOf(basis);
  if(level==='not_tested')return {module,level,basis,evidenceIds:[],attemptIds:[],turnIds:[],quotes:[],wording:null,suggestions:[],scope:'this_interview'};
  const attemptIds=followUps.map(t=>t.attemptId!);
  const evidenceIds=attemptIds.flatMap(a=>repo.list('gradings').filter(g=>g.attemptId===a).at(-1)?.evidenceIds??[]).slice(0,500);
  const quotes=followUps.map(t=>Array.from(t.answer.trim()).slice(0,200).join('')).filter(Boolean).slice(0,5);
  return {module,level,basis,evidenceIds,attemptIds,turnIds:mine.map(t=>t.id),quotes,wording:LOCAL_WORDING[basis],suggestions:suggestionsFor(module,level),scope:'this_interview'};
 });
 let mode:'model'|'local_rules'='local_rules';
 if(ctx.providerKind!=='offline'){
  try{
   const tested=modules.filter(m=>m.level!=='not_tested');
   const {content}=await ctx.model({operationId:input.operationId+'-wording',prompt:REPORT_WORDING_PROMPT,data:{modules:tested.map(m=>({module:m.module,level:MODULE_LEVEL_LABELS[m.level],quotes:m.quotes}))},timeoutMs:20_000},signal);
   const parsed=wordingOutput.safeParse(JSON.parse(content));
   if(parsed.success)for(const m of tested){const w=parsed.data.wordings[m.module]?.trim();if(w&&m.basis==='correct_with_reason'&&Array.from(w).length<=200&&!FORBIDDEN_WORDING.test(w)){m.wording=w;mode='model';}}
  }catch(e){if(!(e instanceof RuntimeError)&&!(e instanceof SyntaxError))throw e;}
 }
 // Home-mode 「待核实」 observations since the last report of an earlier interview: confirmed when this interview points the same way.
 const levelFor=(d:'理解'|'逻辑')=>modules.find(m=>m.module===d)!.level;
 const since=input.previousReport?.createdAt??'';
 const observations:ChatObservation[]=input.observations.filter(o=>o.at>since).slice(-50);
 const observationChecks=observations.map(o=>{const l=levelFor(o.dimension);const agrees=o.signal==='clear'?l==='good':l==='partial'||l==='needs_work';return {observationId:o.id,dimension:o.dimension,result:agrees?'confirmed' as const:'not_seen' as const};});
 const previous=input.previousReport;
 const changes=previous?modules.flatMap(m=>{const from=previous.modules.find(x=>x.module===m.module)?.level;return from&&from!==m.level?[{module:m.module,from,to:m.level,note:`上次${MODULE_LEVEL_LABELS[from]}，这次${MODULE_LEVEL_LABELS[m.level]}`}]:[];}):[];
 return schemas.ProfessionalReport.parse({schemaVersion:SCHEMA_VERSION,id:'preport-'+input.operationId,operationId:input.operationId,evidenceRevision:repo.evidenceRevision(),interviewId:iv.id,
  version:input.supersedes?input.supersedes.version+1:1,supersedesReportId:input.supersedes?.id??null,comparedWithReportId:previous?.id??null,modules,observationChecks,changes,mode,createdAt:now});
}
