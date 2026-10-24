/** 所有者：Claude（综合模式：对话观察与对话小结）。由 server/agents/learning.ts 委托调用。观察与小结是学习记录：不进评分证据，不受记忆开关影响。 */
import { z } from 'zod';
import { schemas,SCHEMA_VERSION,type ConversationSummary,type ObservationDraft,type Validation } from '../../../shared/learning-contracts';
import { RuntimeError } from '../../core/errors';
import { INTENSE_PATTERN,SAFETY_PATTERN } from '../../agents/stages';
import { SUMMARY_PROMPT } from '../../agents/prompts/summary';
import type { EndConversationInput,ObservationCheck,RevampContext } from '../context';
export const OBSERVATIONS_PER_DIMENSION=3;
/** Emotion words never become a topic or a plan line of a learning record. */
export const EMOTION_LABEL_PATTERN=/焦虑|难过|伤心|生气|沮丧|崩溃|害怕|紧张|烦躁|自卑|抑郁|情绪|心情|哭|委屈|压力|不开心|郁闷/;
const POINT_NAMES:Record<string,string>={'math-language':'数学语句与条件','counterexample':'反例与条件','negative-brackets':'去括号负号','like-terms':'合并同类项','fixed-variable-cost':'一次费用与变化费用','rotation-2d':'二维旋转','other':'其他题型'};
const SIGNAL_RANK={confused:0,partial:1,clear:2} as const;
/** Program gate for a model-proposed observation (see contract §6). */
export function validateObservation(candidate:unknown,check:ObservationCheck):Validation<ObservationDraft>{
 const parsed=schemas.ObservationDraft.safeParse(candidate);if(!parsed.success)return {ok:false,reasons:['schema_invalid']};
 const o=parsed.data,reasons:string[]=[];
 if(!((check.stage==='probe'&&check.probeAllowed)||check.lifeScene))reasons.push('probe_not_allowed');
 const quote=o.quote.trim();if(!quote||!check.studentTexts.some(t=>t.includes(quote)))reasons.push('quote_not_from_student');
 if(check.existing.filter(e=>e.sessionId===check.sessionId&&e.dimension===o.dimension).length>=OBSERVATIONS_PER_DIMENSION)reasons.push('dimension_limit');
 return reasons.length?{ok:false,reasons}:{ok:true,value:{...o,quote}};
}
export function latestSummary(ctx:Pick<RevampContext,'repository'>):ConversationSummary|null{return ctx.repository.list('summaries').at(-1)??null;}
const draftSchema=z.object({topics:z.array(z.string()).max(10),planSuggestions:z.array(z.string()).max(10)});
const clean=(items:string[],max:number,limit:number)=>[...new Set(items.map(s=>s.trim()).filter(s=>s&&s.length<=limit&&!EMOTION_LABEL_PATTERN.test(s)))].slice(0,max);
/** Student-end or farewell. One summary per chat session; a repeat call returns the saved one. */
export async function endConversation(input:EndConversationInput,ctx:RevampContext,signal?:AbortSignal):Promise<ConversationSummary>{
 const repo=ctx.repository,turns=repo.list('chatTurns').filter(t=>t.sessionId===input.sessionId);
 if(!turns.length)throw new RuntimeError('not_found','没有这次聊天');
 const saved=repo.list('summaries').find(s=>s.sessionId===input.sessionId);if(saved)return saved;
 const userTexts=input.history.filter(h=>h.role==='user').map(h=>h.content);
 // Safety first: a session that touched the safety gate gets help information, never a summary.
 if(userTexts.some(t=>SAFETY_PATTERN.test(t)))throw new RuntimeError('invalid_state','这次先不做小结');
 const sessionTexts=userTexts.slice(-turns.length),startedAt=turns[0].at;
 const observations=repo.list('observations').filter(o=>o.sessionId===input.sessionId);
 const problems=repo.list('problems').filter(p=>p.sessionId===input.sessionId);
 const stuck=repo.list('stuckPoints').filter(s=>s.createdAt>=startedAt);
 const card=repo.list('progressCards').filter(c=>c.sessionId===input.sessionId).at(-1)??null;
 const previous=repo.list('summaries').filter(s=>s.createdAt<=ctx.clock.now()).at(-1)??null;
 const reachedStudy=turns.some(t=>['probe','think','reflect'].includes(t.stage));
 // Program fallback (no model, or a draft that does not survive the checks): topics and plan only.
 const points=[...new Set([...problems.map(p=>p.knowledgePointId),...stuck.map(s=>s.knowledgePointId)])];
 // 学习计划建议只看学习话题观察；生活话题观察（sceneId）不引导做题。
 const studyObservations=observations.filter(o=>!o.sceneId);
 const localTopics=[...(reachedStudy?['聊了学习上遇到的事']:['聊了聊最近的事']),...points.map(k=>'说到了'+POINT_NAMES[k])];
 const localPlan=[
  ...points.slice(0,2).map(k=>'找一道'+POINT_NAMES[k]+'小题，先说说第一步'),
  ...(studyObservations.some(o=>o.dimension==='理解'&&o.signal!=='clear')?['读题时把条件一条条圈出来，再说说每个条件的意思']:[]),
  ...(studyObservations.some(o=>o.dimension==='逻辑'&&o.signal!=='clear')?['做完一步问问自己：为什么可以这样']:[]),
  ...(card?.nextTry?[card.nextTry.slice(0,100)]:[]),
  '花5分钟回顾今天聊到的一件事'];
 let topics=clean(localTopics,5,100),plan=clean(localPlan,3,100),mode:ConversationSummary['mode']='local_rules';
 if(ctx.providerKind!=='offline'){
  try{
   const {content}=await ctx.model({operationId:input.operationId+'-summary',prompt:SUMMARY_PROMPT,data:{history:input.history.slice(-20),observations:observations.map(({dimension,signal,quote,note})=>({dimension,signal,quote,note})),knowledgePoints:points.map(k=>POINT_NAMES[k])}},signal);
   const draft=draftSchema.parse(JSON.parse(content));const t=clean(draft.topics,5,100),p=clean(draft.planSuggestions,3,100);
   if(t.length&&p.length){topics=t;plan=p;mode='model';}
  }catch(e){if(signal?.aborted)throw e;/* model unavailable or invalid: keep the program summary */}
 }
 // Changes: only same-dimension observations that exist in both sessions, each with both verbatim quotes.
 const before=previous?repo.list('observations').filter(o=>previous.observationIds.includes(o.id)):[];
 const changes=(['理解','逻辑'] as const).flatMap(dim=>{
  const a=before.filter(o=>o.dimension===dim).at(-1),b=observations.filter(o=>o.dimension===dim).at(-1);if(!a||!b)return [];
  const trend=SIGNAL_RANK[b.signal]>SIGNAL_RANK[a.signal]?'这次说得更清楚了':SIGNAL_RANK[b.signal]<SIGNAL_RANK[a.signal]?'这次还需要再看看':'和上次差不多';
  return [`${dim}：上次说「${a.quote}」，这次说「${b.quote}」，${trend}`.slice(0,200)];
 });
 const intense=sessionTexts.slice(-2).some(t=>INTENSE_PATTERN.test(t));
 const summary:ConversationSummary=schemas.ConversationSummary.parse({schemaVersion:SCHEMA_VERSION,id:'summary-'+input.operationId,operationId:input.operationId,sessionId:input.sessionId,trigger:input.trigger,
  topics,observationIds:observations.map(o=>o.id),comparedWithSummaryId:previous?.id??null,changes,planSuggestions:plan,
  suggestProfessionalMode:!intense&&(observations.length>0||problems.length>0||stuck.length>0),progressCardId:card?.id??null,mode,createdAt:ctx.clock.now()});
 repo.append('summaries',summary);return summary;
}
