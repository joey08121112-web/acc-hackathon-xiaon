/** 所有者：ChatGPT（改造一：首页综合模式）。第一期实现，挂载位与 props 遵守冻结契约。 */
import type { ChatIntent,ChatReply } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
export type HomeChatProps={l:LearningUI;reply:ChatReply|null;send:(text:string,extra?:{intent?:ChatIntent;problemId?:string})=>void;navigate:(page:string,tab?:string)=>void};
export function HomeChat({reply,send,l}:HomeChatProps){
 if(!reply?.askStudy||reply.safety||reply.summary)return null;
 return <section className="home-card" aria-label="轻轻问一句">
  <p>要不要一起看看学习上的事？今天不想也可以。</p>
  <div className="home-card-actions">
   <button className="secondary" disabled={l.busy} onClick={()=>send('好呀，看看',{intent:'study'})}>好呀，看看</button>
   <button className="secondary" disabled={l.busy} onClick={()=>send('今天先不了',{intent:'decline_study'})}>今天先不了</button>
  </div>
 </section>;
}
