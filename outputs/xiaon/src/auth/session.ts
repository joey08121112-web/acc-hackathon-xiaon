/** 手机号登录的前端一侧：问服务器要不要登录、登录/注册/退出。登录凭据只在 HttpOnly cookie 里，浏览器存储里不放。 */
import { createContext } from 'react';
import type { AuthStatus } from '../../shared/auth';
export async function authPost<T>(path:'status'|'check'|'login'|'register'|'logout',body:unknown={}):Promise<T>{
 const res=await fetch('/api/auth/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw new Error(data?.error?.message??'服务暂时连不上，请稍后再试');
 return data as T;
}
export const authStatus=()=>authPost<AuthStatus>('status');
/** 上次在这台浏览器登录的是哪个号（打码手机号）。同号再登录不清本地进度，换号登录才清。 */
const LAST_ACCOUNT_KEY='xiaon-last-account';
export const rememberAccount=(masked:string)=>{try{localStorage.setItem(LAST_ACCOUNT_KEY,masked);}catch{/* 记不住就每次按换号处理 */}};
export const lastAccount=()=>{try{return localStorage.getItem(LAST_ACCOUNT_KEY);}catch{return null;}};
/** 换账号前清掉上一个人留在这台浏览器里的进度和草稿；只保留声音开关、开发者模式这类设备偏好，
 * 以及「上次登录的号」——退出登录会清进度，但同一个人再登录回来不该重走一遍入门引导。 */
export function clearAccountCache(){
 try{for(const key of Object.keys(localStorage))if(key.startsWith('xiaon-')&&key!=='xiaon-voice-on'&&key!=='xiaon-dev-mode'&&key!==LAST_ACCOUNT_KEY)localStorage.removeItem(key);}catch{/* 存储不可用时没有可清的 */}
}
export async function logout(){
 await authPost('logout').catch(()=>{});clearAccountCache();window.location.replace('/');
}
export const AccountContext=createContext<{phone:string|null;logout:()=>void}>({phone:null,logout(){}});
