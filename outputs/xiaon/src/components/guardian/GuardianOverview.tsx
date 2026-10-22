/** 监护人页：学习概览 + 每周学习小结。数据全部来自 l.view（本机 SQLite 学习记录），口径见 digest.ts。 */
import { useState } from 'react';
import type { LearningView } from '../../../server/agents/learning';
import { guardianDigest,digestText,shortDate } from './digest';

export function GuardianOverview({view}:{view:LearningView}){
 const [offset,setOffset]=useState(0),[copied,setCopied]=useState<''|'ok'|'fail'>('');
 const d=guardianDigest(view,offset),o=d.overview,w=d.week;
 const copy=()=>{setCopied('');if(!navigator.clipboard){setCopied('fail');return;}navigator.clipboard.writeText(digestText(d)).then(()=>setCopied('ok'),()=>setCopied('fail'));};
 return <>
  <section className="guardian-overview" aria-label="学习概览">
   <h2>学习概览</h2>
   <span className="tag">来自真实学习记录 · 不含聊天与倾诉</span>
   <dl>
    {o.monthGoal&&<><dt>本月目标（孩子确认）</dt><dd>{o.monthGoal}</dd></>}
    <dt>当前计划</dt>
    <dd>{o.planGoal?<>{o.planGoal}{o.planDeferred&&'（孩子选择了暂不开始）'}</>:'孩子还没有确认计划'}</dd>
    <dt>学习状态</dt>
    <dd>{o.paused?'孩子选择了先休息，学习提醒已暂停':'正常，由孩子自己选择什么时候学'}</dd>
    <dt>已经观察到的知识点</dt>
    <dd>{o.skills.length?<ul className="guardian-list">{o.skills.map(s=><li key={s.name}><strong>{s.name}</strong> · {s.label}{s.lastDate&&<small>（{shortDate(s.lastDate)}）</small>}</li>)}</ul>:'还没有做题记录'}
     {o.unobserved>0&&<small className="guardian-note">另有 {o.unobserved} 个知识点还没观察，不代表不会。</small>}</dd>
    <dt>下一次复习</dt>
    <dd>{o.nextReview?`${o.nextReview.name} · ${shortDate(o.nextReview.dueDate)}起${o.activeReviews>1?`（共 ${o.activeReviews} 项在复习队列里）`:''}`:'暂无'}</dd>
    {o.levels&&<><dt>最近一次专业模式测评（{shortDate(o.levelsDate!)}）</dt>
     <dd><ul className="guardian-list">{o.levels.map(l=><li key={l.module}><strong>{l.module}</strong> · {l.label}</li>)}</ul></dd></>}
   </dl>
  </section>
  <section className="guardian-week" aria-label="每周学习小结">
   <div className="guardian-week-head">
    <h2>每周学习小结</h2>
    <div className="guardian-week-nav">
     <button className="text-button" disabled={!w.hasEarlier} onClick={()=>{setOffset(offset-1);setCopied('');}} aria-label="上一周">‹ 上一周</button>
     <span>{shortDate(w.start)}–{shortDate(w.end)}</span>
     <button className="text-button" disabled={offset>=0} onClick={()=>{setOffset(offset+1);setCopied('');}} aria-label="下一周">下一周 ›</button>
    </div>
   </div>
   <div className="guardian-stats">
    <div><strong>{w.days.length}</strong><span>学习天数</span></div>
    <div><strong>{w.attempts}</strong><span>做了几道题</span></div>
    <div><strong>{w.kinds.independent}</strong><span>新题独立做对</span></div>
   </div>
   {w.attempts>0&&<p className="guardian-kinds">看过提示后做对 {w.kinds.helped} · 同一道题改对或重做 {w.kinds.original} · 还没做对 {w.kinds.incorrect}{w.kinds.pending>0&&` · 待核查 ${w.kinds.pending}`}</p>}
   {w.changes.length>0&&<div className="guardian-block"><h3>这周的变化</h3>
    {w.changes.map(c=><p key={c.name}><strong>{c.name}</strong>：{shortDate(c.fromDate)} {c.fromLabel} → {shortDate(c.toDate)} 新题独立做对</p>)}</div>}
   {w.practising.length>0&&<div className="guardian-block"><h3>还在练的</h3>
    {w.practising.map(p=><p key={p.name}><strong>{p.name}</strong>：这周有 {p.count} 次还没做对，会在复习里换题再试。</p>)}</div>}
   {w.levelChanges.length>0&&<div className="guardian-block"><h3>专业模式测评</h3>
    {w.levelChanges.map((c,i)=><p key={i}><strong>{c.module}</strong>：{c.from} → {c.to}</p>)}</div>}
   {(w.problems.count>0||w.plan.length>0||w.confidence)&&<div className="guardian-block"><h3>孩子自己做的选择</h3>
    {w.problems.count>0&&<p>记下了 {w.problems.count} 道错题（{w.problems.names.join('、')}）。</p>}
    {w.plan.map((p,i)=><p key={i}>{shortDate(p.date)} {p.action}</p>)}
    {w.confidence&&<p>做完题后的自评：更有把握 {w.confidence.more_sure} 次 · 差不多 {w.confidence.about_same} 次 · 仍不确定 {w.confidence.still_unsure} 次</p>}</div>}
   <div className="guardian-tips"><h3>家长可以这样聊</h3>{w.tips.length?w.tips.map((t,i)=><p key={i}>{t}</p>):<p>保持平常心，问问孩子这周最想跟你分享的一件事。</p>}</div>
   <p className="guardian-note">只覆盖在小N里做过的题，不代表整体成绩。不包含聊天、倾诉、记忆，也不包含孩子写下的作答原文。</p>
   <button className="secondary wide" onClick={copy}>复制文字版</button>
   {copied&&<p className="guardian-note" role="status">{copied==='ok'?'已复制，可以粘贴到备忘录或聊天里。':'没能复制，可以长按上面的文字手动选择。'}</p>}
  </section>
 </>;
}
