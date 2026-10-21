/** 所有者：zCode（改造五：记忆草稿确认）。draft = ChatReply.memoryDraft（聊天提议或进步卡提炼）；
 * 只有点「记住」才调用 learning/memory/confirm-draft，text 是学生改后的文字。 */
import { useEffect, useState } from 'react';
import { BookMarked, Check, Pencil, X } from 'lucide-react';
import type { MemoryDraft, MemoryItem, MemoryRetention } from '../../../../shared/learning-contracts';
import type { LearningUI } from '../../../agents/useLearning';
export type MemoryPromptProps={draft:MemoryDraft|null;sessionId:string|null;memoryEnabled:boolean;l:LearningUI};
const KIND_NAMES:Record<MemoryDraft['kind'],string>={event:'一件事',interest:'一个兴趣',method:'一个方法'};
// Integration phase 1 (contract change for zCode request 2): minimal wiring of the retention choice.
const RETENTION:{key:MemoryRetention;label:string}[]=[{key:'forever',label:'一直记得'},{key:'7d',label:'记 7 天'},{key:'30d',label:'记 30 天'}];
export function MemoryPrompt({draft,sessionId,memoryEnabled,l}:MemoryPromptProps){
 const [text,setText]=useState(''),[editing,setEditing]=useState(false),[done,setDone]=useState<MemoryItem|null>(null),[dismissed,setDismissed]=useState(false),[retention,setRetention]=useState<MemoryRetention>('forever');
 useEffect(()=>{
  if(!draft)return;
  setText(draft.text);setEditing(false);setDone(null);setDismissed(false);setRetention('forever');
 },[draft]);
 if(!draft||dismissed||!memoryEnabled)return null;
 const confirm=async()=>{
  const item=await l.run<MemoryItem>('learning/memory/confirm-draft',{sessionId,draft,text:text.trim()||draft.text,retention});
  setDone(item);
 };
 if(done)return <section className="memory-prompt" aria-label="已记住"><p className="notice" role="status"><Check size={16}/>记住了：{done.text}。以后见面我可以主动提起，记忆页里随时可以更正或删除。</p></section>;
 return <section className="memory-prompt" aria-label="记忆确认">
  <h3><BookMarked size={17}/>要我记住这件小事吗？</h3>
  <p className="small muted">{KIND_NAMES[draft.kind]} · 由你决定</p>
  {editing
   ?<label className="field">记成这样<textarea rows={2} value={text} onChange={e=>setText(e.target.value)}/></label>
   :<p className="problem-field">{draft.text}</p>}
  <div className="quick-replies" role="group" aria-label="记多久">{RETENTION.map(r=><button key={r.key} type="button" aria-pressed={retention===r.key} disabled={l.busy} onClick={()=>setRetention(r.key)}>{r.label}</button>)}</div>
  {retention==='forever'&&<p className="small muted">满 30 天时，我会在记忆页问你这条还适用吗。</p>}
  <div className="quick-replies">
   {editing
    ?<button className="primary" disabled={l.busy||!text.trim()} onClick={()=>void confirm()}><Check size={16}/>就这样记住</button>
    :<button className="primary" disabled={l.busy} onClick={()=>void confirm()}><Check size={16}/>记住</button>}
   {!editing&&<button className="secondary" disabled={l.busy} onClick={()=>setEditing(true)}><Pencil size={16}/>改一下</button>}
   <button className="text-button" disabled={l.busy} onClick={()=>setDismissed(true)}><X size={15}/>不用了</button>
  </div>
 </section>;
}
