/** 所有者：ChatGPT（改造一：确定需求）。第一期实现，挂载位与 props 遵守冻结契约。 */
import { useState } from 'react';
import type { ChatIntent } from '../../../../shared/learning-contracts';
/** open = ChatReply.needsCheck。三个选项：继续聊聊 → life，看看哪里没考好 → study，做个正式测试 → formal_test。 */
export type NeedsCheckCardProps={open:boolean;disabled:boolean;onChoose:(intent:ChatIntent,label:string)=>void};
export function NeedsCheckCard({open,disabled,onChoose}:NeedsCheckCardProps){
 const [chosen,setChosen]=useState(false);
 if(!open||chosen)return null;
 return <section className="home-card needs-check" aria-label="接下来想怎么聊">
  <h2>接下来，你想怎么聊？</h2>
  <div className="home-card-actions">{([
   ['life','继续聊聊'],['study','看看哪里没考好'],['formal_test','做个正式测试'],
  ] as const).map(([intent,label])=><button className="secondary" key={intent} disabled={disabled} onClick={()=>{setChosen(true);onChoose(intent,label);}}>{label}</button>)}</div>
 </section>;
}
