/** 成长页「我的档案」：自由聊的个人档案。学生可以随时加、改、删；“以前喜欢”的兴趣小N 不会主动提起。 */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiRequest } from '../../agent-client';
import { ITEM_TEXT_MAX, type Profile, type ProfileItem, type ProfileKind } from '../../../shared/free-chat';
const GROUPS: { kind: ProfileKind; title: string; example: string }[] = [
 { kind: 'about', title: '关于我', example: '比如：有个妹妹、养了一只猫' },
 { kind: 'interest', title: '兴趣爱好', example: '比如：打篮球、画画' },
 { kind: 'recent', title: '最近的事', example: '比如：下周有篮球赛。两周后会自动忘掉' },
 { kind: 'method', title: '对我有用的方法', example: '比如：画个图我就懂了' },
];
const DAY = 86400000;
const day = (iso: string) => new Date(iso).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' });
const daysLeft = (item: ProfileItem, now: string) => item.expiresAt ? Math.max(1, Math.ceil((Date.parse(item.expiresAt) - Date.parse(now)) / DAY)) : null;
const onboardingGrade = () => { try { return JSON.parse(localStorage.getItem('xiaon-progress-v1') ?? '{}').grade ?? ''; } catch { return ''; } };
export function ProfileView() {
 const [profile, setProfile] = useState<Profile | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const [selected, setSelected] = useState<string | null>(null), [editText, setEditText] = useState('');
 const [adding, setAdding] = useState<ProfileKind | null>(null), [addText, setAddText] = useState('');
 const [basicDraft, setBasicDraft] = useState<{ nickname: string; grade: string } | null>(null);
 useEffect(() => { apiRequest<Profile>('free-chat/profile').then(setProfile).catch(() => setError('档案暂时打不开，请稍后再试。')); }, []);
 const act = (path: string, body: unknown, after?: () => void) => {
  if (busy) return; setBusy(true); setError('');
  apiRequest<Profile>(path, body).then(next => { setProfile(next); after?.(); }).catch(e => setError((e instanceof Error && e.message) || '这一步没成功，请再试一次。')).finally(() => setBusy(false));
 };
 const edit = (body: object) => act('free-chat/profile/item', body, () => setSelected(null));
 if (!profile) return <section className="info-paper profile-view" aria-label="我的档案"><h2>我的档案</h2><p className="small muted">{error || '正在打开…'}</p></section>;
 const { basic, items, now } = profile;
 const select = (item: ProfileItem) => { setAdding(null); if (selected === item.id) { setSelected(null); return; } setSelected(item.id); setEditText(item.text); };
 const chip = (item: ProfileItem) => { const left = daysLeft(item, now); return <button key={item.id} type="button" className="profile-chip" data-status={item.status} aria-pressed={selected === item.id} onClick={() => select(item)}>{item.text}{left !== null && <small>还剩 {left} 天</small>}</button>; };
 const editor = (item: ProfileItem) => <div className="profile-editor">
  <p className="small muted">{item.source === 'chat' ? `小N 从聊天里记下的 · ${day(item.createdAt)}` : `我自己加的 · ${day(item.createdAt)}`}{item.mentionCount > 1 ? ` · 聊到过 ${item.mentionCount} 次` : ''}</p>
  <input aria-label="改成" value={editText} maxLength={ITEM_TEXT_MAX} onChange={e => setEditText(e.target.value)} />
  <div className="profile-actions">
   <button className="secondary" disabled={busy || !editText.trim() || editText.trim() === item.text} onClick={() => edit({ action: 'update', id: item.id, text: editText })}>保存</button>
   {item.kind === 'interest' && <button className="secondary" disabled={busy} onClick={() => edit({ action: 'status', id: item.id, status: item.status === 'active' ? 'past' : 'active' })}>{item.status === 'active' ? '现在不喜欢了' : '又喜欢了'}</button>}
   <button className="secondary" disabled={busy} onClick={() => edit({ action: 'delete', id: item.id })}>删掉</button>
   <button className="text-button" onClick={() => setSelected(null)}>取消</button>
  </div>
 </div>;
 return <section className="info-paper profile-view" aria-label="我的档案">
  <h2>我的档案</h2>
  <p className="small muted">小N 从聊天里记下的，和你自己加的，都在这里。不对的可以改，不想让它记的可以删。</p>
  {basicDraft ? <div className="profile-basic-form">
   <label className="field">怎么称呼你<input value={basicDraft.nickname} maxLength={20} placeholder="比如：小明" onChange={e => setBasicDraft({ ...basicDraft, nickname: e.target.value })} /></label>
   <label className="field">年级<input value={basicDraft.grade} maxLength={20} placeholder="比如：七年级" onChange={e => setBasicDraft({ ...basicDraft, grade: e.target.value })} /></label>
   <div className="profile-actions"><button className="secondary" disabled={busy} onClick={() => act('free-chat/profile/basic', basicDraft, () => setBasicDraft(null))}>保存</button><button className="text-button" onClick={() => setBasicDraft(null)}>取消</button></div>
  </div> : <p className="profile-basic">称呼：{basic.nickname || <span className="muted">还没填</span>} · 年级：{basic.grade || <span className="muted">还没填</span>}<button className="text-button" onClick={() => setBasicDraft({ nickname: basic.nickname, grade: basic.grade || onboardingGrade() })}>改</button></p>}
  {GROUPS.map(g => {
   const own = items.filter(i => i.kind === g.kind), active = own.filter(i => i.status === 'active'), past = own.filter(i => i.status === 'past');
   const open = own.find(i => i.id === selected);
   return <div className="profile-group" key={g.kind}>
    <h3>{g.title}</h3>
    {own.length === 0 && adding !== g.kind && <p className="small muted">{g.example}</p>}
    {active.length > 0 && <div className="profile-chips">{g.kind === 'interest' && past.length > 0 && <span className="profile-sub">在玩</span>}{active.map(chip)}</div>}
    {past.length > 0 && <div className="profile-chips"><span className="profile-sub">以前喜欢</span>{past.map(chip)}</div>}
    {open && editor(open)}
    {adding === g.kind ? <form className="profile-add" onSubmit={e => { e.preventDefault(); if (addText.trim()) act('free-chat/profile/item', { action: 'add', kind: g.kind, text: addText }, () => { setAdding(null); setAddText(''); }); }}>
     <input aria-label={`加到${g.title}`} autoFocus value={addText} maxLength={ITEM_TEXT_MAX} placeholder={g.example.replace(/^比如：/, '').split(/[。、]/)[0]} onChange={e => setAddText(e.target.value)} />
     <button className="secondary" disabled={busy || !addText.trim()}>加上</button><button type="button" className="text-button" onClick={() => setAdding(null)}>取消</button>
    </form> : <button className="text-button profile-add-button" onClick={() => { setSelected(null); setAddText(''); setAdding(g.kind); }}><Plus size={15} />加一条</button>}
   </div>;
  })}
  {error && <p className="notice" role="status">{error}</p>}
  <label className="check-row profile-switch"><input type="checkbox" checked={profile.autoRemember} disabled={busy} onChange={() => act('free-chat/settings', { autoRemember: !profile.autoRemember })} /><span>让小N 从聊天里记住我<small>关掉后小N 不再记新的东西；已经记下的还在，你可以自己删。</small></span></label>
 </section>;
}
