/**
 * E1 program validator. Model output is parsed strictly, mapped onto a whitelisted template, and every
 * model-supplied string (expression/answer/steps) is compared with the program's own structure.
 * Only the program-built TaskDefinition can be published.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SCHEMA_VERSION,schemas,type GenerationRecord,type TaskDefinition } from '../../../shared/learning-contracts';
import { checkObjective } from '../assessment/grading';
import { skillDefinitions } from '../assessment/catalog';
import { asciiExpression,fingerprint,isSimplified,linearOf,parseExpression,renderExpression,renderLinear,sameLinear,variablesOf,type Item,type Linear,type Variable } from './expression';
import { ESTIMATED_MINUTES,TEMPLATES,TEMPLATE_VERSION,type Difficulty,type Focus,type KnowledgePointId,type Params } from './templates';
export const VALIDATOR_VERSION='e1-validator-1';
export type Reason=GenerationRecord['candidates'][number]['reasons'][number];
const FOCUS=['bracket_sign_constant','bracket_sign_variable','bracket_plus_inside','bracket_constant_outside','combine_after_expand','combine_coefficients','combine_with_negatives','separate_constants'] as const satisfies readonly Focus[];
const integer=z.number().int().min(-99).max(99);
// Only digits, the two allowed letters, +, minus glyphs, brackets and spaces: no HTML, prose or instructions.
const math=(max:number)=>z.string().min(1).max(max).regex(/^[0-9xa+\-−–() ]+$/);
export const candidateSchema=z.strictObject({
 templateId:z.enum(Object.keys(TEMPLATES) as [string,...string[]]),
 difficulty:z.enum(['introductory','standard','stretch']),
 variable:z.enum(['x','a']),
 params:z.strictObject({a:integer.optional(),b:integer.optional(),c:integer.optional(),d:integer.optional(),k:integer.optional(),terms:z.array(z.strictObject({k:integer,variable:z.boolean()})).max(6).optional()}),
 expression:math(80),answer:math(40),steps:z.array(math(80)).min(1).max(4),
 focus:z.enum(FOCUS),
 evidenceIds:z.array(schemas.StartSession.shape.operationId).max(8),
});
export type Candidate=z.infer<typeof candidateSchema>;
export type ValidationRequest={knowledgePointId:KnowledgePointId;purpose:'practice'|'review';allowedDifficulties:Difficulty[];allowedEvidenceIds:Set<string>;existingFingerprints:Set<string>};
export type Accepted={ok:true;candidate:Candidate;task:TaskDefinition;contentFingerprint:string;parameterFingerprint:string;focus:Focus};
export type Rejected={ok:false;reasons:Reason[];templateId:string|null;difficulty:Difficulty|null;parameterFingerprint:string|null;contentFingerprint:string|null};
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Tolerates a Markdown code fence around the object; nothing else is unwrapped. */
export function parseCandidateText(content:string):unknown{
 if(typeof content!=='string'||content.length>4000)return undefined;
 const trimmed=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return JSON.parse(trimmed);}catch{return undefined;}
}
const exprText=(items:Item[])=>renderExpression(items);
export function buildTask(input:{knowledgePointId:KnowledgePointId;purpose:'practice'|'review';difficulty:Difficulty;items:Item[];answer:Linear;variable:Variable;hint:string;typicalError:Linear|null;contentFingerprint:string}):TaskDefinition{
 const skill=skillDefinitions.find(s=>s.id===input.knowledgePointId)!;
 const answer=renderLinear(input.answer,input.variable);
 const typical=input.typicalError&&!sameLinear(input.typicalError,input.answer)?renderLinear(input.typicalError,input.variable):null;
 return schemas.TaskDefinition.parse({schemaVersion:SCHEMA_VERSION,id:`gen-${input.knowledgePointId}-${input.contentFingerprint.slice(0,16)}`,version:2,
  title:`${skill.label} · 新出的同类题`,question:`化简：${exprText(input.items)}。可写一次式或以等号相连的完整等价步骤。`,choices:[],
  knowledgePoints:[skill.id],primaryDimension:skill.dimension,auxiliaryDimensions:[],familyId:'family-'+skill.id,
  // Same-family numeric variant. "transfer"/"delayed" mirror the static bank's slot only; the generation
  // record states relation=same_family_numeric_variant so no broader transfer is implied.
  variantKind:input.purpose==='review'?'delayed':'transfer',difficulty:input.difficulty,
  prerequisites:input.knowledgePointId==='negative-brackets'?['like-terms']:[],estimatedMinutes:ESTIMATED_MINUTES[input.difficulty],visual:null,
  answer:[answer],rubric:[{id:'result',description:'在受限答案范围内核对最终结果；程序按模板计算的同类换数题',expected:answer,weight:1,requiresExplanation:false}],
  hints:[{id:'hint-1',text:input.hint,level:1}],
  commonErrors:typical?[{id:'typical-error',description:'与典型错误结果一致；只作为待核实线索，不推断心理过程',indicator:typical,certainty:'clue_only'}]:[]});
}
export function validateCandidate(content:string,request:ValidationRequest):Accepted|Rejected{
 const reject=(reasons:Reason[],extra:Partial<Rejected>={}):Rejected=>({ok:false,reasons:[...new Set(reasons)],templateId:null,difficulty:null,parameterFingerprint:null,contentFingerprint:null,...extra});
 const parsed=candidateSchema.safeParse(parseCandidateText(content));
 if(!parsed.success)return reject(['schema_invalid']);
 const c=parsed.data,template=TEMPLATES[c.templateId];
 const parameterFingerprint=sha({templateId:c.templateId,difficulty:c.difficulty,variable:c.variable,params:c.params});
 const meta={templateId:c.templateId,difficulty:c.difficulty,parameterFingerprint};
 if(template.knowledgePointId!==request.knowledgePointId)return reject(['knowledge_point_mismatch'],meta);
 const params=Object.fromEntries(Object.entries(c.params).filter(([,v])=>v!==undefined)) as Params;
 const reasons:Reason[]=[...template.check(params,c.difficulty)];
 if(!request.allowedDifficulties.includes(c.difficulty))reasons.push('difficulty_not_allowed');
 if(!template.focus.includes(c.focus))reasons.push('focus_not_allowed');
 if(c.evidenceIds.some(id=>!request.allowedEvidenceIds.has(id)))reasons.push('evidence_reference_invalid');
 if(reasons.includes('params_invalid')||reasons.includes('params_out_of_range'))return reject(reasons,meta);
 const built=template.build(params,c.variable);
 const contentFingerprint=fingerprint(request.knowledgePointId,built.items);
 const withContent={...meta,contentFingerprint};
 if(!built.covers.includes(c.focus))reasons.push('focus_not_allowed');
 // Model strings are checked against the program structure. They are never displayed or stored.
 const only=(items:Item[])=>[...variablesOf(items)].every(v=>v===c.variable);
 const modelExpression=parseExpression(c.expression);
 if(!modelExpression||!only(modelExpression)||fingerprint(request.knowledgePointId,modelExpression)!==contentFingerprint)reasons.push('expression_mismatch');
 const modelAnswer=parseExpression(c.answer);
 if(!modelAnswer||!only(modelAnswer)||!isSimplified(modelAnswer)||!sameLinear(linearOf(modelAnswer),built.answer))reasons.push('answer_mismatch');
 const steps=c.steps.map(parseExpression);
 if(steps.some(s=>!s||!only(s)||!sameLinear(linearOf(s),built.answer)))reasons.push('steps_invalid');
 const last=steps.at(-1);
 if(!last||!only(last)||!isSimplified(last)||!sameLinear(linearOf(last),built.answer))reasons.push('steps_final_mismatch');
 if(request.existingFingerprints.has(contentFingerprint))reasons.push('duplicate_content');
 if(reasons.length)return reject(reasons,withContent);
 const task=buildTask({knowledgePointId:request.knowledgePointId,purpose:request.purpose,difficulty:c.difficulty,items:built.items,answer:built.answer,variable:c.variable,hint:built.hint,typicalError:built.typicalError,contentFingerprint});
 // The existing grader must accept the program answer and the full expression as an equivalent step,
 // and must not accept the typical error. Otherwise the task would be ungradable in the product.
 const objective=(value:string)=>checkObjective(task,value).status;
 const graderOk=objective(task.answer[0])==='supported'&&objective(asciiExpression(built.items))==='supported'&&task.commonErrors.every(e=>objective(e.indicator)==='unsupported');
 if(!graderOk)return reject(['grader_unsupported'],withContent);
 return{ok:true,candidate:c,task,contentFingerprint,parameterFingerprint,focus:c.focus};
}
export { TEMPLATE_VERSION };
