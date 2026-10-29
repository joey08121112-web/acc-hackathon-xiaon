/** 记忆整理：学生空闲时，把还没整理的自由聊对话交给模型，模型只能回几种固定操作，服务端逐条校验后再改档案。
 * 白天聊天不提取，回复不变慢；学生改过的条目、删掉过的内容和敏感内容都由这里兜底。 */
import { z } from 'zod';
import type { ModelProvider } from '../../shared/learning-contracts';
import { ITEMS_PER_KIND_MAX,ITEM_TEXT_MAX,PROFILE_KINDS,RECENT_DAYS,type ConsolidationChange,type ProfileKind } from '../../shared/free-chat';
import { RuntimeError } from '../core/errors';
import type { FreeChatStore } from './store';
export const CONSOLIDATE_PROMPT=`你在帮学伴小N 整理它和一个初中生的聊天记录，把值得长期记住的小事整理进这个学生的个人档案。

档案分四类（kind）：
- about：关于他的稳定事实，比如“有个妹妹”“养了一只猫”
- interest：他喜欢做、喜欢看、喜欢玩的，比如“喜欢打篮球”“在看《三体》”
- recent：最近要发生或刚发生的事，比如“下周有篮球赛”。同时给 expiresInDays（1 到 30），表示几天后这件事就没必要再记了
- method：对他有用的学习方法，比如“画个图更容易懂”

怎么记：
- 只记学生自己明确说的。小N 说的、小N 猜的、学生随口一提或者拿不准的，都不记。
- 绝对不记：心事和情绪、家庭矛盾、身体和健康、恋爱、和别人的冲突，以及学校名字、住址、电话这类能认出他是谁的信息。
- 现有条目里已经有的，这次又聊到了，用 mention，不要重复 add。
- 现有条目的内容有了变化（比如“在学吉他”变成“吉他考过三级了”），用 update。
- 他明确说不喜欢了、不玩了，用 past。
- 新的事用 add。text 写成简短的短语，不超过 20 个字，省略主语，不写“他”“学生”，比如“下周五合唱比赛当领唱”。
- “他删掉过的”是他自己从档案里删掉的，不要再 add，除非他在这次的对话里又主动明确聊起。
- 最多 10 条操作。没有值得记的，就返回 {"ops":[]}。

只输出 JSON，不要任何别的文字。格式：
{"ops":[{"op":"add","kind":"interest","text":"喜欢打篮球"},{"op":"add","kind":"recent","text":"下周有篮球赛","expiresInDays":10},{"op":"mention","id":"条目id"},{"op":"update","id":"条目id","text":"新的内容"},{"op":"past","id":"条目id"}]}`;
export const CONVERSATION_MAX=8000,MAX_OPS=10,MAX_FAILURES=3;
/** 空闲多久开始整理，默认 3 小时；也可以用 XIAON_FC_IDLE_MIN 调（分钟）。 */
export function idleMsFromEnv(env:Readonly<Record<string,string|undefined>>=process.env){
 const raw=env.XIAON_FC_IDLE_MIN?.trim();const minutes=raw?Number(raw):180;
 if(!Number.isFinite(minutes)||minutes<0||minutes>10080)throw new RuntimeError('invalid_params','XIAON_FC_IDLE_MIN 必须是 0 到 10080 的分钟数');
 return minutes*60000;
}
const DAY=86400000;
const shanghaiDay=(iso:string)=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
const SENSITIVE=/自杀|自残|想死|割腕|跳楼|抑郁|焦虑|难过|伤心|害怕|生病|病了|住院|吃药|过敏|离婚|吵架|打我|家暴|欺负|霸凌|恋爱|男朋友|女朋友|暗恋|地址|住在|小区|门牌|电话|手机号|微信号|QQ号|身份证|学校叫|在.{1,8}(中学|小学|学校)上学|\d{6,}/;
const normalize=(s:string)=>s.replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
/** 同一件事的不同说法：“喜欢打篮球”和“打篮球”算一件。 */
export function similar(a:string,b:string){const x=normalize(a),y=normalize(b);if(!x||!y)return false;return x===y||(Math.min(x.length,y.length)>=2&&(x.includes(y)||y.includes(x)));}
const text=z.string().trim().min(1).max(ITEM_TEXT_MAX);
const opSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('add'),kind:z.enum(PROFILE_KINDS),text,expiresInDays:z.number().int().min(1).max(30).optional()}),
 z.object({op:z.literal('mention'),id:z.string()}),
 z.object({op:z.literal('update'),id:z.string(),text}),
 z.object({op:z.literal('past'),id:z.string()}),
]);
type Op=z.infer<typeof opSchema>;
/** 模型有时会包一层 ```json；取第一个 { 到最后一个 }。整段解析不了返回 null；单条操作格式不对就丢掉这一条。 */
export function parseOps(raw:string):Op[]|null{
 const start=raw.indexOf('{'),end=raw.lastIndexOf('}');if(start<0||end<start)return null;
 let data:unknown;try{data=JSON.parse(raw.slice(start,end+1));}catch{return null;}
 const ops=(data as {ops?:unknown})?.ops;if(!Array.isArray(ops))return null;
 return ops.slice(0,MAX_OPS).flatMap(o=>{const p=opSchema.safeParse(o);return p.success?[p.data]:[];});
}
/** 是否该在后台整理：开关开着、有没整理的对话，并且最后一句已经空闲够久或者已经过了一天。 */
export function shouldConsolidate(store:FreeChatStore,now:string,idleMs:number){
 if(!store.autoRemember())return false;
 const last=store.pendingMessages().at(-1);if(!last)return false;
 return Date.parse(now)-Date.parse(last.createdAt)>=idleMs||shanghaiDay(last.createdAt)!==shanghaiDay(now);
}
function modelInput(store:FreeChatStore,pending:ReturnType<FreeChatStore['pendingMessages']>,now:string){
 const profile=store.profile(),forgotten=store.forgotten();
 const items=profile.items.map(i=>`- [${i.id}] ${i.kind}${i.status==='past'?'（以前喜欢）':''}：${i.text}（最近提到 ${shanghaiDay(i.lastMentionedAt)}）`);
 // 对话太长时保留最近的部分。
 const lines:string[]=[];let size=0;
 for(const m of [...pending].reverse()){const line=`${m.role==='user'?'学生':'小N'}（${shanghaiDay(m.createdAt)}）：${m.content}`;if(size+line.length>CONVERSATION_MAX&&lines.length)break;lines.unshift(line);size+=line.length;}
 return [`今天是 ${shanghaiDay(now)}。`,`现有条目：\n${items.join('\n')||'（没有）'}`,`他删掉过的：\n${forgotten.map(f=>`- ${f.kind}：${f.text}`).join('\n')||'（没有）'}`,`这次要整理的对话：\n${lines.join('\n')}`].join('\n\n');
}
/** 逐条校验并执行，返回真正生效的改动。整个过程在一个事务里，和学生在档案页的修改不会交错。 */
function apply(store:FreeChatStore,ops:Op[],pending:ReturnType<FreeChatStore['pendingMessages']>,now:string):ConsolidationChange[]{
 const changes:ConsolidationChange[]=[],touched=new Set<string>();
 const userLines=pending.filter(m=>m.role==='user');
 const mention=(id:string,kind:ProfileKind,text:string)=>{if(touched.has(id))return;touched.add(id);store.mention(id);changes.push({op:'mention',itemId:id,kind,text});};
 for(const op of ops){
  if(op.op==='add'){
   if(SENSITIVE.test(op.text))continue;
   const profile=store.profile();
   const same=profile.items.find(i=>i.kind===op.kind&&similar(i.text,op.text));
   if(same){mention(same.id,same.kind,same.text);continue;}
   // 学生删掉过的：只有删掉之后他又在对话里说起，才能再记。
   const deleted=store.forgotten().find(f=>f.kind===op.kind&&similar(f.text,op.text));
   if(deleted&&!userLines.some(m=>m.createdAt>deleted.deletedAt))continue;
   if(store.countKind(op.kind)>=ITEMS_PER_KIND_MAX)continue;
   const expiresAt=op.kind==='recent'?new Date(Date.parse(now)+(op.expiresInDays??RECENT_DAYS)*DAY).toISOString():null;
   const id=store.insert({kind:op.kind,text:op.text,source:'chat',editedByStudent:false,expiresAt});
   touched.add(id);changes.push({op:'add',itemId:id,kind:op.kind,text:op.text});continue;
  }
  const item=store.item(op.id);if(!item||touched.has(item.id))continue;
  if(op.op==='mention'){mention(item.id,item.kind,item.text);continue;}
  // 学生自己加的、改过的条目，整理只能记一次“又提到了”。
  if(item.editedByStudent)continue;
  if(op.op==='update'){
   if(SENSITIVE.test(op.text)||op.text===item.text)continue;
   touched.add(item.id);store.chatUpdate(item.id,op.text);changes.push({op:'update',itemId:item.id,kind:item.kind,text:op.text});
  }else if(item.kind==='interest'&&item.status==='active'){
   touched.add(item.id);store.chatPast(item.id);changes.push({op:'past',itemId:item.id,kind:item.kind,text:item.text});
  }
 }
 return changes;
}
/** 整理一次。模型调用失败（网络、限流）直接抛出，不算一次失败，下次再试；模型回的内容解析不了才算失败，连续 MAX_FAILURES 次就跳过这批对话。 */
export async function consolidate(store:FreeChatStore,provider:ModelProvider,now:()=>string,signal:AbortSignal):Promise<{status:'ok'|'failed'|'skipped'|'empty'|'off';changes:ConsolidationChange[]}>{
 if(!store.autoRemember())return{status:'off',changes:[]};
 const pending=store.pendingMessages();if(!pending.length)return{status:'empty',changes:[]};
 if(provider.kind==='offline')throw new RuntimeError('unavailable','还没有连接模型，暂时整理不了');
 const upTo=pending.at(-1)!.rowid;
 const out=await provider.complete({messages:[{role:'system',content:CONSOLIDATE_PROMPT},{role:'user',content:modelInput(store,pending,now())}],tools:[],signal});
 const ops=parseOps(out.content);
 if(!ops){
  return store.transaction(()=>{
   store.recordRun('failed',upTo,[]);
   if(store.consecutiveFailures()<MAX_FAILURES)return{status:'failed' as const,changes:[]};
   store.markConsolidated(upTo);store.recordRun('skipped',upTo,[]);return{status:'skipped' as const,changes:[]};
  });
 }
 return store.transaction(()=>{
  const changes=apply(store,ops,pending,now());
  store.markConsolidated(upTo);store.recordRun('ok',upTo,changes);return{status:'ok' as const,changes};
 });
}
