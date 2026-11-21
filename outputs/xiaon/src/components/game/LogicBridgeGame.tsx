/** 逻辑小桥 · 《断桥真伪录》互动探索游戏（专业模式第二站「逻辑」深度融合）。
 * 星溪石桥侦探档案纸感风：桥头假铭文反例核验 → 数轴平方前提严查 → 奇偶密码闸自主造反例
 * → 桥下暗渠单变量控变排查；通关解锁《破妄反例诀》并同步写入「成长 · 我的档案」。 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Droplets,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  Scale,
  ScrollText,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { Mascot, type PetMood } from '../../Art';
import { apiRequest } from '../../agent-client';
import { lastAccount } from '../../auth/session';
import {
  CANAL_SOURCE_DROPS,
  LOGIC_BRIDGE_LEVELS,
  PIPE_JOINTS,
  buildLogicBridgeSummary,
  decomposeParity,
  evaluateCanalTrial,
  evaluateCounterexampleCard,
  evaluateParityBuilder,
  type CanalTrialResult,
  type LogicBridgeSummary,
  type LogicCardEval,
  type LogicLevelRecord,
  type ParityEvalResult,
  type PipeJointId,
} from './logicBridgeLogic';

const DONE_KEY_PREFIX = 'xiaon-logic-bridge-done-v1:';

export type LogicBridgeCompletion = {
  completedAt: string;
  achievements: string[];
  totalAttempts: number;
  firstTryCount: number;
  usedSingleChangeStrategy: boolean;
  assessment: string;
};

export type LogicBridgeGameProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: (summary: LogicBridgeCompletion) => void;
  onGoChat?: () => void;
  onFallbackAssess?: () => void;
};

type CanalLogRow = {
  trialNo: number;
  replaced: readonly PipeJointId[];
  predicted: 6 | 8 | null;
  delivered: number;
  note: string;
};

function doneStorageKey(): string {
  const acct = typeof window !== 'undefined' ? lastAccount() || 'local' : 'local';
  return `${DONE_KEY_PREFIX}${acct}`;
}

export function readLogicBridgeCompletion(): LogicBridgeCompletion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(doneStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogicBridgeCompletion>;
    if (!parsed || typeof parsed.completedAt !== 'string') return null;
    return {
      completedAt: parsed.completedAt,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      totalAttempts: typeof parsed.totalAttempts === 'number' ? parsed.totalAttempts : 0,
      firstTryCount: typeof parsed.firstTryCount === 'number' ? parsed.firstTryCount : 0,
      usedSingleChangeStrategy: Boolean(parsed.usedSingleChangeStrategy),
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    };
  } catch {
    return null;
  }
}

function saveLogicBridgeCompletion(summary: LogicBridgeCompletion): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(doneStorageKey(), JSON.stringify(summary));
  } catch {
    /* 存储受限时静默忽略 */
  }
}

function ParityDots({ value, accent }: { value: number; accent: 'left' | 'right' }) {
  const dec = decomposeParity(value);
  return (
    <div className={`logic-dot-grid ${accent}`} aria-label={`${value} 可以分成 ${dec.pairs} 对${dec.leftover ? '并多出 1 个' : ''}`}>
      {Array.from({ length: dec.pairs }, (_, idx) => (
        <span key={idx} className="logic-dot-pair">
          <i />
          <i />
        </span>
      ))}
      {dec.leftover === 1 && (
        <span className="logic-dot-lonely" title="多出来的 1 颗落单圆点">
          <i />
        </span>
      )}
    </div>
  );
}

export function LogicBridgeGame({
  open,
  onClose,
  onCompleted,
  onGoChat,
  onFallbackAssess,
}: LogicBridgeGameProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  const onCompletedRef = useRef(onCompleted);
  onCloseRef.current = onClose;
  onCompletedRef.current = onCompleted;

  const [levelIdx, setLevelIdx] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardEval, setCardEval] = useState<LogicCardEval | null>(null);

  const [paritySlot, setParitySlot] = useState<'left' | 'right'>('left');
  const [parityLeft, setParityLeft] = useState<number | null>(null);
  const [parityRight, setParityRight] = useState<number | null>(null);
  const [parityEval, setParityEval] = useState<ParityEvalResult | null>(null);

  const [replacedJoints, setReplacedJoints] = useState<PipeJointId[]>([]);
  const [excludedJoints, setExcludedJoints] = useState<PipeJointId[]>([]);
  const [canalGuess, setCanalGuess] = useState<6 | 8 | null>(null);
  const [canalEval, setCanalEval] = useState<CanalTrialResult | null>(null);
  const [canalLogs, setCanalLogs] = useState<CanalLogRow[]>([]);

  const [levelSolved, setLevelSolved] = useState(false);
  const [attemptsInLevel, setAttemptsInLevel] = useState(0);
  const [pickedPremiseViolation, setPickedPremiseViolation] = useState(false);
  const [usedSingleChangeInLevel, setUsedSingleChangeInLevel] = useState(false);
  const [triggeredMultiChangeInLevel, setTriggeredMultiChangeInLevel] = useState(false);
  const [predictedBeforeTrial, setPredictedBeforeTrial] = useState(false);

  const [tipsOpen, setTipsOpen] = useState(false);
  const [hintTier, setHintTier] = useState<1 | 2 | 3>(1);
  const [maxHintInLevel, setMaxHintInLevel] = useState(0);

  const [records, setRecords] = useState<LogicLevelRecord[]>([]);
  const [summary, setSummary] = useState<LogicBridgeSummary | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const level = LOGIC_BRIDGE_LEVELS[levelIdx];
  const allComplete = summary !== null;

  function initLevel(idx: number) {
    setLevelIdx(idx);
    setSelectedCardId(null);
    setCardEval(null);
    setParitySlot('left');
    setParityLeft(null);
    setParityRight(null);
    setParityEval(null);
    setReplacedJoints([]);
    setExcludedJoints([]);
    setCanalGuess(null);
    setCanalEval(null);
    setCanalLogs([]);
    setLevelSolved(false);
    setAttemptsInLevel(0);
    setPickedPremiseViolation(false);
    setUsedSingleChangeInLevel(false);
    setTriggeredMultiChangeInLevel(false);
    setPredictedBeforeTrial(false);
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
          { ...window.history.state, page: undefined, logicBridge: true },
          '',
          '#logic-bridge',
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

  function recordLevelSolved(params: {
    attempts: number;
    premiseViolated: boolean;
    singleChange: boolean;
    multiChange: boolean;
    predicted: boolean;
  }) {
    const rec: LogicLevelRecord = {
      levelId: level.id,
      levelTitle: level.title,
      skillTag: level.skillTag,
      attempts: params.attempts,
      pickedPremiseViolation: params.premiseViolated,
      usedSingleChangeStrategy: params.singleChange,
      triggeredMultiChange: params.multiChange,
      predictedBeforeTrial: params.predicted,
      usedHints: maxHintInLevel,
      completed: true,
    };
    setRecords((prev) => [...prev.filter((r) => r.levelId !== rec.levelId), rec]);
  }

  function handleInspectCard() {
    if (!selectedCardId || levelSolved) return;
    const res = evaluateCounterexampleCard(level, selectedCardId);
    if (!res) return;
    const nextAttempts = attemptsInLevel + 1;
    setAttemptsInLevel(nextAttempts);
    setCardEval(res);
    const nextPremiseViolated = pickedPremiseViolation || res.premiseViolated;
    if (res.premiseViolated) setPickedPremiseViolation(true);
    if (res.ok) {
      setLevelSolved(true);
      recordLevelSolved({
        attempts: nextAttempts,
        premiseViolated: nextPremiseViolated,
        singleChange: false,
        multiChange: false,
        predicted: false,
      });
    }
  }

  function handlePickParityNumber(num: number) {
    if (levelSolved) return;
    setParityEval(null);
    if (paritySlot === 'left') {
      setParityLeft(num);
      setParitySlot('right');
    } else {
      setParityRight(num);
      setParitySlot('left');
    }
  }

  function handleCheckParity() {
    if (parityLeft === null || parityRight === null || levelSolved) return;
    const res = evaluateParityBuilder(parityLeft, parityRight);
    const nextAttempts = attemptsInLevel + 1;
    setAttemptsInLevel(nextAttempts);
    setParityEval(res);
    const nextPremiseViolated = pickedPremiseViolation || res.premiseViolated;
    if (res.premiseViolated) setPickedPremiseViolation(true);
    if (res.ok) {
      setLevelSolved(true);
      recordLevelSolved({
        attempts: nextAttempts,
        premiseViolated: nextPremiseViolated,
        singleChange: false,
        multiChange: false,
        predicted: false,
      });
    }
  }

  function toggleJoint(joint: PipeJointId) {
    if (levelSolved) return;
    setCanalEval(null);
    setReplacedJoints((prev) =>
      prev.includes(joint) ? prev.filter((j) => j !== joint) : [...prev, joint],
    );
  }

  function resetCanalJoints() {
    if (levelSolved) return;
    setReplacedJoints([]);
    setCanalEval(null);
  }

  function handleRunCanalTrial() {
    if (levelSolved) return;
    const res = evaluateCanalTrial(replacedJoints, canalGuess, level.leakyJoint ?? 'B');
    const nextAttempts = attemptsInLevel + 1;
    setAttemptsInLevel(nextAttempts);
    setCanalEval(res);

    const nextSingle = usedSingleChangeInLevel || res.isSingleChange;
    const nextMulti = triggeredMultiChangeInLevel || res.isMultiChange;
    const nextPredicted = predictedBeforeTrial || canalGuess !== null;
    if (res.isSingleChange) setUsedSingleChangeInLevel(true);
    if (res.isMultiChange) setTriggeredMultiChangeInLevel(true);
    if (canalGuess !== null) setPredictedBeforeTrial(true);
    if (res.status === 'single-no-fix' && res.replacedJoints.length === 1) {
      const cleared = res.replacedJoints[0];
      setExcludedJoints((prev) => (prev.includes(cleared) ? prev : [...prev, cleared]));
    }

    setCanalLogs((prev) => [
      ...prev,
      {
        trialNo: nextAttempts,
        replaced: res.replacedJoints,
        predicted: canalGuess,
        delivered: res.deliveredDrops,
        note:
          res.status === 'solved-fair'
            ? '只换 1 段 → 锁定漏点'
            : res.status === 'single-no-fix'
              ? '只换 1 段 → 排除该段'
              : res.status === 'multi-change'
                ? '同时换多段 → 分不清'
                : '未换接头',
      },
    ]);

    if (res.solved) {
      setLevelSolved(true);
      recordLevelSolved({
        attempts: nextAttempts,
        premiseViolated: false,
        singleChange: nextSingle,
        multiChange: nextMulti,
        predicted: nextPredicted,
      });
    }
  }

  async function handleAdvanceLevel() {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (levelIdx < LOGIC_BRIDGE_LEVELS.length - 1) {
      initLevel(levelIdx + 1);
      return;
    }
    const built = buildLogicBridgeSummary(records);
    setSummary(built);
    const completion: LogicBridgeCompletion = {
      completedAt: new Date().toISOString(),
      achievements: built.achievements,
      totalAttempts: built.totalAttempts,
      firstTryCount: built.firstTryCount,
      usedSingleChangeStrategy: built.usedSingleChangeStrategy,
      assessment: built.assessment,
    };
    saveLogicBridgeCompletion(completion);
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

  const activeCard = useMemo(
    () => level.cards?.find((c) => c.id === selectedCardId) ?? null,
    [level.cards, selectedCardId],
  );

  const hasErrorNow =
    (cardEval && !cardEval.ok) ||
    (parityEval && !parityEval.ok) ||
    (canalEval && !canalEval.solved);

  const mascotMood: PetMood = allComplete || levelSolved
    ? 'happy'
    : hasErrorNow
      ? 'thinking'
      : 'idle';

  const stepInfo = useMemo(() => {
    if (level.kind === 'canal-control') {
      if (levelSolved) return { current: 2, total: 2, label: '已锁定唯一漏水接头' };
      return replacedJoints.length === 0
        ? { current: 1, total: 2, label: '选 1 段接头换新并先猜水量' }
        : { current: 2, total: 2, label: '开闸试水看结果' };
    }
    if (level.kind === 'parity-builder') {
      if (levelSolved) return { current: 2, total: 2, label: '反例造成功啦' };
      return parityLeft === null || parityRight === null
        ? { current: 1, total: 2, label: '挑两个数字放进加法器' }
        : { current: 2, total: 2, label: '点验证看落单圆点怎么配对' };
    }
    if (levelSolved) return { current: 2, total: 2, label: '反例命中' };
    return selectedCardId
      ? { current: 2, total: 2, label: '上检验台核对前提与结论' }
      : { current: 1, total: 2, label: '挑一张样本卡放上检验台' };
  }, [level.kind, levelSolved, replacedJoints.length, parityLeft, parityRight, selectedCardId]);

  const displayedDrops = canalEval?.deliveredDrops ?? 6;
  const leakStillActive = !replacedJoints.includes(level.leakyJoint ?? 'B');

  return (
    <dialog
      ref={dialogRef}
      className="logic-dialog"
      aria-labelledby={titleId}
      onClose={handleNativeClose}
    >
      <header className="logic-bar">
        <button type="button" className="logic-nav-btn" onClick={closeGame}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>

        <div className="logic-title-pill" id={titleId}>
          <SearchCheck size={15} />
          <strong>断桥真伪录</strong>
          {!allComplete && (
            <span className="logic-step-pill">
              {level.index}/{LOGIC_BRIDGE_LEVELS.length}
            </span>
          )}
        </div>

        <div className="logic-bar-actions">
          {!allComplete && (
            <button
              type="button"
              className="logic-hud-btn"
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
              className="logic-hud-btn logic-hud-ghost"
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

      <div ref={bodyRef} className="logic-body">
        {tipsOpen && !allComplete && (
          <section className="logic-tips-drawer" aria-label="小N分级锦囊">
            <div className="logic-tips-head">
              <strong>
                <Lightbulb size={15} /> 小N锦囊（提示思路，不直接给答案）
              </strong>
              <button
                type="button"
                className="logic-icon-btn"
                aria-label="收起锦囊"
                onClick={() => setTipsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="logic-tips-tabs" role="tablist" aria-label="提示层级">
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
                <div className="logic-tip-content">
                  <h4>{currentHint.title}</h4>
                  <p>{currentHint.body}</p>
                </div>
              );
            })()}
          </section>
        )}

        {allComplete && summary ? (
          <section className="logic-summary-card" aria-label="逻辑小桥探索手记评价卡">
            <div className="logic-summary-head">
              <div className="logic-summary-mascot">
                <Mascot mood="happy" />
              </div>
              <div>
                <span className="logic-eyebrow">逻辑小桥 · 已点亮</span>
                <h2>断桥真伪录 · 结案档案</h2>
                <p>{summary.assessment}</p>
              </div>
            </div>

            <div className="logic-scroll-card" aria-label="解锁星溪秘籍">
              <div className="logic-scroll-head">
                <ScrollText size={15} />
                <strong>解锁星溪秘籍 · 《破妄反例诀》</strong>
              </div>
              <ul>
                <li>一记真反例：必须先严格满足原命题的全部前提，再让结论当场失效。</li>
                <li>警惕 0、负数与偷换符号：前提越界的例子，哪怕结论相反也不算反驳。</li>
                <li>控制变量铁律：排查故障时每次只改动 1 个变量，才能拿到唯一归因铁证。</li>
              </ul>
            </div>

            {summary.achievements.length > 0 && (
              <div className="logic-badges">
                {summary.achievements.map((a) => (
                  <span key={a} className="logic-badge">
                    <Award size={13} />
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="logic-metrics">
              <div>
                <strong>
                  {summary.counterexampleFirstTryCount}/{summary.counterexampleTotal}
                </strong>
                <span>反例一次命中</span>
              </div>
              <div>
                <strong>{summary.totalAttempts} 次</strong>
                <span>动手检验</span>
              </div>
              <div>
                <strong>{summary.usedSingleChangeStrategy ? '已掌握' : '待巩固'}</strong>
                <span>只改一项策略</span>
              </div>
            </div>

            <ul className="logic-record-list">
              {records.map((r) => (
                <li key={r.levelId}>
                  <CheckCircle2 size={15} />
                  <strong>{r.levelTitle}</strong>
                  <span className="logic-skill-chip">{r.skillTag}</span>
                  <small>
                    {r.levelId === 'canal-leak-detective'
                      ? r.triggeredMultiChange
                        ? '调整为单变量锁定'
                        : '单变量公平找出'
                      : r.attempts <= 1
                        ? '一次命中'
                        : `验了 ${r.attempts} 次`}
                  </small>
                </li>
              ))}
            </ul>

            <p className="logic-archive-status">
              <Sparkles size={14} />
              {saved === 'saving'
                ? '正在把这次记录放进「成长 · 我的档案」…'
                : saved === 'saved'
                  ? `已记进「我的档案 · 近况」：${summary.profileText}`
                  : '已经点亮逻辑小桥啦！（离线模式下暂不同步云端档案）'}
            </p>

            <div className="logic-summary-actions">
              {onGoChat && (
                <button
                  type="button"
                  className="logic-btn logic-btn-main"
                  onClick={() => {
                    closeGame();
                    requestAnimationFrame(() => onGoChat());
                  }}
                >
                  <MessageCircle size={16} />
                  带着发现找小N聊聊
                </button>
              )}
              <button type="button" className="logic-btn logic-btn-soft" onClick={closeGame}>
                回到五维地图
              </button>
              <button type="button" className="logic-btn logic-btn-ghost" onClick={restartAll}>
                <RotateCcw size={15} />
                再玩一轮
              </button>
            </div>
          </section>
        ) : (
          <div className="logic-workspace">
            {/* 顶部关卡故事与宣言牌 */}
            <section className="logic-order-card">
              <div className="logic-order-top">
                <span className="logic-skill-chip">{level.skillTag}</span>
                <span className="logic-step-hint">
                  第 {stepInfo.current}/{stepInfo.total} 步 · {stepInfo.label}
                </span>
              </div>
              <div className="logic-story-row">
                <div className="logic-story-mascot">
                  <Mascot mood={mascotMood} />
                </div>
                <div>
                  <h2>
                    第 {level.index} 关 · {level.title}
                  </h2>
                  <p className="logic-story">{level.story}</p>
                </div>
              </div>
              <div className="logic-claim-banner">
                <span>
                  {level.kind === 'canal-control' ? `${level.speaker}读数` : `${level.speaker}`}
                </span>
                <strong>{level.claim}</strong>
              </div>
            </section>

            {/* 第 1 & 2 关：案卷证物 + 核验台（含第 2 关有向数轴与平方对比） */}
            {(level.kind === 'card-check' || level.kind === 'square-seesaw') && level.cards && (
              <>
                <section className="logic-panel" aria-label="案卷证物箱">
                  <div className="logic-panel-head">
                    <h3>挑选一份证物送上核验台</h3>
                    <span className="logic-muted">核查前提边界，再执行核验</span>
                  </div>
                  <div className="logic-card-grid">
                    {level.cards.map((card) => {
                      const isSel = selectedCardId === card.id;
                      const isVerifiedOk = cardEval?.card.id === card.id && cardEval.ok;
                      const isVerifiedErr = cardEval?.card.id === card.id && !cardEval.ok;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          disabled={levelSolved}
                          aria-pressed={isSel}
                          className={`logic-sample-card${isSel ? ' selected' : ''}${isVerifiedOk ? ' ok' : ''}${isVerifiedErr ? ' err' : ''}`}
                          onClick={() => {
                            setSelectedCardId(card.id);
                            setCardEval(null);
                          }}
                        >
                          <div className="logic-sample-top">
                            <strong>{card.title}</strong>
                            <span>{card.badge}</span>
                          </div>
                          <code className="logic-sample-expr">{card.expression}</code>
                          {card.comparePair && (
                            <div className="logic-mini-bars" aria-hidden="true">
                              <div>
                                <small>原数</small>
                                <span className="logic-mini-pair">
                                  {card.comparePair.leftNum} {card.comparePair.relation}{' '}
                                  {card.comparePair.rightNum}
                                </span>
                              </div>
                              <div>
                                <small>平方</small>
                                <span className="logic-mini-pair sq">
                                  {card.comparePair.leftSq} vs {card.comparePair.rightSq}
                                </span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="logic-panel logic-bench-panel" aria-label="石桥核验台">
                  <div className="logic-panel-head">
                    <h3>
                      <Scale size={16} />{' '}
                      {level.kind === 'square-seesaw' ? '数轴平方核验台' : '证物核验台'}
                    </h3>
                    {activeCard && <span className="logic-bench-tag">{activeCard.title}</span>}
                  </div>

                  {!activeCard ? (
                    <div className="logic-bench-empty">
                      先从上方案卷中选取一份证物，送上核验台检查前提与结论。
                    </div>
                  ) : (
                    <div className="logic-bench-stage">
                      <div className="logic-bench-expr">{activeCard.expression}</div>

                      {activeCard.comparePair && (
                        <div className="logic-seesaw-bars">
                          <div className="logic-bar-group">
                            <span className="logic-bar-title">原数在数轴上的位置（负左 · 0居中 · 正右）</span>
                            {([
                              { label: '左数', val: activeCard.comparePair.leftNum },
                              { label: '右数', val: activeCard.comparePair.rightNum },
                            ] as const).map((item) => {
                              const pct = (Math.abs(item.val) / 3) * 50;
                              const leftPct = item.val < 0 ? 50 - pct : 50;
                              return (
                                <div className="logic-bar-row" key={item.label}>
                                  <span>{item.label}</span>
                                  <div className="logic-bar-track logic-signed-track">
                                    <i className="logic-zero-axis" aria-hidden="true" />
                                    {item.val === 0 ? (
                                      <span className="logic-zero-dot" title="0 点" />
                                    ) : (
                                      <div
                                        className={`logic-signed-fill ${item.val < 0 ? 'neg' : 'orig'}`}
                                        style={{ left: `${leftPct}%`, width: `${Math.max(6, pct)}%` }}
                                      />
                                    )}
                                  </div>
                                  <b>{item.val}</b>
                                </div>
                              );
                            })}
                          </div>

                          <div className="logic-bar-group">
                            <span className="logic-bar-title">平方高度对比</span>
                            <div className="logic-bar-row">
                              <span>左平方</span>
                              <div className="logic-bar-track">
                                <div
                                  className="logic-bar-fill sq"
                                  style={{
                                    width: `${Math.max(8, (activeCard.comparePair.leftSq / 4) * 100)}%`,
                                  }}
                                />
                              </div>
                              <b>{activeCard.comparePair.leftSq}</b>
                            </div>
                            <div className="logic-bar-row">
                              <span>右平方</span>
                              <div className="logic-bar-track">
                                <div
                                  className="logic-bar-fill sq-hi"
                                  style={{
                                    width: `${Math.max(8, (activeCard.comparePair.rightSq / 4) * 100)}%`,
                                  }}
                                />
                              </div>
                              <b>{activeCard.comparePair.rightSq}</b>
                            </div>
                          </div>
                        </div>
                      )}

                      {cardEval && (
                        <div className="logic-lamps-row" aria-label="前提与结论检验灯">
                          {cardEval.card.premiseLamps.map((lamp) => (
                            <span
                              key={lamp.label}
                              className={`logic-lamp ${lamp.passed ? 'pass' : 'fail'}`}
                            >
                              {lamp.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                              前提：{lamp.label}
                            </span>
                          ))}
                          <span
                            className={`logic-lamp ${cardEval.ok ? 'pass' : 'neutral'}`}
                          >
                            {cardEval.ok ? <Sparkles size={14} /> : <ShieldAlert size={14} />}
                            {cardEval.card.conclusionLabel}
                          </span>
                        </div>
                      )}

                      <div className="logic-action-row">
                        {!levelSolved ? (
                          <button
                            type="button"
                            className="logic-btn logic-btn-main"
                            onClick={handleInspectCard}
                          >
                            <SearchCheck size={16} />
                            送上核验台检验
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="logic-btn logic-btn-main"
                            onClick={() => void handleAdvanceLevel()}
                          >
                            <span>进入下一关</span>
                            <ArrowRight size={16} />
                          </button>
                        )}
                      </div>

                      {cardEval && (
                        <div
                          className={`logic-feedback ${cardEval.ok ? 'ok' : 'warn'}`}
                          role="status"
                        >
                          <div className="logic-feedback-row">
                            <div className="logic-mini-mascot">
                              <Mascot mood={mascotMood} />
                            </div>
                            <div>
                              <strong>{cardEval.headline}</strong>
                              <p>{cardEval.feedback}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* 第 3 关：奇偶密码闸（自主选数 + 点阵配对 + 代数本质） */}
            {level.kind === 'parity-builder' && level.numberPool && (
              <section className="logic-panel" aria-label="奇偶密码检验器">
                <div className="logic-panel-head">
                  <h3>选两个整数送入奇偶检验器</h3>
                  <span className="logic-muted">
                    当前准备填入：{paritySlot === 'left' ? '左侧槽位' : '右侧槽位'}
                  </span>
                </div>

                <div className="logic-pool-row" role="group" aria-label="整数数字盘">
                  {level.numberPool.map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={levelSolved}
                      className="logic-num-block"
                      onClick={() => handlePickParityNumber(num)}
                    >
                      <strong>{num}</strong>
                    </button>
                  ))}
                </div>

                <div className="logic-adder-stage">
                  <button
                    type="button"
                    disabled={levelSolved}
                    className={`logic-adder-slot${paritySlot === 'left' && !levelSolved ? ' active' : ''}`}
                    onClick={() => setParitySlot('left')}
                  >
                    <span className="logic-slot-label">第一个加数</span>
                    {parityLeft !== null ? (
                      <>
                        <strong className="logic-slot-num">{parityLeft}</strong>
                        <ParityDots value={parityLeft} accent="left" />
                      </>
                    ) : (
                      <em className="logic-slot-placeholder">点上面数字放入</em>
                    )}
                  </button>

                  <span className="logic-adder-plus" aria-hidden="true">
                    +
                  </span>

                  <button
                    type="button"
                    disabled={levelSolved}
                    className={`logic-adder-slot${paritySlot === 'right' && !levelSolved ? ' active' : ''}`}
                    onClick={() => setParitySlot('right')}
                  >
                    <span className="logic-slot-label">第二个加数</span>
                    {parityRight !== null ? (
                      <>
                        <strong className="logic-slot-num">{parityRight}</strong>
                        <ParityDots value={parityRight} accent="right" />
                      </>
                    ) : (
                      <em className="logic-slot-placeholder">点上面数字放入</em>
                    )}
                  </button>
                </div>

                {parityEval && (
                  <div className="logic-parity-merge" aria-label="合并配对演示">
                    <div className="logic-merge-head">
                      <span>
                        合并结果：{parityEval.left.value} + {parityEval.right.value} ={' '}
                        <b>{parityEval.sum}</b>（{parityEval.sumIsEven ? '偶数' : '奇数'}）
                      </span>
                    </div>
                    <div className="logic-merge-dots">
                      {Array.from(
                        { length: parityEval.left.pairs + parityEval.right.pairs },
                        (_, i) => (
                          <span key={`p-${i}`} className="logic-dot-pair merged">
                            <i />
                            <i />
                          </span>
                        ),
                      )}
                      {parityEval.left.leftover === 1 && parityEval.right.leftover === 1 ? (
                        <span
                          className="logic-dot-pair reunited"
                          title="两个落单的 1 凑成新的一对！"
                        >
                          <i />
                          <i />
                        </span>
                      ) : parityEval.left.leftover + parityEval.right.leftover === 1 ? (
                        <span className="logic-dot-lonely">
                          <i />
                        </span>
                      ) : null}
                    </div>
                    {parityEval.ok && (
                      <div className="logic-algebra-insight">
                        <small className="logic-merge-caption">
                          两个奇数的余数 1 + 1 正好凑成新的一对，全部完成两两配对。
                        </small>
                        <code className="logic-algebra-formula">
                          代数通式：(2m + 1) + (2n + 1) = 2(m + n + 1) → 必为偶数
                        </code>
                      </div>
                    )}
                  </div>
                )}

                <div className="logic-action-row">
                  {!levelSolved ? (
                    <>
                      <button
                        type="button"
                        className="logic-btn logic-btn-main"
                        disabled={parityLeft === null || parityRight === null}
                        onClick={handleCheckParity}
                      >
                        <SearchCheck size={16} />
                        执行合并核验
                      </button>
                      <button
                        type="button"
                        className="logic-btn logic-btn-soft"
                        onClick={() => {
                          setParityLeft(null);
                          setParityRight(null);
                          setParitySlot('left');
                          setParityEval(null);
                        }}
                      >
                        <RotateCcw size={14} />
                        清空重挑
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="logic-btn logic-btn-main"
                      onClick={() => void handleAdvanceLevel()}
                    >
                      <span>进入最后一关</span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>

                {parityEval && (
                  <div
                    className={`logic-feedback ${parityEval.ok ? 'ok' : 'warn'}`}
                    role="status"
                  >
                    <div className="logic-feedback-row">
                      <div className="logic-mini-mascot">
                        <Mascot mood={mascotMood} />
                      </div>
                      <div>
                        <strong>{parityEval.headline}</strong>
                        <p>{parityEval.feedback}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 第 4 关：暗渠控变追踪（控制变量试水台） */}
            {level.kind === 'canal-control' && (
              <section className="logic-panel" aria-label="桥下暗渠试水台">
                <div className="logic-panel-head">
                  <h3>
                    <Droplets size={16} /> 桥下暗渠：单变量试水排查
                  </h3>
                  <span className="logic-muted">
                    当前已换新：{replacedJoints.length === 0 ? '0 处' : `${replacedJoints.join('、')}（${replacedJoints.length} 处）`}
                  </span>
                </div>

                {/* 可视化 SVG 暗渠图 */}
                <svg
                  className="logic-canal-svg"
                  viewBox="0 0 340 112"
                  role="img"
                  aria-label={`上游发出 ${CANAL_SOURCE_DROPS} 单位水量，经过 A、B、C 三段阀门，当前试水到达终点 ${displayedDrops} 单位`}
                >
                  <rect x="6" y="18" width="56" height="54" rx="14" fill="#e1f2f9" stroke="#7cb6d1" strokeWidth="1.8" />
                  <text x="34" y="42" textAnchor="middle" fill="#23576e" fontSize="11" fontWeight="700">
                    上游
                  </text>
                  <text x="34" y="59" textAnchor="middle" fill="#1e6b8a" fontSize="13" fontWeight="700">
                    {CANAL_SOURCE_DROPS} 单位
                  </text>

                  {/* 暗渠主管与动态水流线 */}
                  <line
                    x1="62"
                    y1="45"
                    x2="278"
                    y2="45"
                    stroke={canalEval && displayedDrops === 8 ? '#3e9c78' : '#7cb6d1'}
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <line
                    className="logic-water-flow"
                    x1="64"
                    y1="45"
                    x2="276"
                    y2="45"
                    stroke="#ffffff"
                    strokeWidth="2.4"
                    strokeDasharray="6 10"
                    strokeLinecap="round"
                    opacity="0.72"
                  />

                  {/* 三段阀门 */}
                  {PIPE_JOINTS.map((joint, idx) => {
                    const cx = 104 + idx * 66;
                    const isReplaced = replacedJoints.includes(joint.id);
                    const isExcluded = excludedJoints.includes(joint.id) && !canalEval?.solved;
                    const isConfirmedLeak =
                      Boolean(canalEval?.solved) && joint.id === (level.leakyJoint ?? 'B');
                    return (
                      <g key={joint.id}>
                        <rect
                          x={cx - 22}
                          y="26"
                          width="44"
                          height="38"
                          rx="11"
                          fill={isReplaced ? '#dff5ea' : isExcluded ? '#f1f3f5' : '#fff8e8'}
                          stroke={isReplaced ? '#358d67' : isExcluded ? '#9aa5b1' : '#d2a24c'}
                          strokeWidth="2"
                        />
                        <text
                          x={cx}
                          y="43"
                          textAnchor="middle"
                          fill={isReplaced ? '#1a5c41' : isExcluded ? '#52606d' : '#704b0e'}
                          fontSize="12"
                          fontWeight="700"
                        >
                          {joint.id} 阀
                        </text>
                        <text
                          x={cx}
                          y="56"
                          textAnchor="middle"
                          fill={isReplaced ? '#257050' : isExcluded ? '#616e7c' : '#966b1e'}
                          fontSize="9.5"
                          fontWeight="600"
                        >
                          {isReplaced ? '已换新' : isExcluded ? '已排除' : '旧阀门'}
                        </text>
                        {isConfirmedLeak && (
                          <text
                            x={cx}
                            y="82"
                            textAnchor="middle"
                            fill="#1d6b4a"
                            fontSize="10"
                            fontWeight="700"
                          >
                            ✓ 渗漏点已锁定
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {canalEval && leakStillActive && (
                    <text
                      x="170"
                      y="92"
                      textAnchor="middle"
                      fill="#b55336"
                      fontSize="10.5"
                      fontWeight="700"
                    >
                      沿途仍损耗 2 单位，保持单变量继续排查
                    </text>
                  )}

                  {/* 终点水表 */}
                  <rect
                    x="278"
                    y="18"
                    width="56"
                    height="54"
                    rx="14"
                    fill={canalEval && displayedDrops === 8 ? '#e3f7ec' : '#fff3e6'}
                    stroke={canalEval && displayedDrops === 8 ? '#4aa378' : '#dfb176'}
                    strokeWidth="1.8"
                  />
                  <text x="306" y="42" textAnchor="middle" fill="#4f4328" fontSize="11" fontWeight="700">
                    终点
                  </text>
                  <text
                    x="306"
                    y="59"
                    textAnchor="middle"
                    fill={canalEval && displayedDrops === 8 ? '#1d6b4a' : '#a85426'}
                    fontSize="13"
                    fontWeight="700"
                  >
                    {canalEval ? `${displayedDrops} 单位` : '6 单位'}
                  </text>
                </svg>

                {/* 阀门换新按钮组 */}
                <div className="logic-joint-grid" role="group" aria-label="选择更换的暗渠阀门">
                  {PIPE_JOINTS.map((joint) => {
                    const isNew = replacedJoints.includes(joint.id);
                    const isExcluded = excludedJoints.includes(joint.id) && !levelSolved;
                    return (
                      <button
                        key={joint.id}
                        type="button"
                        disabled={levelSolved}
                        aria-pressed={isNew}
                        className={`logic-joint-btn${isNew ? ' active' : ''}${isExcluded ? ' excluded' : ''}`}
                        onClick={() => toggleJoint(joint.id)}
                      >
                        <Wrench size={14} />
                        <strong>{joint.name}</strong>
                        <small>{isNew ? '已换新阀' : isExcluded ? '已排除（无漏）' : '点击换新'}</small>
                      </button>
                    );
                  })}
                </div>

                {/* 先猜水量条 */}
                {!levelSolved && (
                  <div className="logic-guess-row" role="group" aria-label="试水前先预测终点水量">
                    <span>开闸前预测终点水量：</span>
                    <div className="logic-guess-btns">
                      {([6, 8] as const).map((drops) => (
                        <button
                          key={drops}
                          type="button"
                          aria-pressed={canalGuess === drops}
                          className={canalGuess === drops ? 'active' : ''}
                          onClick={() => setCanalGuess(drops)}
                        >
                          预测 {drops} 单位
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="logic-action-row">
                  {!levelSolved ? (
                    <>
                      <button
                        type="button"
                        className="logic-btn logic-btn-main"
                        onClick={handleRunCanalTrial}
                      >
                        <Droplets size={16} />
                        开闸试水
                      </button>
                      <button
                        type="button"
                        className="logic-btn logic-btn-soft"
                        disabled={replacedJoints.length === 0}
                        onClick={resetCanalJoints}
                      >
                        <RotateCcw size={14} />
                        恢复原状
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="logic-btn logic-btn-main"
                      onClick={() => void handleAdvanceLevel()}
                    >
                      <span>解锁结案档案与秘籍</span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>

                {canalEval && (
                  <div
                    className={`logic-feedback ${canalEval.solved ? 'ok' : 'warn'}`}
                    role="status"
                  >
                    <div className="logic-feedback-row">
                      <div className="logic-mini-mascot">
                        <Mascot mood={mascotMood} />
                      </div>
                      <div>
                        <strong>{canalEval.headline}</strong>
                        <p>{canalEval.feedback}</p>
                      </div>
                    </div>
                  </div>
                )}

                {canalLogs.length > 0 && (
                  <div className="logic-trial-log" aria-label="试水实验记录">
                    <h4>试水实验记录单</h4>
                    <ul>
                      {canalLogs.map((row) => (
                        <li key={row.trialNo}>
                          <span>第 {row.trialNo} 次</span>
                          <b>
                            换新：
                            {row.replaced.length > 0 ? row.replaced.join('+') : '无'}
                          </b>
                          <em>
                            终点 {row.delivered} 滴
                            {row.predicted !== null ? `（猜 ${row.predicted}）` : ''}
                          </em>
                          <small>{row.note}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
