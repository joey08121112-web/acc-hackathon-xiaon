/**
 * E1 restricted expression structure. Independent from src/data.ts so a model string is never
 * "proved" by the same comparator that later grades students. Grammar (no eval, no products):
 *   expr  := [+|-] item ( (+|-) item )*
 *   item  := term | "(" [+|-] term ( (+|-) term )* ")"
 *   term  := digits [x|a] | x | a        (integers only, no leading zeros, no nested brackets)
 */
import { createHash } from 'node:crypto';
export type Variable='x'|'a';
export type Term={k:number;v:Variable|null};
export type Item={kind:'term';term:Term}|{kind:'group';sign:1|-1;terms:Term[]};
export type Linear={v:number;c:number};
export const MAX_SOURCE_LENGTH=80;
const MINUS=/[−–—﹣－]/g;
export function normalizeSource(source:string){return source.replace(MINUS,'-').replace(/＋/g,'+').replace(/（/g,'(').replace(/）/g,')').replace(/\s+/g,'');}
/** Returns null for anything outside the grammar (including decimals, *, nested brackets, other letters). */
export function parseExpression(raw:string):Item[]|null{
 if(typeof raw!=='string'||raw.length>MAX_SOURCE_LENGTH)return null;
 const s=normalizeSource(raw);if(!s||!/^[0-9xa+\-()]+$/.test(s))return null;
 let pos=0;
 const sign=():1|-1|null=>{if(s[pos]==='+'){pos++;return 1;}if(s[pos]==='-'){pos++;return -1;}return null;};
 const term=(sg:1|-1):Term|null=>{
  const m=s.slice(pos).match(/^(0|[1-9]\d{0,3})?([xa])?/);if(!m||(!m[1]&&!m[2]))return null;
  pos+=m[0].length;const k=m[1]?Number(m[1]):1;if(m[1]==='0'&&m[2])return null;
  return{k:sg*k,v:(m[2] as Variable|undefined)??null};
 };
 const items:Item[]=[];
 let first=true;
 while(pos<s.length){
  let sg=sign();
  if(sg===null){if(!first)return null;sg=1;}
  if(s[pos]==='('){
   pos++;const terms:Term[]=[];let innerFirst=true;
   while(pos<s.length&&s[pos]!==')'){
    let ts=sign();if(ts===null){if(!innerFirst)return null;ts=1;}
    const t=term(ts);if(!t)return null;terms.push(t);innerFirst=false;
   }
   if(s[pos]!==')'||terms.length<2)return null;pos++;
   items.push({kind:'group',sign:sg,terms});
  }else{const t=term(sg);if(!t)return null;items.push({kind:'term',term:t});}
  first=false;
 }
 return items.length?items:null;
}
export function variablesOf(items:Item[]):Set<Variable>{
 const out=new Set<Variable>();for(const i of items)for(const t of i.kind==='term'?[i.term]:i.terms)if(t.v)out.add(t.v);return out;
}
export function linearOf(items:Item[]):Linear{
 let v=0,c=0;
 for(const i of items){const sg=i.kind==='term'?1:i.sign;for(const t of i.kind==='term'?[i.term]:i.terms){if(t.v)v+=sg*t.k;else c+=sg*t.k;}}
 return{v,c};
}
export const sameLinear=(a:Linear,b:Linear)=>a.v===b.v&&a.c===b.c;
/** A simplified result has no brackets and at most one variable term and one constant term. */
export function isSimplified(items:Item[]){return items.every(i=>i.kind==='term')&&items.filter(i=>i.kind==='term'&&i.term.v).length<=1&&items.filter(i=>i.kind==='term'&&!i.term.v).length<=1;}
const termText=(t:Term,leading:boolean)=>{
 const mag=Math.abs(t.k);const body=t.v?(mag===1?t.v:`${mag}${t.v}`):`${mag}`;
 return leading?(t.k<0?'−'+body:body):(t.k<0?` − ${body}`:` + ${body}`);
};
/** Student-facing rendering with typographic minus, matching the static bank style. */
export function renderExpression(items:Item[]):string{
 return items.map((i,index)=>{
  if(i.kind==='term')return termText(i.term,index===0);
  const inner=i.terms.map((t,j)=>termText(t,j===0)).join('');
  const prefix=index===0?(i.sign<0?'−':''):(i.sign<0?' − ':' + ');
  return `${prefix}(${inner})`;
 }).join('');
}
/** ASCII canonical answer accepted by the existing grading parser, e.g. 4x+2, -2a+5, 3x-7. */
export function renderLinear(l:Linear,variable:Variable):string{
 const parts:string[]=[];
 if(l.v!==0)parts.push(l.v===1?variable:l.v===-1?'-'+variable:`${l.v}${variable}`);
 if(l.c!==0)parts.push(parts.length?(l.c>0?`+${l.c}`:`${l.c}`):`${l.c}`);
 return parts.join('')||'0';
}
export const asciiExpression=(items:Item[])=>normalizeSource(renderExpression(items));
/**
 * Content fingerprint: order-insensitive multiset of top-level items, bracket contents sorted,
 * variable letter erased. Whitespace, minus glyphs, term order and x/a swaps therefore collide.
 */
export function structureKey(items:Item[]):string{
 const t=(x:Term)=>[x.k,x.v?'v':''];
 const keyed=items.map(i=>i.kind==='term'?JSON.stringify(['t',...t(i.term)]):JSON.stringify(['g',i.sign,i.terms.map(t).map(x=>JSON.stringify(x)).sort()]));
 return JSON.stringify(keyed.sort());
}
export const fingerprint=(knowledgePointId:string,items:Item[])=>createHash('sha256').update(knowledgePointId+'|'+structureKey(items)).digest('hex');
/** Extract the expression of a bank question such as "化简：7a − (3a − 2)。…"; null when not this form. */
export function questionExpression(question:string):string|null{
 const m=question.match(/^化简：([^。]+)/);return m?m[1].trim():null;
}
