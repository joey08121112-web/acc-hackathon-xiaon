/** 所有者：ChatGPT（改造一：切到专业模式）。第一期实现，挂载位与 props 遵守冻结契约。 */
import { useState } from 'react';
import type { ModeSuggestion } from '../../../../shared/learning-contracts';
/** 学生点确认才切换；切换即 navigate('explore','探索')。 */
export type ModeSwitchCardProps={suggestion:ModeSuggestion|null;navigate:(page:string,tab?:string)=>void};
export function ModeSwitchCard({suggestion,navigate}:ModeSwitchCardProps){
 const [dismissed,setDismissed]=useState(false),[starting,setStarting]=useState(false);
 if(!suggestion||dismissed)return null;
 return <section className="home-card mode-switch" aria-label="专业模式说明">
  <span className="eyebrow">由你决定</span><h2>想更仔细地看看吗？</h2><p>{suggestion.reason}</p>
  <p>专业模式会用几道题，看看理解、逻辑、计算、建模和空间想象。可以随时暂停，不打总分，也不排名。</p>
  <div className="home-card-actions">
   <button className="primary" disabled={starting} onClick={()=>{setStarting(true);void Promise.resolve(navigate('explore','探索')).finally(()=>setStarting(false));}}>{starting?'正在准备…':'去专业模式'}</button>
   <button className="secondary" disabled={starting} onClick={()=>setDismissed(true)}>先不了</button>
  </div>
 </section>;
}
