/** 所有者：ChatGPT。趋势只读 learning/trend，不把聊天观察换算成等级。 */
import { useEffect, useState } from 'react';
import { INTERVIEW_MODULE_ORDER, MODULE_LEVEL_LABELS, schemas, type TrendQuery } from '../../../shared/learning-contracts';
import { apiRequest } from '../../agent-client';
import type { LearningUI } from '../../agents/useLearning';
import { useDevMode } from '../../agents/devMode';
import { archiveMonths, professionalDate, professionalMonth } from './archive';
export type GrowthArchiveProps={l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function GrowthArchive({l,navigate}:GrowthArchiveProps){
 const dev=useDevMode(),[trend,setTrend]=useState<TrendQuery|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const reportKey=(l.view?.professionalReports??[]).map(r=>r.id).join('|');
 useEffect(()=>{
  setTrend(null);setError('');if(!l.connected)return;
  const controller=new AbortController();setLoading(true);
  void apiRequest<TrendQuery>('learning/trend',undefined,controller.signal).then(data=>{if(!controller.signal.aborted)setTrend(schemas.TrendQuery.parse(data));}).catch(e=>{if(!controller.signal.aborted)setError(dev?(e as Error).message:'等级趋势暂时还没接通，请稍后重试。对话小结和进步卡仍可查看。');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[l.connected,reportKey,retry,dev]);
 const view=l.view,months=view?archiveMonths(view,trend):[];
 return <section className="professional professional-archive" aria-label="成长档案" aria-busy={loading}>
  <span className="eyebrow">把每一点变化，慢慢串起来</span><h2>成长档案</h2><p>按月看看五个模块的本次观察，也看看聊过的事和你确认的小进步。</p>
  {loading&&<p role="status">正在翻开成长记录…</p>}
  {error&&<p className="notice" role="status">{error}<button className="text-button" onClick={()=>setRetry(n=>n+1)}>重试等级趋势</button></p>}
  {!loading&&!error&&!months.length&&<p className="notice">这里还没有记录。一次聊天、一张进步卡或一份测评报告，都可以成为起点。</p>}
  {months.map(month=>{
   const points=trend?.history.filter(p=>p.month===month)??[],summaries=view!.summaries.filter(s=>professionalMonth(s.createdAt)===month),cards=view!.progressCards.filter(c=>professionalMonth(c.confirmedAt)===month);
   const timeline=[...summaries.map(s=>({at:s.createdAt,summary:s,card:null})),...cards.map(c=>({at:c.confirmedAt,summary:null,card:c}))].sort((a,b)=>a.at.localeCompare(b.at));
   return <article className="professional-month" key={month}><h3>{month.replace('-',' 年 ')} 月</h3><p className="small muted">同月有多次评测时，按发生顺序展示；没有记录的模块不补等级。</p>
    <dl className="professional-trends">{INTERVIEW_MODULE_ORDER.map(module=>{const rows=points.filter(p=>p.module===module).sort((a,b)=>a.reportCreatedAt.localeCompare(b.reportCreatedAt));return <div key={module}><dt>{module}</dt><dd>{rows.length?rows.map((p,i)=><span key={p.sourceReportId+':'+i}>{i>0&&' → '}<span title={professionalDate(p.reportCreatedAt)}>{MODULE_LEVEL_LABELS[p.level]}</span></span>):<span className="muted">{error?'趋势待连接':'本月暂无评测记录'}</span>}</dd></div>;})}</dl>
    <div className="professional-timeline">{timeline.map(item=><details key={item.summary?.id??item.card!.id}><summary>{professionalDate(item.at)} · {item.summary?'对话小结':'进步卡'}</summary>{item.summary?<><p>{item.summary.topics.join('、')||'聊了聊'}</p>{item.summary.observationIds.map(id=>view!.observations.find(o=>o.id===id)).filter(o=>o&&o.sessionId===item.summary!.sessionId).map(o=><blockquote key={o!.id}>{o!.dimension} · 待专业模式确认：「{o!.quote}」</blockquote>)}{item.summary.changes.map((c,i)=><p key={i}>{c}</p>)}{item.summary.planSuggestions.map((s,i)=><p key={i}>可以试试：{s}</p>)}</>:<>{([['今天的小突破',item.card!.breakthrough],['这次有用的方法',item.card!.method],['下次想试试',item.card!.nextTry]] as const).map(([label,value])=><p key={label}><strong>{label}：</strong>{value??'这次先跳过'}</p>)}</>}</details>)}</div>
   </article>;
  })}
  <button className="secondary wide" onClick={()=>navigate('report','成长')}>查看评测报告与依据</button>
  {dev&&trend&&<p className="small">趋势：{trend.history.length} 条记录，{trend.latest.length} 条最近记录。</p>}
 </section>;
}
