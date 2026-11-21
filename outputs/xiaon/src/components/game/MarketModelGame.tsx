/** 生活集市 · 《星溪策算司》互动探索游戏（专业模式第四站「建模」深度融合）。
 * 星溪夜集账房手账风：把现实费用拆解为「变量累加项」与「固定基数项」构建一次式模型，
 * 配合线性趋势图直观看见斜率与截距 → 开张试算台先预判再核账 → 雨夜边界决策与模型演进；通关解锁《线性策算经》。 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calculator,
  CheckCircle2,
  CloudRain,
  Lightbulb,
  MessageCircle,
  Minus,
  Plus,
  Receipt,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { Mascot, type PetMood } from '../../Art';
import { apiRequest } from '../../agent-client';
import { lastAccount } from '../../auth/session';
import {
  MARKET_MODEL_LEVELS,
  buildFormulaFromSlots,
  buildMarketModelSummary,
  buildUnitBreakdown,
  evaluateMarketFormula,
  evaluateMarketModelSlots,
  evaluateRainyCause,
  evaluateRainyUpgrade,
  evaluateTrialPrediction,
  formatMarketFormula,
  type CostSlotKind,
  type MarketLevelRecord,
  type MarketModelEvaluation,
  type MarketModelSummary,
  type RainyCauseEval,
  type RainyCauseId,
  type RainyStrategy,
  type RainyUpgradeEval,
  type TrialCheckResult,
} from './marketModelLogic';

const DONE_KEY_PREFIX = 'xiaon-market-model-done-v1:';

export type MarketModelCompletion = {
  completedAt: string;
  achievements: string[];
  totalAttempts: number;
  firstTryCount: number;
  predictedBeforeCheckCount: number;
  recognizedBoundary: boolean;
  assessment: string;
};

export type MarketModelGameProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: (summary: MarketModelCompletion) => void;
  onGoChat?: () => void;
  onFallbackAssess?: () => void;
};

function doneStorageKey(): string {
  const acct = typeof window !== 'undefined' ? lastAccount() || 'local' : 'local';
  return `${DONE_KEY_PREFIX}${acct}`;
}

export function readMarketModelCompletion(): MarketModelCompletion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(doneStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MarketModelCompletion>;
    if (!parsed || typeof parsed.completedAt !== 'string') return null;
    return {
      completedAt: parsed.completedAt,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      totalAttempts: typeof parsed.totalAttempts === 'number' ? parsed.totalAttempts : 0,
      firstTryCount: typeof parsed.firstTryCount === 'number' ? parsed.firstTryCount : 0,
      predictedBeforeCheckCount:
        typeof parsed.predictedBeforeCheckCount === 'number'
          ? parsed.predictedBeforeCheckCount
          : 0,
      recognizedBoundary: Boolean(parsed.recognizedBoundary),
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    };
  } catch {
    return null;
  }
}

function saveMarketModelCompletion(summary: MarketModelCompletion): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(doneStorageKey(), JSON.stringify(summary));
  } catch {
    /* 存储受限时静默忽略 */
  }
}

/** 轻量 SVG 线性费用趋势图：直观呈现斜率（单价）与 y 轴截距（固定基数），支持对比第二条线或异常实测点。 */
function LinearCostChart({
  formula,
  unitName,
  highlightQty,
  compareFormula,
  actualPoint,
}: {
  formula: { variable: string; ratePerUnit: number; fixedFee: number };
  unitName: string;
  highlightQty?: number;
  compareFormula?: { variable: string; ratePerUnit: number; fixedFee: number } | null;
  actualPoint?: { qty: number; total: number; label: string } | null;
}) {
  const maxQty = 5;
  const values = [
    formula.fixedFee,
    formula.ratePerUnit * maxQty + formula.fixedFee,
    compareFormula ? compareFormula.ratePerUnit * maxQty + compareFormula.fixedFee : 0,
    actualPoint ? actualPoint.total : 0,
  ];
  const maxY = Math.max(20, Math.ceil((Math.max(...values) * 1.15) / 5) * 5);

  const padL = 36;
  const padR = 18;
  const padT = 16;
  const padB = 26;
  const W = 320;
  const H = 136;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const px = (q: number) => padL + (q / maxQty) * plotW;
  const py = (v: number) => padT + plotH - (Math.min(maxY, Math.max(0, v)) / maxY) * plotH;

  const linePts = (f: { ratePerUnit: number; fixedFee: number }) =>
    Array.from({ length: maxQty + 1 }, (_, q) => `${px(q).toFixed(1)},${py(f.ratePerUnit * q + f.fixedFee).toFixed(1)}`).join(' ');

  return (
    <div className="market-chart-box" aria-label="线性费用增长趋势图">
      <div className="market-chart-head">
        <span>费用趋势图（起点 = 固定基数，坡度 = 单价）</span>
        <small>
          起点 {formula.fixedFee} 元 · 每 +{unitName} 涨 {formula.ratePerUnit} 元
        </small>
      </div>
      <svg className="market-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="线性趋势折线图">
        {[0, 0.5, 1].map((ratio) => {
          const val = Math.round(maxY * ratio);
          const y = py(val);
          return (
            <g key={ratio}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#ead9cc" strokeDasharray="3 4" />
              <text x={padL - 6} y={y + 3.5} textAnchor="end" fill="#8b624b" fontSize="9.5">
                {val}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="#b68a6e" strokeWidth="1.2" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#b68a6e" strokeWidth="1.2" />
        {[0, 1, 2, 3, 4, 5].map((q) => (
          <text key={q} x={px(q)} y={H - 8} textAnchor="middle" fill="#8b624b" fontSize="9.5">
            {q}
            {q === 0 ? '' : unitName}
          </text>
        ))}

        {/* 主模型折线 */}
        <polyline
          points={linePts(formula)}
          fill="none"
          stroke="#c96537"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx={px(0)} cy={py(formula.fixedFee)} r="4" fill="#d48a2b" stroke="#fff" strokeWidth="1.5" />

        {highlightQty !== undefined && (
          <circle
            cx={px(highlightQty)}
            cy={py(formula.ratePerUnit * highlightQty + formula.fixedFee)}
            r="4.5"
            fill="#c96537"
            stroke="#fff"
            strokeWidth="1.6"
          />
        )}

        {/* 升级后对比线（雨夜模型） */}
        {compareFormula && (
          <polyline
            points={linePts(compareFormula)}
            fill="none"
            stroke="#2c8a66"
            strokeWidth="2.6"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}

        {/* 雨夜实测点 */}
        {actualPoint && (
          <g>
            <line
              x1={px(actualPoint.qty)}
              y1={py(formula.ratePerUnit * actualPoint.qty + formula.fixedFee)}
              x2={px(actualPoint.qty)}
              y2={py(actualPoint.total)}
              stroke="#b8442a"
              strokeWidth="1.8"
              strokeDasharray="2 2"
            />
            <circle
              cx={px(actualPoint.qty)}
              cy={py(actualPoint.total)}
              r="5"
              fill="#b8442a"
              stroke="#fff"
              strokeWidth="1.6"
            />
            <text
              x={px(actualPoint.qty) - 6}
              y={py(actualPoint.total) - 7}
              textAnchor="end"
              fill="#9e321a"
              fontSize="9.5"
              fontWeight="700"
            >
              {actualPoint.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export function MarketModelGame({
  open,
  onClose,
  onCompleted,
  onGoChat,
  onFallbackAssess,
}: MarketModelGameProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  const onCompletedRef = useRef(onCompleted);
  onCloseRef.current = onClose;
  onCompletedRef.current = onCompleted;

  const [levelIdx, setLevelIdx] = useState(0);

  // 第 1-3 关状态：拼装槽位 + 开张试算台
  const [slotMap, setSlotMap] = useState<Record<string, CostSlotKind | undefined>>({});
  const [modelEval, setModelEval] = useState<MarketModelEvaluation | null>(null);
  const [modelConfirmed, setModelConfirmed] = useState(false);

  const [guessTotal, setGuessTotal] = useState(10);
  const [hasEditedGuess, setHasEditedGuess] = useState(false);
  const [trialEval, setTrialEval] = useState<TrialCheckResult | null>(null);
  const [exploreQty, setExploreQty] = useState(4);

  // 第 4 关雨天边界状态
  const [selectedCause, setSelectedCause] = useState<RainyCauseId | null>(null);
  const [causeEval, setCauseEval] = useState<RainyCauseEval | null>(null);
  const [causeSolved, setCauseSolved] = useState(false);
  const [rainyPath, setRainyPath] = useState<RainyStrategy | null>(null);
  const [rainyExtraSlot, setRainyExtraSlot] = useState<CostSlotKind | null>(null);
  const [rainyUpgradeEval, setRainyUpgradeEval] = useState<RainyUpgradeEval | null>(null);
  const [scopeNoteDone, setScopeNoteDone] = useState(false);

  // 关卡统计与锦囊
  const [levelSolved, setLevelSolved] = useState(false);
  const [modelAttempts, setModelAttempts] = useState(0);
  const [trialAttempts, setTrialAttempts] = useState(0);
  const [confusedFixedVar, setConfusedFixedVar] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [hintTier, setHintTier] = useState<1 | 2 | 3>(1);
  const [maxHintInLevel, setMaxHintInLevel] = useState(0);

  const [records, setRecords] = useState<MarketLevelRecord[]>([]);
  const [summary, setSummary] = useState<MarketModelSummary | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const level = MARKET_MODEL_LEVELS[levelIdx];
  const allComplete = summary !== null;

  function initLevel(idx: number) {
    const target = MARKET_MODEL_LEVELS[idx];
    setLevelIdx(idx);
    setSlotMap({});
    setModelEval(null);
    setModelConfirmed(false);
    setGuessTotal(target.kind === 'build-and-trial' ? target.quickGuesses[0] : 14);
    setHasEditedGuess(false);
    setTrialEval(null);
    setExploreQty(target.kind === 'build-and-trial' ? target.trialTargetQty : target.targetQty);
    setSelectedCause(null);
    setCauseEval(null);
    setCauseSolved(false);
    setRainyPath(null);
    setRainyExtraSlot(null);
    setRainyUpgradeEval(null);
    setScopeNoteDone(false);
    setLevelSolved(false);
    setModelAttempts(0);
    setTrialAttempts(0);
    setConfusedFixedVar(false);
    setTipsOpen(false);
    setHintTier(1);
    setMaxHintInLevel(0);
  }

  function restartAll() {
    setRecords([]);
    setSummary(null);
    setSaved('idle');
    initLevel(0);
  }

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      else onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      if (!pushed.current) {
        window.history.pushState(
          { ...window.history.state, page: undefined, marketModel: true },
          '',
          '#market-model',
        );
        pushed.current = true;
      }
    } else {
      setTipsOpen(false);
      if (dialog.open) dialog.close();
    }
  }, [open]);

  function handleNativeClose() {
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = '';
    setTipsOpen(false);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
    onCloseRef.current();
  }

  function closeGame() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  }

  function toggleTips() {
    const next = !tipsOpen;
    setTipsOpen(next);
    if (next) setMaxHintInLevel((prev) => Math.max(prev, hintTier));
  }

  function selectHintTier(tier: 1 | 2 | 3) {
    setHintTier(tier);
    setMaxHintInLevel((prev) => Math.max(prev, tier));
  }

  function assignBlockSlot(blockId: string, slot: CostSlotKind) {
    if (modelConfirmed || levelSolved) return;
    setSlotMap((prev) => ({ ...prev, [blockId]: slot }));
    setModelEval(null);
  }

  function handleConfirmModel() {
    if (level.kind !== 'build-and-trial' || modelConfirmed) return;
    const res = evaluateMarketModelSlots(level, slotMap);
    setModelEval(res);
    if (res.code !== 'incomplete') {
      setModelAttempts((n) => n + 1);
    }
    if (res.confusedFixedVar) {
      setConfusedFixedVar(true);
    }
    if (res.ok) {
      setModelConfirmed(true);
    }
  }

  function adjustGuess(delta: number) {
    if (levelSolved) return;
    setGuessTotal((g) => Math.max(0, Math.min(120, g + delta)));
    setHasEditedGuess(true);
    setTrialEval(null);
  }

  function handleCheckoutTrial() {
    if (level.kind !== 'build-and-trial' || !modelConfirmed || levelSolved) return;
    const nextTrial = trialAttempts + 1;
    setTrialAttempts(nextTrial);
    const res = evaluateTrialPrediction(level, guessTotal);
    setTrialEval(res);

    if (res.matched) {
      setLevelSolved(true);
      const rec: MarketLevelRecord = {
        levelId: level.id,
        levelTitle: level.title,
        skillTag: level.skillTag,
        modelAttempts: Math.max(1, modelAttempts),
        trialAttempts: nextTrial,
        confusedFixedVar,
        predictedBeforeCheck: true,
        predictionFirstTryOk: nextTrial === 1,
        recognizedBoundary: false,
        usedHints: maxHintInLevel,
        completed: true,
      };
      setRecords((prev) => [...prev.filter((r) => r.levelId !== rec.levelId), rec]);
    }
  }

  function handleVerifyRainyCause() {
    if (level.kind !== 'rainy-boundary' || !selectedCause || causeSolved) return;
    const nextAttempts = modelAttempts + 1;
    setModelAttempts(nextAttempts);
    const res = evaluateRainyCause(selectedCause);
    setCauseEval(res);
    if (res.ok) {
      setCauseSolved(true);
    }
  }

  function handleConfirmRainyUpgrade() {
    if (level.kind !== 'rainy-boundary' || levelSolved) return;
    const nextTrial = trialAttempts + 1;
    setTrialAttempts(nextTrial);
    const res = evaluateRainyUpgrade(level, rainyExtraSlot);
    setRainyUpgradeEval(res);
    if (res.code === 'wrong-slot-rate') {
      setConfusedFixedVar(true);
    }
    if (res.ok) {
      setLevelSolved(true);
      const rec: MarketLevelRecord = {
        levelId: level.id,
        levelTitle: level.title,
        skillTag: level.skillTag,
        modelAttempts: Math.max(1, modelAttempts),
        trialAttempts: nextTrial,
        confusedFixedVar: confusedFixedVar || res.code === 'wrong-slot-rate',
        predictedBeforeCheck: false,
        predictionFirstTryOk: nextTrial === 1,
        recognizedBoundary: true,
        boundaryStrategy: 'upgrade-model',
        usedHints: maxHintInLevel,
        completed: true,
      };
      setRecords((prev) => [...prev.filter((r) => r.levelId !== rec.levelId), rec]);
    }
  }

  function handleConfirmScopeLimit() {
    if (level.kind !== 'rainy-boundary' || levelSolved) return;
    const nextTrial = trialAttempts + 1;
    setTrialAttempts(nextTrial);
    setScopeNoteDone(true);
    setLevelSolved(true);
    const rec: MarketLevelRecord = {
      levelId: level.id,
      levelTitle: level.title,
      skillTag: level.skillTag,
      modelAttempts: Math.max(1, modelAttempts),
      trialAttempts: nextTrial,
      confusedFixedVar,
      predictedBeforeCheck: false,
      predictionFirstTryOk: true,
      recognizedBoundary: true,
      boundaryStrategy: 'scope-limit',
      usedHints: maxHintInLevel,
      completed: true,
    };
    setRecords((prev) => [...prev.filter((r) => r.levelId !== rec.levelId), rec]);
  }

  async function handleAdvanceLevel() {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (levelIdx < MARKET_MODEL_LEVELS.length - 1) {
      initLevel(levelIdx + 1);
      return;
    }
    const built = buildMarketModelSummary(records);
    setSummary(built);
    const completion: MarketModelCompletion = {
      completedAt: new Date().toISOString(),
      achievements: built.achievements,
      totalAttempts: built.totalAttempts,
      firstTryCount: built.firstTryCount,
      predictedBeforeCheckCount: built.predictedBeforeCheckCount,
      recognizedBoundary: built.recognizedBoundary,
      assessment: built.assessment,
    };
    saveMarketModelCompletion(completion);
    onCompletedRef.current?.(completion);
    setSaved('saving');
    try {
      await apiRequest('free-chat/profile/item', {
        action: 'add',
        kind: 'recent',
        text: built.profileText,
      });
      setSaved('saved');
    } catch {
      setSaved('error');
    }
  }

  const liveFormula = useMemo(() => {
    if (level.kind !== 'build-and-trial') return null;
    return buildFormulaFromSlots(level, slotMap);
  }, [level, slotMap]);

  const liveBreakdown = useMemo(() => {
    if (level.kind !== 'build-and-trial' || !liveFormula) return [];
    return buildUnitBreakdown(liveFormula, Math.min(3, level.trialTargetQty), level.unitName);
  }, [level, liveFormula]);

  const hasWarnNow =
    (modelEval && !modelEval.ok) ||
    (trialEval && !trialEval.matched) ||
    (causeEval && !causeEval.ok) ||
    (rainyUpgradeEval && !rainyUpgradeEval.ok);

  const mascotMood: PetMood = allComplete || levelSolved
    ? 'happy'
    : hasWarnNow
      ? 'thinking'
      : 'idle';

  const stepInfo = useMemo(() => {
    if (level.kind === 'rainy-boundary') {
      if (levelSolved) return { current: 2, total: 2, label: '已处理好雨天模型边界' };
      return !causeSolved
        ? { current: 1, total: 2, label: '找出账本差额原因' }
        : { current: 2, total: 2, label: '选择升级模型或标明适用范围' };
    }
    if (levelSolved) return { current: 2, total: 2, label: '小摊试算对齐' };
    return !modelConfirmed
      ? { current: 1, total: 2, label: '拼装账单模型' }
      : { current: 2, total: 2, label: '开张试算台先猜再结账' };
  }, [level.kind, levelSolved, causeSolved, modelConfirmed]);

  return (
    <dialog
      ref={dialogRef}
      className="market-dialog"
      aria-labelledby={titleId}
      onClose={handleNativeClose}
    >
      <header className="market-bar">
        <button type="button" className="market-nav-btn" onClick={closeGame}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>

        <div className="market-title-pill" id={titleId}>
          <Store size={15} />
          <strong>星溪策算司</strong>
          {!allComplete && (
            <span className="market-step-pill">
              {level.index}/{MARKET_MODEL_LEVELS.length}
            </span>
          )}
        </div>

        <div className="market-bar-actions">
          {!allComplete && (
            <button
              type="button"
              className="market-hud-btn"
              aria-expanded={tipsOpen}
              onClick={toggleTips}
            >
              <Lightbulb size={14} />
              <span>锦囊</span>
            </button>
          )}
          {onFallbackAssess && (
            <button
              type="button"
              className="market-hud-btn market-hud-ghost"
              onClick={() => {
                closeGame();
                requestAnimationFrame(() => onFallbackAssess());
              }}
            >
              问答版
            </button>
          )}
        </div>
      </header>

      <div ref={bodyRef} className="market-body">
        {tipsOpen && !allComplete && (
          <section className="market-tips-drawer" aria-label="小N分级锦囊">
            <div className="market-tips-head">
              <strong>
                <Lightbulb size={15} /> 小N锦囊（提示思路，不直接给答案）
              </strong>
              <button
                type="button"
                className="market-icon-btn"
                aria-label="收起锦囊"
                onClick={() => setTipsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="market-tips-tabs" role="tablist" aria-label="提示层级">
              {level.hints.map((h) => (
                <button
                  key={h.tier}
                  type="button"
                  role="tab"
                  aria-selected={hintTier === h.tier}
                  className={hintTier === h.tier ? 'active' : ''}
                  onClick={() => selectHintTier(h.tier)}
                >
                  小提示 {h.tier}
                </button>
              ))}
            </div>
            {(() => {
              const currentHint = level.hints.find((h) => h.tier === hintTier) ?? level.hints[0];
              return (
                <div className="market-tip-content">
                  <h4>{currentHint.title}</h4>
                  <p>{currentHint.body}</p>
                </div>
              );
            })()}
          </section>
        )}

        {allComplete && summary ? (
          <section className="market-summary-card" aria-label="生活集市探索手记评价卡">
            <div className="market-summary-head">
              <div className="market-summary-mascot">
                <Mascot mood="happy" />
              </div>
              <div>
                <span className="market-eyebrow">生活集市 · 已点亮</span>
                <h2>星溪策算司 · 策算档案</h2>
                <p>{summary.assessment}</p>
              </div>
            </div>

            <div className="market-scroll-card" aria-label="解锁星溪秘籍">
              <div className="market-scroll-head">
                <ScrollText size={15} />
                <strong>解锁星溪秘籍 · 《线性策算经》</strong>
              </div>
              <ul>
                <li>抓清两个核心角色：随数量增长的是斜率（单价 × 变量），整单一次性的则是起跑线（固定基数）。</li>
                <li>无视语序干扰：前置固定费依然只计一次，绝不按文字先后死套公式。</li>
                <li>敬畏模型边界：所有数学模型都基于假设前提——现实条件变了，要么升级模型，要么标明适用范围。</li>
              </ul>
            </div>

            {summary.achievements.length > 0 && (
              <div className="market-badges">
                {summary.achievements.map((a) => (
                  <span key={a} className="market-badge">
                    <Award size={13} />
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="market-metrics">
              <div>
                <strong>
                  {summary.firstTryCount}/{summary.totalLevels}
                </strong>
                <span>一次对齐</span>
              </div>
              <div>
                <strong>{summary.predictedBeforeCheckCount} 关</strong>
                <span>先猜后结账</span>
              </div>
              <div>
                <strong>{summary.recognizedBoundary ? '已识破' : '待巩固'}</strong>
                <span>雨天边界</span>
              </div>
            </div>

            <ul className="market-record-list">
              {records.map((r) => (
                <li key={r.levelId}>
                  <CheckCircle2 size={15} />
                  <strong>{r.levelTitle}</strong>
                  <span className="market-skill-chip">{r.skillTag}</span>
                  <small>
                    {r.levelId === 'rainy-day-test'
                      ? r.boundaryStrategy === 'scope-limit'
                        ? '标明晴天适用边界'
                        : '升级为雨天新模型'
                      : r.confusedFixedVar
                        ? '对照计费条后理清'
                        : '一次搭准并试算'}
                  </small>
                </li>
              ))}
            </ul>

            <p className="market-archive-status">
              <Sparkles size={14} />
              {saved === 'saving'
                ? '正在把这次记录放进「成长 · 我的档案」…'
                : saved === 'saved'
                  ? `已记进「我的档案 · 近况」：${summary.profileText}`
                  : '已经点亮生活集市啦！（离线模式下暂不同步云端档案）'}
            </p>

            <div className="market-summary-actions">
              {onGoChat && (
                <button
                  type="button"
                  className="market-btn market-btn-main"
                  onClick={() => {
                    closeGame();
                    requestAnimationFrame(() => onGoChat());
                  }}
                >
                  <MessageCircle size={16} />
                  带着发现找小N聊聊
                </button>
              )}
              <button type="button" className="market-btn market-btn-soft" onClick={closeGame}>
                回到五维地图
              </button>
              <button type="button" className="market-btn market-btn-ghost" onClick={restartAll}>
                <RotateCcw size={15} />
                再玩一轮
              </button>
            </div>
          </section>
        ) : (
          <div className="market-workspace">
            {/* 摊位故事卡 */}
            <section className="market-order-card">
              <div className="market-order-top">
                <span className="market-skill-chip">{level.skillTag}</span>
                <span className="market-step-hint">
                  第 {stepInfo.current}/{stepInfo.total} 步 · {stepInfo.label}
                </span>
              </div>
              <div className="market-story-row">
                <div className="market-story-mascot">
                  <Mascot mood={mascotMood} />
                </div>
                <div>
                  <h2>
                    第 {level.index} 关 · {level.title}
                  </h2>
                  <p className="market-story">{level.story}</p>
                </div>
              </div>
              <div className="market-stall-banner">
                <span>今日摊位：{level.stallName}</span>
                <strong>{level.subtitle}</strong>
              </div>
            </section>

            {/* 第 1-3 关：拼账单模型 + 开张试算台 */}
            {level.kind === 'build-and-trial' && liveFormula && (
              <>
                <section className="market-panel" aria-label="拼装账单模型">
                  <div className="market-panel-head">
                    <h3>
                      <Receipt size={16} /> 第一步：把费用积木放进对应区域
                    </h3>
                    <span className="market-formula-pill">
                      当前拼出：<strong>{formatMarketFormula(liveFormula)}</strong>
                    </span>
                  </div>

                  <div className="market-block-list">
                    {level.blocks.map((block) => {
                      const picked = slotMap[block.id];
                      return (
                        <div key={block.id} className="market-cost-card">
                          <div className="market-cost-meta">
                            <div>
                              <strong>{block.label}</strong>
                              <small>{block.unitHint}</small>
                            </div>
                            <span className="market-cost-tag">{block.emojiTag}</span>
                          </div>
                          <div
                            className="market-slot-picker"
                            role="group"
                            aria-label={`为 ${block.label} 选择计费类型`}
                          >
                            <button
                              type="button"
                              disabled={modelConfirmed}
                              aria-pressed={picked === 'rate'}
                              className={`market-slot-btn rate${picked === 'rate' ? ' selected' : ''}`}
                              onClick={() => assignBlockSlot(block.id, 'rate')}
                            >
                              变量累加项（× {level.variable}）
                            </button>
                            <button
                              type="button"
                              disabled={modelConfirmed}
                              aria-pressed={picked === 'fixed'}
                              className={`market-slot-btn fixed${picked === 'fixed' ? ' selected' : ''}`}
                              onClick={() => assignBlockSlot(block.id, 'fixed')}
                            >
                              固定基数项（+ 常数）
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 实时分单位计费透视条 + 线性增长趋势图 */}
                  {(liveFormula.ratePerUnit > 0 || liveFormula.fixedFee > 0) && (
                    <>
                      <div className="market-meter-box" aria-label="分单位计费预览条">
                        <div className="market-meter-head">
                          <span>按当前模型（{formatMarketFormula(liveFormula)}），前 3 {level.unitName}计费拆解：</span>
                        </div>
                        <div className="market-meter-rows">
                          {liveBreakdown.map((row) => (
                            <div key={row.unitIndex} className="market-meter-row">
                              <span className="market-meter-lbl">{row.label}</span>
                              <div className="market-meter-bars">
                                {liveFormula.ratePerUnit > 0 && (
                                  <span
                                    className="market-bar-rate"
                                    style={{
                                      width: `${Math.min(72, Math.max(22, (row.unitIndex * liveFormula.ratePerUnit) * 2.4))}%`,
                                    }}
                                  >
                                    变量 {row.unitIndex}×{liveFormula.ratePerUnit}
                                  </span>
                                )}
                                {liveFormula.fixedFee > 0 && (
                                  <span className="market-bar-fixed">
                                    +基数 {liveFormula.fixedFee}
                                  </span>
                                )}
                              </div>
                              <b>{row.cumulative} 元</b>
                            </div>
                          ))}
                        </div>
                      </div>
                      <LinearCostChart
                        formula={liveFormula}
                        unitName={level.unitName}
                        highlightQty={modelConfirmed ? level.trialTargetQty : undefined}
                      />
                    </>
                  )}

                  {!modelConfirmed && (
                    <div className="market-action-row">
                      <button
                        type="button"
                        className="market-btn market-btn-main"
                        onClick={handleConfirmModel}
                      >
                        <CheckCircle2 size={16} />
                        确认账单模型
                      </button>
                    </div>
                  )}

                  {modelEval && (
                    <div
                      className={`market-feedback ${modelEval.ok ? 'ok' : 'warn'}`}
                      role="status"
                    >
                      <div className="market-feedback-row">
                        <div className="market-mini-mascot">
                          <Mascot mood={mascotMood} />
                        </div>
                        <div>
                          <strong>{modelEval.headline}</strong>
                          <p>{modelEval.feedback}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* 第二步：开张试算台（先预测，再模拟结账 + 自由切换数量看规律） */}
                {modelConfirmed && (
                  <section className="market-panel market-trial-panel" aria-label="开张试算台">
                    <div className="market-panel-head">
                      <h3>
                        <Calculator size={16} /> 第二步：实单试算台（先预判再结账）
                      </h3>
                      <span className="market-order-badge">
                        测试订单：{level.variable} = {level.trialTargetQty} {level.unitName}
                      </span>
                    </div>

                    <p className="market-trial-prompt">
                      按刚搭好的模型 <b>{formatMarketFormula(level.targetFormula)}</b>，如果买{' '}
                      <b>
                        {level.trialTargetQty} {level.unitName}
                      </b>
                      ，先猜一猜一共要付多少元？
                    </p>

                    <div className="market-quick-guesses" role="group" aria-label="快捷预测数字">
                      <span>点个预测或自己微调：</span>
                      <div className="market-quick-row">
                        {level.quickGuesses.map((val) => (
                          <button
                            key={val}
                            type="button"
                            disabled={levelSolved}
                            aria-pressed={guessTotal === val && hasEditedGuess}
                            className={guessTotal === val && hasEditedGuess ? 'active' : ''}
                            onClick={() => {
                              setGuessTotal(val);
                              setHasEditedGuess(true);
                              setTrialEval(null);
                            }}
                          >
                            {val} 元
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="market-stepper-box">
                      <span className="market-stepper-label">我预测总价是</span>
                      <div className="market-stepper-controls">
                        <button
                          type="button"
                          disabled={levelSolved}
                          aria-label="预测金额减 5"
                          onClick={() => adjustGuess(-5)}
                        >
                          −5
                        </button>
                        <button
                          type="button"
                          disabled={levelSolved}
                          aria-label="预测金额减 1"
                          onClick={() => adjustGuess(-1)}
                        >
                          <Minus size={14} />
                        </button>
                        <output aria-live="polite">{guessTotal} 元</output>
                        <button
                          type="button"
                          disabled={levelSolved}
                          aria-label="预测金额加 1"
                          onClick={() => adjustGuess(1)}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={levelSolved}
                          aria-label="预测金额加 5"
                          onClick={() => adjustGuess(5)}
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    {/* 结账清单积木条（点击模拟结账后展开） */}
                    {trialEval && (
                      <div className="market-receipt-visual" aria-label="收银台模拟结账清单">
                        <div className="market-receipt-chips">
                          {Array.from({ length: trialEval.qty }, (_, i) => (
                            <span key={i} className="market-chip-unit">
                              第{i + 1}
                              {level.unitName} · {level.targetFormula.ratePerUnit}元
                            </span>
                          ))}
                          <span className="market-chip-fixed">
                            + 固定底座 · {trialEval.fixedSubtotal}元
                          </span>
                        </div>
                        <div className="market-receipt-total">
                          <span>你的预测：{trialEval.predictedTotal} 元</span>
                          <strong>
                            {trialEval.matched
                              ? `收银实付：${trialEval.actualTotal} 元 ✓`
                              : '收银实付还没对上，对着上面积木条再加一遍！'}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="market-action-row">
                      {!levelSolved ? (
                        <button
                          type="button"
                          className="market-btn market-btn-main"
                          onClick={handleCheckoutTrial}
                        >
                          <Receipt size={16} />
                          模拟结账核对
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="market-btn market-btn-main"
                          onClick={() => void handleAdvanceLevel()}
                        >
                          <span>进入下一关</span>
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>

                    {trialEval && (
                      <div
                        className={`market-feedback ${trialEval.matched ? 'ok' : 'warn'}`}
                        role="status"
                      >
                        <div className="market-feedback-row">
                          <div className="market-mini-mascot">
                            <Mascot mood={mascotMood} />
                          </div>
                          <div>
                            <strong>{trialEval.headline}</strong>
                            <p>{trialEval.feedback}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 过关后可自由切换不同数量观察总价如何随数量增长 */}
                    {levelSolved && (
                      <div className="market-explore-box">
                        <div className="market-explore-head">
                          <span>试试换不同数量，看模型如何自动预测：</span>
                          <strong>
                            {level.variable} = {exploreQty} →{' '}
                            {evaluateMarketFormula(level.targetFormula, exploreQty)} 元
                          </strong>
                        </div>
                        <div className="market-qty-pills" role="group" aria-label="切换试算数量">
                          {level.sampleQuantities.map((q) => (
                            <button
                              key={q}
                              type="button"
                              aria-pressed={exploreQty === q}
                              className={exploreQty === q ? 'active' : ''}
                              onClick={() => setExploreQty(q)}
                            >
                              {q} {level.unitName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {/* 第 4 关：雨天小考验（模型边界意识） */}
            {level.kind === 'rainy-boundary' && (
              <>
                <section className="market-panel market-rainy-panel" aria-label="雨天账本对照板">
                  <div className="market-panel-head">
                    <h3>
                      <CloudRain size={16} /> 第一步：对比旧模型预测与雨天实际流水
                    </h3>
                    <span className="market-diff-badge">差额 +4 元</span>
                  </div>

                  <div className="market-compare-grid">
                    <div className="market-ledger-box old">
                      <small>晴天模型（3x + 2）</small>
                      <strong>14 元</strong>
                      <span>4 本×3 元 + 2 元礼袋</span>
                    </div>
                    <div className="market-ledger-box actual">
                      <small>雨夜实际流水</small>
                      <strong>18 元</strong>
                      <span>4 本×3 元 + 2 元礼袋 + 防雨篷布</span>
                    </div>
                  </div>

                  <LinearCostChart
                    formula={level.baseFormula}
                    unitName={level.unitName}
                    highlightQty={level.targetQty}
                    compareFormula={rainyUpgradeEval?.ok ? rainyUpgradeEval.newFormula : null}
                    actualPoint={{ qty: level.targetQty, total: 18, label: '雨夜实付 18 元 (+4)' }}
                  />

                  <p className="market-trial-prompt">
                    为什么昨天的模型预测（14 元）和今天的实际账单（18 元）对不上了呢？
                  </p>

                  <div className="market-cause-list">
                    {level.causeOptions.map((opt) => {
                      const isSel = selectedCause === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={causeSolved}
                          aria-pressed={isSel}
                          className={`market-cause-card${isSel ? ' selected' : ''}${causeSolved && opt.id === 'missing-rain-cover' ? ' ok' : ''}`}
                          onClick={() => {
                            setSelectedCause(opt.id);
                            setCauseEval(null);
                          }}
                        >
                          <strong>{opt.title}</strong>
                          <small>{opt.subtitle}</small>
                        </button>
                      );
                    })}
                  </div>

                  {!causeSolved && (
                    <div className="market-action-row">
                      <button
                        type="button"
                        className="market-btn market-btn-main"
                        disabled={!selectedCause}
                        onClick={handleVerifyRainyCause}
                      >
                        <CheckCircle2 size={16} />
                        确认原因
                      </button>
                    </div>
                  )}

                  {causeEval && (
                    <div
                      className={`market-feedback ${causeEval.ok ? 'ok' : 'warn'}`}
                      role="status"
                    >
                      <div className="market-feedback-row">
                        <div className="market-mini-mascot">
                          <Mascot mood={mascotMood} />
                        </div>
                        <div>
                          <strong>{causeEval.headline}</strong>
                          <p>{causeEval.feedback}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* 第二步：掌柜决策——升级模型 OR 标明晴天适用范围（两种都科学！） */}
                {causeSolved && (
                  <section className="market-panel market-decision-panel" aria-label="掌柜模型边界决策">
                    <div className="market-panel-head">
                      <h3>
                        <ShieldCheck size={16} /> 第二步：作为策算师，你如何处置旧模型？
                      </h3>
                      <span className="market-muted">两种科学决策均可通关，任选其一</span>
                    </div>

                    <div className="market-path-tabs" role="group" aria-label="选择处理方式">
                      <button
                        type="button"
                        disabled={levelSolved}
                        aria-pressed={rainyPath === 'upgrade-model'}
                        className={`market-path-btn${rainyPath === 'upgrade-model' ? ' active' : ''}`}
                        onClick={() => {
                          setRainyPath('upgrade-model');
                          setRainyUpgradeEval(null);
                        }}
                      >
                        <strong>方案 A：升级模型</strong>
                        <small>把雨夜 4 元防雨篷布并入公式，生成雨天版本</small>
                      </button>
                      <button
                        type="button"
                        disabled={levelSolved}
                        aria-pressed={rainyPath === 'scope-limit'}
                        className={`market-path-btn${rainyPath === 'scope-limit' ? ' active' : ''}`}
                        onClick={() => {
                          setRainyPath('scope-limit');
                          setRainyUpgradeEval(null);
                        }}
                      >
                        <strong>方案 B：划定适用边界</strong>
                        <small>保留 3x + 2，明确标注“仅限晴天条件适用”</small>
                      </button>
                    </div>

                    {rainyPath === 'upgrade-model' && (
                      <div className="market-upgrade-box">
                        <p className="market-trial-prompt">
                          把新增的 <b>4 元防雨篷布费</b> 并入原模型（3x + 2）的哪个槽位？
                        </p>
                        <div className="market-slot-picker">
                          <button
                            type="button"
                            disabled={levelSolved}
                            aria-pressed={rainyExtraSlot === 'rate'}
                            className={`market-slot-btn rate${rainyExtraSlot === 'rate' ? ' selected' : ''}`}
                            onClick={() => {
                              setRainyExtraSlot('rate');
                              setRainyUpgradeEval(null);
                            }}
                          >
                            并入变量项（每本 +4 元）
                          </button>
                          <button
                            type="button"
                            disabled={levelSolved}
                            aria-pressed={rainyExtraSlot === 'fixed'}
                            className={`market-slot-btn fixed${rainyExtraSlot === 'fixed' ? ' selected' : ''}`}
                            onClick={() => {
                              setRainyExtraSlot('fixed');
                              setRainyUpgradeEval(null);
                            }}
                          >
                            并入固定基数（整单 +4 元）
                          </button>
                        </div>

                        {!levelSolved && (
                          <div className="market-action-row">
                            <button
                              type="button"
                              className="market-btn market-btn-main"
                              onClick={handleConfirmRainyUpgrade}
                            >
                              <Receipt size={16} />
                              升级模型并验算 4 本流水
                            </button>
                          </div>
                        )}

                        {rainyUpgradeEval && (
                          <div
                            className={`market-feedback ${rainyUpgradeEval.ok ? 'ok' : 'warn'}`}
                            role="status"
                          >
                            <div className="market-feedback-row">
                              <div className="market-mini-mascot">
                                <Mascot mood={mascotMood} />
                              </div>
                              <div>
                                <strong>{rainyUpgradeEval.headline}</strong>
                                <p>{rainyUpgradeEval.feedback}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {rainyPath === 'scope-limit' && (
                      <div className="market-scope-box">
                        <div className="market-scope-tag-preview">
                          <span>账单模型：3x + 2</span>
                          <strong>适用边界：仅限晴天无额外物料时适用；雨天需另计 4 元防雨篷布费</strong>
                        </div>
                        {!levelSolved && (
                          <div className="market-action-row">
                            <button
                              type="button"
                              className="market-btn market-btn-main"
                              onClick={handleConfirmScopeLimit}
                            >
                              <ShieldCheck size={16} />
                              签署晴天适用边界说明
                            </button>
                          </div>
                        )}
                        {scopeNoteDone && (
                          <div className="market-feedback ok" role="status">
                            <div className="market-feedback-row">
                              <div className="market-mini-mascot">
                                <Mascot mood="happy" />
                              </div>
                              <div>
                                <strong>严谨的建模视野！明确模型边界与建出公式同等重要</strong>
                                <p>
                                  任何数学模型都有自己的前提假设。清晰标注“3x + 2 仅限晴天适用”，后续使用模型的人就不会误用并产生账目偏差。
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {levelSolved && (
                      <div className="market-action-row">
                        <button
                          type="button"
                          className="market-btn market-btn-main"
                          onClick={() => void handleAdvanceLevel()}
                        >
                          <span>解锁策算档案与秘籍</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
