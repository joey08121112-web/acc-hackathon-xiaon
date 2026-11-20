/** 空间山丘 · 《星象风车台》互动小游戏（专业模式第五站「空间想象」深度融合）。
 * 核心玩法：先在标准笛卡尔星盘 [-4..4] × [-4..4] 上摆放旋转后的预测折线虚影，
 * 再「拨动星象齿轮」观看真实旋转轨迹与程序诊断反馈；
 * 全 4 关完成后生成探索手记评价卡，自动同步至「成长 · 我的档案」并点亮地图站点。 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  Eye,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  RotateCw,
  Sparkles,
  Target,
  Undo2,
  X,
} from 'lucide-react';
import { Mascot, type PetMood } from '../../Art';
import { apiRequest } from '../../agent-client';
import { lastAccount } from '../../auth/session';
import {
  GRID_MAX,
  GRID_MIN,
  SPATIAL_LEVELS,
  buildSpatialSummary,
  evaluatePrediction,
  formatPoint,
  pointsEqual,
  rotatePolyline,
  type GridPoint,
  type PredictionEvaluation,
  type SpatialLevelRecord,
  type SpatialSummary,
} from './spatialLogic';

const DONE_KEY_PREFIX = 'xiaon-spatial-hill-done-v1:';
const SVG_SIZE = 360;
const SVG_CENTER = 180;
const SVG_CELL = 36;
const GRID_TICKS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

/** 背景装饰星点（低对比度，不干扰格点辨识）。 */
const STARFIELD = [
  { x: 26, y: 24, r: 1.2, o: 0.45 },
  { x: 92, y: 18, r: 1.0, o: 0.35 },
  { x: 268, y: 20, r: 1.4, o: 0.5 },
  { x: 336, y: 30, r: 1.1, o: 0.4 },
  { x: 18, y: 148, r: 1.0, o: 0.3 },
  { x: 344, y: 132, r: 1.3, o: 0.45 },
  { x: 24, y: 292, r: 1.2, o: 0.35 },
  { x: 338, y: 306, r: 1.4, o: 0.45 },
  { x: 118, y: 346, r: 1.0, o: 0.35 },
  { x: 248, y: 344, r: 1.1, o: 0.35 },
] as const;

export type SpatialCompletion = {
  completedAt: string;
  achievements: string[];
  totalAttempts: number;
  firstTryCount: number;
  usedGuideAny: boolean;
  assessment: string;
};

export type SpatialHillGameProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: (summary: SpatialCompletion) => void;
  onGoChat?: () => void;
  onFallbackAssess?: () => void;
};

type StagePhase = 'placing' | 'animating' | 'matched' | 'missed' | 'completed';

function doneStorageKey(): string {
  const acct = typeof window !== 'undefined' ? lastAccount() || 'local' : 'local';
  return `${DONE_KEY_PREFIX}${acct}`;
}

export function readSpatialCompletion(): SpatialCompletion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(doneStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SpatialCompletion>;
    if (!parsed || typeof parsed.completedAt !== 'string') return null;
    return {
      completedAt: parsed.completedAt,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      totalAttempts: typeof parsed.totalAttempts === 'number' ? parsed.totalAttempts : 0,
      firstTryCount: typeof parsed.firstTryCount === 'number' ? parsed.firstTryCount : 0,
      usedGuideAny: Boolean(parsed.usedGuideAny),
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    };
  } catch {
    return null;
  }
}

function saveSpatialCompletion(summary: SpatialCompletion): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(doneStorageKey(), JSON.stringify(summary));
  } catch {
    /* 存储受限时静默忽略 */
  }
}

function toSvgX(x: number): number {
  return SVG_CENTER + x * SVG_CELL;
}

function toSvgY(y: number): number {
  return SVG_CENTER - y * SVG_CELL;
}

function rotateContinuous(
  point: GridPoint,
  center: GridPoint,
  clockwiseDeg: number,
): { x: number; y: number } {
  const rad = (clockwiseDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos + dy * sin,
    y: center.y - dx * sin + dy * cos,
  };
}

function describeClockwiseArc(
  center: GridPoint,
  startPoint: GridPoint,
  sweepDeg: number,
): string | null {
  if (sweepDeg < 2) return null;
  const dx = startPoint.x - center.x;
  const dy = startPoint.y - center.y;
  const radiusGrid = Math.hypot(dx, dy);
  if (radiusGrid < 0.01) return null;
  const rSvg = radiusGrid * SVG_CELL;
  const end = rotateContinuous(startPoint, center, sweepDeg);
  const sx = toSvgX(startPoint.x);
  const sy = toSvgY(startPoint.y);
  const ex = toSvgX(end.x);
  const ey = toSvgY(end.y);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  // SVG 纵轴向下，sweep-flag=1 恰好对应视觉顺时针方向。
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${rSvg.toFixed(2)} ${rSvg.toFixed(2)} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

function polylinePointsAttr(pts: readonly { x: number; y: number }[]): string {
  return pts.map((p) => `${toSvgX(p.x).toFixed(2)},${toSvgY(p.y).toFixed(2)}`).join(' ');
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

const VERTEX_BADGES = ['①', '②', '③'] as const;

export function SpatialHillGame({
  open,
  onClose,
  onCompleted,
  onGoChat,
  onFallbackAssess,
}: SpatialHillGameProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pushed = useRef(false);
  const rafRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const onCompletedRef = useRef(onCompleted);
  onCloseRef.current = onClose;
  onCompletedRef.current = onCompleted;

  const [levelIdx, setLevelIdx] = useState(0);
  const [placed, setPlaced] = useState<GridPoint[]>([]);
  const [phase, setPhase] = useState<StagePhase>('placing');
  const [animDeg, setAnimDeg] = useState(0);
  const [evaluation, setEvaluation] = useState<PredictionEvaluation | null>(null);
  const [guideEnabled, setGuideEnabled] = useState(false);
  const [guideUsedInLevel, setGuideUsedInLevel] = useState(false);
  const [attemptsInLevel, setAttemptsInLevel] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [hintTierVisible, setHintTierVisible] = useState<1 | 2 | 3>(1);
  const [maxHintUsedInLevel, setMaxHintUsedInLevel] = useState(0);
  const [records, setRecords] = useState<SpatialLevelRecord[]>([]);
  const [summary, setSummary] = useState<SpatialSummary | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hoverPoint, setHoverPoint] = useState<GridPoint | null>(null);
  const [cursor, setCursor] = useState<GridPoint>({ x: 0, y: 0 });
  const [boardFocused, setBoardFocused] = useState(false);
  const [microNotice, setMicroNotice] = useState('');

  const level = SPATIAL_LEVELS[levelIdx];
  const expectedTarget = useMemo(
    () => rotatePolyline(level.source, level.center, level.clockwiseDeg),
    [level],
  );

  // 切换关卡时对齐键盘光标到当前关的旋转中心
  useEffect(() => {
    setCursor(level.center);
  }, [level]);

  // 浏览器返回手势兼容（与原生 <dialog> 的 Esc / close 请求协同，无双退历史栈）
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
      } else {
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 打开 / 关闭原生模态 <dialog>（严禁使用 body overflow: hidden，依赖 CSS overscroll-behavior）
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      if (!pushed.current) {
        window.history.pushState(
          { ...window.history.state, page: undefined, spatialHill: true },
          '',
          '#spatial-hill',
        );
        pushed.current = true;
      }
    } else {
      setTipsOpen(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  function handleNativeClose() {
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = '';
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setTipsOpen(false);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
    onCloseRef.current();
  }

  function closeGame() {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      onClose();
    }
  }

  function switchToAssess() {
    closeGame();
    requestAnimationFrame(() => onFallbackAssess?.());
  }

  function goChatWithDiscovery() {
    closeGame();
    requestAnimationFrame(() => onGoChat?.());
  }

  function resetLevelState(nextIdx: number, keepGuide = false) {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setLevelIdx(nextIdx);
    setPlaced([]);
    setPhase('placing');
    setAnimDeg(0);
    setEvaluation(null);
    setGuideEnabled(keepGuide);
    setGuideUsedInLevel(keepGuide);
    setAttemptsInLevel(0);
    setTipsOpen(false);
    setHintTierVisible(1);
    setMaxHintUsedInLevel(0);
    setMicroNotice('');
  }

  function restartAll() {
    setRecords([]);
    setSummary(null);
    setSaved('idle');
    resetLevelState(0, false);
  }

  function toggleTips() {
    setTipsOpen((prev) => {
      const next = !prev;
      if (next) {
        setMaxHintUsedInLevel((m) => Math.max(m, hintTierVisible));
      }
      return next;
    });
  }

  function revealNextHint() {
    setHintTierVisible((prev) => {
      const next = (prev < 3 ? prev + 1 : 3) as 1 | 2 | 3;
      setMaxHintUsedInLevel((m) => Math.max(m, next));
      return next;
    });
  }

  function toggleGuide() {
    if (phase !== 'placing') return;
    setGuideEnabled((prev) => {
      const next = !prev;
      if (next) setGuideUsedInLevel(true);
      return next;
    });
  }

  function handleSelectPoint(pt: GridPoint) {
    if (phase !== 'placing') return;
    setMicroNotice('');
    setCursor(pt);

    // 点中已放的最后一个点 → 温和撤销该点
    if (placed.length > 0 && pointsEqual(placed[placed.length - 1], pt)) {
      setPlaced((prev) => prev.slice(0, -1));
      return;
    }

    // 防止重复叠放已有顶点
    if (placed.some((p) => pointsEqual(p, pt))) {
      setMicroNotice(`格点 ${formatPoint(pt)} 已经在虚影里啦，换一个新顶点试试。`);
      return;
    }

    if (placed.length >= 3) {
      setMicroNotice('已放满 3 个顶点，可直接点「拨动星象齿轮」，或先撤销再调整。');
      return;
    }

    setPlaced((prev) => [...prev, pt]);
  }

  function handleAnchorCenter() {
    if (phase !== 'placing' || placed.length > 0) return;
    handleSelectPoint(level.center);
  }

  function handleUndo() {
    if (phase !== 'placing' || placed.length === 0) return;
    setMicroNotice('');
    setPlaced((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    if (phase !== 'placing' || placed.length === 0) return;
    setMicroNotice('');
    setPlaced([]);
  }

  function handleBoardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (phase !== 'placing') return;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setCursor((c) => ({ x: c.x, y: Math.min(GRID_MAX, c.y + 1) }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setCursor((c) => ({ x: c.x, y: Math.max(GRID_MIN, c.y - 1) }));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setCursor((c) => ({ x: Math.max(GRID_MIN, c.x - 1), y: c.y }));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setCursor((c) => ({ x: Math.min(GRID_MAX, c.x + 1), y: c.y }));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelectPoint(cursor);
        break;
      case 'Backspace':
        e.preventDefault();
        handleUndo();
        break;
    }
  }

  function finishSpin(result: PredictionEvaluation, attemptNum: number) {
    setAnimDeg(level.clockwiseDeg);
    setEvaluation(result);
    if (result.matched) {
      setPhase('matched');
      const rec: SpatialLevelRecord = {
        levelId: level.id,
        levelTitle: level.title,
        isOriginCenter: level.isOriginCenter,
        clockwiseDeg: level.clockwiseDeg,
        attempts: attemptNum,
        usedGuide: guideUsedInLevel,
        usedHints: maxHintUsedInLevel,
        completed: true,
      };
      setRecords((prev) => [...prev.filter((r) => r.levelId !== level.id), rec]);
    } else {
      setPhase('missed');
    }
  }

  function handleSpinGear() {
    if (phase !== 'placing' || placed.length !== 3) return;
    setMicroNotice('');
    setTipsOpen(false);
    const nextAttempt = attemptsInLevel + 1;
    setAttemptsInLevel(nextAttempt);
    const result = evaluatePrediction(placed, level);

    if (prefersReducedMotion()) {
      finishSpin(result, nextAttempt);
      return;
    }

    setPhase('animating');
    setAnimDeg(0);
    const duration =
      level.clockwiseDeg === 90 ? 860 : level.clockwiseDeg === 180 ? 1050 : 1220;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeInOutCubic(t);
      setAnimDeg(level.clockwiseDeg * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        finishSpin(result, nextAttempt);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleRetryCalibrate() {
    // 清除真实落点与上一次虚影，让孩子基于观察独立重摆，绝不代填
    setPlaced([]);
    setAnimDeg(0);
    setEvaluation(null);
    setPhase('placing');
    setMicroNotice('已收起真实星轨，按刚才的观察重新点出 3 个顶点吧。');
  }

  async function completeAllLevels() {
    const finalSummary = buildSpatialSummary(records);
    setSummary(finalSummary);
    setPhase('completed');
    setSaved('saving');

    const completion: SpatialCompletion = {
      completedAt: new Date().toISOString(),
      achievements: finalSummary.achievements,
      totalAttempts: finalSummary.totalAttempts,
      firstTryCount: finalSummary.firstTryCount,
      usedGuideAny: finalSummary.usedGuideAny,
      assessment: finalSummary.assessment,
    };
    saveSpatialCompletion(completion);
    onCompletedRef.current?.(completion);

    try {
      await apiRequest('free-chat/profile/item', {
        action: 'add',
        kind: 'recent',
        text: finalSummary.profileText,
      });
      setSaved('saved');
    } catch {
      setSaved('error');
    }
  }

  function handleAdvance() {
    if (levelIdx + 1 < SPATIAL_LEVELS.length) {
      resetLevelState(levelIdx + 1, false);
    } else {
      void completeAllLevels();
    }
  }

  // 计算当前渲染中的旋转星叶坐标（动画结束后精确吸附整数目标）
  const rotatingPoints = useMemo(() => {
    if (phase === 'matched' || phase === 'missed') {
      return expectedTarget;
    }
    return level.source.map((pt) => rotateContinuous(pt, level.center, animDeg));
  }, [phase, expectedTarget, level, animDeg]);

  const showRotatingOverlay = phase === 'animating' || phase === 'matched' || phase === 'missed';
  const activeCoord = hoverPoint ?? (boardFocused ? cursor : null);

  // 逐边追踪辅助弧线（只画第 1 条边端点 p1 的方向参考弧，不直接画终点答案折线）
  const guideArcPath = useMemo(() => {
    if (!guideEnabled || phase !== 'placing') return null;
    // 画 70% 弧段加上方向感，帮助建立顺时针旋转角度直觉而不直接标出精确终点格
    return describeClockwiseArc(level.center, level.source[1], level.clockwiseDeg * 0.72);
  }, [guideEnabled, phase, level]);

  const spinArc1 = useMemo(
    () => (showRotatingOverlay ? describeClockwiseArc(level.center, level.source[1], animDeg) : null),
    [showRotatingOverlay, level, animDeg],
  );
  const spinArc2 = useMemo(
    () => (showRotatingOverlay ? describeClockwiseArc(level.center, level.source[2], animDeg) : null),
    [showRotatingOverlay, level, animDeg],
  );

  const mascotMood: PetMood =
    phase === 'matched' || phase === 'completed'
      ? 'happy'
      : phase === 'animating'
        ? 'thinking'
        : phase === 'missed'
          ? 'concerned'
          : 'idle';

  const activeTipList = level.hints.slice(0, hintTierVisible);

  return (
    <dialog
      ref={dialogRef}
      className="spatial-dialog"
      aria-labelledby={titleId}
      onClose={handleNativeClose}
    >
      {open && (
        <>
          <header className="spatial-bar">
            <button type="button" className="spatial-nav-btn" onClick={closeGame}>
              <ArrowLeft size={16} />
              <span>返回</span>
            </button>

            <div className="spatial-title-pill">
              <Compass size={15} />
              <h1 id={titleId}>风车山丘</h1>
              <span className="spatial-level-pill" aria-label={`第 ${level.index} 关，共 4 关`}>
                {phase === 'completed' ? '4/4' : `${level.index}/4`}
              </span>
            </div>

            <div className="spatial-bar-actions">
              {phase !== 'completed' && (
                <button
                  type="button"
                  className="spatial-hud-btn"
                  aria-expanded={tipsOpen}
                  onClick={toggleTips}
                >
                  <Lightbulb size={15} />
                  <span>锦囊</span>
                </button>
              )}
              {onFallbackAssess && (
                <button
                  type="button"
                  className="spatial-hud-btn ghost"
                  onClick={switchToAssess}
                  title="切换为小N空间想象问答版"
                >
                  <span>问答版</span>
                </button>
              )}
            </div>
          </header>

          <div className="spatial-stage">
            {tipsOpen && phase !== 'completed' && (
              <aside className="spatial-tips-drawer" aria-label="小N 空间旋转伴游锦囊">
                <div className="spatial-tips-head">
                  <div className="spatial-tips-title">
                    <Sparkles size={15} />
                    <strong>
                      小N 伴游锦囊 · 第 {level.index} 关（只给思路不剧透）
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="spatial-icon-close"
                    aria-label="收起锦囊"
                    onClick={() => setTipsOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="spatial-tips-list">
                  {activeTipList.map((hint) => (
                    <div className="spatial-tip-item" key={hint.tier}>
                      <span className="spatial-tip-tier">{hint.tier}</span>
                      <div>
                        <strong>{hint.title}</strong>
                        <p>{hint.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="spatial-tips-foot">
                  {hintTierVisible < 3 ? (
                    <button
                      type="button"
                      className="spatial-next-hint-btn"
                      onClick={revealNextHint}
                    >
                      再看第 {hintTierVisible + 1} 层思路（{hintTierVisible}/3）
                    </button>
                  ) : (
                    <span>3 层思路已全部展开 · 也可以开启星盘下方的「逐边追踪」</span>
                  )}
                </div>
              </aside>
            )}

            {phase === 'completed' && summary ? (
              <section className="spatial-complete-wrap" aria-label="空间山丘探索手记评价卡">
                <div className="spatial-complete-card">
                  <div className="spatial-complete-mascot">
                    <Mascot small mood="happy" />
                  </div>
                  <span className="spatial-eyebrow">
                    <Award size={13} /> 空间山丘 · 探索手记评价卡
                  </span>
                  <h2>4 座星象风车台全部点亮！</h2>
                  <p className="spatial-save-status" role="status">
                    {saved === 'saving'
                      ? '正在把本次星象观察写入「成长 · 我的档案」…'
                      : saved === 'saved'
                        ? '已点亮地图「空间山丘」，探索摘要同步写入「成长 · 我的档案」'
                        : '已点亮地图「空间山丘」（档案同步稍后再试，手记已保存在本地）'}
                  </p>

                  <div className="spatial-badges">
                    <span className="spatial-badge gold">
                      <CheckCircle2 size={13} />
                      {summary.firstTryCount === summary.totalLevels
                        ? '4/4 关一次点亮'
                        : `共校准 ${summary.totalAttempts} 次 · ${summary.firstTryCount}/4 关一次命中`}
                    </span>
                    {summary.achievements.map((a) => (
                      <span className="spatial-badge" key={a}>
                        <Sparkles size={12} /> {a}
                      </span>
                    ))}
                  </div>

                  <div className="spatial-assessment-box">{summary.assessment}</div>

                  <ul className="spatial-record-list" aria-label="4 座星台完成记录">
                    {SPATIAL_LEVELS.map((lv) => {
                      const rec = records.find((r) => r.levelId === lv.id);
                      return (
                        <li key={lv.id}>
                          <div>
                            <strong>
                              {lv.index}. {lv.title}
                            </strong>
                            <span>{lv.subtitle}</span>
                          </div>
                          <div className="spatial-record-tags">
                            <em>
                              {rec?.attempts === 1
                                ? '一次命中'
                                : `尝试 ${rec?.attempts ?? 1} 次`}
                            </em>
                            {rec?.usedGuide && <small>逐边辅助</small>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="spatial-complete-actions">
                    {onGoChat && (
                      <button
                        type="button"
                        className="spatial-gold-btn"
                        onClick={goChatWithDiscovery}
                      >
                        <MessageCircle size={16} /> 带着发现找小N聊聊
                      </button>
                    )}
                    <button type="button" className="spatial-outline-btn" onClick={closeGame}>
                      <Compass size={16} /> 返回五维地图
                    </button>
                    <button type="button" className="spatial-ghost-btn" onClick={restartAll}>
                      <RotateCcw size={15} /> 再玩一次
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <div className="spatial-play-shell">
                {/* 4 关星轨进度条 */}
                <ol className="spatial-stepper" aria-label="关卡进度">
                  {SPATIAL_LEVELS.map((lv, idx) => {
                    const done = records.some((r) => r.levelId === lv.id && r.completed);
                    const active = idx === levelIdx;
                    return (
                      <li
                        key={lv.id}
                        className={done ? 'done' : active ? 'active' : 'upcoming'}
                        aria-current={active ? 'step' : undefined}
                      >
                        <span className="spatial-step-dot">{done ? '✓' : lv.index}</span>
                        <span className="spatial-step-name">{lv.title}</span>
                      </li>
                    );
                  })}
                </ol>

                <div className="spatial-workspace">
                  {/* 左侧/上方：星盘 SVG 舞台 */}
                  <div className="spatial-board-col">
                    <div className="spatial-mission-head">
                      <div className="spatial-mission-meta">
                        <span className="spatial-eyebrow">
                          第 {level.index} / {SPATIAL_LEVELS.length} 座星台
                        </span>
                        <span
                          className={`spatial-rule-pill${level.isOriginCenter ? '' : ' non-origin'}`}
                        >
                          <Target size={12} />
                          绕 {formatPoint(level.center)} · 顺时针 {level.clockwiseDeg}°
                        </span>
                      </div>
                      <h2>{level.title}</h2>
                      <p>{level.story}</p>
                    </div>

                    <div
                      className="spatial-board-frame"
                      tabIndex={0}
                      role="application"
                      aria-label={`星象坐标星盘，${level.title}，${level.subtitle}。可直接点击整数格点，或用方向键移动光标、回车放置顶点、退格撤销。`}
                      onFocus={() => setBoardFocused(true)}
                      onBlur={() => setBoardFocused(false)}
                      onKeyDown={handleBoardKeyDown}
                    >
                      <div className="spatial-board-hud-strip">
                        <span className="spatial-legend-chip source">
                          <i /> 原风叶
                        </span>
                        <span
                          className={`spatial-legend-chip ${phase === 'missed' ? 'missed' : 'ghost'}`}
                        >
                          <i /> 我的虚影
                        </span>
                        {showRotatingOverlay && (
                          <span className="spatial-legend-chip truth">
                            <i /> 真实星轨
                          </span>
                        )}
                        <span className="spatial-coord-readout" aria-live="polite">
                          {phase === 'animating'
                            ? `旋转 ${Math.round(animDeg)}° / ${level.clockwiseDeg}°`
                            : activeCoord
                              ? `格点 ${formatPoint(activeCoord)}`
                              : '横轴向右 · 纵轴向上'}
                        </span>
                      </div>

                      <svg
                        className="spatial-svg"
                        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                        aria-hidden="true"
                      >
                        <defs>
                          <radialGradient id="spatial-bg-glow" cx="50%" cy="46%" r="58%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                            <stop offset="100%" stopColor="#f2effb" stopOpacity="1" />
                          </radialGradient>
                          <filter id="spatial-gold-glow" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* 明亮浅紫方格纸底盘与柔和点缀 */}
                        <rect
                          x="0"
                          y="0"
                          width={SVG_SIZE}
                          height={SVG_SIZE}
                          rx="18"
                          fill="url(#spatial-bg-glow)"
                          stroke="#dcd5f2"
                          strokeWidth="1.2"
                        />
                        {STARFIELD.map((st, idx) => (
                          <circle
                            key={idx}
                            cx={st.x}
                            cy={st.y}
                            r={st.r + 0.5}
                            fill="#c4b5ea"
                            opacity={st.o * 0.85}
                          />
                        ))}

                        {/* 围绕旋转中心的柔和风车圈 */}
                        {[1, 2, 3].map((ring) => (
                          <circle
                            key={ring}
                            cx={toSvgX(level.center.x)}
                            cy={toSvgY(level.center.y)}
                            r={ring * SVG_CELL}
                            fill="none"
                            stroke="rgba(209, 152, 47, 0.22)"
                            strokeDasharray="3 5"
                          />
                        ))}

                        {/* 整数网格线 [-4..4] */}
                        {GRID_TICKS.map((t) => {
                          const posX = toSvgX(t);
                          const posY = toSvgY(t);
                          const isAxis = t === 0;
                          return (
                            <g key={t}>
                              <line
                                x1={posX}
                                y1={toSvgY(GRID_MAX)}
                                x2={posX}
                                y2={toSvgY(GRID_MIN)}
                                stroke={isAxis ? '#877eb0' : '#dfdbf0'}
                                strokeWidth={isAxis ? 1.6 : 1}
                              />
                              <line
                                x1={toSvgX(GRID_MIN)}
                                y1={posY}
                                x2={toSvgX(GRID_MAX)}
                                y2={posY}
                                stroke={isAxis ? '#877eb0' : '#dfdbf0'}
                                strokeWidth={isAxis ? 1.6 : 1}
                              />
                            </g>
                          );
                        })}

                        {/* 坐标轴箭头与方向标识（横轴 x 向右、纵轴 y 向上） */}
                        <path
                          d={`M ${toSvgX(GRID_MAX) + 10} ${SVG_CENTER} l -7 -4 l 0 8 z`}
                          fill="#6e6599"
                        />
                        <text
                          x={toSvgX(GRID_MAX) + 14}
                          y={SVG_CENTER + 4}
                          className="spatial-axis-name"
                        >
                          x
                        </text>
                        <path
                          d={`M ${SVG_CENTER} ${toSvgY(GRID_MAX) - 10} l -4 7 l 8 0 z`}
                          fill="#6e6599"
                        />
                        <text
                          x={SVG_CENTER + 7}
                          y={toSvgY(GRID_MAX) - 10}
                          className="spatial-axis-name"
                        >
                          y
                        </text>

                        {/* 坐标刻度数字（沿底边与左边排布，永不遮挡中心与图形） */}
                        {GRID_TICKS.map((t) => (
                          <g key={`lbl-${t}`}>
                            <text
                              x={toSvgX(t)}
                              y={toSvgY(GRID_MIN) + 18}
                              textAnchor="middle"
                              className="spatial-tick-label"
                            >
                              {t}
                            </text>
                            <text
                              x={toSvgX(GRID_MIN) - 14}
                              y={toSvgY(t) + 3.5}
                              textAnchor="end"
                              className="spatial-tick-label"
                            >
                              {t}
                            </text>
                          </g>
                        ))}

                        {/* 非原点关柔和提示坐标原点 O，帮助识别图钉偏离 */}
                        {!level.isOriginCenter && (
                          <g>
                            <circle
                              cx={toSvgX(0)}
                              cy={toSvgY(0)}
                              r="3.2"
                              fill="#9e95c4"
                            />
                            <text
                              x={toSvgX(0) - 9}
                              y={toSvgY(0) + 13}
                              className="spatial-origin-hint"
                            >
                              O
                            </text>
                          </g>
                        )}

                        {/* 逐边追踪辅助：高亮第一段边及顺时针方向参考弧 */}
                        {guideEnabled && phase === 'placing' && (
                          <g className="spatial-guide-layer">
                            {guideArcPath && (
                              <path
                                d={guideArcPath}
                                fill="none"
                                stroke="#2c926c"
                                strokeWidth="2.4"
                                strokeDasharray="5 5"
                                opacity="0.85"
                              />
                            )}
                            <line
                              x1={toSvgX(level.source[0].x)}
                              y1={toSvgY(level.source[0].y)}
                              x2={toSvgX(level.source[1].x)}
                              y2={toSvgY(level.source[1].y)}
                              stroke="#3ca57d"
                              strokeWidth="8"
                              strokeLinecap="round"
                              opacity="0.22"
                            />
                          </g>
                        )}

                        {/* 旋转轨迹弧线 */}
                        {spinArc1 && (
                          <path
                            d={spinArc1}
                            fill="none"
                            stroke="#d6911e"
                            strokeWidth="2.2"
                            strokeDasharray="4 4"
                            opacity="0.85"
                          />
                        )}
                        {spinArc2 && (
                          <path
                            d={spinArc2}
                            fill="none"
                            stroke="#d6911e"
                            strokeWidth="1.6"
                            strokeDasharray="3 5"
                            opacity="0.58"
                          />
                        )}

                        {/* 原风叶折线（天蓝长边 + 柔和紫短边，在浅底清晰夺目） */}
                        <g className="spatial-source-layer">
                          <line
                            x1={toSvgX(level.source[0].x)}
                            y1={toSvgY(level.source[0].y)}
                            x2={toSvgX(level.source[1].x)}
                            y2={toSvgY(level.source[1].y)}
                            stroke="#3678c9"
                            strokeWidth="4.4"
                            strokeLinecap="round"
                          />
                          <line
                            x1={toSvgX(level.source[1].x)}
                            y1={toSvgY(level.source[1].y)}
                            x2={toSvgX(level.source[2].x)}
                            y2={toSvgY(level.source[2].y)}
                            stroke="#7c5cc4"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          {level.source.map((pt, idx) => (
                            <circle
                              key={`src-${idx}`}
                              cx={toSvgX(pt.x)}
                              cy={toSvgY(pt.y)}
                              r={idx === 0 ? 4.4 : 5}
                              fill={idx === 1 ? '#3678c9' : '#7c5cc4'}
                              stroke="#ffffff"
                              strokeWidth="1.8"
                            />
                          ))}
                        </g>

                        {/* 真实旋转后的暖金风叶 */}
                        {showRotatingOverlay && (
                          <g className="spatial-truth-layer" filter="url(#spatial-gold-glow)">
                            <polyline
                              points={polylinePointsAttr(rotatingPoints)}
                              fill="none"
                              stroke="#d98c16"
                              strokeWidth="4.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {rotatingPoints.map((pt, idx) => (
                              <circle
                                key={`rot-${idx}`}
                                cx={toSvgX(pt.x)}
                                cy={toSvgY(pt.y)}
                                r={idx === 0 ? 4.4 : 5.4}
                                fill="#ffe7a6"
                                stroke="#b8720a"
                                strokeWidth="1.8"
                              />
                            ))}
                          </g>
                        )}

                        {/* 学生预测虚影折线 */}
                        {placed.length > 0 && (
                          <g className={`spatial-ghost-layer ${phase}`}>
                            {placed.length >= 2 && (
                              <polyline
                                points={polylinePointsAttr(placed)}
                                fill="none"
                                stroke={
                                  phase === 'missed'
                                    ? '#d15a47'
                                    : phase === 'matched'
                                      ? '#238a5e'
                                      : '#268d68'
                                }
                                strokeWidth={phase === 'matched' ? 4.2 : 3.6}
                                strokeDasharray={phase === 'matched' ? undefined : '7 5'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                            {placed.map((pt, idx) => (
                              <g key={`p-${idx}`}>
                                {phase === 'matched' && (
                                  <circle
                                    cx={toSvgX(pt.x)}
                                    cy={toSvgY(pt.y)}
                                    r="11"
                                    fill="none"
                                    stroke="#289466"
                                    strokeWidth="1.8"
                                    opacity="0.65"
                                  />
                                )}
                                <circle
                                  cx={toSvgX(pt.x)}
                                  cy={toSvgY(pt.y)}
                                  r="6.2"
                                  fill={
                                    phase === 'missed'
                                      ? '#d96652'
                                      : phase === 'matched'
                                        ? '#289466'
                                        : '#2d9b72'
                                  }
                                  stroke="#ffffff"
                                  strokeWidth="1.8"
                                />
                                <text
                                  x={toSvgX(pt.x) + 10}
                                  y={toSvgY(pt.y) - 9}
                                  className={`spatial-vertex-num ${phase === 'missed' ? 'missed' : ''}`}
                                >
                                  {VERTEX_BADGES[idx]}
                                </text>
                              </g>
                            ))}
                          </g>
                        )}

                        {/* 发光金色小图钉（旋转中心） */}
                        <g className="spatial-center-pin">
                          <circle
                            className="spatial-pin-halo"
                            cx={toSvgX(level.center.x)}
                            cy={toSvgY(level.center.y)}
                            r="12"
                            fill="rgba(235, 174, 48, 0.22)"
                            stroke="rgba(204, 138, 18, 0.72)"
                            strokeWidth="1.4"
                          />
                          <circle
                            cx={toSvgX(level.center.x)}
                            cy={toSvgY(level.center.y)}
                            r="5.8"
                            fill="#f0b63a"
                            stroke="#8a5805"
                            strokeWidth="1.6"
                          />
                          <circle
                            cx={toSvgX(level.center.x)}
                            cy={toSvgY(level.center.y)}
                            r="2"
                            fill="#fffdf4"
                          />
                        </g>

                        {/* 鼠标悬停或键盘光标指示环 */}
                        {phase === 'placing' && activeCoord && (
                          <circle
                            cx={toSvgX(activeCoord.x)}
                            cy={toSvgY(activeCoord.y)}
                            r="11.5"
                            fill="rgba(45, 155, 114, 0.14)"
                            stroke="#268d68"
                            strokeWidth="1.6"
                            strokeDasharray="3 3"
                            pointerEvents="none"
                          />
                        )}

                        {/* 81 个整数格点触控热区（每格 34×34 SVG 单位，移动端易点不易误触） */}
                        {phase === 'placing' &&
                          GRID_TICKS.map((gx) =>
                            GRID_TICKS.map((gy) => (
                              <rect
                                key={`hit-${gx}-${gy}`}
                                x={toSvgX(gx) - 17}
                                y={toSvgY(gy) - 17}
                                width="34"
                                height="34"
                                fill="transparent"
                                className="spatial-hit-cell"
                                onMouseEnter={() => setHoverPoint({ x: gx, y: gy })}
                                onMouseLeave={() => setHoverPoint(null)}
                                onClick={() => handleSelectPoint({ x: gx, y: gy })}
                              />
                            )),
                          )}
                      </svg>
                    </div>
                  </div>

                  {/* 右侧/下方：顶点托盘、操作台与小N反馈 */}
                  <div className="spatial-control-col">
                    {/* 已放顶点条 */}
                    <div className="spatial-tray-card">
                      <div className="spatial-tray-head">
                        <strong>我的预测虚影（3 个顶点）</strong>
                        {phase === 'placing' && placed.length === 0 && (
                          <button
                            type="button"
                            className="spatial-anchor-chip"
                            onClick={handleAnchorCenter}
                          >
                            从中心 {formatPoint(level.center)} 起笔
                          </button>
                        )}
                      </div>

                      <div className="spatial-vertex-row" aria-live="polite">
                        {(['起点图钉', '拐弯点', '小旗尖'] as const).map((slotName, i) => {
                          const pt = placed[i];
                          return (
                            <span
                              key={i}
                              className={`spatial-vertex-pill${pt ? ' filled' : ''}`}
                            >
                              <em>{VERTEX_BADGES[i]}</em>
                              {pt ? formatPoint(pt) : slotName}
                            </span>
                          );
                        })}
                      </div>

                      {microNotice && <p className="spatial-micro-notice">{microNotice}</p>}

                      {/* 工具按钮 */}
                      <div className="spatial-tool-row">
                        <button
                          type="button"
                          className="spatial-tool-btn"
                          disabled={phase !== 'placing' || placed.length === 0}
                          onClick={handleUndo}
                        >
                          <Undo2 size={14} /> 撤销一步
                        </button>
                        <button
                          type="button"
                          className="spatial-tool-btn"
                          disabled={phase !== 'placing' || placed.length === 0}
                          onClick={handleClear}
                        >
                          <RotateCcw size={14} /> 清空重放
                        </button>
                        <button
                          type="button"
                          className={`spatial-tool-btn guide${guideEnabled ? ' active' : ''}`}
                          aria-pressed={guideEnabled}
                          disabled={phase !== 'placing'}
                          onClick={toggleGuide}
                        >
                          <Eye size={14} /> 逐边追踪
                        </button>
                      </div>

                      {/* 主操作按钮 */}
                      <div className="spatial-primary-wrap">
                        {phase === 'placing' && (
                          <button
                            type="button"
                            className="spatial-gold-btn wide"
                            disabled={placed.length !== 3}
                            onClick={handleSpinGear}
                          >
                            <RotateCw size={17} />
                            {placed.length === 3
                              ? '拨动星象齿轮'
                              : `再放 ${3 - placed.length} 个顶点即可拨动齿轮`}
                          </button>
                        )}

                        {phase === 'animating' && (
                          <button type="button" className="spatial-gold-btn wide" disabled>
                            <RotateCw size={17} className="spatial-spin-icon" />
                            星象齿轮转动中（{Math.round(animDeg)}°）…
                          </button>
                        )}

                        {phase === 'matched' && (
                          <button
                            type="button"
                            className="spatial-gold-btn wide"
                            onClick={handleAdvance}
                          >
                            {levelIdx + 1 < SPATIAL_LEVELS.length ? (
                              <>
                                下一座星台 <ArrowRight size={17} />
                              </>
                            ) : (
                              <>
                                查看探索手记 <Award size={17} />
                              </>
                            )}
                          </button>
                        )}

                        {phase === 'missed' && (
                          <button
                            type="button"
                            className="spatial-gold-btn wide"
                            onClick={handleRetryCalibrate}
                          >
                            <RotateCcw size={17} /> 重新校准
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 小N 伴游反馈卡 */}
                    <section
                      className={`spatial-feedback-card ${phase}`}
                      aria-live="polite"
                      aria-label="小N反馈"
                    >
                      <div className="spatial-feedback-mascot">
                        <Mascot small mood={mascotMood} />
                      </div>
                      <div className="spatial-feedback-body">
                        {phase === 'placing' && (
                          <>
                            <strong>先想再摆，最后拨动齿轮验证</strong>
                            <p>
                              在星盘上依次点出旋转后的 3 个顶点（从中心出发或从叶尖倒着摆都可以）。
                              {guideEnabled
                                ? '已为你高亮第一段长边的顺时针方向参考弧。'
                                : '拿不准时可以点「逐边追踪」或右上角「小N锦囊」。'}
                            </p>
                          </>
                        )}
                        {phase === 'animating' && (
                          <>
                            <strong>看着金色星轨慢慢转过去…</strong>
                            <p>
                              留意中心点 {formatPoint(level.center)} 稳稳不动，风叶的边长和拐角大小始终保持不变。
                            </p>
                          </>
                        )}
                        {phase === 'matched' && evaluation && (
                          <>
                            <strong>{evaluation.headline}</strong>
                            <p>{evaluation.feedback}</p>
                          </>
                        )}
                        {phase === 'missed' && evaluation && (
                          <>
                            <strong>{evaluation.headline}</strong>
                            <p>{evaluation.feedback}</p>
                            <div className="spatial-compare-note">
                              <span>珊瑚虚线：我的虚影</span>
                              <span>暖金实线：真实落点</span>
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
