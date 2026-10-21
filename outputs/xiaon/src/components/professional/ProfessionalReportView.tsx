/** 所有者：ChatGPT。只展示报告快照中的等级和引用，不推算总分。 */
import { useState } from 'react';
import { MODULE_LEVEL_LABELS } from '../../../shared/learning-contracts';
import type { LearningUI } from '../../agents/useLearning';
import { useDevMode } from '../../agents/devMode';
import { professionalDate } from './archive';
export type ProfessionalReportViewProps={l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function ProfessionalReportView({l,navigate}:ProfessionalReportViewProps){
 const dev=useDevMode(),[selected,setSelected]=useState('');
 const reports=[...(l.view?.professionalReports??[])].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.version-a.version);
 const report=reports.find(r=>r.id===selected)??reports[0];
 return <section className="professional professional-report" aria-label="专业评测报告">
  <span className="eyebrow">一步步，认识自己的思考</span><h2>专业评测报告</h2><p>本次观察，不是总分，不排名。还没测到，不代表能力弱。</p>
  {!report?<><p className="notice">还没有专业评测报告。先完成理解和逻辑，就可以看看本次观察。</p><button className="primary" onClick={()=>navigate('explore','探索')}>去专业模式</button></>:<>
   <label className="field">专业评测历史<select value={report.id} onChange={e=>setSelected(e.target.value)}>{reports.map((r,i)=><option key={r.id} value={r.id}>{professionalDate(r.createdAt)} · 第 {r.version} 版{i===0?' · 最近一份':''}</option>)}</select></label>
   <p className="small muted">记录于 {professionalDate(report.createdAt)}。切换历史只查看原来的记录。</p>
   <div className="professional-module-cards">{report.modules.map(m=><article className="professional-module" key={m.module} data-level={m.level}><div className="professional-module-title"><h3>{m.module}</h3><span className="professional-level">{MODULE_LEVEL_LABELS[m.level]}</span></div>
    {m.wording&&<p>{m.wording}</p>}
    {m.level==='not_tested'?<p className="muted">这次还没走到这里，以后按你的节奏继续。</p>:<>
     <details><summary>展开依据原话（{m.quotes.length}）</summary>{m.quotes.length?m.quotes.map((q,i)=><blockquote key={i}>你说：「{q}」</blockquote>):<p>这次的依据见已保存作答。</p>}</details>
     {m.suggestions.length>0&&<div><h4>可以试试</h4>{m.suggestions.map((s,i)=><p key={i}>{s}</p>)}</div>}
    </>}
    {dev&&<p className="small">判级依据：{m.basis} · 作答 {m.attemptIds.join('、')||'无'} · 证据 {m.evidenceIds.join('、')||'无'}</p>}
   </article>)}</div>
   <div className="professional-comparison"><h3>与综合模式观察的对照</h3>{report.observationChecks.length?report.observationChecks.map((check,i)=>{const o=l.view?.observations.find(o=>o.id===check.observationId);return <div key={i}><span className="tag">{check.dimension} · {check.result==='confirmed'?'本次得到确认':'本次尚未观察到'}</span>{o?<blockquote>聊天时你说：「{o.quote}」</blockquote>:<p>这条聊天原话暂时无法查看。</p>}{check.result==='not_seen'&&<p className="small muted">只表示这次没看到对应表现，先保留观察。</p>}</div>;}):<p className="muted">这份报告没有可对照的聊天观察。</p>}
   <h3>和上次比</h3>{report.comparedWithReportId?<><p className="small">对照 {professionalDate(reports.find(r=>r.id===report.comparedWithReportId)?.createdAt??'')} 的评测。</p>{report.changes.length?report.changes.map((c,i)=><p key={i}><strong>{c.module}：</strong>{MODULE_LEVEL_LABELS[c.from]} → {MODULE_LEVEL_LABELS[c.to]}。{c.note}</p>):<p>这次没有记录等级变化。</p>}</>:<p>这是第一份可对照的评测记录，之后再一起看变化。</p>}</div>
   <button className="primary wide" onClick={()=>navigate('plan','成长')}>进入月阶段规划</button><p className="small muted">月阶段规划将根据报告整理建议，目标和周任务都由你确认。</p>
   {report.supersedesReportId&&<p className="small muted">这是同一次测评的更新版，之前的版本仍可在历史里查看。</p>}
   {dev&&<p className="small">报告 {report.id} · 证据版本 {report.evidenceRevision} · {report.mode}</p>}
  </>}
 </section>;
}
