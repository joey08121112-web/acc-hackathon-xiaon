/** 所有者：zCode（改造五：记忆已关提示）。记忆关闭时不提议、不主动提起，但首页与进步卡处如实告知，并给去打开的入口。 */
import { Lock } from 'lucide-react';
export type MemoryOffNoticeProps={memoryEnabled:boolean;where:'home'|'progress_card';navigate:(page:string,tab?:string)=>void};
export function MemoryOffNotice({memoryEnabled,where,navigate}:MemoryOffNoticeProps){
 if(memoryEnabled)return null;
 return <p className="notice memory-off-notice" data-where={where} role="status">
  <Lock size={16}/>记忆已关，小N不会记住这次的方法，下次也不会主动提起。<button onClick={()=>navigate('memory')}>去打开</button>
 </p>;
}
