/** 所有者：Claude（阶段 0 建好，ChatGPT 只调用；设置页里的开关由 ChatGPT 加）。浏览器本地开关，默认关：关时隐藏服务模式条和 Agent 与工具轨迹。 */
import { useSyncExternalStore } from 'react';
export const DEV_MODE_KEY='xiaon-dev-mode';
const EVENT='xiaon-dev-mode-change';
export function isDevMode():boolean{try{return localStorage.getItem(DEV_MODE_KEY)==='1';}catch{return false;}}
export function setDevMode(on:boolean){try{if(on)localStorage.setItem(DEV_MODE_KEY,'1');else localStorage.removeItem(DEV_MODE_KEY);}catch{/* storage blocked: stays off */}window.dispatchEvent(new Event(EVENT));}
function subscribe(notify:()=>void){window.addEventListener(EVENT,notify);window.addEventListener('storage',notify);return()=>{window.removeEventListener(EVENT,notify);window.removeEventListener('storage',notify);};}
export function useDevMode():boolean{return useSyncExternalStore(subscribe,isDevMode,()=>false);}
