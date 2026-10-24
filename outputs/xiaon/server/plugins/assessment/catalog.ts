import { SCHEMA_VERSION,schemas,type TaskCatalog,type TaskDefinition,type TaskSelection } from '../../../shared/learning-contracts';
import { legacyTasks,publicView } from '../../tools/legacy';
import { RuntimeError } from '../../core/errors';
export const skillDefinitions=[
 {id:'math-language',dimension:'理解' as const,label:'数学语句与条件提取',scope:'先后运算关系及条件解释'},
 {id:'counterexample',dimension:'逻辑' as const,label:'反例与条件结论',scope:'满足前提且推翻结论的反例及解释'},
 {id:'negative-brackets',dimension:'计算' as const,label:'去括号负号处理',scope:'受限一次式结果表现，具体心理过程待核实'},
 {id:'like-terms',dimension:'计算' as const,label:'合并同类项',scope:'受限一次式系数和常数合并结果'},
 {id:'fixed-variable-cost',dimension:'建模' as const,label:'一次费用与随数量变化费用',scope:'单一线性数量关系及费用来源解释'},
 {id:'rotation-2d',dimension:'空间想象' as const,label:'二维旋转与位置关系',scope:'明确坐标系、旋转中心和方向的折线旋转识别'},
];
type Seed={id:string;skill:string;kind:TaskDefinition['variantKind'];question:string;answer:string;wrong:string;hint:string;reason?:string;choices?:string[];visual?:TaskDefinition['visual']};
const seeds:Seed[]=[
 {id:'understand',skill:'math-language',kind:'observation',question:'文具店的价签很奇怪：一款笔标着“价格是 x 元的 2 倍少 3 元”。小林盯着价签想算明白。帮他把价格写成式子，另起一行解释运算的先后关系。',answer:'2x-3',wrong:'2x-6',hint:'先找 x 的 2 倍，再减 3。',reason:'先求2倍得到2x，再少3；不能先减3再翻倍。'},
 {id:'b-language-transfer',skill:'math-language',kind:'transfer',question:'班里有个“数字魔术盒”：丢进去一个数 a，它会先给这个数加 2，再把结果整体乘 3 吐出来。写出吐出来的数，另起一行说明运算次序。',answer:'3a+6',wrong:'3a+2',hint:'增加2发生在乘3之前，需整体乘3。',reason:'a+2整体乘3，等于3a+6。'},
 {id:'b-language-delayed',skill:'math-language',kind:'delayed',question:'手工课上一根 x 厘米长的彩绳，先剪去 4 厘米做小花；老师又要求再剪一根，长度是剩下的 2 倍。第一行写出第二根的长度的式子，另起一行说明条件。',answer:'2x-8',wrong:'2x-4',hint:'剩下x-4，再乘2；长度场景要求x至少为4。',reason:'剩余x-4，新长度2(x-4)，且x至少为4。'},
 {id:'logic',skill:'counterexample',kind:'observation',question:'课间小林拍着桌子宣布：“两个负数的和一定是正数！”全组安静了三秒。哪个例子能当场推翻他？第一行写选项字母，另起一行说明前提与结论。',choices:['A: (-2)+(-3)=-5','B: 2+3=5','C: (-2)×(-3)=6'],answer:'A',wrong:'C',hint:'需要两个负数相加，并检查和是否正数。',reason:'-2与-3都是负数，和-5不是正数，满足前提但结论不成立。'},
 {id:'b-logic-transfer',skill:'counterexample',kind:'transfer',question:'数学角的公告栏贴了张纸条：“两个正数中，较大的数的平方反而较小。”哪个例子能证明这张纸条贴错了？第一行写选项字母，另起一行解释。',choices:['A: -2<-1，但4>1','B: 1=1，平方也相等','C: 1<2，且1<4'],answer:'C',wrong:'A',hint:'反例必须先满足两个正数且大小不同。',reason:'1和2都是正数，较大数2的平方4也较大，并非较小。'},
 {id:'b-logic-delayed',skill:'counterexample',kind:'delayed',question:'哥哥打游戏前放话：“两个奇数的和一定是奇数，这是规律！”你想了想，找到了反例。是哪个？第一行写选项字母，另起一行解释。',choices:['A: 2+3=5','B: 3+5=8','C: 3×5=15'],answer:'B',wrong:'A',hint:'两个加数都得是奇数，且讨论的是相加。',reason:'3、5都是奇数，其和8为偶数，否定一定为奇数。'},
 {id:'bracket',skill:'negative-brackets',kind:'observation',question:'小林攒了 3x 张卡片，送给同桌的张数比 2x 少 5 张，也就是 (2x − 5) 张。小林还剩多少张？算式已经列好，请化简：3x − (2x − 5)。可写一次式或以等号相连的完整等价步骤。',answer:'x+5',wrong:'x-5',hint:'减去括号内每一项：−(2x−5)=−2x+5。'},
 {id:'transfer',skill:'negative-brackets',kind:'transfer',question:'班级图书角原有 7a 本书，周五借出的本数比 3a 少 2 本，也就是 (3a − 2) 本。图书角还剩多少本？算式已经列好，请化简：7a − (3a − 2)。可写一次式或以等号相连的完整等价步骤。',answer:'4a+2',wrong:'4a-2',hint:'先处理−(3a−2)，再合并同类项。'},
 {id:'b-neg-delayed',skill:'negative-brackets',kind:'delayed',question:'小美有 8 元零花钱，买文具花的钱比 3x 元少 4 元，也就是 (3x − 4) 元。她还剩多少元？算式已经列好，请化简：8 − (3x − 4)。可写一次式或以等号相连的完整等价步骤。',answer:'12-3x',wrong:'4-3x',hint:'常数8留在括号外，括号里的两项都需改变符号。'},
 {id:'b-like-observation',skill:'like-terms',kind:'observation',question:'班长整理班费：周一收了 2x 元，周二收了 3x 元，买粉笔花了 4 元。现在班费有多少元？算式已经列好，请化简：2x + 3x − 4。',answer:'5x-4',wrong:'x',hint:'x项的系数相加，常数另算。'},
 {id:'b-like-transfer',skill:'like-terms',kind:'transfer',question:'小美这周的积分：周一得了 7a 分，周二奖励 2 分，周三扣了 4a 分，周四又奖励 5 分。她现在一共多少分？算式已经列好，请化简：7a + 2 − 4a + 5。',answer:'3a+7',wrong:'3a-3',hint:'把a项放在一组，把常数放在一组，保留各自符号。'},
 {id:'b-like-delayed',skill:'like-terms',kind:'delayed',question:'小林的跑步软件记录：出发点离家 6 千米，他先朝家跑了 2x 千米，又往外跑了 5x 千米，最后朝家走了 1 千米。他现在离家多少千米？算式已经列好，请化简：6 − 2x + 5x − 1。',answer:'3x+5',wrong:'7x+5',hint:'x项是−2x与5x，常数是6与−1。'},
 {id:'model',skill:'fixed-variable-cost',kind:'observation',question:'小林帮全班买练习本：每本 3 元买 x 本，老板说还要加一次 2 元的纸袋费。第一行写出总费用的式子，另起一行说明两部分来源。',answer:'3x+2',wrong:'3x+6',hint:'纸袋费只付一次；练习本费用随本数改变。',reason:'3x是x本的总价，2是一次性纸袋费。'},
 {id:'b-cost-transfer',skill:'fixed-variable-cost',kind:'transfer',question:'全家租自行车环湖：每小时 5 元，另外一次性付 8 元头盔租金，骑了 a 小时。第一行写出总费用的式子，另起一行解释各项。',answer:'5a+8',wrong:'13a',hint:'头盔租金不随小时重复收取。',reason:'5a随租用小时变化，8元头盔费只支付一次。'},
 {id:'b-cost-delayed',skill:'fixed-variable-cost',kind:'delayed',question:'小美帮社团寄件：先付一次 12 元包装费，每件运费 2 元，共寄 x 件。第一行写出总费用的式子，另起一行解释各项。',answer:'2x+12',wrong:'14x',hint:'先分清一次收费和每件收费。',reason:'12元包装费只收一次，2x是x件的运费。'},
 {id:'space',skill:'rotation-2d',kind:'observation',question:'运动会入场式上，一面小旗的轮廓是折线 (0,0)→(0,3)→(1,3)（坐标横轴向右、纵轴向上），旗手举着它绕旗杆底端 (0,0) 顺时针转 90°。哪个选项是转完后的小旗？第一行写字母。',answer:'B',wrong:'A',hint:'向上的长边转为向右，短边再向下。',choices:['A','B','C'],visual:{kind:'rotation2d',points:[[0,0],[0,3],[1,3]],center:[0,0],clockwiseDegrees:90,options:[{label:'A',points:[[0,0],[-3,0],[-3,1]]},{label:'B',points:[[0,0],[3,0],[3,-1]]},{label:'C',points:[[0,0],[0,-3],[1,-3]]}]}},
 {id:'b-space-transfer',skill:'rotation-2d',kind:'transfer',question:'风车的一片叶子是折线 (1,1)→(3,1)→(3,2)（坐标横轴向右、纵轴向上），绕中心 (1,1) 顺时针转 180°。哪个选项是转后的位置？第一行写字母。',answer:'A',wrong:'B',hint:'先减中心坐标，半周旋转后两个相对坐标都取相反数，再加回中心。',choices:['A','B','C'],visual:{kind:'rotation2d',points:[[1,1],[3,1],[3,2]],center:[1,1],clockwiseDegrees:180,options:[{label:'A',points:[[1,1],[-1,1],[-1,0]]},{label:'B',points:[[1,1],[1,-1],[2,-1]]},{label:'C',points:[[1,1],[1,3],[0,3]]}]}},
 {id:'b-space-delayed',skill:'rotation-2d',kind:'delayed',question:'商场旋转门的一条边是折线 (-1,0)→(-1,2)→(2,2)（坐标横轴向右、纵轴向上），绕门轴 (-1,0) 顺时针转 270°。哪个选项是转后的位置？第一行写字母。',answer:'C',wrong:'B',hint:'顺时针270°与逆时针90°落点一致；旋转中心不是原点。',choices:['A','B','C'],visual:{kind:'rotation2d',points:[[-1,0],[-1,2],[2,2]],center:[-1,0],clockwiseDegrees:270,options:[{label:'A',points:[[-1,0],[-1,-2],[-4,-2]]},{label:'B',points:[[-1,0],[1,0],[1,-3]]},{label:'C',points:[[-1,0],[-3,0],[-3,3]]}]}},
];
function definition(s:Seed):TaskDefinition {
 const skill=skillDefinitions.find(k=>k.id===s.skill)!;
 return schemas.TaskDefinition.parse({schemaVersion:SCHEMA_VERSION,id:s.id,version:2,title:skill.label,question:s.question,choices:s.choices??[],knowledgePoints:[skill.id],primaryDimension:skill.dimension,auxiliaryDimensions:s.skill==='fixed-variable-cost'?['理解']:[],familyId:'family-'+s.skill,variantKind:s.kind,difficulty:'introductory',prerequisites:s.skill==='like-terms'?[]:s.skill==='negative-brackets'?['like-terms']:[],estimatedMinutes:s.reason?4:3,visual:s.visual??null,answer:[s.answer],rubric:[{id:'result',description:s.visual?'在明确坐标系中识别旋转后的对应位置':'在受限答案范围内核对最终结果或反例选择',expected:s.answer,weight:1,requiresExplanation:false},...(s.reason?[{id:'reason',description:'用自己的表达解释关系；选择正确不替代理由证据',expected:s.reason,weight:1,requiresExplanation:true}]:[])],hints:[{id:'hint-1',text:s.hint,level:1}],commonErrors:[{id:'typical-error',description:'与典型错误结果一致；只作为待核实线索，不推断心理过程',indicator:s.wrong,certainty:'clue_only'}]});
}
/** Freeze nested trusted content; callers only receive detached copies from the catalog. */
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const child of Object.values(v))freeze(child);}return v;}
export const assessmentTasks=freeze(seeds.map(definition));
const extras=Array.from({length:10},(_,i)=>definition({id:`calc-${i}`,skill:'negative-brackets',kind:'transfer',question:`运动会前，仓库里有 ${i+5}x 瓶矿泉水，第一批搬走的比 ${i+2}x 瓶少 ${i+1} 瓶，也就是 (${i+2}x − ${i+1}) 瓶。仓库里还剩多少瓶？算式已经列好，请化简：${i+5}x − (${i+2}x − ${i+1})。可写一次式或以等号相连的完整等价步骤。`,answer:`3x+${i+1}`,wrong:`3x-${i+1}`,hint:'括号内各项分别变号，再合并。'}));
const allTasks=freeze([...assessmentTasks,...extras]);
export const legacyIdMapping:Readonly<Record<string,string>>=freeze(Object.fromEntries(legacyTasks.map(t=>[t.id,t.id])));
export function skillIdsForTask(task:TaskDefinition):string[]{
 if(task.version===1){const match=allTasks.find(t=>t.id===task.id);return match?.knowledgePoints??[];}
 return task.knowledgePoints;
}
/** E1: static bank plus program-validated generated tasks from one source; every consumer reads this catalog. */
export class AssessmentCatalog implements TaskCatalog {
 private readonly definitions=freeze([...structuredClone(legacyTasks),...structuredClone(allTasks)]);
 constructor(private readonly generated:()=>readonly TaskDefinition[]=()=>[]){}
 /** Static tasks always win an ID/version collision; generated IDs are prefixed gen- and never replace them. */
 private extra(){return this.generated().filter(g=>!this.definitions.some(t=>t.id===g.id&&t.version===g.version));}
 all():TaskDefinition[]{return [...this.definitions,...this.extra()].map(t=>structuredClone(t));}
 definition(id:string,version:number){const t=this.definitions.find(t=>t.id===id&&t.version===version)??this.extra().find(t=>t.id===id&&t.version===version);return t?structuredClone(t):undefined;}
 publicTask(id:string,version:number){const t=this.definition(id,version);return t?publicView(t):undefined;}
 candidates(input:TaskSelection){
  if(!Number.isInteger(input.limit)||input.limit<0||input.limit>100)throw new RuntimeError('invalid_params','候选题数范围0–100');
  return [...allTasks,...this.extra()].filter(t=>(!input.dimension||t.primaryDimension===input.dimension)&&(!input.knowledgePointId||t.knowledgePoints.includes(input.knowledgePointId))&&!input.excludeTaskIds.includes(t.id)).slice(0,input.limit).map(publicView);
 }
}
