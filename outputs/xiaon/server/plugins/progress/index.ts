/** 所有者：Claude（改造三：一起思考 + 进步卡）。由 server/agents/learning.ts 委托调用。进步卡是学习记录：不进评分证据；AI 草稿与学生确认文本分开存。 */
import { schemas,SCHEMA_VERSION,type ConfirmProgressCard,type LearningEpisode,type MemoryDraft,type ProgressCard,type ProgressCardDraft } from '../../../shared/learning-contracts';
import { RuntimeError } from '../../core/errors';
import { PROGRESS_CARD_PROMPT } from '../../agents/prompts/reflect';
import type { ProgressDraftInput,RevampContext } from '../context';
const FIELDS=['breakthrough','method','nextTry'] as const;
/** With any help used, a card may never claim the student did it alone (PRD FR17). */
export const SELF_ONLY_PATTERN=/完全靠自己|全靠自己|独立完成|自己推出来|自己想出来|没用提示|没有提示|不靠提示|没靠提示/;
/** Confidence comes only from the student's own self-rating, never from the draft. */
export const CONFIDENCE_CLAIM_PATTERN=/信心|有把握|自信/;
const SKIP_PATTERN=/^(?:先跳过|跳过|不想说|没有|没什么|不知道|嗯+|哦+|好的?)[。！!.]*$/;
const latest=(episode:LearningEpisode,ctx:Pick<RevampContext,'repository'>)=>ctx.repository.get('episodes',episode.id)??episode;
/** A column survives only if it is honest about help, claims no confidence, and every 「quote」 is the student's own words in this episode. */
function honest(value:string|null,helped:boolean,studentTexts:string[]):boolean{
 if(!value)return false;
 if(helped&&SELF_ONLY_PATTERN.test(value))return false;
 if(CONFIDENCE_CLAIM_PATTERN.test(value))return false;
 return [...value.matchAll(/「([^」]+)」/g)].every(m=>studentTexts.some(t=>t.includes(m[1])));
}
/** Program facts for the card when no model text survives. */
function programCard(episode:LearningEpisode,studentTexts:string[]):ProgressCardDraft{
 if(episode.loop){
  const l=episode.loop;return {episodeId:episode.id,breakthrough:episode.studentSolvedAt?'这次的作答已保存，完成情况见片段回顾':'这次先停在这里，尚未用新题核实',method:l.help.length?'这次使用过帮助，帮助记录已保留':null,nextTry:'下次可以用同类新题或隔天复习核对'};
 }
 const helped=episode.helpLevelsUsed.length>0,top=Math.max(0,...episode.helpLevelsUsed);
 const breakthrough=episode.studentSolvedAt?(helped?`在第${top}级提示后算出了结果`:'自己算出了结果')
  :'这次先停在这里，结果尚未核实';
 const reflection=studentTexts.at(-1)?.trim()??'';
 const method=reflection.length>=4&&!SKIP_PATTERN.test(reflection)?`「${reflection.slice(0,60)}」`:null;
 return {episodeId:episode.id,breakthrough,method,nextTry:'下次先把题目条件一条条说出来'};
}
export async function draftProgressCard(input:ProgressDraftInput,ctx:RevampContext,signal?:AbortSignal):Promise<{draft:ProgressCardDraft;memoryDraft:MemoryDraft|null}>{
 if(!input.episode)throw new RuntimeError('invalid_state','没有正在进行的一起思考');
 const episode=latest(input.episode,ctx),helped=episode.helpLevelsUsed.length>0,fallback=programCard(episode,input.studentTexts);
 let candidate=schemas.ProgressCardDraft.safeParse(input.candidate).data;
 if(!candidate&&ctx.providerKind!=='offline'){
  try{const {content}=await ctx.model({operationId:'card-'+episode.id+'-r'+episode.revision,prompt:PROGRESS_CARD_PROMPT,data:{helped,helpLevelsUsed:episode.helpLevelsUsed,solved:!!episode.studentSolvedAt,endReason:episode.endReason,studentTexts:input.studentTexts}},signal);
   candidate=schemas.ProgressCardDraft.safeParse(JSON.parse(content)).data;}
  catch(e){if(signal?.aborted)throw e;/* model unavailable or invalid: program card */}
 }
 const pick=(field:typeof FIELDS[number])=>{const v=candidate?.[field]??null;if(field==='breakthrough')return fallback[field];
  const sourced=field==='method'?!!v&&/^「[^」]+」$/.test(v):!!v&&/^(下次|下一次|可以试试)/.test(v)&&!/(完成|掌握|学会|独立|想通)/.test(v);
  return sourced&&honest(v,helped,input.studentTexts)?v:fallback[field];};
 const draft=schemas.ProgressCardDraft.parse({episodeId:episode.id,breakthrough:pick('breakthrough'),method:pick('method'),nextTry:pick('nextTry')});
 // One memory line distilled from the method (else the breakthrough). Only when the student switched memory on; memory-flow shows and confirms it.
 const source=(draft.method??draft.breakthrough??'').replace(/[「」]/g,'').trim().slice(0,40);
 const memoryDraft=ctx.memoryEnabled()&&source?schemas.MemoryDraft.parse({text:source,kind:'method',origin:'progress_card'}):null;
 return {draft,memoryDraft};
}
/** Saved only on the student's confirm (or skip-all) click, once per episode, and only once the episode reached reflect. */
export async function confirmProgressCard(input:ConfirmProgressCard,ctx:RevampContext):Promise<ProgressCard>{
 const repo=ctx.repository;
 if(!repo.list('chatTurns').some(t=>t.sessionId===input.sessionId)&&!repo.list('episodes').some(e=>e.loop&&e.sessionId===input.sessionId))throw new RuntimeError('not_found','没有这次聊天');
 if(input.episodeId!==null){
  const episode=repo.get('episodes',input.episodeId);
  if(!episode||episode.sessionId!==input.sessionId)throw new RuntimeError('not_found','没有这次一起思考');
  if(episode.stage!=='reflect')throw new RuntimeError('invalid_state','还没到看见进步这一步');
  if(repo.list('progressCards').some(c=>c.episodeId===input.episodeId))throw new RuntimeError('conflict','这次的进步卡已经保存过了');
 }
 if(input.aiDraft&&input.aiDraft.episodeId!==input.episodeId)throw new RuntimeError('invalid_params','草稿与这次一起思考不对应');
 const trimmed=(v:string|null)=>v?.trim()||null;
 const card=schemas.ProgressCard.parse({schemaVersion:SCHEMA_VERSION,id:'card-'+input.operationId,operationId:input.operationId,sessionId:input.sessionId,episodeId:input.episodeId,aiDraft:input.aiDraft,
  breakthrough:trimmed(input.breakthrough),method:trimmed(input.method),nextTry:trimmed(input.nextTry),skipped:FIELDS.filter(f=>!trimmed(input[f])),confidence:input.confidence,confirmedAt:ctx.clock.now()});
 repo.append('progressCards',card);
 const episode=input.episodeId?repo.get('episodes',input.episodeId):null;
 if(episode?.loop)repo.append('episodes',{...episode,revision:episode.revision+1,status:'closed',updatedAt:ctx.clock.now()});
 return card;
}
