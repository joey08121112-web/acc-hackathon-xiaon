import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALC_WORKSHOP_LEVELS,
  buildCalcWorkshopSummary,
  checkSlotAssignment,
  evaluateBalanceScale,
  evaluateBracketUnpack,
  evaluateLevelOriginal,
  evaluateLinearExpr,
  evaluateWorkshopSubmission,
  formatLinearExpr,
  formatTermToken,
  summarizeTerms,
  type CalcLevelRecord,
} from './calcWorkshopLogic';

describe('calcWorkshopLogic: 关卡原式与目标恒等性', () => {
  it('全部 4 关的原式在多个试数值下与 target 精确恒等', () => {
    assert.equal(CALC_WORKSHOP_LEVELS.length, 4);
    for (const level of CALC_WORKSHOP_LEVELS) {
      for (const sample of [-3, 0, 1, 2, 3, 4, 7]) {
        const orig = evaluateLevelOriginal(level, sample);
        const target = evaluateLinearExpr(level.target, sample);
        assert.equal(
          orig,
          target,
          `Level ${level.id} at ${level.variable}=${sample}: orig=${orig}, target=${target}`,
        );
      }
    }
  });

  it('线性表达式与单项格式化准确清晰', () => {
    assert.equal(formatLinearExpr({ variable: 'x', varCoeff: 5, constVal: -4 }), '5x − 4');
    assert.equal(formatLinearExpr({ variable: 'a', varCoeff: 3, constVal: 7 }), '3a + 7');
    assert.equal(formatLinearExpr({ variable: 'x', varCoeff: 1, constVal: 5 }), 'x + 5');
    assert.equal(formatLinearExpr({ variable: 'x', varCoeff: -3, constVal: 12 }), '12 − 3x');
    assert.equal(formatTermToken({ kind: 'var', coeff: 1 }, 'x'), '+x');
    assert.equal(formatTermToken({ kind: 'var', coeff: -1 }, 'x'), '−x');
    assert.equal(formatTermToken({ kind: 'const', coeff: -5 }, 'x'), '−5');
  });
});

describe('calcWorkshopLogic: 负号礼盒拆盒校验与精准错因诊断', () => {
  const level3 = CALC_WORKSHOP_LEVELS[2];
  const box3 = level3.bracketBox!;

  it('未选齐全部符号返回 incomplete', () => {
    const res = evaluateBracketUnpack(box3, { 'l3-b1': -1 }, 'x');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'incomplete');
  });

  it('两项均正确翻号则通过拆盒并产出准确散装项', () => {
    const res = evaluateBracketUnpack(box3, { 'l3-b1': -1, 'l3-b2': 1 }, 'x');
    assert.equal(res.ok, true);
    assert.equal(res.code, 'exact');
    assert.deepEqual(
      res.unpackedTerms.map((t) => ({ kind: t.kind, coeff: t.coeff })),
      [
        { kind: 'var', coeff: -2 },
        { kind: 'const', coeff: 5 },
      ],
    );
    const merged = summarizeTerms([...level3.looseTerms, ...res.unpackedTerms], 'x');
    assert.deepEqual(merged, level3.target);
  });

  it('第一项变号、第二项漏翻时精准诊断为 forgot-second-sign', () => {
    const res = evaluateBracketUnpack(box3, { 'l3-b1': -1, 'l3-b2': -1 }, 'x');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'forgot-second-sign');
    assert.match(res.headline, /第二项/);
  });

  it('全部保留原符号时精准诊断为 forgot-all-signs', () => {
    const res = evaluateBracketUnpack(box3, { 'l3-b1': 1, 'l3-b2': -1 }, 'x');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'forgot-all-signs');
  });

  it('第 4 关 8 - (3x - 4) 正确拆盒与漏翻诊断', () => {
    const level4 = CALC_WORKSHOP_LEVELS[3];
    const box4 = level4.bracketBox!;
    const okRes = evaluateBracketUnpack(box4, { 'l4-b1': -1, 'l4-b2': 1 }, 'x');
    assert.equal(okRes.ok, true);
    assert.deepEqual(summarizeTerms([...level4.looseTerms, ...okRes.unpackedTerms], 'x'), level4.target);

    const missRes = evaluateBracketUnpack(box4, { 'l4-b1': -1, 'l4-b2': -1 }, 'x');
    assert.equal(missRes.ok, false);
    assert.equal(missRes.code, 'forgot-second-sign');
  });
});

describe('calcWorkshopLogic: 同类项归槽、打包校验与试数天平', () => {
  it('同类项归槽校验能识别异类混淆 mixed-unlike-terms', () => {
    const varToken = { id: 't1', kind: 'var' as const, coeff: 3 };
    const constToken = { id: 't2', kind: 'const' as const, coeff: -4 };

    assert.equal(checkSlotAssignment(varToken, 'var', 'x').ok, true);
    assert.equal(checkSlotAssignment(constToken, 'const', 'x').ok, true);

    const mix1 = checkSlotAssignment(constToken, 'var', 'x');
    assert.equal(mix1.ok, false);
    assert.equal(mix1.code, 'mixed-unlike-terms');

    const mix2 = checkSlotAssignment(varToken, 'const', 'x');
    assert.equal(mix2.ok, false);
    assert.equal(mix2.code, 'mixed-unlike-terms');
  });

  it('最终打包提交能区分完全命中与常数符号错', () => {
    const level3 = CALC_WORKSHOP_LEVELS[2];
    assert.equal(evaluateWorkshopSubmission(level3, 1, 5).matched, true);

    const signErr = evaluateWorkshopSubmission(level3, 1, -5);
    assert.equal(signErr.matched, false);
    assert.equal(signErr.code, 'const-sign-error');

    const varErr = evaluateWorkshopSubmission(level3, 5, 5);
    assert.equal(varErr.matched, false);
    assert.equal(varErr.code, 'var-coeff-mismatch');
  });

  it('试数天平在恒等时严格平衡，在漏变号时倾斜并给出准确数值', () => {
    const level3 = CALC_WORKSHOP_LEVELS[2];
    const balanced = evaluateBalanceScale(level3, 1, 5, 2);
    assert.equal(balanced.leftValue, 7);
    assert.equal(balanced.rightValue, 7);
    assert.equal(balanced.balanced, true);
    assert.equal(balanced.tiltDeg, 0);

    const wrong = evaluateBalanceScale(level3, 1, -5, 2);
    assert.equal(wrong.leftValue, 7);
    assert.equal(wrong.rightValue, -3);
    assert.equal(wrong.balanced, false);
    assert.ok(wrong.tiltDeg < 0 && wrong.tiltDeg >= -16);
  });
});

describe('calcWorkshopLogic: 过程证据与个人档案摘要', () => {
  it('全关一次通关生成合理成就且 profileText 不超过 60 字', () => {
    const records: CalcLevelRecord[] = CALC_WORKSHOP_LEVELS.map((l) => ({
      levelId: l.id,
      levelTitle: l.title,
      skillTag: l.skillTag,
      hasBracket: l.bracketBox !== null,
      unpackAttempts: l.bracketBox ? 1 : 0,
      submitAttempts: 1,
      triggeredForgotSecondSign: false,
      fixedForgotSecondSign: false,
      unlikeTermMistakes: 0,
      usedBalanceScale: true,
      usedHints: 0,
      completed: true,
    }));

    const summary = buildCalcWorkshopSummary(records);
    assert.equal(summary.completedLevels, 4);
    assert.equal(summary.firstTryCount, 4);
    assert.equal(summary.bracketFirstTryCount, 2);
    assert.equal(summary.usedBalanceScaleAny, true);
    assert.ok(summary.achievements.includes('符号零失误 · 全关一次通关'));
    assert.ok(summary.profileText.length > 0 && summary.profileText.length <= 60);
  });

  it('触发并自主修正漏翻第二项时如实记录并在 60 字以内', () => {
    const records: CalcLevelRecord[] = CALC_WORKSHOP_LEVELS.map((l, idx) => ({
      levelId: l.id,
      levelTitle: l.title,
      skillTag: l.skillTag,
      hasBracket: l.bracketBox !== null,
      unpackAttempts: idx === 2 ? 2 : l.bracketBox ? 1 : 0,
      submitAttempts: 1,
      triggeredForgotSecondSign: idx === 2,
      fixedForgotSecondSign: idx === 2,
      unlikeTermMistakes: idx === 0 ? 1 : 0,
      usedBalanceScale: idx === 2,
      usedHints: 1,
      completed: true,
    }));

    const summary = buildCalcWorkshopSummary(records);
    assert.equal(summary.triggeredForgotSecondSignAny, true);
    assert.equal(summary.fixedForgotSecondSignAny, true);
    assert.equal(summary.totalUnlikeTermMistakes, 1);
    assert.ok(summary.achievements.includes('攻克“漏翻第二项”陷阱'));
    assert.ok(summary.profileText.length > 0 && summary.profileText.length <= 60);
  });
});
