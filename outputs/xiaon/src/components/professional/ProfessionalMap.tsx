/** 专业模式的五维地图：复用探索地图的形象，按测评进度依次点亮；只展示状态，不判级。 */
import { Check } from 'lucide-react';
import { INTERVIEW_MODULE_ORDER } from '../../../shared/learning-contracts';
import { MapArt } from '../../Art';
import { dimensionDetails } from '../../data';
import { icons } from '../learning/ExplorationMap';
export type MapModule=typeof INTERVIEW_MODULE_ORDER[number];
export type MapNodeState='done'|'current'|'waiting';
export const placeOf=(m:string)=>dimensionDetails.find(d=>d.name===m)?.place??m;
const labels:Record<MapNodeState,string>={done:'已点亮',current:'点这里进入',waiting:'待探索'};
export function ProfessionalMap({stateOf,onNode}:{stateOf:(m:MapModule)=>MapNodeState;onNode:(m:MapModule)=>void}){
 return <div className="exploration-map professional-map" role="group" aria-label="五维地图">
  <MapArt/>
  <span className="map-stamp">小N的探索手记<br/><small>五站 · 依次点亮</small></span>
  {INTERVIEW_MODULE_ORDER.map((m,i)=>{const d=dimensionDetails[i],Icon=icons[i],state=stateOf(m);
   return <button key={m} className={`map-node node-${i}`} data-state={state} aria-current={state==='current'?'step':undefined} onClick={()=>onNode(m)}>
    <span className="node-icon" style={{background:d.color}}><Icon size={25}/>{state==='done'&&<i><Check size={12}/></i>}</span>
    <strong>{d.place}</strong><small>{labels[state]}</small>
   </button>;})}
 </div>;
}
