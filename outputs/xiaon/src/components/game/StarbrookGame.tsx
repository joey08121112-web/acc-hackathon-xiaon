/** 星溪镇小游戏 × 学伴小N「理解能力」深度融合播放器。
 * 由专业模式地图第一站「理解花园（理解能力 · 星溪镇）」直接唤起：
 * - 加载期以小N伴游故事幕布替代生硬黑屏，提示理解能力观察重点；
 * - 游玩中顶部提供玻璃态 HUD 与非剧透「小N锦囊」思路卡，以及切回问答版入口；
 * - 通关收到 postMessage('starbrook-eval') 后，自动把摘要写入「我的档案 · 近况」、点亮地图站点，
 *   并展示旅程评价卡，支持一键带发现去找小N自由聊或返回地图进入下一站。 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Gamepad2,
  Lightbulb,
  MessageCircle,
  Scale,
  Sparkles,
  X,
} from 'lucide-react';
import { Mascot } from '../../Art';
import { apiRequest } from '../../agent-client';
import { fetchText } from '../../agent-client/http';
import { lastAccount } from '../../auth/session';

const GAME_INDEX = '/starbrook/index.html';
const DONE_KEY_PREFIX = 'xiaon-starbrook-done-v1:';

type DeployState = 'unknown' | 'checking' | 'ready' | 'missing';

/** 游戏章节完成时 postMessage 过来的数据（main.gd post_to_host）。 */
type StarbrookEval = {
  achievements: string[];
  assessment: string;
  record: { weight_attempts: { correct: boolean }[] };
};

export type StarbrookCompletion = {
  completedAt: string;
  achievements: string[];
  tries: number;
  assessment: string;
};

export type StarbrookGameProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: (summary: StarbrookCompletion) => void;
  onGoChat?: () => void;
  onFallbackAssess?: () => void;
};

function doneStorageKey(): string {
  const acct = typeof window !== 'undefined' ? lastAccount() || 'local' : 'local';
  return `${DONE_KEY_PREFIX}${acct}`;
}

export function readStarbrookCompletion(): StarbrookCompletion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(doneStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StarbrookCompletion>;
    if (!parsed || typeof parsed.completedAt !== 'string') return null;
    return {
      completedAt: parsed.completedAt,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      tries: typeof parsed.tries === 'number' ? parsed.tries : 0,
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    };
  } catch {
    return null;
  }
}

function saveStarbrookCompletion(summary: StarbrookCompletion): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(doneStorageKey(), JSON.stringify(summary));
  } catch {
    /* 存储受限时静默忽略 */
  }
}

const COMPANION_TIPS = [
  {
    id: 'clues',
    icon: BookOpen,
    title: '找箱子与对话线索',
    body: '把镇上人物提到的每句话分成「已知的事实」和「要找的条件」，顺着条件联想，不容易漏掉关键道具。',
  },
  {
    id: 'balance',
    icon: Scale,
    title: '钟楼配重小思路',
    body: '先观察左右两边差了多少，再用小步幅试探配平。多试几次完全没关系，每次调整都在帮你看清数量关系。',
  },
  {
    id: 'letter',
    icon: Compass,
    title: '读窗边的信',
    body: '留意信里的「因为、但是、原来」这类词，它们通常把故事里的因果和真实心意连在一起。',
  },
] as const;

export function StarbrookGame({
  open,
  onClose,
  onCompleted,
  onGoChat,
  onFallbackAssess,
}: StarbrookGameProps) {
  const [deploy, setDeploy] = useState<DeployState>('unknown');
  const [loaded, setLoaded] = useState(false);
  const [allowSkipCurtain, setAllowSkipCurtain] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [report, setReport] = useState<StarbrookEval | null>(null);
  const [reportMinimized, setReportMinimized] = useState(false);
  const [saved, setSaved] = useState<'saving' | 'saved' | 'error'>('saving');
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  const onCompletedRef = useRef(onCompleted);
  onCloseRef.current = onClose;
  onCompletedRef.current = onCompleted;

  const coarse =
    typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

  // 系统返回手势先关游戏，不直接退离当前页面。
  useEffect(() => {
    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = '';
    };
  }, []);

  // 打开时校验游戏文件、锁背景滚动并压入独立历史记录。
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) {
      setTipsOpen(false);
      setAllowSkipCurtain(false);
      return;
    }
    if (!pushed.current) {
      window.history.pushState({ ...window.history.state, page: undefined, starbrook: true }, '', '#starbrook');
      pushed.current = true;
    }
    if (deploy === 'unknown' || deploy === 'missing') {
      // 静态资源，不是 API：取不到就当游戏没部署好，别把控制台刷满错误。
      const controller = new AbortController();
      setDeploy('checking');
      fetchText(GAME_INDEX, { signal: controller.signal, cache: 'no-store' })
        .then((body) => {
          setDeploy(/godot|\.wasm/i.test(body) ? 'ready' : 'missing');
        })
        .catch(() => {
          setDeploy('missing');
        });
      return () => {
        controller.abort();
      };
    }
  }, [open, deploy]);

  // 防止旧版游戏构建未发 starbrook-loaded 时遮罩卡住：4 秒后提供一键进入按钮。
  useEffect(() => {
    if (!open || loaded || deploy !== 'ready') return;
    const t = window.setTimeout(() => setAllowSkipCurtain(true), 4000);
    return () => window.clearTimeout(t);
  }, [open, loaded, deploy]);

  // 监听同源 iframe 内的星溪镇事件：加载完成 & 章节评价回传。
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data.type !== 'string') return;
      if (e.data.type === 'starbrook-loaded') {
        setLoaded(true);
        return;
      }
      if (e.data.type !== 'starbrook-eval') return;
      const d = e.data as StarbrookEval;
      setReport(d);
      setReportMinimized(false);
      setTipsOpen(false);
      setSaved('saving');
      const tries = Array.isArray(d.record?.weight_attempts) ? d.record.weight_attempts.length : 0;
      const achievements = Array.isArray(d.achievements) ? d.achievements : [];
      const summary: StarbrookCompletion = {
        completedAt: new Date().toISOString(),
        achievements,
        tries,
        assessment: d.assessment ?? '',
      };
      saveStarbrookCompletion(summary);
      onCompletedRef.current?.(summary);
      const text = `星溪镇通关：${achievements.join('、') || '完成章节'}${
        tries > 1 ? `；配重试了${tries}次` : '；配重一次配平'
      }`.slice(0, 60);
      try {
        await apiRequest('free-chat/profile/item', { action: 'add', kind: 'recent', text });
        setSaved('saved');
      } catch {
        setSaved('error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function closeGame() {
    if (pushed.current) {
      window.history.back();
    } else {
      onClose();
    }
  }

  function switchToAssess() {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
    onClose();
    requestAnimationFrame(() => onFallbackAssess?.());
  }

  function goChatWithDiscovery() {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
    onClose();
    requestAnimationFrame(() => onGoChat?.());
  }

  if (!open) return null;

  const tries = Array.isArray(report?.record?.weight_attempts)
    ? report.record.weight_attempts.length
    : 0;

  return (
    <div className="starbrook-overlay" role="dialog" aria-modal="true" aria-label="理解能力 · 星溪镇小游戏">
      <header className="starbrook-bar">
        <button type="button" className="starbrook-nav-btn" onClick={closeGame}>
          <ArrowLeft size={16} />
          <span>探索地图</span>
        </button>

        <div className="starbrook-title-pill">
          <Gamepad2 size={14} />
          <strong>理解能力 · 星溪镇</strong>
        </div>

        <div className="starbrook-bar-actions">
          {deploy === 'ready' && (
            <button
              type="button"
              className="starbrook-hud-btn"
              aria-expanded={tipsOpen}
              onClick={() => setTipsOpen((v) => !v)}
            >
              <Lightbulb size={15} />
              <span>小N锦囊</span>
            </button>
          )}
          {onFallbackAssess && (
            <button
              type="button"
              className="starbrook-hud-btn ghost"
              onClick={switchToAssess}
              title="切换为小N语音/文字问答测评"
            >
              <span>问答版</span>
            </button>
          )}
        </div>
      </header>

      <div className="starbrook-stage">
        {deploy === 'ready' && (
          <iframe
            src={GAME_INDEX}
            title="星溪镇：钟声响起之前"
            allow="autoplay; fullscreen"
            onLoad={() => {
              // 若 2.5s 后仍未收到 Godot 的 starbrook-loaded，自动淡出幕布以防遮挡。
              window.setTimeout(() => setLoaded(true), 2500);
            }}
          />
        )}

        {(deploy === 'checking' || (deploy === 'ready' && !loaded)) && (
          <div className="starbrook-curtain" role="status" aria-live="polite">
            <div className="starbrook-curtain-inner">
              <div className="starbrook-curtain-mascot">
                <Mascot small mood="happy" />
              </div>
              <span className="starbrook-eyebrow">
                <Sparkles size={12} /> 专业模式 · 理解能力探索
              </span>
              <h2>星溪镇：钟声响起之前</h2>
              <p className="starbrook-curtain-lead">
                正在推开星溪镇的木门… 这次不在题海里找答案，跟着小N在镇子里听故事、拆线索。
              </p>

              <div className="starbrook-quest-grid">
                <div>
                  <BookOpen size={15} />
                  <strong>读懂线索</strong>
                  <span>留心对话与窗边信件里的条件</span>
                </div>
                <div>
                  <Scale size={15} />
                  <strong>看清关系</strong>
                  <span>观察钟楼配重两边的数量平衡</span>
                </div>
                <div>
                  <Award size={15} />
                  <strong>自动归档</strong>
                  <span>通关评价会同步写进「我的档案」</span>
                </div>
              </div>

              <div className="starbrook-progress-track" aria-hidden="true">
                <div className="starbrook-progress-fill" />
              </div>
              <p className="starbrook-control-hint">
                {coarse
                  ? '首次加载约需几秒 · 建议横屏游玩：左下 ◀ ▶ 走动，右下按钮互动'
                  : '首次加载约需几秒 · 键盘 A/D 走动、Shift 快走、E 交互、J 看日志'}
              </p>

              {allowSkipCurtain && (
                <button
                  type="button"
                  className="starbrook-skip-btn"
                  onClick={() => setLoaded(true)}
                >
                  画面已经出来了，直接进入
                </button>
              )}
            </div>
          </div>
        )}

        {deploy === 'missing' && (
          <div className="starbrook-curtain">
            <div className="starbrook-curtain-inner starbrook-missing-card">
              <div className="starbrook-curtain-mascot">
                <Mascot small mood="concerned" />
              </div>
              <h2>星溪镇网页资源暂未就绪</h2>
              <p className="starbrook-curtain-lead">
                当前环境还没放入 Godot Web 导出文件（<code>public/starbrook/</code>）。放好后这里会自动变成可玩入口。
              </p>
              <div className="starbrook-missing-actions">
                {onFallbackAssess && (
                  <button type="button" className="starbrook-gold-btn" onClick={switchToAssess}>
                    <MessageCircle size={16} /> 改用小N「理解能力」问答体验
                  </button>
                )}
                <button
                  type="button"
                  className="starbrook-skip-btn"
                  onClick={() => setDeploy('unknown')}
                >
                  再检查一次
                </button>
              </div>
            </div>
          </div>
        )}

        {tipsOpen && (
          <aside className="starbrook-tips-drawer" aria-label="小N 理解力伴游锦囊">
            <div className="starbrook-tips-head">
              <div className="starbrook-tips-title">
                <Sparkles size={15} />
                <strong>小N 伴游锦囊 · 只给思路不剧透</strong>
              </div>
              <button
                type="button"
                className="starbrook-icon-close"
                aria-label="收起锦囊"
                onClick={() => setTipsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="starbrook-tips-list">
              {COMPANION_TIPS.map((tip) => {
                const Icon = tip.icon;
                return (
                  <div className="starbrook-tip-item" key={tip.id}>
                    <span className="starbrook-tip-icon">
                      <Icon size={15} />
                    </span>
                    <div>
                      <strong>{tip.title}</strong>
                      <p>{tip.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="starbrook-tips-foot">
              {coarse
                ? '操作提示：横屏体验更佳 · 左下 ◀ ▶ 移动 · 右下按键互动'
                : '操作提示：A/D 或方向键移动 · Shift 快走 · E 互动 · J 打开日志 · Esc 关闭'}
            </p>
          </aside>
        )}

        {report && reportMinimized && (
          <button
            type="button"
            className="starbrook-report-fab"
            onClick={() => setReportMinimized(false)}
          >
            <Award size={15} />
            <span>查看本章理解报告</span>
          </button>
        )}

        {report && !reportMinimized && (
          <section className="starbrook-report" role="status" aria-label="星溪镇理解能力探索报告">
            <div className="starbrook-report-head">
              <div className="starbrook-report-title">
                <Award size={18} />
                <div>
                  <strong>理解能力探索完成 · 星溪镇回顾</strong>
                  <span className="starbrook-save-status">
                    {saved === 'saving'
                      ? '正在将探索摘要写入你的档案…'
                      : saved === 'saved'
                        ? '已点亮地图「理解花园」，并写入「成长 · 我的档案」'
                        : '已点亮地图「理解花园」（档案同步稍后再试，完整评价保留在这里）'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="starbrook-icon-close"
                aria-label="收起评价"
                onClick={() => setReportMinimized(true)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="starbrook-badges">
              <span className="starbrook-badge gold">
                <CheckCircle2 size={13} />
                {tries > 1 ? `配重尝试 ${tries} 次后找到平衡` : '钟楼配重一次配平'}
              </span>
              {(report.achievements ?? []).map((a) => (
                <span className="starbrook-badge" key={a}>
                  <Sparkles size={12} /> {a}
                </span>
              ))}
            </div>

            <div className="starbrook-report-text">{report.assessment}</div>

            <div className="starbrook-report-actions">
              {onGoChat && (
                <button
                  type="button"
                  className="starbrook-gold-btn"
                  onClick={goChatWithDiscovery}
                >
                  <MessageCircle size={15} /> 去找小N聊聊这次发现
                </button>
              )}
              <button type="button" className="starbrook-outline-btn" onClick={closeGame}>
                <Compass size={15} /> 返回地图 · 探索下一站
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
