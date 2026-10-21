import { useState } from 'react';
import { ArrowRight,BookOpen,Check,ChevronRight,Compass,Flower2,List,Map,Plus,Sprout } from 'lucide-react';
import { MapArt } from '../../Art';
import { dimensionDetails } from '../../data';
import type { LearningUI } from '../../agents/useLearning';
type View=NonNullable<LearningUI['view']>;
function MarketIcon({size=20}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16l-1 14H5L4 7ZM8 7V5a4 4 0 018 0v2"/></svg>;}
const icons=[Flower2,BookOpen,Plus,MarketIcon,Compass];
/** Map labels summarize observed tasks; they never imply complete mastery of a dimension. */
export function explorationStatus(view:View,dimension:string){
 const tasks=new Set(view.tasks.filter(t=>t.primaryDimension===dimension).map(t=>t.id));
 const attempts=view.attempts.filter(a=>tasks.has(a.taskId));
 const latestGrades=attempts.map(a=>view.gradings.filter(g=>g.attemptId===a.id).at(-1));
 if(latestGrades.some(g=>g?.verdict==='correct'))return '完成';
 if(attempts.length)return latestGrades.some(g=>!g||g.verdict==='needs_review')?'待核查':'进行中';
 if(view.exposures.some(e=>tasks.has(e.taskId)&&e.kind==='task'))return view.paused?'暂未完成':'进行中';
 return '未开始';
}
export function ExplorationMap({view,onDimension,onReport}:{view:View;onDimension:(index:number)=>void;onReport:()=>void}){
 const [mapMode,setMapMode]=useState(true);
 const completed=dimensionDetails.filter(d=>explorationStatus(view,d.name)==='完成').length;
 const calculationCount=new Set(view.exposures.filter(e=>e.sessionId===view.session?.id&&e.kind==='task'&&view.tasks.find(t=>t.id===e.taskId)?.primaryDimension==='计算').map(e=>e.taskId)).size;
 return <>
  <div className="explore-toolbar">
   <span><i className="green-dot"/>已探索 {completed} / 5 个地点</span>
   <div className="segmented">
    <button aria-label="地图入口" aria-pressed={mapMode} className={mapMode?'active':''} onClick={()=>setMapMode(true)}><Map size={17}/></button>
    <button aria-label="列表入口" aria-pressed={!mapMode} className={!mapMode?'active':''} onClick={()=>setMapMode(false)}><List size={17}/></button>
   </div>
  </div>
  {mapMode?<div className="exploration-map">
   <MapArt/>
   <span className="map-stamp">小N的探索手记<br/><small>VOL. 01 · 数学</small></span>
   {dimensionDetails.map((d,i)=>{const Icon=icons[i],status=explorationStatus(view,d.name);return <button className={`map-node node-${i}`} key={d.name} onClick={()=>onDimension(i)}>
    <span className="node-icon" style={{background:d.color}}><Icon size={25}/>{status==='完成'&&<i><Check size={12}/></i>}</span>
    <strong>{d.place}</strong><small>{status==='未开始'&&i<2?'从这里开始':status}</small>
   </button>;})}
   <span className="map-key"><span/>路线只作导航，没有分数排名</span>
  </div>:<div className="dimension-list">
   {dimensionDetails.map((d,i)=>{const Icon=icons[i];return <button key={d.name} onClick={()=>onDimension(i)}>
    <span className="dimension-icon" style={{background:d.color}}><Icon size={23}/></span>
    <span><strong>{d.place}</strong><small>{d.note}</small></span>
    <span className="tag">{explorationStatus(view,d.name)}</span><ChevronRight size={17}/>
   </button>;})}
  </div>}
  <div className="explore-note"><Sprout size={23}/><div><h3>先从理解和逻辑出发</h3><p>你可以随时暂停。结果只代表这些任务中的表现。</p></div></div>
  <button className="secondary wide" onClick={onReport}>看看已有的学习观察 <ArrowRight size={17}/></button>
  <p className="small muted center">本次计算题已打开 {calculationCount} / 10 · 包含补充题</p>
 </>;
}
