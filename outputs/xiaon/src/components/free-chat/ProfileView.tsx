/** 成长页「我的档案」：自由聊与星溪镇探索的个人档案卡片。学生可随时新增、编辑、删除或关闭自动记忆。 */
import { useEffect, useState } from 'react';
import {
  Clock3,
  Gamepad2,
  Lightbulb,
  Pencil,
  Plus,
  Sparkles,
  Sprout,
  UserRound,
} from 'lucide-react';
import { apiRequest } from '../../agent-client';
import { useDevMode } from '../../agents/devMode';
import {
  ITEM_TEXT_MAX,
  type ConsolidateResult,
  type Profile,
  type ProfileItem,
  type ProfileKind,
} from '../../../shared/free-chat';

const GROUPS: {
  kind: ProfileKind;
  title: string;
  example: string;
  icon: typeof UserRound;
}[] = [
  { kind: 'about', title: '关于我', example: '比如：有个妹妹、养了一只猫', icon: UserRound },
  { kind: 'interest', title: '兴趣爱好', example: '比如：打篮球、画画', icon: Sparkles },
  {
    kind: 'recent',
    title: '最近的事',
    example: '比如：下周有篮球赛、星溪镇探索记录（两周后自动忘掉）',
    icon: Clock3,
  },
  { kind: 'method', title: '对我有用的方法', example: '比如：画个图我就懂了', icon: Lightbulb },
];

const DAY = 86400000;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  });
const daysLeft = (item: ProfileItem, now: string) =>
  item.expiresAt ? Math.max(1, Math.ceil((Date.parse(item.expiresAt) - Date.parse(now)) / DAY)) : null;
const onboardingGrade = () => {
  try {
    return JSON.parse(localStorage.getItem('xiaon-progress-v1') ?? '{}').grade ?? '';
  } catch {
    return '';
  }
};

export function ProfileView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [adding, setAdding] = useState<ProfileKind | null>(null);
  const [addText, setAddText] = useState('');
  const [basicDraft, setBasicDraft] = useState<{ nickname: string; grade: string } | null>(null);
  const dev = useDevMode();
  const [runNote, setRunNote] = useState('');

  const consolidateNow = () => {
    if (busy) return;
    setBusy(true);
    setRunNote('正在整理…');
    apiRequest<ConsolidateResult>('free-chat/consolidate', {})
      .then((r) => {
        setProfile(r.profile);
        const added = r.changes.filter((c) => c.op === 'add').length;
        const others = r.changes.length - added;
        setRunNote(
          {
            ok: `整理完了：新记下 ${added} 条，更新或又提到 ${others} 条。`,
            empty: '没有新的对话要整理。',
            off: '自动记忆是关着的。',
            failed: '模型这次的回答看不懂，下次再试。',
            skipped: '连续几次没整理成功，这批对话先跳过了。',
            stale: '整理的时候数据变了（重置演示或动了开关），这次的结果没有保存。',
          }[r.status],
        );
      })
      .catch((e) => setRunNote((e instanceof Error && e.message) || '整理失败了'))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    apiRequest<Profile>('free-chat/profile')
      .then(setProfile)
      .catch(() => setError('档案暂时打不开，请稍后再试。'));
  }, []);

  const act = (path: string, body: unknown, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError('');
    apiRequest<Profile>(path, body)
      .then((next) => {
        setProfile(next);
        after?.();
      })
      .catch((e) => setError((e instanceof Error && e.message) || '这一步没成功，请再试一次。'))
      .finally(() => setBusy(false));
  };

  const edit = (body: object) => act('free-chat/profile/item', body, () => setSelected(null));

  if (!profile) {
    return (
      <section className="info-paper profile-view" aria-label="我的档案">
        <h2>我的档案</h2>
        <p className="small muted">{error || '正在打开…'}</p>
      </section>
    );
  }

  const { basic, items, now } = profile;
  const select = (item: ProfileItem) => {
    setAdding(null);
    if (selected === item.id) {
      setSelected(null);
      return;
    }
    setSelected(item.id);
    setEditText(item.text);
  };

  const chip = (item: ProfileItem) => {
    const left = daysLeft(item, now);
    const isStarbrook = item.text.includes('星溪镇');
    return (
      <button
        key={item.id}
        type="button"
        className={`profile-chip${isStarbrook ? ' profile-chip-game' : ''}`}
        data-status={item.status}
        aria-pressed={selected === item.id}
        onClick={() => select(item)}
      >
        {isStarbrook && <Gamepad2 size={13} />}
        <span>{item.text}</span>
        {left !== null && <small>还剩 {left} 天</small>}
      </button>
    );
  };

  const editor = (item: ProfileItem) => (
    <div className="profile-editor">
      <p className="small muted">
        {item.source === 'chat'
          ? `小N 从聊天里记下的 · ${day(item.createdAt)}`
          : `我自己加的 · ${day(item.createdAt)}`}
        {item.mentionCount > 1 ? ` · 聊到过 ${item.mentionCount} 次` : ''}
      </p>
      <input
        aria-label="改成"
        value={editText}
        maxLength={ITEM_TEXT_MAX}
        onChange={(e) => setEditText(e.target.value)}
      />
      <div className="profile-actions">
        <button
          className="secondary"
          disabled={busy || !editText.trim() || editText.trim() === item.text}
          onClick={() => edit({ action: 'update', id: item.id, text: editText })}
        >
          保存
        </button>
        {item.kind === 'interest' && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              edit({
                action: 'status',
                id: item.id,
                status: item.status === 'active' ? 'past' : 'active',
              })
            }
          >
            {item.status === 'active' ? '现在不喜欢了' : '又喜欢了'}
          </button>
        )}
        <button
          className="secondary"
          disabled={busy}
          onClick={() => edit({ action: 'delete', id: item.id })}
        >
          删掉
        </button>
        <button className="text-button" onClick={() => setSelected(null)}>
          取消
        </button>
      </div>
    </div>
  );

  const displayGrade = basic.grade || onboardingGrade();

  return (
    <section className="profile-view profile-modern" aria-label="我的档案">
      <div className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-avatar-badge" aria-hidden="true">
            <Sprout size={22} />
          </div>
          <div className="profile-hero-meta">
            <h2>{basic.nickname || '小N 的小伙伴'}</h2>
            <div className="profile-hero-tags">
              <span>{displayGrade || '年级未填'}</span>
              <span>已记录 {items.length} 条</span>
            </div>
          </div>
          {!basicDraft && (
            <button
              type="button"
              className="profile-edit-pill"
              onClick={() => setBasicDraft({ nickname: basic.nickname, grade: displayGrade })}
            >
              <Pencil size={13} /> 编辑
            </button>
          )}
        </div>
        <p className="profile-hero-desc">
          小N 从聊天和星溪镇探索里记下的小事，和你自己加的都在这里，随时能改、能删。
        </p>

        {basicDraft && (
          <div className="profile-basic-form">
            <label className="field">
              怎么称呼你
              <input
                value={basicDraft.nickname}
                maxLength={20}
                placeholder="比如：小明"
                onChange={(e) => setBasicDraft({ ...basicDraft, nickname: e.target.value })}
              />
            </label>
            <label className="field">
              年级
              <input
                value={basicDraft.grade}
                maxLength={20}
                placeholder="比如：七年级"
                onChange={(e) => setBasicDraft({ ...basicDraft, grade: e.target.value })}
              />
            </label>
            <div className="profile-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => act('free-chat/profile/basic', basicDraft, () => setBasicDraft(null))}
              >
                保存资料
              </button>
              <button className="text-button" onClick={() => setBasicDraft(null)}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="profile-groups-stack">
        {GROUPS.map((g) => {
          const Icon = g.icon;
          const own = items.filter((i) => i.kind === g.kind);
          const active = own.filter((i) => i.status === 'active');
          const past = own.filter((i) => i.status === 'past');
          const open = own.find((i) => i.id === selected);
          return (
            <div className="profile-group-card" key={g.kind}>
              <div className="profile-group-head">
                <div className="profile-group-title">
                  <span className="profile-group-icon">
                    <Icon size={15} />
                  </span>
                  <h3>{g.title}</h3>
                  {own.length > 0 && <span className="profile-group-count">{own.length}</span>}
                </div>
                {adding !== g.kind && (
                  <button
                    type="button"
                    className="profile-add-pill"
                    onClick={() => {
                      setSelected(null);
                      setAddText('');
                      setAdding(g.kind);
                    }}
                  >
                    <Plus size={14} /> 添加
                  </button>
                )}
              </div>

              {own.length === 0 && adding !== g.kind && (
                <p className="small muted profile-empty-hint">{g.example}</p>
              )}

              {active.length > 0 && (
                <div className="profile-chips">
                  {g.kind === 'interest' && past.length > 0 && (
                    <span className="profile-sub">在玩</span>
                  )}
                  {active.map(chip)}
                </div>
              )}

              {past.length > 0 && (
                <div className="profile-chips">
                  <span className="profile-sub">以前喜欢</span>
                  {past.map(chip)}
                </div>
              )}

              {open && editor(open)}

              {adding === g.kind && (
                <form
                  className="profile-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (addText.trim()) {
                      act('free-chat/profile/item', { action: 'add', kind: g.kind, text: addText }, () => {
                        setAdding(null);
                        setAddText('');
                      });
                    }
                  }}
                >
                  <input
                    aria-label={`加到${g.title}`}
                    autoFocus
                    value={addText}
                    maxLength={ITEM_TEXT_MAX}
                    placeholder={g.example.replace(/^比如：/, '').split(/[。、]/)[0]}
                    onChange={(e) => setAddText(e.target.value)}
                  />
                  <div className="profile-actions">
                    <button className="primary" disabled={busy || !addText.trim()}>
                      加上
                    </button>
                    <button type="button" className="text-button" onClick={() => setAdding(null)}>
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}

      {dev && (
        <p className="small muted profile-dev">
          <button className="secondary" disabled={busy} onClick={consolidateNow}>
            现在整理
          </button>
          {runNote}
        </p>
      )}

      <div className="profile-switch-card">
        <div>
          <strong>让小N 从聊天里记住我</strong>
          <small>关掉后小N 不再记新的东西；已经记下的还在，你可以自己删。</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={profile.autoRemember}
          aria-label="让小N 从聊天里记住我"
          className="ui-switch"
          disabled={busy}
          onClick={() => act('free-chat/settings', { autoRemember: !profile.autoRemember })}
        >
          <span className="ui-switch-thumb" />
        </button>
      </div>
    </section>
  );
}
