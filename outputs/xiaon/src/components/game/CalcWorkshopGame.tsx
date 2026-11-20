/** 计算工坊 · 《口袋整理坊》互动小游戏（专业模式第三站「计算」深度融合）。
 * 温暖明亮绘本纸感风：亲手把变号魔法盒内每一项翻号拆出 → 分类放进「神秘小袋子」与「星星数字袋」
 * → 亲手把袋里数量合起来，并随时用「试数小天平」代入数字称重验算。 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Lightbulb,
  Lock,
  MessageCircle,
  Minus,
  PackageOpen,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import { Mascot, type PetMood } from '../../Art';
import { apiRequest } from '../../agent-client';
import { lastAccount } from '../../auth/session';
import {
  CALC_WORKSHOP_LEVELS,
  buildCalcWorkshopSummary,
  checkSlotAssignment,
  evaluateBalanceScale,
  evaluateBracketUnpack,
  evaluateWorkshopSubmission,
  formatLinearExpr,
  formatTermToken,
  summarizeTerms,
  type CalcLevelRecord,
  type CalcWorkshopSummary,
  type SubmissionEvaluation,
  type TermKind,
  type TermSign,
  type TermToken,
  type UnpackEvaluation,
} from './calcWorkshopLogic';

const DONE_KEY_PREFIX = 'xiaon-calc-workshop-done-v1:';

export type CalcWorkshopCompletion = {
  completedAt: string;
  achievements: string[];
  totalAttempts: number;
  firstTryCount: number;
  usedBalanceScaleAny: boolean;
  assessment: string;
};

export type CalcWorkshopGameProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: (summary: CalcWorkshopCompletion) => void;
  onGoChat?: () => void;
  onFallbackAssess?: () => void;
};

function doneStorageKey(): string {
  const acct = typeof window !== 'undefined' ? lastAccount() || 'local' : 'local';
  return `${DONE_KEY_PREFIX}${acct}`;
}

export function readCalcWorkshopCompletion(): CalcWorkshopCompletion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(doneStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalcWorkshopCompletion>;
    if (!parsed || typeof parsed.completedAt !== 'string') return null;
    return {
      completedAt: parsed.completedAt,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      totalAttempts: typeof parsed.totalAttempts === 'number' ? parsed.totalAttempts : 0,
      firstTryCount: typeof parsed.firstTryCount === 'number' ? parsed.firstTryCount : 0,
      usedBalanceScaleAny: Boolean(parsed.usedBalanceScaleAny),
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    };
  } catch {
    return null;
  }
}

function saveCalcWorkshopCompletion(summary: CalcWorkshopCompletion): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(doneStorageKey(), JSON.stringify(summary));
  } catch {
    /* 存储受限时静默忽略 */
  }
}

export function CalcWorkshopGame({
  open,
  onClose,
  onCompleted,
  onGoChat,
  onFallbackAssess,
}: CalcWorkshopGameProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scaleRef = useRef<HTMLElement>(null);
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  const onCompletedRef = useRef(onCompleted);
  onCloseRef.current = onClose;
  onCompletedRef.current = onCompleted;

  const [levelIdx, setLevelIdx] = useState(0);
  const [boxUnpacked, setBoxUnpacked] = useState(true);
  const [chosenSigns, setChosenSigns] = useState<Record<string, TermSign | undefined>>({});
  const [unpackedTerms, setUnpackedTerms] = useState<TermToken[]>([]);
  const [unpackEval, setUnpackEval] = useState<UnpackEvaluation | null>(null);

  const [slotMap, setSlotMap] = useState<Record<string, TermKind>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slotNotice, setSlotNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [varInput, setVarInput] = useState(0);
  const [constInput, setConstInput] = useState(0);
  const [submitEval, setSubmitEval] = useState<SubmissionEvaluation | null>(null);
  const [levelSolved, setLevelSolved] = useState(false);

  const [scaleOpen, setScaleOpen] = useState(false);
  const [sampleVal, setSampleVal] = useState(2);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [hintTier, setHintTier] = useState<1 | 2 | 3>(1);

  const [unpackAttempts, setUnpackAttempts] = useState(0);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [triggeredForgotSecond, setTriggeredForgotSecond] = useState(false);
  const [unlikeMistakes, setUnlikeMistakes] = useState(0);
  const [usedScaleInLevel, setUsedScaleInLevel] = useState(false);
  const [maxHintInLevel, setMaxHintInLevel] = useState(0);

  const [records, setRecords] = useState<CalcLevelRecord[]>([]);
  const [summary, setSummary] = useState<CalcWorkshopSummary | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const level = CALC_WORKSHOP_LEVELS[levelIdx];
  const allComplete = summary !== null;

  function initLevel(idx: number) {
    const target = CALC_WORKSHOP_LEVELS[idx];
    setLevelIdx(idx);
    setBoxUnpacked(target.bracketBox === null);
    setChosenSigns({});
    setUnpackedTerms([]);
    setUnpackEval(null);
    setSlotMap({});
    setSelectedId(target.bracketBox === null ? (target.looseTerms[0]?.id ?? null) : null);
    setSlotNotice(null);
    setVarInput(0);
    setConstInput(0);
    setSubmitEval(null);
    setLevelSolved(false);
    setSampleVal(target.sampleValues[1] ?? 2);
    setTipsOpen(false);
    setHintTier(1);
    setUnpackAttempts(0);
    setSubmitAttempts(0);
    setTriggeredForgotSecond(false);
    setUnlikeMistakes(0);
    setUsedScaleInLevel(false);
    setMaxHintInLevel(0);
  }

  function restartAll() {
    setRecords([]);
    setSummary(null);
    setSaved('idle');
    setScaleOpen(false);
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
          { ...window.history.state, page: undefined, calcWorkshop: true },
          '',
          '#calc-workshop',
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

  const trayTerms = useMemo(
    () => [...level.looseTerms, ...(boxUnpacked ? unpackedTerms : [])],
    [level.looseTerms, boxUnpacked, unpackedTerms],
  );

  const looseUnassigned = useMemo(
    () => trayTerms.filter((t) => !slotMap[t.id]),
    [trayTerms, slotMap],
  );
  const varSlotTerms = useMemo(
    () => trayTerms.filter((t) => slotMap[t.id] === 'var'),
    [trayTerms, slotMap],
  );
  const constSlotTerms = useMemo(
    () => trayTerms.filter((t) => slotMap[t.id] === 'const'),
    [trayTerms, slotMap],
  );

  const allSorted = boxUnpacked && looseUnassigned.length === 0;
  const activeToken =
    looseUnassigned.find((t) => t.id === selectedId) ?? looseUnassigned[0] ?? null;

  const scalePreviewExpr = useMemo(() => {
    if (!boxUnpacked && level.bracketBox) {
      const box = level.bracketBox;
      const previewBoxTerms: TermToken[] = box.innerTerms.map((t) => {
        const picked = chosenSigns[t.id] ?? (t.coeff < 0 ? -1 : 1);
        return { ...t, coeff: picked * Math.abs(t.coeff) };
      });
      return summarizeTerms([...level.looseTerms, ...previewBoxTerms], level.variable);
    }
    if (allSorted) {
      return { variable: level.variable, varCoeff: varInput, constVal: constInput };
    }
    return summarizeTerms(trayTerms, level.variable);
  }, [boxUnpacked, level, chosenSigns, allSorted, varInput, constInput, trayTerms]);

  const scaleResult = useMemo(
    () =>
      evaluateBalanceScale(
        level,
        scalePreviewExpr.varCoeff,
        scalePreviewExpr.constVal,
        sampleVal,
      ),
    [level, scalePreviewExpr, sampleVal],
  );

  function toggleScale(forceOpen?: boolean, scrollIntoView = false) {
    const next = forceOpen ?? !scaleOpen;
    setScaleOpen(next);
    if (next) {
      setUsedScaleInLevel(true);
      if (scrollIntoView) {
        requestAnimationFrame(() => {
          scaleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }
  }

  function pickSample(val: number) {
    setSampleVal(val);
    setUsedScaleInLevel(true);
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

  function handleUnpackSubmit() {
    if (!level.bracketBox) return;
    const res = evaluateBracketUnpack(level.bracketBox, chosenSigns, level.variable);
    setUnpackEval(res);
    if (res.code !== 'incomplete') {
      setUnpackAttempts((n) => n + 1);
    }
    if (res.code === 'forgot-second-sign') {
      setTriggeredForgotSecond(true);
    }
    if (res.ok) {
      setUnpackedTerms([...res.unpackedTerms]);
      setBoxUnpacked(true);
      const nextLoose = [...level.looseTerms, ...res.unpackedTerms];
      setSelectedId(nextLoose[0]?.id ?? null);
      setSlotNotice({ ok: true, text: res.feedback });
    }
  }

  function assignToSlot(targetSlot: TermKind) {
    if (!activeToken || !boxUnpacked || levelSolved) return;
    const check = checkSlotAssignment(activeToken, targetSlot, level.variable);
    setSlotNotice({ ok: check.ok, text: check.message });
    if (!check.ok) {
      setUnlikeMistakes((n) => n + 1);
      return;
    }
    const nextMap = { ...slotMap, [activeToken.id]: targetSlot };
    setSlotMap(nextMap);
    const remaining = trayTerms.filter((t) => !nextMap[t.id]);
    setSelectedId(remaining[0]?.id ?? null);
  }

  function returnFromSlot(tokenId: string) {
    if (levelSolved) return;
    const nextMap = { ...slotMap };
    delete nextMap[tokenId];
    setSlotMap(nextMap);
    setSelectedId(tokenId);
    setSubmitEval(null);
  }

  function adjustVar(delta: number) {
    if (levelSolved) return;
    setVarInput((v) => Math.max(-20, Math.min(20, v + delta)));
    setSubmitEval(null);
  }

  function adjustConst(delta: number) {
    if (levelSolved) return;
    setConstInput((c) => Math.max(-30, Math.min(30, c + delta)));
    setSubmitEval(null);
  }

  function handleSubmitPackage() {
    if (!allSorted || levelSolved) return;
    const nextAttempts = submitAttempts + 1;
    setSubmitAttempts(nextAttempts);
    const res = evaluateWorkshopSubmission(level, varInput, constInput);
    setSubmitEval(res);

    if (res.matched) {
      setLevelSolved(true);
      const rec: CalcLevelRecord = {
        levelId: level.id,
        levelTitle: level.title,
        skillTag: level.skillTag,
        hasBracket: level.bracketBox !== null,
        unpackAttempts,
        submitAttempts: nextAttempts,
        triggeredForgotSecondSign: triggeredForgotSecond,
        fixedForgotSecondSign: triggeredForgotSecond,
        unlikeTermMistakes: unlikeMistakes,
        usedBalanceScale: usedScaleInLevel,
        usedHints: maxHintInLevel,
        completed: true,
      };
      setRecords((prev) => [...prev.filter((r) => r.levelId !== rec.levelId), rec]);
    }
  }

  async function handleAdvanceLevel() {
    if (levelIdx < CALC_WORKSHOP_LEVELS.length - 1) {
      initLevel(levelIdx + 1);
      return;
    }
    const built = buildCalcWorkshopSummary(records);
    setSummary(built);
    const completion: CalcWorkshopCompletion = {
      completedAt: new Date().toISOString(),
      achievements: built.achievements,
      totalAttempts: built.totalAttempts,
      firstTryCount: built.firstTryCount,
      usedBalanceScaleAny: built.usedBalanceScaleAny,
      assessment: built.assessment,
    };
    saveCalcWorkshopCompletion(completion);
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

  const mascotMood: PetMood = allComplete || levelSolved
    ? 'happy'
    : unpackEval?.ok === false || submitEval?.matched === false || slotNotice?.ok === false
      ? 'thinking'
      : 'idle';

  const hasBox = level.bracketBox !== null;
  const totalSteps = hasBox ? 3 : 2;
  const currentStep = hasBox
    ? !boxUnpacked
      ? 1
      : !allSorted
        ? 2
        : 3
    : !allSorted
      ? 1
      : 2;
  const currentStepLabel = !boxUnpacked
    ? '打开变号魔法盒'
    : !allSorted
      ? '分类放进口袋'
      : '合起来数一数';

  return (
    <dialog
      ref={dialogRef}
      className="calc-dialog"
      aria-labelledby={titleId}
      onClose={handleNativeClose}
    >
      <header className="calc-bar">
        <button type="button" className="calc-nav-btn" onClick={closeGame}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>

        <div className="calc-title-pill" id={titleId}>
          <Wrench size={15} />
          <strong>计算工坊</strong>
          {!allComplete && (
            <span className="calc-step-pill">
              {level.index}/{CALC_WORKSHOP_LEVELS.length}
            </span>
          )}
        </div>

        <div className="calc-bar-actions">
          {!allComplete && (
            <button
              type="button"
              className="calc-hud-btn"
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
              className="calc-hud-btn calc-hud-ghost"
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

      <div className="calc-body">
        {tipsOpen && !allComplete && (
          <section className="calc-tips-drawer" aria-label="小N分级锦囊">
            <div className="calc-tips-head">
              <strong>
                <Lightbulb size={15} /> 小N锦囊（提示思路，不直接给答案）
              </strong>
              <button
                type="button"
                className="calc-icon-btn"
                aria-label="收起锦囊"
                onClick={() => setTipsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="calc-tips-tabs" role="tablist" aria-label="提示层级">
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
                <div className="calc-tip-content">
                  <h4>{currentHint.title}</h4>
                  <p>{currentHint.body}</p>
                </div>
              );
            })()}
          </section>
        )}

        {allComplete && summary ? (
          <section className="calc-summary-card" aria-label="计算工坊探索手记评价卡">
            <div className="calc-summary-head">
              <div className="calc-summary-mascot">
                <Mascot mood="happy" />
              </div>
              <div>
                <span className="calc-eyebrow">计算工坊 · 已点亮</span>
                <h2>口袋整理坊小手记</h2>
                <p>{summary.assessment}</p>
              </div>
            </div>

            {summary.achievements.length > 0 && (
              <div className="calc-badges">
                {summary.achievements.map((a) => (
                  <span key={a} className="calc-badge">
                    <Award size={13} />
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="calc-metrics">
              <div>
                <strong>
                  {summary.firstTryCount}/{summary.totalLevels}
                </strong>
                <span>一次过关</span>
              </div>
              <div>
                <strong>{summary.totalAttempts} 次</strong>
                <span>动手尝试</span>
              </div>
              <div>
                <strong>{summary.usedBalanceScaleCount} 关</strong>
                <span>用天平验算</span>
              </div>
            </div>

            <ul className="calc-record-list">
              {records.map((r) => (
                <li key={r.levelId}>
                  <CheckCircle2 size={15} />
                  <strong>{r.levelTitle}</strong>
                  <span className="calc-skill-chip">{r.skillTag}</span>
                  <small>
                    {r.triggeredForgotSecondSign
                      ? '自己发现并改对第二项'
                      : r.submitAttempts <= 1 && (!r.hasBracket || r.unpackAttempts <= 1)
                        ? '一次过关'
                        : `试了 ${Math.max(1, r.submitAttempts)} 次`}
                  </small>
                </li>
              ))}
            </ul>

            <p className="calc-archive-status">
              <Sparkles size={14} />
              {saved === 'saving'
                ? '正在把这次记录放进「成长 · 我的档案」…'
                : saved === 'saved'
                  ? `已记进「我的档案 · 近况」：${summary.profileText}`
                  : '已经点亮计算工坊啦！（离线模式下暂不同步云端档案）'}
            </p>

            <div className="calc-summary-actions">
              {onGoChat && (
                <button
                  type="button"
                  className="calc-btn calc-btn-main"
                  onClick={() => {
                    closeGame();
                    requestAnimationFrame(() => onGoChat());
                  }}
                >
                  <MessageCircle size={16} />
                  带着发现找小N聊聊
                </button>
              )}
              <button type="button" className="calc-btn calc-btn-soft" onClick={closeGame}>
                回到五维地图
              </button>
              <button type="button" className="calc-btn calc-btn-ghost" onClick={restartAll}>
                <RotateCcw size={15} />
                再玩一轮
              </button>
            </div>
          </section>
        ) : (
          <div className="calc-workspace">
            {/* 关卡故事卡片 */}
            <section className="calc-order-card">
              <div className="calc-order-top">
                <span className="calc-skill-chip">{level.skillTag}</span>
                <span className="calc-step-hint">
                  第 {currentStep}/{totalSteps} 步 · {currentStepLabel}
                </span>
              </div>
              <div className="calc-story-row">
                <div className="calc-story-mascot">
                  <Mascot mood={mascotMood} />
                </div>
                <div>
                  <h2>
                    第 {level.index} 关 · {level.title}
                  </h2>
                  <p className="calc-story">{level.story}</p>
                </div>
              </div>
              <div className="calc-expr-banner" aria-label={`原式 ${level.expressionDisplay}`}>
                <span>要整理的式子</span>
                <code>{level.expressionDisplay}</code>
              </div>
            </section>

            {/* 变号魔法盒（仅负括号关卡） */}
            {level.bracketBox && !boxUnpacked && (
              <section className="calc-panel calc-gate-panel" aria-label="变号魔法盒">
                <div className="calc-panel-head">
                  <h3>
                    <Lock size={16} /> 变号小门：帮盒里的每一项选新符号
                  </h3>
                  <span className="calc-gate-badge">
                    盒外是「{level.bracketBox.outerSign < 0 ? '减号 −' : '加号 +'}」
                  </span>
                </div>

                <div className="calc-box-grid">
                  {level.bracketBox.innerTerms.map((term, i) => {
                    const picked = chosenSigns[term.id];
                    const absText =
                      term.kind === 'var'
                        ? Math.abs(term.coeff) === 1
                          ? level.variable
                          : `${Math.abs(term.coeff)}${level.variable}`
                        : `${Math.abs(term.coeff)}`;
                    return (
                      <div key={term.id} className="calc-box-item">
                        <div className="calc-box-orig">
                          <small>盒里第 {i + 1} 个</small>
                          <strong>{formatTermToken(term, level.variable)}</strong>
                        </div>
                        <div
                          className="calc-sign-picker"
                          role="group"
                          aria-label={`盒里第 ${i + 1} 个出小门后的符号`}
                        >
                          <button
                            type="button"
                            className={`calc-sign-btn pos${picked === 1 ? ' selected' : ''}`}
                            aria-pressed={picked === 1}
                            onClick={() => {
                              setChosenSigns((prev) => ({ ...prev, [term.id]: 1 }));
                              setUnpackEval(null);
                            }}
                          >
                            +{absText}
                          </button>
                          <button
                            type="button"
                            className={`calc-sign-btn neg${picked === -1 ? ' selected' : ''}`}
                            aria-pressed={picked === -1}
                            onClick={() => {
                              setChosenSigns((prev) => ({ ...prev, [term.id]: -1 }));
                              setUnpackEval(null);
                            }}
                          >
                            −{absText}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="calc-gate-actions">
                  <button
                    type="button"
                    className="calc-btn calc-btn-main"
                    onClick={handleUnpackSubmit}
                  >
                    <PackageOpen size={16} />
                    打开魔法盒
                  </button>
                  <button
                    type="button"
                    className="calc-btn calc-btn-soft"
                    onClick={() => toggleScale(true, true)}
                  >
                    <Scale size={15} />
                    用试数小天平看看
                  </button>
                </div>

                {unpackEval && !unpackEval.ok && (
                  <div className="calc-feedback warn" role="status">
                    <strong>{unpackEval.headline}</strong>
                    <p>{unpackEval.feedback}</p>
                  </div>
                )}
              </section>
            )}

            {/* 分类放进口袋 */}
            {boxUnpacked && (
              <section className="calc-panel" aria-label="分类放进口袋">
                <div className="calc-panel-head">
                  <h3>
                    <Unlock size={16} /> 分类放进口袋
                  </h3>
                  <span className="calc-muted">
                    {allSorted ? '全部放好啦！' : `还剩 ${looseUnassigned.length} 个`}
                  </span>
                </div>

                {!allSorted && (
                  <div className="calc-conveyor">
                    <div className="calc-token-row">
                      {looseUnassigned.map((t) => {
                        const isSel = activeToken?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`calc-token ${t.coeff >= 0 ? 'pos' : 'neg'}${isSel ? ' selected' : ''}`}
                            aria-pressed={isSel}
                            onClick={() => setSelectedId(t.id)}
                          >
                            <strong>{formatTermToken(t, level.variable)}</strong>
                            <small>{t.fromBox ? '刚拆出' : '待分类'}</small>
                          </button>
                        );
                      })}
                    </div>
                    {activeToken && (
                      <div className="calc-assign-bar">
                        <span>
                          把 <b>{formatTermToken(activeToken, level.variable)}</b> 放进：
                        </span>
                        <div className="calc-assign-btns">
                          <button
                            type="button"
                            className="calc-btn calc-slot-var-btn"
                            onClick={() => assignToSlot('var')}
                          >
                            {level.variable} 小袋子
                          </button>
                          <button
                            type="button"
                            className="calc-btn calc-slot-const-btn"
                            onClick={() => assignToSlot('const')}
                          >
                            星星数字袋
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="calc-slots-grid">
                  <div className="calc-slot-box var-slot">
                    <div className="calc-slot-head">
                      <strong>{level.variable} 小袋子（带字母）</strong>
                      <small>{varSlotTerms.length} 个</small>
                    </div>
                    <div className="calc-slot-items">
                      {varSlotTerms.length === 0 ? (
                        <span className="calc-slot-empty">等带 {level.variable} 的进来</span>
                      ) : (
                        varSlotTerms.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`calc-chip ${t.coeff >= 0 ? 'pos' : 'neg'}`}
                            disabled={levelSolved}
                            title="点一下放回上面"
                            onClick={() => returnFromSlot(t.id)}
                          >
                            {formatTermToken(t, level.variable)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="calc-slot-box const-slot">
                    <div className="calc-slot-head">
                      <strong>星星数字袋（纯数字）</strong>
                      <small>{constSlotTerms.length} 个</small>
                    </div>
                    <div className="calc-slot-items">
                      {constSlotTerms.length === 0 ? (
                        <span className="calc-slot-empty">等纯数字小星星进来</span>
                      ) : (
                        constSlotTerms.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`calc-chip ${t.coeff >= 0 ? 'pos' : 'neg'}`}
                            disabled={levelSolved}
                            title="点一下放回上面"
                            onClick={() => returnFromSlot(t.id)}
                          >
                            {formatTermToken(t, level.variable)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {slotNotice && (
                  <p className={`calc-inline-msg ${slotNotice.ok ? 'ok' : 'warn'}`} role="status">
                    {slotNotice.text}
                  </p>
                )}
              </section>
            )}

            {/* 合起来数一数 */}
            {allSorted && (
              <section className="calc-panel calc-pack-panel" aria-label="合起来数一数">
                <div className="calc-panel-head">
                  <h3>把两个口袋分别合起来</h3>
                  <span className="calc-preview-pill">
                    合起来是：
                    <strong>
                      {formatLinearExpr({
                        variable: level.variable,
                        varCoeff: varInput,
                        constVal: constInput,
                      })}
                    </strong>
                  </span>
                </div>

                <div className="calc-steppers">
                  <div className="calc-stepper">
                    <span className="calc-stepper-label">
                      {level.variable} 小袋子一共是
                    </span>
                    <div className="calc-stepper-controls">
                      <button
                        type="button"
                        aria-label={`${level.variable} 系数减 5`}
                        disabled={levelSolved}
                        onClick={() => adjustVar(-5)}
                      >
                        −5
                      </button>
                      <button
                        type="button"
                        aria-label={`${level.variable} 系数减 1`}
                        disabled={levelSolved}
                        onClick={() => adjustVar(-1)}
                      >
                        <Minus size={14} />
                      </button>
                      <output aria-live="polite">
                        {varInput >= 0 ? `+${varInput}` : `−${Math.abs(varInput)}`}
                        {level.variable}
                      </output>
                      <button
                        type="button"
                        aria-label={`${level.variable} 系数加 1`}
                        disabled={levelSolved}
                        onClick={() => adjustVar(1)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${level.variable} 系数加 5`}
                        disabled={levelSolved}
                        onClick={() => adjustVar(5)}
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <div className="calc-stepper">
                    <span className="calc-stepper-label">星星数字袋一共是</span>
                    <div className="calc-stepper-controls">
                      <button
                        type="button"
                        aria-label="常数减 5"
                        disabled={levelSolved}
                        onClick={() => adjustConst(-5)}
                      >
                        −5
                      </button>
                      <button
                        type="button"
                        aria-label="常数减 1"
                        disabled={levelSolved}
                        onClick={() => adjustConst(-1)}
                      >
                        <Minus size={14} />
                      </button>
                      <output aria-live="polite">
                        {constInput >= 0 ? `+${constInput}` : `−${Math.abs(constInput)}`}
                      </output>
                      <button
                        type="button"
                        aria-label="常数加 1"
                        disabled={levelSolved}
                        onClick={() => adjustConst(1)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="常数加 5"
                        disabled={levelSolved}
                        onClick={() => adjustConst(5)}
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </div>

                <div className="calc-pack-actions">
                  {!levelSolved ? (
                    <>
                      <button
                        type="button"
                        className="calc-btn calc-btn-main"
                        onClick={handleSubmitPackage}
                      >
                        <CheckCircle2 size={16} />
                        交卷看看对不对
                      </button>
                      <button
                        type="button"
                        className="calc-btn calc-btn-soft"
                        onClick={() => toggleScale(true, true)}
                      >
                        <Scale size={15} />
                        用试数小天平验算
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="calc-btn calc-btn-main"
                      onClick={() => void handleAdvanceLevel()}
                    >
                      <span>
                        {levelIdx < CALC_WORKSHOP_LEVELS.length - 1
                          ? '进入下一关'
                          : '看看我的探索手记'}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>

                {submitEval && (
                  <div
                    className={`calc-feedback ${submitEval.matched ? 'ok' : 'warn'}`}
                    role="status"
                  >
                    <div className="calc-feedback-row">
                      <div className="calc-mini-mascot">
                        <Mascot mood={mascotMood} />
                      </div>
                      <div>
                        <strong>{submitEval.headline}</strong>
                        <p>{submitEval.feedback}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 随身暖木绘本风 SVG 试数小天平 */}
            <section ref={scaleRef} className="calc-panel calc-scale-panel" aria-label="试数小天平">
              <div className="calc-panel-head">
                <h3>
                  <Scale size={16} /> 试数小天平（代个数字称称看）
                </h3>
                <button
                  type="button"
                  className="calc-link-btn"
                  aria-expanded={scaleOpen}
                  onClick={() => toggleScale()}
                >
                  {scaleOpen ? '收起' : '打开称重'}
                </button>
              </div>

              {scaleOpen && (
                <div className="calc-scale-body">
                  <div className="calc-sample-row" role="group" aria-label="选择代入数字">
                    <span>试试让 {level.variable} =</span>
                    {level.sampleValues.map((val) => (
                      <button
                        key={val}
                        type="button"
                        className={sampleVal === val ? 'active' : ''}
                        aria-pressed={sampleVal === val}
                        onClick={() => pickSample(val)}
                      >
                        {val}
                      </button>
                    ))}
                  </div>

                  <svg
                    className="calc-scale-svg"
                    viewBox="0 0 320 138"
                    role="img"
                    aria-label={`当 ${level.variable} 等于 ${sampleVal} 时，左盘原式为 ${scaleResult.leftValue}，右盘当前整理为 ${scaleResult.rightValue}，${scaleResult.balanced ? '天平平衡' : '天平倾斜'}`}
                  >
                    <path d="M118 124h84l-12-16h-60z" fill="#c79e6b" stroke="#9d7344" strokeWidth="1.4" />
                    <rect x="155" y="42" width="10" height="68" rx="4" fill="#b48a58" />
                    <g
                      className="calc-scale-beam"
                      style={{ transform: `rotate(${scaleResult.tiltDeg}deg)` }}
                    >
                      <line
                        x1="56"
                        y1="44"
                        x2="264"
                        y2="44"
                        stroke={scaleResult.balanced ? '#3d8b68' : '#d17850'}
                        strokeWidth="5.5"
                        strokeLinecap="round"
                      />
                      <circle cx="160" cy="44" r="7" fill="#e5b459" stroke="#9d7344" strokeWidth="1.4" />
                      {/* 左托盘：原式 */}
                      <line x1="68" y1="46" x2="68" y2="76" stroke="#a68a68" strokeWidth="1.6" />
                      <rect x="26" y="76" width="84" height="36" rx="12" fill="#fffdf6" stroke="#7ab39e" strokeWidth="1.8" />
                      <text x="68" y="91" textAnchor="middle" fill="#5e7c71" fontSize="10.5" fontWeight="600">
                        原来的式子
                      </text>
                      <text x="68" y="106" textAnchor="middle" fill="#21463a" fontSize="14.5" fontWeight="700">
                        {scaleResult.leftValue}
                      </text>
                      {/* 右托盘：当前式 */}
                      <line x1="252" y1="46" x2="252" y2="76" stroke="#a68a68" strokeWidth="1.6" />
                      <rect
                        x="210"
                        y="76"
                        width="84"
                        height="36"
                        rx="12"
                        fill="#fffdf6"
                        stroke={scaleResult.balanced ? '#4a9e74' : '#dc7d62'}
                        strokeWidth="1.8"
                      />
                      <text x="252" y="91" textAnchor="middle" fill="#5e7c71" fontSize="10.5" fontWeight="600">
                        {allSorted ? '现在合起来' : '现在的拆法'}
                      </text>
                      <text x="252" y="106" textAnchor="middle" fill="#21463a" fontSize="14.5" fontWeight="700">
                        {scaleResult.rightValue}
                      </text>
                    </g>
                  </svg>

                  <p className={`calc-scale-note ${scaleResult.balanced ? 'ok' : 'warn'}`}>
                    {scaleResult.balanced
                      ? `天平稳稳平啦！当 ${level.variable} = ${sampleVal} 时，两边都等于 ${scaleResult.leftValue}。`
                      : `天平歪掉啦！当 ${level.variable} = ${sampleVal} 时，原式 = ${scaleResult.leftValue}，现在（${formatLinearExpr(scalePreviewExpr)}）= ${scaleResult.rightValue}，再检查一下符号或数字吧！`}
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </dialog>
  );
}
