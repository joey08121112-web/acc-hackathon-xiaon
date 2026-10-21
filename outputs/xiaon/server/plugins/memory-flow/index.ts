/** 所有者：zCode（改造五：记得你说过的小事 + 开场问候）。确认后的记忆仍写成现有 MemoryItem（source:'student_explicit'）。
 * 提议上限只读专门的 memoryOffers；实际提议由协调器在通过校验后记录。 */
import { randomUUID } from 'node:crypto';
import { schemas,SCHEMA_VERSION,type ConfirmMemoryDraft,type Greeting,type GreetingRequest,type MemoryDraft,type MemoryItem,type MemoryMention,type Validation,MEMORY_CONTEXT_MAX_ITEMS,retentionWindow } from '../../../shared/learning-contracts';
import { notImplemented,type MemoryDraftCheck,type MemoryOfferInput,type MemorySelectionInput,type RevampContext } from '../context';
import { latestSummary } from '../conversation';
import { RuntimeError } from '../../core/errors';
import type { ConversationSummary } from '../../../shared/learning-contracts';
/** 提议记住的措辞上限（模型草稿；学生改写后的文字按 shortText 上限）。 */
export const MEMORY_DRAFT_MAX_CHARS=40;
/** 同一条记忆两次主动提起的最小间隔。 */
export const MEMORY_MENTION_COOLDOWN_DAYS=3;
/** 长期记忆（一直记得）默认 30 天后到期待复核：reviewAt 到期后不再进入上下文，需学生确认还适用。 */
export const MEMORY_REVIEW_DAYS=30;
const LEGACY_OFFER_MARKER='memory-offer'; // Read compatibility only; never write fake mentions.
// 只记事件、兴趣、有用的方法；情绪状态和对人的评价一律丢弃。
// “差/弱”这类单字必须带语境才算评价，避免误伤“差不多每天练琴”这类事件。
const EMOTION_OR_JUDGEMENT=/焦虑|紧张|害怕|恐惧|难过|伤心|哭|崩溃|绝望|烦|生气|愤怒|郁闷|压力大|开心|高兴|兴奋|讨厌|(?:数学|语文|英语|物理|成绩|考试|考得|学得|很|太|比较|相当)差|差劲|(?:很|太|身体)弱|笨|聪明|不努力|懒|不认真|学不会|没天赋|粗心/;
const norm=(s:string)=>s.replace(/[\s，。、；：？！]/g,'').toLowerCase();
const trimTo=(s:string,max:number)=>Array.from(s.trim()).slice(0,max).join('');
function mention(memoryId:string,sessionId:string|null,ctx:RevampContext):MemoryMention{
 const row:MemoryMention={schemaVersion:SCHEMA_VERSION,id:'mention-'+randomUUID(),memoryId,sessionId,via:'greeting',at:ctx.clock.now()};
 ctx.repository.append('memoryMentions',row);return row;
}
/** 模型或进步卡提议的 memoryDraft。程序校验：记忆关闭一律拒绝；origin 由程序按调用方决定，不采纳模型自报；
 * 情绪与评价类丢弃；长度不超过 40 字。 */
export function validateMemoryDraft(candidate:unknown,check:MemoryDraftCheck):Validation<MemoryDraft>{
 if(!check.memoryEnabled)return {ok:false,reasons:['记忆关闭']};
 if(!candidate||typeof candidate!=='object')return {ok:false,reasons:['草稿不是对象']};
 const c=candidate as {text?:unknown;kind?:unknown};
 if(typeof c.text!=='string'||!c.text.trim())return {ok:false,reasons:['缺少文字']};
 const text=c.text.trim();
 if(Array.from(text).length>MEMORY_DRAFT_MAX_CHARS)return {ok:false,reasons:['超过40字']};
 if(EMOTION_OR_JUDGEMENT.test(text))return {ok:false,reasons:['情绪或评价不记录']};
 const kind=c.kind==='event'||c.kind==='interest'||c.kind==='method'?c.kind:null;
 if(!kind)return {ok:false,reasons:['种类只能是事件、兴趣或方法']};
 const value=schemas.MemoryDraft.parse({text,kind,origin:check.origin});
 return {ok:true,value};
}
/** 学生点「记住」才调用；text 是学生改后的文字。写成现有 MemoryItem，并记一条 chat 提起（刚确认的事不再马上主动提起）。 */
export async function confirmMemoryDraft(input:ConfirmMemoryDraft,ctx:RevampContext):Promise<MemoryItem>{
 if(!ctx.memoryEnabled())throw new RuntimeError('forbidden','可选记忆关闭');
 // Integration phase 1: the student's retention choice (contract change, zCode request 2); omitted keeps the old default (forever + 30-day review).
 const {expiresAt,reviewAt}=retentionWindow(input.retention,ctx.clock.now());
 const item=ctx.events.remember({operationId:input.operationId,text:input.text,source:'student_explicit',purpose:'tutoring',expiresAt,reviewAt});
 const row:MemoryMention={schemaVersion:SCHEMA_VERSION,id:'mention-'+randomUUID(),memoryId:item.id,sessionId:input.sessionId,via:'chat',at:ctx.clock.now()};
 ctx.repository.append('memoryMentions',row);return item;
}
/** 小N先开口。优先接上一份对话小结（学习记录，记忆关闭也可用）；否则从有效记忆里挑一条 3 天内没提起过的，
 * 挑哪条由程序决定，模型只负责措辞；模型失败/离线用程序默认文字。 */
export async function greeting(input:GreetingRequest,ctx:RevampContext,signal?:AbortSignal):Promise<Greeting>{
 void signal;
 const memoryOff=!ctx.memoryEnabled();
 let summary:ConversationSummary|null=null;
 try{summary=latestSummary(ctx);}catch{/* Claude 路的桩或失败都不影响问候 */ }
 if(!summary){const all=ctx.repository.list('summaries');summary=all.at(-1)??null;}
 if(summary){
  const topic=summary.topics[0]??'上次聊的那些事';
  const fallback=`上次我们聊到${topic}，这几天怎么样？`;
  const text=await phrase(ctx,input.operationId,'summary',{topic,topics:summary.topics},fallback);
  return {text,memoryId:null,summaryId:summary.id,memoryOff};
 }
 if(memoryOff)return {text:'嗨，又见面啦。今天想聊点什么？',memoryId:null,summaryId:null,memoryOff:true};
 const mentioned=new Map(ctx.repository.list('memoryMentions').filter(m=>m.memoryId!==LEGACY_OFFER_MARKER).map(m=>[m.memoryId,m.at]));
 const cooldown=MEMORY_MENTION_COOLDOWN_DAYS*86_400_000,now=Date.parse(ctx.clock.now());
 const candidates=ctx.events.context().memories
  .map(m=>({m,last:mentioned.has(m.id)?Date.parse(mentioned.get(m.id)!):null}))
  .filter(({last})=>last===null||now-last>=cooldown)
  .sort((a,b)=>(a.last??-Infinity)-(b.last??-Infinity)||Date.parse(b.m.createdAt)-Date.parse(a.m.createdAt));
 const picked=candidates[0]?.m??null;
 if(!picked)return {text:'嗨，又见面啦。今天想聊点什么？',memoryId:null,summaryId:null,memoryOff:false};
 const fallback=`${picked.text}，后来怎么样了？`;
 const text=await phrase(ctx,input.operationId,'memory',{memory:picked.text},fallback);
 mention(picked.id,null,ctx);
 return {text,memoryId:picked.id,summaryId:null,memoryOff:false};
}
/** 模型措辞：一次、无工具；失败时用程序默认文字，不让问候失败。 */
async function phrase(ctx:RevampContext,operationId:string,kind:'summary'|'memory',data:Record<string,unknown>,fallback:string):Promise<string>{
 if(ctx.providerKind==='offline')return fallback;
 try{
  const {content}=await ctx.model({operationId:operationId+'-phrase',prompt:{version:'greeting-i1',text:[
   '你是小N，七年级学生的学习伙伴，说话像温和的同学。根据给的内容写一句开场问候，12到40个字，只问一个问题，不用表情符号。',
   '不评判、不给建议、不提学习成绩。输出严格JSON {"text":"..."}，不要任何其他文字。',
  ].join('\n')},data:{kind,...data},timeoutMs:20_000});
  const match=content.match(/\{[\s\S]*\}/);const value=match?JSON.parse(match[0]) as {text?:unknown}:null;
  if(typeof value?.text==='string'&&value.text.trim())return trimTo(value.text,300);
 }catch{/* 模型失败用默认文字 */}
 return fallback;
}
/** Pure gate: only actual, validated chat offers consume the two chances. */
export function shouldOfferMemory(input:MemoryOfferInput,ctx:RevampContext):boolean{
 return ctx.memoryEnabled()&&ctx.repository.list('memoryOffers').filter(o=>o.sessionId===input.sessionId).length<2;
}
/** Called only by the program after a valid chat-origin draft; retries have the same event id. */
export function recordMemoryOffer(input:MemoryOfferInput&{operationId:string},ctx:RevampContext):void{
 const id='memory-offer-'+input.operationId;
 if(ctx.repository.get('memoryOffers',id)||!shouldOfferMemory(input,ctx))return;
 ctx.repository.append('memoryOffers',{schemaVersion:SCHEMA_VERSION,id,...input,at:ctx.clock.now()});
}
/** Tutor 上下文只带与当前话题相关的记忆：与近期学生原话有公共子串（≥2字）才算相关，按相关度与新旧排序，最多 MEMORY_CONTEXT_MAX_ITEMS 条。
 * 没有相关记忆时返回空（问候会另行提起）。协调器随后仍会用服务端自己的记忆文本复查并截断。 */
export function selectMemoriesForContext(input:MemorySelectionInput,ctx:RevampContext):MemoryItem[]{
 void ctx;
 const texts=input.studentTexts.slice(-6).map(norm);
 const scored=input.memories.map(m=>{
  let score=0;for(const t of texts)score=Math.max(score,longestCommon(norm(m.text),t));
  return {m,score};
 }).filter(s=>s.score>=2)
  .sort((a,b)=>b.score-a.score||Date.parse(b.m.createdAt)-Date.parse(a.m.createdAt)||a.m.id.localeCompare(b.m.id));
 return scored.slice(0,MEMORY_CONTEXT_MAX_ITEMS).map(s=>s.m);
}
function longestCommon(a:string,b:string):number{
 if(!a||!b)return 0;
 let best=0;const prev=new Array<number>(b.length+1).fill(0);
 for(let i=1;i<=a.length;i++){
  let last=0;const row=new Array<number>(b.length+1).fill(0);
  for(let j=1;j<=b.length;j++)last=row[j]=a[i-1]===b[j-1]?prev[j-1]+1:0,best=Math.max(best,last);
  prev.splice(0,b.length+1,...row);
 }
 return best;
}
