import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, Sparkles, Sprout } from 'lucide-react';
import { Mascot } from '../Art';
import { PASSWORD_MAX, passwordProblem, phoneProblem } from '../../shared/auth';
import { authPost } from './session';
import '../styles/login.css';

/** 单页极简登录/注册：输满 11 位手机号自动识别新老号，同页展开密码框，一键进入小N。 */
export function LoginScreen({ onDone }: { onDone: (phone: string, registered: boolean) => void }) {
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<'idle' | 'checking' | 'login' | 'register'>('idle');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checkedPhone = useRef('');
  const passwordInput = useRef<HTMLInputElement>(null);

  // 输满 11 位合法手机号后自动查询是否已注册，省去“下一步”跳页。
  useEffect(() => {
    if (phone.length < 11) {
      checkedPhone.current = '';
      setMode('idle');
      setPassword('');
      setAgain('');
      return;
    }
    const problem = phoneProblem(phone);
    if (problem) {
      setMode('idle');
      setError(problem);
      return;
    }
    if (checkedPhone.current === phone) return;
    let cancelled = false;
    setMode('checking');
    setError('');
    authPost<{ registered: boolean }>('check', { phone })
      .then((r) => {
        if (cancelled) return;
        checkedPhone.current = phone;
        setMode(r.registered ? 'login' : 'register');
        requestAnimationFrame(() => passwordInput.current?.focus());
      })
      .catch((e) => {
        if (cancelled) return;
        setMode('idle');
        setError(e instanceof Error ? e.message : '没能连上服务器，请稍后再试');
      });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || mode === 'checking') return;
    const pErr = phoneProblem(phone);
    if (pErr) {
      setError(pErr);
      return;
    }
    // 兜底：如果用户粘贴后立刻按回车还没查完，先查再进入。
    if (mode === 'idle') {
      setMode('checking');
      setError('');
      try {
        const r = await authPost<{ registered: boolean }>('check', { phone });
        checkedPhone.current = phone;
        setMode(r.registered ? 'login' : 'register');
        requestAnimationFrame(() => passwordInput.current?.focus());
      } catch (err) {
        setMode('idle');
        setError(err instanceof Error ? err.message : '没能连上服务器，请再试一次');
      }
      return;
    }
    if (mode === 'register') {
      const problem = passwordProblem(password);
      if (problem) {
        setError(problem);
        return;
      }
      if (password !== again) {
        setError('两次输入的密码不一样');
        return;
      }
    } else if (!password) {
      setError('请输入密码');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await authPost<{ phone: string }>(mode, { phone, password });
      onDone(r.phone, mode === 'register');
    } catch (err) {
      setError(err instanceof Error ? err.message : '没成功，请再试一次');
    } finally {
      setBusy(false);
    }
  };

  const readyToSubmit =
    mode === 'login'
      ? Boolean(password)
      : mode === 'register'
        ? Boolean(password && again)
        : phone.length === 11;

  return (
    <div className="root">
      <div className="app-shell login-shell">
        <div className="onboarding login-screen">
          <div className="onboard-top">
            <span className="brand">
              <Sprout size={22} /> 学伴小N
            </span>
            <span className="login-pill">
              <Sparkles size={13} /> 语音学伴
            </span>
          </div>

          <div className="login-hero">
            <div className="login-mascot-ring">
              <Mascot small mood={mode === 'login' || mode === 'register' ? 'happy' : 'idle'} />
            </div>
            <h1>嗨，来找小N聊聊</h1>
            <p className="login-sub">填手机号即可自动识别，老朋友直接登录，新朋友设个密码马上开始。</p>
          </div>

          <form className="login-card" onSubmit={(e) => void submit(e)} noValidate>
            <label className="field login-field">
              <span className="login-label-row">
                <span>手机号</span>
                {mode === 'checking' && (
                  <span className="login-badge checking">
                    <LoaderCircle size={13} className="spin" /> 识别中…
                  </span>
                )}
                {mode === 'login' && (
                  <span className="login-badge ready">
                    <CheckCircle2 size={13} /> 欢迎回来
                  </span>
                )}
                {mode === 'register' && (
                  <span className="login-badge fresh">
                    <Sparkles size={13} /> 首次来，设密码即注册
                  </span>
                )}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                name="phone"
                maxLength={11}
                placeholder="输入 11 位手机号"
                value={phone}
                autoFocus
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 11));
                  setError('');
                }}
              />
            </label>

            {(mode === 'login' || mode === 'register') && (
              <div className="login-expand">
                <label className="field login-field">
                  <span>{mode === 'login' ? '密码' : '设置密码（6–32 位，不含空格）'}</span>
                  <span className="login-password">
                    <input
                      ref={passwordInput}
                      type={show ? 'text' : 'password'}
                      name="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder={mode === 'login' ? '输入你的密码' : '给自己设一个好记的密码'}
                      maxLength={PASSWORD_MAX}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                    />
                    <button
                      type="button"
                      className="login-eye"
                      aria-label={show ? '隐藏密码' : '显示密码'}
                      aria-pressed={show}
                      onClick={() => setShow((v) => !v)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>

                {mode === 'register' && (
                  <label className="field login-field">
                    <span>确认密码</span>
                    <input
                      type={show ? 'text' : 'password'}
                      name="password-again"
                      autoComplete="new-password"
                      placeholder="再输一遍确认"
                      maxLength={PASSWORD_MAX}
                      value={again}
                      onChange={(e) => {
                        setAgain(e.target.value);
                        setError('');
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {error && (
              <p className="notice error login-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="primary wide login-submit"
              disabled={busy || mode === 'checking' || !readyToSubmit}
            >
              {busy
                ? '正在进入…'
                : mode === 'login'
                  ? '登录小N'
                  : mode === 'register'
                    ? '注册并进入小N'
                    : '继续'}
              <ArrowRight size={18} />
            </button>
          </form>

          <footer className="onboard-footer login-footer">
            免短信验证码 · 每个手机号拥有独立学习档案，密码请记好哦
          </footer>
        </div>
      </div>
    </div>
  );
}
