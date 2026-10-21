/** 所有者：zCode（改造二：成长页错题列表）。挂在 LearningPages page==='growth'；数据来自 l.view.problems。
 * 按时间倒序列出已确认的错题记录（来源、知识点、卡点）；第三期的「按错题出题」入口会加在这里。 */
import type { LearningUI } from '../../../agents/useLearning';
import type { ProblemKnowledgePoint, ProblemRecord } from '../../../../shared/learning-contracts';
export type ProblemListProps={l:LearningUI;navigate:(page:string,tab?:string)=>void};
const POINT_NAMES:Record<ProblemKnowledgePoint,string>={'math-language':'数学语句与条件','counterexample':'反例与条件','negative-brackets':'去括号负号','like-terms':'合并同类项','fixed-variable-cost':'一次费用与变化费用','rotation-2d':'二维旋转','other':'其他'};
const SOURCE_NAMES:Record<ProblemRecord['source'],string>={spoken:'说给我听',photo:'拍一张',catalog:'从题库挑'};
export function ProblemList({l,navigate}:ProblemListProps){
 void navigate;
 const problems=l.view?[...l.view.problems].sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt)):[];
 return <section className="info-paper problem-list-section" aria-label="我的错题">
  <h2>我的错题</h2>
  {problems.length===0&&<p className="small">还没有错题记录。在首页和小N聊聊哪里卡住，说清楚后可以记一条。</p>}
  {problems.map(p=><div className="problem-item" key={p.id}>
   <div className="problem-item-head"><span className="tag">{SOURCE_NAMES[p.source]}</span><strong>{POINT_NAMES[p.knowledgePointId]}</strong></div>
   {p.questionText&&<p className="math-inline">{p.questionText}</p>}
   <p className="small">卡点：{p.stuckQuote}</p>
   <small>{new Date(p.confirmedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})} 记下</small>
  </div>)}
 </section>;
}
