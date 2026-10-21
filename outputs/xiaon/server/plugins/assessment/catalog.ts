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
 {id:'understand',skill:'math-language',kind:'observation',question:'“比 x 的 2 倍少 3”可以怎样表示？第一行写式子，另起一行解释先后关系。',answer:'2x-3',wrong:'2x-6',hint:'先找 x 的 2 倍，再减 3。',reason:'先求2倍得到2x，再少3；不能先减3再翻倍。'},
 {id:'b-language-transfer',skill:'math-language',kind:'transfer',question:'先把 a 增加 2，再把所得结果乘 3。第一行写式子，另起一行说明运算次序。',answer:'3a+6',wrong:'3a+2',hint:'增加2发生在乘3之前，需整体乘3。',reason:'a+2整体乘3，等于3a+6。'},
 {id:'b-language-delayed',skill:'math-language',kind:'delayed',question:'一根长 x 厘米的绳先剪去 4 厘米，另一根长为剩下部分的 2 倍。第一行写另一根绳长度的式子，另起一行说明条件。',answer:'2x-8',wrong:'2x-4',hint:'剩下x-4，再乘2；长度场景要求x至少为4。',reason:'剩余x-4，新长度2(x-4)，且x至少为4。'},
 {id:'logic',skill:'counterexample',kind:'observation',question:'小林说“两个负数的和一定是正数”。哪个例子否定这句话？第一行写选项字母，另起一行说明前提与结论。',choices:['A: (-2)+(-3)=-5','B: 2+3=5','C: (-2)×(-3)=6'],answer:'A',wrong:'C',hint:'需要两个负数相加，并检查和是否正数。',reason:'-2与-3都是负数，和-5不是正数，满足前提但结论不成立。'},
 {id:'b-logic-transfer',skill:'counterexample',kind:'transfer',question:'有人说“两个正数中，较大的数的平方反而较小”。哪个例子能反驳？第一行写选项字母，另起一行解释。',choices:['A: -2<-1，但4>1','B: 1=1，平方也相等','C: 1<2，且1<4'],answer:'C',wrong:'A',hint:'反例必须先满足两个正数且大小不同。',reason:'1和2都是正数，较大数2的平方4也较大，并非较小。'},
 {id:'b-logic-delayed',skill:'counterexample',kind:'delayed',question:'“两个奇数的和一定是奇数”，哪个例子能反驳？第一行写选项字母，另起一行解释。',choices:['A: 2+3=5','B: 3+5=8','C: 3×5=15'],answer:'B',wrong:'A',hint:'两个加数都得是奇数，且讨论的是相加。',reason:'3、5都是奇数，其和8为偶数，否定一定为奇数。'},
 {id:'bracket',skill:'negative-brackets',kind:'observation',question:'化简：3x − (2x − 5)。可写一次式或以等号相连的完整等价步骤。',answer:'x+5',wrong:'x-5',hint:'减去括号内每一项：−(2x−5)=−2x+5。'},
 {id:'transfer',skill:'negative-brackets',kind:'transfer',question:'化简：7a − (3a − 2)。可写一次式或以等号相连的完整等价步骤。',answer:'4a+2',wrong:'4a-2',hint:'先处理−(3a−2)，再合并同类项。'},
 {id:'b-neg-delayed',skill:'negative-brackets',kind:'delayed',question:'化简：8 − (3x − 4)。可写一次式或以等号相连的完整等价步骤。',answer:'12-3x',wrong:'4-3x',hint:'常数8留在括号外，括号里的两项都需改变符号。'},
 {id:'b-like-observation',skill:'like-terms',kind:'observation',question:'化简：2x + 3x − 4。',answer:'5x-4',wrong:'x',hint:'x项的系数相加，常数另算。'},
 {id:'b-like-transfer',skill:'like-terms',kind:'transfer',question:'化简：7a + 2 − 4a + 5。',answer:'3a+7',wrong:'3a-3',hint:'把a项放在一组，把常数放在一组，保留各自符号。'},
 {id:'b-like-delayed',skill:'like-terms',kind:'delayed',question:'化简：6 − 2x + 5x − 1。',answer:'3x+5',wrong:'7x+5',hint:'x项是−2x与5x，常数是6与−1。'},
 {id:'model',skill:'fixed-variable-cost',kind:'observation',question:'每本练习本3元，买x本，另付一次纸袋费2元。第一行写总费用式子，另起一行说明两部分来源。',answer:'3x+2',wrong:'3x+6',hint:'纸袋费只付一次；练习本费用随本数改变。',reason:'3x是x本的总价，2是一次性纸袋费。'},
 {id:'b-cost-transfer',skill:'fixed-variable-cost',kind:'transfer',question:'租自行车每小时5元，另付一次头盔租金8元。租a小时，第一行写总费用式子，另起一行解释各项。',answer:'5a+8',wrong:'13a',hint:'头盔租金不随小时重复收取。',reason:'5a随租用小时变化，8元头盔费只支付一次。'},
 {id:'b-cost-delayed',skill:'fixed-variable-cost',kind:'delayed',question:'寄件先收一次包装费12元，每件运费2元，共x件。第一行写总费用式子，另起一行解释各项。',answer:'2x+12',wrong:'14x',hint:'先分清一次收费和每件收费。',reason:'12元包装费只收一次，2x是x件的运费。'},
 {id:'space',skill:'rotation-2d',kind:'observation',question:'坐标横轴向右、纵轴向上。折线依次为(0,0)、(0,3)、(1,3)，绕(0,0)顺时针90°。哪个选项给出旋转后的对应顶点？第一行写字母。',answer:'B',wrong:'A',hint:'向上的长边转为向右，短边再向下。',choices:['A','B','C'],visual:{kind:'rotation2d',points:[[0,0],[0,3],[1,3]],center:[0,0],clockwiseDegrees:90,options:[{label:'A',points:[[0,0],[-3,0],[-3,1]]},{label:'B',points:[[0,0],[3,0],[3,-1]]},{label:'C',points:[[0,0],[0,-3],[1,-3]]}]}},
 {id:'b-space-transfer',skill:'rotation-2d',kind:'transfer',question:'坐标横轴向右、纵轴向上。折线依次为(1,1)、(3,1)、(3,2)，绕(1,1)顺时针180°。哪个选项给出对应顶点？第一行写字母。',answer:'A',wrong:'B',hint:'先减中心坐标，半周旋转后两个相对坐标都取相反数，再加回中心。',choices:['A','B','C'],visual:{kind:'rotation2d',points:[[1,1],[3,1],[3,2]],center:[1,1],clockwiseDegrees:180,options:[{label:'A',points:[[1,1],[-1,1],[-1,0]]},{label:'B',points:[[1,1],[1,-1],[2,-1]]},{label:'C',points:[[1,1],[1,3],[0,3]]}]}},
 {id:'b-space-delayed',skill:'rotation-2d',kind:'delayed',question:'坐标横轴向右、纵轴向上。折线依次为(-1,0)、(-1,2)、(2,2)，绕(-1,0)顺时针270°。哪个选项给出对应顶点？第一行写字母。',answer:'C',wrong:'B',hint:'顺时针270°与逆时针90°落点一致；旋转中心不是原点。',choices:['A','B','C'],visual:{kind:'rotation2d',points:[[-1,0],[-1,2],[2,2]],center:[-1,0],clockwiseDegrees:270,options:[{label:'A',points:[[-1,0],[-1,-2],[-4,-2]]},{label:'B',points:[[-1,0],[1,0],[1,-3]]},{label:'C',points:[[-1,0],[-3,0],[-3,3]]}]}},
];
function definition(s:Seed):TaskDefinition {
 const skill=skillDefinitions.find(k=>k.id===s.skill)!;
 return schemas.TaskDefinition.parse({schemaVersion:SCHEMA_VERSION,id:s.id,version:2,title:skill.label,question:s.question,choices:s.choices??[],knowledgePoints:[skill.id],primaryDimension:skill.dimension,auxiliaryDimensions:s.skill==='fixed-variable-cost'?['理解']:[],familyId:'family-'+s.skill,variantKind:s.kind,difficulty:'introductory',prerequisites:s.skill==='like-terms'?[]:s.skill==='negative-brackets'?['like-terms']:[],estimatedMinutes:s.reason?4:3,visual:s.visual??null,answer:[s.answer],rubric:[{id:'result',description:s.visual?'在明确坐标系中识别旋转后的对应位置':'在受限答案范围内核对最终结果或反例选择',expected:s.answer,weight:1,requiresExplanation:false},...(s.reason?[{id:'reason',description:'用自己的表达解释关系；选择正确不替代理由证据',expected:s.reason,weight:1,requiresExplanation:true}]:[])],hints:[{id:'hint-1',text:s.hint,level:1}],commonErrors:[{id:'typical-error',description:'与典型错误结果一致；只作为待核实线索，不推断心理过程',indicator:s.wrong,certainty:'clue_only'}]});
}
/** Freeze nested trusted content; callers only receive detached copies from the catalog. */
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const child of Object.values(v))freeze(child);}return v;}
export const assessmentTasks=freeze(seeds.map(definition));
const extras=Array.from({length:10},(_,i)=>definition({id:`calc-${i}`,skill:'negative-brackets',kind:'transfer',question:`化简：${i+5}x − (${i+2}x − ${i+1})。`,answer:`3x+${i+1}`,wrong:`3x-${i+1}`,hint:'括号内各项分别变号，再合并。'}));
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
