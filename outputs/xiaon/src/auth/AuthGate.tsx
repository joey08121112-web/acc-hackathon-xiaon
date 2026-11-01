import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import App from '../App';
import { LoginScreen } from './LoginScreen';
import { AccountContext, authStatus, clearAccountCache, logout } from './session';
/** 服务器要求登录又还没登录时先出登录页；连不上服务器（离线版、本地规则）照旧直接进小N。 */
export function AuthGate(){
 const [state,setState]=useState<'loading'|'login'|'app'>('loading'),[phone,setPhone]=useState<string|null>(null);
 useEffect(()=>{authStatus().then(s=>{setPhone(s.phone);setState(s.required&&!s.phone?'login':'app');}).catch(()=>setState('app'));},[]);
 if(state==='loading')return <div className="root"><div className="app-shell login-loading" aria-busy="true"><Sprout size={28}/></div></div>;
 if(state==='login')return <LoginScreen onDone={(masked,registered)=>{
  // 新注册的号接管了这个浏览器原来的记录，本地进度留着；登录别的号就从干净的本地状态开始。
  if(!registered)clearAccountCache();
  setPhone(masked);setState('app');
 }}/>;
 return <AccountContext.Provider value={{phone,logout:()=>void logout()}}><App/></AccountContext.Provider>;
}
