/** 所有者：zCode（改造二：错题记录确认）。draft = ChatReply.problemDraft；只有点「记下」才调用 learning/problem/confirm。
 * 「改一下」进入编辑：保存的是学生改后的文字。只有知识点、没有题目文字时，确认后给题库同类题建议。 */
import { useEffect, useState } from 'react';
import { Check, ListChecks, Pencil, X } from 'lucide-react';
import type { ProblemDraft, ProblemKnowledgePoint, ProblemRecord } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
export type ProblemConfirmCardProps={draft:ProblemDraft|null;sessionId:string|null;l:LearningUI;onConfirmed:(problem:ProblemRecord)=>void};
const POINT_NAMES:Record<ProblemKnowledgePoint,string>={'math-language':'数学语句与条件','counterexample':'反例与条件','negative-brackets':'去括号负号','like-terms':'合并同类项','fixed-variable-cost':'一次费用与变化费用','rotation-2d':'二维旋转','other':'其他'};
export function ProblemConfirmCard({draft,sessionId,l,onConfirmed}:ProblemConfirmCardProps){
 const [editing,setEditing]=useState(false),[question,setQuestion]=useState(''),[work,setWork]=useState(''),[quote,setQuote]=useState(''),[point,setPoint]=useState<ProblemKnowledgePoint>('other'),[done,setDone]=useState<ProblemRecord|null>(null),[dismissed,setDismissed]=useState(false);
 useEffect(()=>{
  if(!draft)return;
  setQuestion(draft.questionText??'');setWork(draft.studentWork??'');setQuote(draft.stuckQuote);setPoint(draft.knowledgePointId);
  setEditing(false);setDone(null);setDismissed(false);
 },[draft]);
 if(!draft||dismissed)return null;
 const confirm=async()=>{
  const record=await l.run<ProblemRecord>('learning/problem/confirm',{sessionId,draft:{...draft,questionText:question.trim()||null,studentWork:work.trim()||null,knowledgePointId:point,stuckQuote:quote.trim()||draft.stuckQuote},referenceAnswer:null});
  setDone(record);onConfirmed(record);
 };
 if(done)return <section className="problem-card" aria-label="已记下的错题">
  <p className="notice" role="status"><Check size={16}/>记下了。小N会从「这道题哪里让你觉得难」接着陪你聊。</p>
  {!done.questionText&&<div className="problem-suggest">
   <p className="small">这道题没有题目原文，先看看{POINT_NAMES[done.knowledgePointId]}的同类题？</p>
   <div className="quick-replies">{(l.view?.tasks??[]).filter(t=>t.knowledgePoints.includes(done.knowledgePointId)&&t.eligible).slice(0,3).map(t=><button key={t.id} disabled={l.busy} onClick={()=>{l.choose(t,'support');}}>{t.title}</button>)}</div>
  </div>}
 </section>;
 return <section className="problem-card" aria-label="错题记录确认">
  <h3>我记下的是这些，对吗？</h3>
  <label className="field">题目{editing
   ?<textarea rows={2} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="题目原文（可以修改）"/>
   :<p className="problem-field">{question||<span className="muted">没有题目原文</span>}</p>}
  </label>
  <label className="field">我的作答{editing
   ?<textarea rows={2} value={work} onChange={e=>setWork(e.target.value)} placeholder="你是怎么做的（可留空）"/>
   :<p className="problem-field">{work||<span className="muted">没有写下来</span>}</p>}
  </label>
  <label className="field">卡在哪一步{editing
   ?<textarea rows={2} value={quote} onChange={e=>setQuote(e.target.value)} placeholder="你说的卡点"/>
   :<p className="problem-field">{quote}</p>}
  </label>
  <label className="field">属于哪个环节{editing
   ?<select value={point} onChange={e=>setPoint(e.target.value as ProblemKnowledgePoint)}>{(Object.keys(POINT_NAMES) as ProblemKnowledgePoint[]).map(k=><option key={k} value={k}>{POINT_NAMES[k]}</option>)}</select>
   :<p className="problem-field">{POINT_NAMES[point]}</p>}
  </label>
  <div className="quick-replies">
   {editing
    ?<button className="primary" disabled={l.busy||!quote.trim()} onClick={()=>void confirm()}><Check size={16}/>改好了，记下</button>
    :<button className="primary" disabled={l.busy||!quote.trim()} onClick={()=>void confirm()}><ListChecks size={16}/>记下</button>}
   {!editing&&<button className="secondary" disabled={l.busy} onClick={()=>setEditing(true)}><Pencil size={16}/>改一下</button>}
   <button className="text-button" disabled={l.busy} onClick={()=>setDismissed(true)}><X size={15}/>不用了</button>
  </div>
  <p className="small muted">参考答案只保存在你的电脑上（小N的服务端），不会发到聊天里。</p>
 </section>;
}
