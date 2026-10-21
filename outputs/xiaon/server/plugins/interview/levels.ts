/** 所有者：Claude（第二期：面试引擎）。模块等级的程序规则：纯函数，阈值写成常量。模型只负责把等级说成学生能懂的话，不能改等级。 */
import { LEVEL_BY_BASIS,type InterviewModule,type ModuleLevelBasis,type ModuleLevelValue } from '../../../shared/learning-contracts';
/** A follow-up answer this short, or matching NO_REASON_PATTERN, does not count as a stated reason (tasks without a reason rubric point). */
export const REASON_MIN_CHARS=4;
export const NO_REASON_PATTERN=/不知道|不清楚|猜的|蒙的|随便|忘了|没想|说不上来|不会/;
/** One graded interview attempt as the level rule sees it. resultOk = the program's result point is supported. */
export interface AttemptFact { resultOk:boolean;reasonClear:boolean;hinted:boolean }
/** observation = the module's first question; transfer = the same-family question asked only after a wrong first answer. */
export function moduleBasis(facts:{observation:AttemptFact|null;transfer:AttemptFact|null}):ModuleLevelBasis{
 const o=facts.observation;if(!o)return 'not_tested';
 if(o.resultOk)return o.hinted?'completed_with_hint':o.reasonClear?'correct_with_reason':'correct_reason_incomplete';
 return facts.transfer?.resultOk?'correct_on_transfer':'incorrect_on_both';
}
export const levelOf=(basis:ModuleLevelBasis):ModuleLevelValue=>LEVEL_BY_BASIS[basis];
/** Without a reason rubric point the program only checks that the follow-up states something; it never judges the reasoning itself. */
export function statedReason(text:string|undefined):boolean{const t=(text??'').trim();return Array.from(t).length>=REASON_MIN_CHARS&&!NO_REASON_PATTERN.test(t);}
/** Local-rules wording per basis: plain, no score, no ranking. */
export const LOCAL_WORDING:Record<ModuleLevelBasis,string|null>={
 correct_with_reason:'这次答对了，也说清了自己的想法。',
 correct_reason_incomplete:'结果对了，理由这次还没说完整（或者还没能核实）。',
 completed_with_hint:'在一个小提示之后做出来了。',
 correct_on_transfer:'第一题没做对，同类的第二题做对了。',
 incorrect_on_both:'这次两道题都还没做对，值得接着练。',
 not_tested:null,
};
/** One or two concrete suggestions per module for partial / needs_work; zCode's month stage reads them. */
export const SUGGESTIONS:Record<InterviewModule,{partial:string[];needs_work:string[]}>={
 '理解':{partial:['读题时先把每个条件圈出来，再说说先算哪一步。'],needs_work:['读题时先把每个条件圈出来，再说说先算哪一步。','把文字一句一句改写成式子，每写一步说一句为什么。']},
 '逻辑':{partial:['举反例时先检查它是否满足题目的前提。'],needs_work:['举反例时先检查它是否满足题目的前提。','说结论前先问自己：反过来会怎样？']},
 '计算':{partial:['写出每一步等号，做完把结果代一个数检查。'],needs_work:['去括号时把括号里每一项的符号都写出来。','写出每一步等号，做完把结果代一个数检查。']},
 '建模':{partial:['先分清只算一次的部分和随数量变化的部分。'],needs_work:['先分清只算一次的部分和随数量变化的部分。','用一个具体数量代进去，检查式子算出的总数对不对。']},
 '空间想象':{partial:['先在纸上画出坐标轴，标出旋转中心再转。'],needs_work:['先在纸上画出坐标轴，标出旋转中心再转。','一次只转一条边，看它转到哪个方向。']},
};
export function suggestionsFor(module:InterviewModule,level:ModuleLevelValue):string[]{return level==='partial'||level==='needs_work'?[...SUGGESTIONS[module][level]]:[];}
