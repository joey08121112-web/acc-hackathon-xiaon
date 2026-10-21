/**
 * E1 whitelisted templates. The program alone builds the expression, answer, hint and typical error
 * from integer parameters; model text is only compared against this structure, never published.
 */
import type { Item,Linear,Term,Variable } from './expression';
import { linearOf,renderExpression } from './expression';
export const TEMPLATE_VERSION='e1-templates-1';
export type Difficulty='introductory'|'standard'|'stretch';
export type KnowledgePointId='negative-brackets'|'like-terms';
export type Focus='bracket_sign_constant'|'bracket_sign_variable'|'bracket_plus_inside'|'bracket_constant_outside'|'combine_after_expand'|'combine_coefficients'|'combine_with_negatives'|'separate_constants';
export type Reason='params_invalid'|'params_out_of_range'|'difficulty_not_allowed'|'degenerate_variable_cancels'|'degenerate_constant_cancels'|'not_covering_target'|'focus_not_allowed';
export type Params={a?:number;b?:number;c?:number;d?:number;k?:number;terms?:{k:number;variable:boolean}[]};
export const GENERATION_KNOWLEDGE_POINTS=['negative-brackets','like-terms'] as const;
export const ESTIMATED_MINUTES:Record<Difficulty,number>={introductory:2,standard:3,stretch:4};
/** Per-difficulty magnitude ceiling for every coefficient/constant; keeps arithmetic small for grade 7. */
export const MAGNITUDE_LIMIT:Record<Difficulty,number>={introductory:9,standard:12,stretch:15};
type Built={items:Item[];answer:Linear;hint:string;typicalError:Linear|null;covers:Focus[]};
export type TemplateSpec={
 id:string;knowledgePointId:KnowledgePointId;difficulties:Difficulty[];description:string;
 params:Record<string,string>;focus:Focus[];
 check(p:Params,d:Difficulty):Reason[];
 build(p:Params,v:Variable):Built;
};
const T=(k:number,v:Variable|null):Term=>({k,v});
const ints=(p:Params,keys:string[]):Reason[]=>{
 const present=Object.keys(p).filter(k=>p[k as keyof Params]!==undefined);
 if(present.length!==keys.length||keys.some(k=>!Number.isInteger(p[k as keyof Params])))return['params_invalid'];
 return[];
};
const range=(values:number[],min:number,max:number)=>values.some(n=>n<min||n>max)?['params_out_of_range' as const]:[];
const flipText=(terms:Term[],v:Variable)=>renderExpression(terms.map(t=>({kind:'term' as const,term:{k:-t.k,v:t.v?v:null}})));
function bracket(id:string,difficulties:Difficulty[],description:string,keys:string[],focus:Focus[],shape:(p:Required<Pick<Params,'a'|'b'|'c'|'d'|'k'>>,v:Variable)=>{outer:Term[];inner:Term[];typicalError:Linear},extra:(p:Params,d:Difficulty)=>Reason[]=()=>[]):TemplateSpec{
 return{id,knowledgePointId:'negative-brackets',difficulties,description,params:Object.fromEntries(keys.map(k=>[k,'整数'])),focus,
  check(p,d){
   const shapeErrors=ints(p,keys);if(shapeErrors.length)return shapeErrors;
   const values=keys.map(k=>p[k as keyof Params] as number);
   const reasons:Reason[]=[...range(values,1,MAGNITUDE_LIMIT[d])];
   if(!this.difficulties.includes(d))reasons.push('difficulty_not_allowed');
   return[...reasons,...extra(p,d)];
  },
  build(p,v){
   const full={a:p.a??0,b:p.b??0,c:p.c??0,d:p.d??0,k:p.k??0};const s=shape(full,v);
   const items:Item[]=[...s.outer.map(term=>({kind:'term' as const,term})),{kind:'group',sign:-1,terms:s.inner}];
   return{items,answer:linearOf(items),typicalError:s.typicalError,covers:focus,hint:`括号前是减号：−(${renderExpression(s.inner.map(term=>({kind:'term',term})))}) = ${flipText(s.inner,v)}，括号里每一项都变号，再合并同类项。`};
  }};
}
export const TEMPLATES:Record<string,TemplateSpec>={
 'nb-basic':bracket('nb-basic',['introductory','standard'],'a·v − (b·v − c)，结果 (a−b)·v + c',['a','b','c'],['bracket_sign_constant','bracket_sign_variable'],
  ({a,b,c},v)=>({outer:[T(a,v)],inner:[T(b,v),T(-c,null)],typicalError:{v:a-b,c:-c}}),
  ({a,b},d)=>[...(a===b?['degenerate_variable_cancels' as const]:[]),...(d==='introductory'&&(a??0)<=(b??0)?['difficulty_not_allowed' as const]:[])]),
 'nb-plus':bracket('nb-plus',['standard','stretch'],'a·v − (b·v + c)，结果 (a−b)·v − c',['a','b','c'],['bracket_plus_inside','bracket_sign_constant'],
  ({a,b,c},v)=>({outer:[T(a,v)],inner:[T(b,v),T(c,null)],typicalError:{v:a-b,c}}),
  ({a,b})=>a===b?['degenerate_variable_cancels']:[]),
 'nb-const-first':bracket('nb-const-first',['standard','stretch'],'k − (b·v − c)，结果 −b·v + (k+c)',['k','b','c'],['bracket_constant_outside','bracket_sign_variable'],
  ({k,b,c},v)=>({outer:[T(k,null)],inner:[T(b,v),T(-c,null)],typicalError:{v:-b,c:k-c}}),
  ({b})=>(b??0)<2?['params_out_of_range']:[]),
 'nb-tail':bracket('nb-tail',['stretch'],'a·v + d − (b·v − c)，结果 (a−b)·v + (d+c)',['a','d','b','c'],['bracket_sign_constant','combine_after_expand'],
  ({a,b,c,d},v)=>({outer:[T(a,v),T(d,null)],inner:[T(b,v),T(-c,null)],typicalError:{v:a-b,c:d-c}}),
  ({a,b})=>a===b?['degenerate_variable_cancels']:[]),
 'lt-terms':{id:'lt-terms',knowledgePointId:'like-terms',difficulties:['introductory','standard','stretch'],description:'按顺序给出3–5项，每项为带符号整数系数，variable=true表示含字母；至少2个字母项与1个常数项',params:{terms:'[{k:非零整数,variable:布尔}]'},focus:['combine_coefficients','combine_with_negatives','separate_constants'],
  check(p,d){
   const keys=Object.keys(p).filter(k=>p[k as keyof Params]!==undefined);
   if(keys.length!==1||!Array.isArray(p.terms))return['params_invalid'];
   const terms=p.terms;const length={introductory:[3,3],standard:[4,4],stretch:[4,5]}[d];
   const reasons:Reason[]=[];
   if(terms.some(t=>!Number.isInteger(t.k)||t.k===0||typeof t.variable!=='boolean'))return['params_invalid'];
   if(terms.length<length[0]||terms.length>length[1]||terms.some(t=>Math.abs(t.k)>MAGNITUDE_LIMIT[d]))reasons.push('params_out_of_range');
   const vars=terms.filter(t=>t.variable),consts=terms.filter(t=>!t.variable);
   if(vars.length<2||consts.length<1)reasons.push('not_covering_target');
   if(vars.length&&vars.reduce((s,t)=>s+t.k,0)===0)reasons.push('degenerate_variable_cancels');
   if(consts.length>1&&consts.reduce((s,t)=>s+t.k,0)===0)reasons.push('degenerate_constant_cancels');
   if(d==='introductory'&&vars.some(t=>t.k<0))reasons.push('difficulty_not_allowed');
   return reasons;
  },
  build(p,v){
   const terms=(p.terms??[]).map(t=>T(t.k,t.variable?v:null));const items:Item[]=terms.map(term=>({kind:'term',term}));
   const vars=terms.filter(t=>t.v),consts=terms.filter(t=>!t.v);
   const show=(ts:Term[])=>ts.map((t,i)=>renderExpression([{kind:'term',term:t}])+(i<ts.length-1?'、':'')).join('');
   const anyNegativeVariable=vars.some(t=>t.k<0);
   const typicalError=anyNegativeVariable?{v:vars.reduce((s,t)=>s+Math.abs(t.k),0),c:consts.reduce((s,t)=>s+t.k,0)}:null;
   return{items,answer:linearOf(items),typicalError,covers:anyNegativeVariable?['combine_coefficients','combine_with_negatives','separate_constants']:['combine_coefficients','separate_constants'],hint:`${v} 的项是 ${show(vars)}；常数是 ${show(consts)}。各自带着前面的符号合并。`};
  }},
};
export const templatesFor=(knowledgePointId:KnowledgePointId)=>Object.values(TEMPLATES).filter(t=>t.knowledgePointId===knowledgePointId);
