import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Sprout } from 'lucide-react';
import { Mascot } from '../Art';
import { PASSWORD_MAX, passwordProblem, phoneProblem } from '../../shared/auth';
import { authPost } from './session';
import '../styles/login.css';
/** 一个入口：先填手机号，注册过的输密码登录，没注册的自己设密码注册。 */
export function LoginScreen({onDone}:{onDone:(phone:string,registered:boolean)=>void}){
 const [step,setStep]=useState<'phone'|'login'|'register'>('phone');
 const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[again,setAgain]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const passwordInput=useRef<HTMLInputElement>(null);
 const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'没成功，请再试一次');}finally{setBusy(false);}};
 const next=(e:FormEvent)=>{e.preventDefault();const problem=phoneProblem(phone);if(problem){setError(problem);return;}
  void run(async()=>{const r=await authPost<{registered:boolean}>('check',{phone});setPassword('');setAgain('');setStep(r.registered?'login':'register');requestAnimationFrame(()=>passwordInput.current?.focus());});};
 const submit=(e:FormEvent)=>{e.preventDefault();
  if(step==='register'){const problem=passwordProblem(password);if(problem){setError(problem);return;}if(password!==again){setError('两次输入的密码不一样');return;}}
  else if(!password){setError('请输入密码');return;}
  const mode=step==='register'?'register':'login';
  void run(async()=>{const r=await authPost<{phone:string}>(mode,{phone,password});onDone(r.phone,mode==='register');});};
 const back=()=>{setStep('phone');setPassword('');setAgain('');setError('');};
 return <div className="root"><div className="app-shell"><div className="onboarding login-screen">
  <div className="onboard-top"><span className="brand"><Sprout size={23}/> 学伴小N</span></div>
  <div className="login-mascot"><Mascot small/></div>
  {step==='phone'?<form className="onboard-copy" onSubmit={next} noValidate>
   <span className="eyebrow">WELCOME</span>
   <h1>用手机号<br/>登录小N</h1>
   <p>注册过的直接登录；第一次来，给自己设个密码就能注册。</p>
   <label className="field">手机号
    <input type="tel" inputMode="numeric" autoComplete="tel" name="phone" maxLength={11} placeholder="11 位手机号" value={phone} autoFocus
     onChange={e=>{setPhone(e.target.value.replace(/\D/g,'').slice(0,11));setError('');}}/>
   </label>
   {error&&<p className="notice error" role="alert">{error}</p>}
   <button className="primary wide" disabled={busy||phone.length!==11}>{busy?'正在查…':'下一步'} <ArrowRight size={18}/></button>
  </form>:<form className="onboard-copy" onSubmit={submit} noValidate>
   <button type="button" className="text-button login-back" onClick={back}><ArrowLeft size={16}/> {phone} · 换一个号</button>
   <h1>{step==='login'?<>欢迎回来</>:<>第一次来，<br/>设个密码吧</>}</h1>
   <p>{step==='login'?'输入你注册时设的密码。':'这个手机号还没注册。密码由你自己定，6 到 32 位，不能有空格。'}</p>
   <input type="text" name="username" autoComplete="username" value={phone} readOnly hidden/>
   <label className="field">{step==='login'?'密码':'设置密码'}
    <span className="login-password">
     <input ref={passwordInput} type={show?'text':'password'} name="password" autoComplete={step==='login'?'current-password':'new-password'} maxLength={PASSWORD_MAX} value={password} onChange={e=>{setPassword(e.target.value);setError('');}}/>
     <button type="button" className="login-eye" aria-label={show?'隐藏密码':'显示密码'} aria-pressed={show} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>
    </span>
   </label>
   {step==='register'&&<label className="field">再输一次
    <input type={show?'text':'password'} name="password-again" autoComplete="new-password" maxLength={PASSWORD_MAX} value={again} onChange={e=>{setAgain(e.target.value);setError('');}}/>
   </label>}
   {error&&<p className="notice error" role="alert">{error}</p>}
   <button className="primary wide" disabled={busy||!password||(step==='register'&&!again)}>{busy?'请稍等…':step==='login'?'登录':'注册并进入'} <ArrowRight size={18}/></button>
  </form>}
  <footer className="onboard-footer">现在先用手机号 + 密码，不发短信验证码。<br/>密码暂时找不回，请记好。</footer>
 </div></div></div>;
}
