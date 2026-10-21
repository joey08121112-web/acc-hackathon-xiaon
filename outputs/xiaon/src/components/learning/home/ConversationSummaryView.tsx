/** 所有者：ChatGPT（改造一：对话小结界面）。第一期实现，挂载位与 props 遵守冻结契约。 */
import type { ConversationSummary } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
import { ModeSwitchCard } from './ModeSwitchCard';
/** summary = ChatReply.summary（道别时）或 /api/learning/conversation/end 的返回。 */
export type ConversationSummaryViewProps={summary:ConversationSummary|null;l:LearningUI;navigate:(page:string,tab?:string)=>void};
/** Current summary bubble; persisted summaries still use the next-visit greeting after reload. */
export const summaryBubbleText=(summary:ConversationSummary)=>`今天先聊到这里。我整理了这次的小结：${summary.topics[0]??'今天聊过的事'}。建议放在下面，什么时候开始由你决定。`;
export function ConversationSummaryView({summary,l,navigate}:ConversationSummaryViewProps){
 if(!summary)return null;
 const observations=l.view?.observations.filter(o=>o.sessionId===summary.sessionId&&summary.observationIds.includes(o.id))??[];
 const card=l.view?.progressCards.find(c=>c.id===summary.progressCardId&&c.sessionId===summary.sessionId);
 return <section className="home-card conversation-summary" aria-label="这次的对话小结">
  <span className="eyebrow">今天先聊到这里</span><h2>这次的对话小结</h2>
  {summary.mode==='local_rules'&&<p className="small muted">这次用本地规则整理，没有生成对话观察。</p>}
  <h3>聊了什么</h3>{summary.topics.length?<ul>{summary.topics.map((t,i)=><li key={i}>{t}</li>)}</ul>:<p>这次简单打了个招呼。</p>}
  <h3>对话观察</h3>{observations.length?observations.map(o=><article className="summary-observation" key={o.id}><strong>{o.dimension} · 待专业模式确认</strong><p>{o.note}</p><blockquote>你说：「{o.quote}」</blockquote></article>):<p>这次没有新增观察。不打分，也不急着下结论。</p>}
  <h3>和上次比</h3>{summary.changes.length?summary.changes.map((t,i)=><p key={i}>{t}</p>):<p>还没有足够的记录可以比较。</p>}
  <h3>计划建议</h3><p className="small muted">先看看，是否开始和如何安排都由你确认。</p>
  {summary.planSuggestions.map((t,i)=><div className="summary-plan" key={i}><p>{t}</p><button className="secondary" disabled={l.busy} onClick={()=>navigate('plan','成长')}>转成正式计划</button></div>)}
  {card&&<article className="summary-progress" aria-label="已确认的进步卡"><h3>今天的进步卡</h3>{([['今天的小突破',card.breakthrough],['这次有用的方法',card.method],['下次想试试',card.nextTry]] as const).map(([label,text])=><div key={label}><strong>{label}</strong><p>{text??'这栏先跳过'}</p></div>)}{card.confidence&&<p>信心自评：{{more_sure:'更有把握',about_same:'差不多',still_unsure:'仍不确定',prefer_not:'暂不回答'}[card.confidence]}</p>}</article>}
  {summary.suggestProfessionalMode&&<ModeSwitchCard key={summary.id} suggestion={{mode:'professional',reason:'如果心情和时间都合适，可以把这次的观察再确认一下。'}} navigate={navigate}/>}
 </section>;
}
