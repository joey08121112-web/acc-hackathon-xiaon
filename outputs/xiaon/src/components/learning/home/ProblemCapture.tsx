/** 所有者：zCode（改造二：说出卡点的三个入口）。open = ChatReply.askProblem；布局挂载位在 ChatPanel（ChatGPT 路）。
 * props 冻结没有 navigate：页面跳转走 App 的 popstate 契约（pushState + PopStateEvent），不修改别人的文件。 */
import { useState } from 'react';
import { BookOpen, Camera, Mic, X } from 'lucide-react';
import type { ProblemRecord } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
export type ProblemCaptureProps={open:boolean;sessionId:string|null;l:LearningUI;onConfirmed:(problem:ProblemRecord)=>void};
// App 的 navigate 只做 pushState；popstate 监听器按 e.state.page 生效，这里复用同一契约。
const goto=(page:string,tab?:string)=>{window.history.pushState({page,tab},'',`#${page}`);window.dispatchEvent(new PopStateEvent('popstate',{state:{page,tab}}));};
export function ProblemCapture({open,sessionId,l,onConfirmed}:ProblemCaptureProps){
 const [tell,setTell]=useState(false);
 // sessionId/l/onConfirmed 由确认卡（ProblemConfirmCard）使用；本组件只负责三个入口。
 void sessionId;void l;void onConfirmed;
 if(!open)return null;
 return <section className="problem-capture" aria-label="把这道题记下来">
  <div className="problem-capture-head">
   <h3>愿意把这道题记下来，一起看看吗？</h3>
   {tell&&<button className="text-button" aria-label="收起说明" onClick={()=>setTell(false)}><X size={15}/></button>}
  </div>
  <div className="problem-entry-row">
   <button className="secondary" onClick={()=>goto('upload')}><Camera size={17}/>拍一张</button>
   <button className="secondary" aria-pressed={tell} onClick={()=>setTell(v=>!v)}><Mic size={17}/>说给我听</button>
   <button className="secondary" onClick={()=>goto('explore','探索')}><BookOpen size={17}/>从题库挑</button>
  </div>
  {tell&&<p className="notice" role="status">用话筒或打字说说：这是哪道题、你卡在哪一步，也可以直接把题目念出来。说完小N会整理成一条错题记录，你点「记下」才会保存。</p>}
  <p className="small muted">三条路记成同一种错题记录；「拍一张」这期先手动输入题目，识别稍后上线。</p>
 </section>;
}
