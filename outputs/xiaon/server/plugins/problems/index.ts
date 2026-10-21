/** 所有者：zCode（改造二：错题记录与拍照识题）。第一期 A：口述卡点 → 草稿校验 → 学生确认 → 错题记录 + 服务端参考答案。
 * 识别（recognize）是第三期：本阶段保持 not_implemented，路由如实返回 501。 */
import { randomUUID } from 'node:crypto';
import { schemas,SCHEMA_VERSION,type ConfirmProblem,type ProblemDraft,type ProblemRecord,type ProblemSecret,type Recognize,type RecognizeResult,type Validation } from '../../../shared/learning-contracts';
import { notImplemented,type FieldCheck,type RevampContext } from '../context';
import { RuntimeError } from '../../core/errors';
import { questionExpression,parseExpression,linearOf,sameLinear,renderLinear,normalizeSource,variablesOf } from '../generation/expression';
/** 服务端解题提示（只在插件内使用；答案只写 problemSecrets，不回前端、不写日志、不进轨迹原文）。 */
const SOLVE_PROMPT={version:'problem-solve-i1',text:[
 '你是解题核对助手。只处理七年级一次式化简类题目，不解其他内容。',
 '输入data里有question（题目原文）。独立解题，把最终答案写成最简一次式（如 4x+2、-2a+5）。',
 '输出严格JSON {"answer":"最简答案"}，不要任何其他文字。解不出就输出 {"answer":""}。',
].join('\n')} as const;
const KNOWN_POINTS=new Set(['math-language','counterexample','negative-brackets','like-terms','fixed-variable-cost','rotation-2d']);
// 出处匹配：忽略空白与连字符变体、全半角括号、大小写——模型逐字抄写常见差异不算编造。
// 全是标点的“原话”归一后为空串，includes 会恒真，必须排除。
const norm=(s:string)=>normalizeSource(s).replace(/[，。、；：？！“”‘’"'\.,;:?!()（）\[\]{}]/g,'').toLowerCase();
const traceable=(quote:string,texts:string[])=>{const q=norm(quote);return q.length>0&&texts.some(t=>norm(t).includes(q));};
const lenient={source:'spoken' as const,questionText:null,studentWork:null,knowledgePointId:'other',stuckQuote:'',stuckPointId:null,catalogTask:null};
/** probe 阶段模型提议的 problemDraft。程序校验：知识点只认现有 6 个（否则 other）；stuckQuote 必须能在学生本场次原话里找到出处，
 * questionText / studentWork 找不到出处就丢弃该字段；只剩卡点、没有题目或作答的草稿视为不完整，不展示确认卡。 */
export function validateProblemDraft(candidate:unknown,check:FieldCheck):Validation<ProblemDraft>{
 if(!candidate||typeof candidate!=='object')return {ok:false,reasons:['草稿不是对象']};
 const c=candidate as Partial<Record<keyof ProblemDraft,unknown>>&{knowledgePointId?:unknown;stuckQuote?:unknown};
 if(typeof c.stuckQuote!=='string'||!c.stuckQuote.trim())return {ok:false,reasons:['缺少卡点原话']};
 if(!traceable(c.stuckQuote,check.studentTexts))return {ok:false,reasons:['卡点原话找不到学生出处']};
 // 知识点不在现有 6 个之内时改为 other，不采纳模型自造的知识点。
 const knowledgePointId=typeof c.knowledgePointId==='string'&&KNOWN_POINTS.has(c.knowledgePointId)?c.knowledgePointId:'other';
 const pick=(v:unknown):string|null=>typeof v==='string'&&v.trim()&&traceable(v,check.studentTexts)?v.trim():null;
 const questionText=pick(c.questionText),studentWork=pick(c.studentWork);
 const stuckPointId=typeof c.stuckPointId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(c.stuckPointId)?c.stuckPointId:null;
 const catalogRef=c.catalogTask&&typeof c.catalogTask==='object'?schemas.ConfirmProblem.shape.draft.safeParse({source:'spoken',questionText:null,studentWork:null,knowledgePointId:'other',stuckQuote:c.stuckQuote,stuckPointId:null,catalogTask:c.catalogTask}):null;
 const catalogTask=catalogRef?.success?catalogRef.data.catalogTask:null;
 if(!questionText&&!studentWork&&!catalogTask)return {ok:false,reasons:['草稿不完整：没有题目、作答或题库题']};
 const draft={source:'spoken',questionText,studentWork,knowledgePointId,stuckQuote:c.stuckQuote.trim().slice(0,200),stuckPointId,catalogTask};
 const parsed=schemas.ProblemDraft.safeParse(draft);
 return parsed.success?{ok:true,value:parsed.data}:{ok:false,reasons:['草稿不符合契约']};
}
/** 题干里的一次式：优先沿用题库「化简：」格式，再兜底口述里没写冒号的写法（只截取表达式字符）。 */
function extractExpression(questionText:string):string|null{
 const direct=questionExpression(questionText);if(direct!==null)return direct;
 const m=questionText.match(/化简[:：]?\s*([0-9xaXA+\-()（）\s．.−–]+)/);
 return m&&m[1].trim()?m[1].trim():null;
}
/** 两次独立解题的答案是否一致，且在能用 expression.ts 核对时也一致。 */
function solveAgrees(a:string,b:string,questionText:string):{agree:boolean;answer:string|null}{
 if(!a||!b||normalizeSource(a)!==normalizeSource(b))return {agree:false,answer:null};
 let answer=a.trim();
 const q=extractExpression(questionText),pa=parseExpression(a);
 if(q!==null){
  const pq=parseExpression(q);
  if(!pq||!pa||!sameLinear(linearOf(pq),linearOf(pa)))return {agree:false,answer:null};
  const variable=[...variablesOf(pa)][0]??(q.includes('x')?'x':'a');
  answer=renderLinear(linearOf(pa),variable);
 }
 return {agree:true,answer};
}
async function solveOnce(operationId:string,questionText:string,ctx:RevampContext):Promise<string>{
 const {content}=await ctx.model({operationId,prompt:SOLVE_PROMPT,data:{question:questionText},timeoutMs:30_000});
 const match=content.match(/\{[\s\S]*\}/);
 const value=match?JSON.parse(match[0]) as {answer?:unknown}:null;
 return typeof value?.answer==='string'?value.answer.trim().slice(0,500):'';
}
/** 学生确认后写入 problems。参考答案只进 problemSecrets：题库题用题库答案；有题目文字且配了模型时两次独立解题，
 * 一致（且可核对时一致）才记 verified；学生自带的参考答案记 student_provided；其余 unknown 且不写秘密。 */
export async function confirmProblem(input:ConfirmProblem,ctx:RevampContext):Promise<ProblemRecord>{
 const now=ctx.clock.now();
 const record:ProblemRecord={schemaVersion:SCHEMA_VERSION,id:'problem-'+randomUUID(),operationId:input.operationId,...input.draft,sessionId:input.sessionId,answerStatus:'unknown',confirmedAt:now};
 const secret=(answer:string[],origin:ProblemSecret['origin'])=>ctx.repository.append('problemSecrets',{schemaVersion:SCHEMA_VERSION,id:'secret-'+randomUUID(),problemId:record.id,answer,origin,createdAt:now});
 if(input.draft.catalogTask){
  const definition=ctx.catalog.definition(input.draft.catalogTask.taskId,input.draft.catalogTask.taskVersion);
  if(!definition)throw new RuntimeError('not_found','题库里没有这道题');
  secret(definition.answer.map(a=>a.slice(0,500)),'catalog');record.answerStatus='verified';
 }else{
  if(input.referenceAnswer)secret([input.referenceAnswer],'student_provided');
  if(input.draft.questionText&&ctx.providerKind!=='offline'){
   try{
    const [a,b]=await Promise.all([solveOnce(input.operationId+'-solve-1',input.draft.questionText,ctx),solveOnce(input.operationId+'-solve-2',input.draft.questionText,ctx)]);
    const {agree,answer}=solveAgrees(a,b,input.draft.questionText);
    if(agree&&answer){secret([answer],'program_computed');record.answerStatus='verified';}
   }catch{/* 解题失败不影响确认：answerStatus 保持 unknown，不写秘密 */}
  }
 }
 ctx.repository.append('problems',record);
 return record;
}
/** 遮挡后的 JPEG 只转发一次，不存图、不记日志；没有模型时改为手动输入。（第三期实现） */
export async function recognize(input:Recognize,ctx:RevampContext,signal?:AbortSignal):Promise<RecognizeResult>{void input;void ctx;void signal;throw notImplemented('recognize');}
