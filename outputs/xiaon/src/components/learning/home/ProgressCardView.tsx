/** 所有者：Claude（改造三：进步卡）。挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。三栏可编辑、可跳过，信心自评可跳过；点确认才保存。 */
import { useEffect, useState } from 'react';
import type { ProgressCardDraft, ProgressConfidence } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
import { MemoryOffNotice } from './MemoryOffNotice';
/** draft = ChatReply.progressCardDraft；三栏可编辑、可跳过，确认调用 learning/progress-card/confirm。 */
export type ProgressCardViewProps={draft:ProgressCardDraft|null;sessionId:string|null;memoryEnabled:boolean;l:LearningUI;navigate:(page:string,tab?:string)=>void};
type Field='breakthrough'|'method'|'nextTry';
const FIELDS:{key:Field;label:string}[]=[{key:'breakthrough',label:'今天的小突破'},{key:'method',label:'这次有用的方法'},{key:'nextTry',label:'下次想试试'}];
const CONFIDENCE:{key:ProgressConfidence;label:string}[]=[{key:'more_sure',label:'更有把握'},{key:'about_same',label:'差不多'},{key:'still_unsure',label:'仍不确定'},{key:'prefer_not',label:'暂不回答'}];
const fromDraft=(d:ProgressCardDraft|null)=>({breakthrough:d?.breakthrough??'',method:d?.method??'',nextTry:d?.nextTry??''});
export function ProgressCardView({draft,sessionId,memoryEnabled,l,navigate}:ProgressCardViewProps){
 const [text,setText]=useState(()=>fromDraft(draft)),[skip,setSkip]=useState<Record<Field,boolean>>({breakthrough:false,method:false,nextTry:false});
 const [confidence,setConfidence]=useState<ProgressConfidence|null>(null),[saved,setSaved]=useState<'card'|'skipped'|null>(null);
 // A new draft (next episode) starts a fresh, unsaved card.
 const key=JSON.stringify(draft);
 useEffect(()=>{setText(fromDraft(draft));setSkip({breakthrough:false,method:false,nextTry:false});setConfidence(null);setSaved(null);},[key]); // eslint-disable-line react-hooks/exhaustive-deps
 if(!draft||!sessionId)return null;
 if(saved)return <p className="notice progress-saved" role="status">{saved==='card'?'进步卡已保存，在成长页可以看到。':'好，这次先不记。'}</p>;
 const value=(f:Field)=>skip[f]?null:text[f].trim().slice(0,300)||null;
 const save=(all:boolean)=>{void l.run('learning/progress-card/confirm',{sessionId,episodeId:draft.episodeId,aiDraft:draft,
  breakthrough:all?null:value('breakthrough'),method:all?null:value('method'),nextTry:all?null:value('nextTry'),confidence:all?null:confidence})
  .then(()=>setSaved(all?'skipped':'card')).catch(()=>{/* l.error shows the reason; the card stays editable */});};
 return <section className="progress-card" aria-label="这次的进步卡">
  <h2>这次的进步卡</h2>
  <p className="small muted">小N先写了草稿，你可以改、可以跳过某一栏。点确认才会保存。</p>
  {FIELDS.map(({key:f,label})=><div className="progress-field" key={f} data-skipped={skip[f]}>
   <label className="field">{label}<textarea rows={2} maxLength={300} disabled={skip[f]} value={text[f]} onChange={e=>setText(t=>({...t,[f]:e.target.value}))} placeholder="想写什么都可以"/></label>
   <label className="progress-skip"><input type="checkbox" checked={skip[f]} onChange={e=>setSkip(s=>({...s,[f]:e.target.checked}))}/>这一栏跳过</label>
  </div>)}
  <fieldset className="progress-confidence"><legend>这次之后，你觉得自己（可以不选）</legend>
   {CONFIDENCE.map(c=><button key={c.key} type="button" aria-pressed={confidence===c.key} onClick={()=>setConfidence(v=>v===c.key?null:c.key)}>{c.label}</button>)}
  </fieldset>
  <MemoryOffNotice memoryEnabled={memoryEnabled} where="progress_card" navigate={navigate}/>
  <div className="progress-actions"><button className="primary" disabled={l.busy} onClick={()=>save(false)}>确认保存</button><button className="text-button" disabled={l.busy} onClick={()=>save(true)}>这次先不记</button></div>
 </section>;
}
