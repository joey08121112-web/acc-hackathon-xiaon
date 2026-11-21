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
/** 敏感词表：六类跟界面承诺一致（情绪心事、家庭矛盾、身体健康、恋爱、人际冲突、能认出身份的信息）。
 * 词表只是第一道；真正的保证在后两道——add/update/mention 必须有学生原话做证据，且证据原话本身也要过这张表：
 * 模型把条目文本洗干净了（「呼吸不太好」）、原话里带着「哮喘」的，一样不入档。判不准就不记。
 *
 * 2026-11-21 补洞。原表漏了未成年人身份信息里最常出现的四类，用四句最普通的日常说法实测确认过会漏：
 * 「我在实验中学」「我上次考试考了58分」「我家在文昌路12号」「我爸妈在杭州上班」——全部两道门都过。
 * 界面承诺（见 CONSOLIDATE_PROMPT）本来就写了"绝对不记……学校名字、住址、电话这类能认出他是谁的信息"，
 * 是词表没兑现承诺，不是策略变了。
 * 分组写开是为了能逐组加词、逐组写断言。匹配语义不变：任一组命中即拦。
 * 取舍原则按 R1-R6 定下的那条走：少记不伤学生，错记伤学生——宁可多拦一点。 */
const SENSITIVE_GROUPS:readonly RegExp[]=[
 // 情绪心事
 /自杀|自残|想死|不想活|割腕|跳楼|抑郁|焦虑|难过|伤心|害怕|想哭|委屈|孤单|孤独|自卑|紧张|压力|崩溃|烦躁|emo|心情|情绪|心事/i,
 // 家庭矛盾
 /离婚|吵架|打架|家暴|打我|骂我|离家出走|后爸|后妈|继父|继母/i,
 // 身体健康
 /哮喘|感冒|发烧|发热|咳嗽|头疼|头痛|头晕|肚子疼|肚子痛|拉肚子|呕吐|恶心|胃炎|近视|散光|牙疼|拔牙|蛀牙|过敏|湿疹|荨麻疹|骨折|扭伤|受伤|缝针|手术|住院|医院|看病|就诊|复诊|体检|打针|疫苗|吃药|服药|生病|病了|不舒服|身体/i,
 // 恋爱
 /恋爱|男朋友|女朋友|暗恋|表白|早恋|处对象|牵手/i,
 // 人际冲突
 /欺负|霸凌|孤立|绝交|闹翻|被骂|被打|冲突/i,
 // 能认出他是谁：身份标识与联系方式
 /身份证|学号|电话|手机号|微信号|QQ号|名字|姓名|叫什么|我叫|学校叫|\d{6,}/i,
 // 补①：学校名与学校关系。条目文本会省略主语（「在实验中学」），所以学校名词本身就要拦，不靠「我」起头。
 /(中学|小学|初中|高中|幼儿园|校区|分校)|(附中|一中|二中|三中|四中|五中|外国语)|学籍|转学|升学|班主任|班级|校服|校徽|校车|校庆/i,
 // 补②：成绩与排名。裸「有考试」不拦——那是日程事实可以记；分数和排名是能力标签，必须拦。
 /考了\s*\d+\s*分|得分|分数|成绩|排名|平均分|满分|及格|挂科|考砸|班级第|年级第/i,
 // 补③：住址。要求家/住/搬的语境，避免误伤「走路」「上街」「城市」这类普通词。
 /(我家|我们家|家里|家住|住在|住|家在|搬到|搬去|老家).{0,10}(路|街|巷|弄|市|省|县|区)|\d+号楼|\d+单元|\d+室|\d+栋|\d+座|\d+号院/i,
 // 补④：家长的联系方式与工作地。家长存在本身可记（「有个妹妹」是允许的事实），联系方式与所在地不可。
 /(爸妈|爸爸|妈妈|父母|家长|爷爷奶奶|外公外婆).{0,10}(电话|手机|微信|住址|地址|工作|上班|单位)/i,
];
/** 任一组命中即视为敏感。 */
const isSensitive=(text:string)=>SENSITIVE_GROUPS.some(g=>g.test(text));
const normalize=(s:string)=>s.replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
/** 保守核验完整短语，只忽略空白与标点；不删内容词，也不靠两字重合或无序单字推断事实。
 * 同义改写无法核验时宁可少记。否定、疑问及敏感原话不作自动记忆的依据。 */
const UNCERTAIN=/不|没|别|讨厌|假如|如果|也许|可能|听说|他说|她说|吗|么|？|\?/;
export function evidenceLine(text:string,userLines:readonly{content:string;createdAt:string;threadId?:string}[]){
 const t=normalize(text);
 if(t.length<2||isSensitive(text))return null;
 return [...userLines].reverse().find(m=>!isSensitive(m.content)&&!UNCERTAIN.test(m.content)&&normalize(m.content).includes(t))??null;
}
/** 删除后必须有明确支持同一完整事实的原话；无关的“喜欢”不能恢复已删除内容。 */
const REVIVE=/喜欢|爱|迷|想玩|想学|又想|又开始|还是|重新|接着|在玩/;
function revivalEvidence(userLines:readonly{content:string;createdAt:string;threadId?:string}[],deleted:{text:string;deletedAt:string}){
 return evidenceLine(deleted.text,userLines.filter(m=>m.createdAt>deleted.deletedAt&&REVIVE.test(m.content)));
}
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
/** 逐条校验并执行，返回真正生效的改动。整个过程在一个事务里，和学生在档案页的修改不会交错。
 * 三道门（R3/R5）：品类词表 → 学生原话证据（证据原话也要过词表）→ 删掉过的要有“重新聊起”的证据。 */
function apply(store:FreeChatStore,ops:Op[],pending:ReturnType<FreeChatStore['pendingMessages']>,now:string):ConsolidationChange[]{
 const changes:ConsolidationChange[]=[],touched=new Set<string>();
 const userLines=pending.filter(m=>m.role==='user');
 const mention=(id:string,kind:ProfileKind,text:string)=>{if(touched.has(id))return;touched.add(id);store.mention(id);changes.push({op:'mention',itemId:id,kind,text});};
 for(const op of ops){
  if(op.op==='add'){
   if(isSensitive(op.text))continue;
   const evidence=evidenceLine(op.text,userLines);
   if(!evidence||isSensitive(evidence.content))continue;
   const profile=store.profile();
   const same=profile.items.find(i=>i.kind===op.kind&&similar(i.text,op.text));
   if(same){mention(same.id,same.kind,same.text);continue;}
   // 学生删掉过的：删掉之后他又主动聊起这件事，才能再记（R3）。
   const deleted=store.forgotten().find(f=>f.kind===op.kind&&similar(f.text,op.text));
   if(deleted&&!revivalEvidence(userLines,deleted))continue;
   if(store.countKind(op.kind)>=ITEMS_PER_KIND_MAX)continue;
   const expiresAt=op.kind==='recent'?new Date(Date.parse(now)+(op.expiresInDays??RECENT_DAYS)*DAY).toISOString():null;
   const id=store.insert({kind:op.kind,text:op.text,source:'chat',editedByStudent:false,expiresAt,originThreadId:evidence.threadId??null,evidenceQuote:evidence.content});
   touched.add(id);changes.push({op:'add',itemId:id,kind:op.kind,text:op.text});continue;
  }
  const item=store.item(op.id);if(!item||touched.has(item.id))continue;
  // “又提到了”必须真的提到：条目内容要能在学生原话里找到依据。
  if(op.op==='mention'){if(evidenceLine(item.text,userLines))mention(item.id,item.kind,item.text);continue;}
  // 学生自己加的、改过的条目，整理只能记一次“又提到了”。
  if(item.editedByStudent)continue;
  if(op.op==='update'){
   if(isSensitive(op.text)||op.text===item.text)continue;
   const evidence=evidenceLine(op.text,userLines);if(!evidence)continue;
   touched.add(item.id);
   // 2026-11-21：不原地覆盖。旧条目标失效保留，新内容另起一条（学生能看见「之前记的是什么」）。
   const newId=store.chatUpdate(item.id,op.text,{threadId:evidence.threadId??null,evidenceQuote:evidence.content});
   touched.add(newId);
   changes.push({op:'update',itemId:newId,kind:item.kind,text:op.text});
  }else if(item.kind==='interest'&&item.status==='active'){
   touched.add(item.id);store.chatPast(item.id);changes.push({op:'past',itemId:item.id,kind:item.kind,text:item.text});
  }
 }
 return changes;
}
/** 整理一次。模型调用失败（网络、限流）直接抛出，不算一次失败，下次再试；模型回的内容解析不了才算失败，连续 MAX_FAILURES 次就跳过这批对话。
 * R1/R2：调模型前记下数据代次和记忆代次，落库前核对——等待期间重置过演示、或动过自动记忆开关（含关了又开），这次的结果整体作废，
 * 对话不标记、run 不落库，下次空闲再从头整理。 */
export async function consolidate(store:FreeChatStore,provider:ModelProvider,now:()=>string,signal:AbortSignal):Promise<{status:'ok'|'failed'|'skipped'|'empty'|'off'|'stale';changes:ConsolidationChange[]}>{
 if(!store.autoRemember())return{status:'off',changes:[]};
 const pending=store.pendingMessages();if(!pending.length)return{status:'empty',changes:[]};
 if(provider.kind==='offline')throw new RuntimeError('unavailable','还没有连接模型，暂时整理不了');
 const upTo=pending.at(-1)!.rowid;
 const epochs=[store.epoch(),store.memoryEpoch()];
 const out=await provider.complete({messages:[{role:'system',content:CONSOLIDATE_PROMPT},{role:'user',content:modelInput(store,pending,now())}],tools:[],signal});
 const stale=()=>store.epoch()!==epochs[0]||store.memoryEpoch()!==epochs[1];
 const ops=parseOps(out.content);
 if(!ops){
  return store.transaction(()=>{
   if(stale())return{status:'stale' as const,changes:[]};
   store.recordRun('failed',upTo,[]);
   if(store.consecutiveFailures()<MAX_FAILURES)return{status:'failed' as const,changes:[]};
   store.markConsolidated(upTo);store.recordRun('skipped',upTo,[]);return{status:'skipped' as const,changes:[]};
  });
 }
 return store.transaction(()=>{
  if(stale())return{status:'stale' as const,changes:[]};
  // R2 兜底：开关本身关着就更不该写（代次已挡住“关了又开”，这里挡住其他旁路）。
  if(!store.autoRemember())return{status:'off' as const,changes:[]};
  const changes=apply(store,ops,pending,now());
  store.markConsolidated(upTo);store.recordRun('ok',upTo,changes);return{status:'ok' as const,changes};
 });
}
