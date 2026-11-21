import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  type MarketBuildLevel,
  type MarketLevelRecord,
  type MarketRainyLevel,
} from './marketModelLogic';

const lv1 = MARKET_MODEL_LEVELS[0] as MarketBuildLevel;
const lv2 = MARKET_MODEL_LEVELS[1] as MarketBuildLevel;
const lv3 = MARKET_MODEL_LEVELS[2] as MarketBuildLevel;
const lv4 = MARKET_MODEL_LEVELS[3] as MarketRainyLevel;

describe('marketModelLogic: 关卡结构、表达式格式化与求值', () => {
  it('共 4 关且每关都具备 3 级非剧透锦囊', () => {
    assert.equal(MARKET_MODEL_LEVELS.length, 4);
    for (const lv of MARKET_MODEL_LEVELS) {
      assert.equal(lv.hints.length, 3);
      assert.deepEqual(
        lv.hints.map((h) => h.tier),
        [1, 2, 3],
      );
    }
  });

  it('线性费用公式格式化与求值精确', () => {
    assert.equal(formatMarketFormula(lv1.targetFormula), '3x + 2');
    assert.equal(formatMarketFormula(lv2.targetFormula), '5a + 8');
    assert.equal(formatMarketFormula(lv3.targetFormula), '2x + 12');
    assert.equal(evaluateMarketFormula(lv1.targetFormula, 4), 14);
    assert.equal(evaluateMarketFormula(lv2.targetFormula, 3), 23);
    assert.equal(evaluateMarketFormula(lv3.targetFormula, 5), 22);
  });
});

describe('marketModelLogic: 第 1-3 关拼装账单模型与防混淆诊断', () => {
  it('第 1 关正确拼装 3x + 2 并支持分单位拆解', () => {
    const res = evaluateMarketModelSlots(lv1, {
      'm1-notebook': 'rate',
      'm1-bag': 'fixed',
    });
    assert.equal(res.ok, true);
    assert.equal(res.code, 'exact');
    assert.equal(res.confusedFixedVar, false);
    assert.deepEqual(res.builtFormula, lv1.targetFormula);

    const rows = buildUnitBreakdown(res.builtFormula, 4, '本');
    assert.equal(rows.length, 4);
    assert.equal(rows[3].cumulative, 14);
  });

  it('第 2 关防范把 8 元头盔费放进按小时重复计费区 (13a)', () => {
    const allRate = evaluateMarketModelSlots(lv2, {
      'm2-bike': 'rate',
      'm2-helmet': 'rate',
    });
    assert.equal(allRate.ok, false);
    assert.equal(allRate.code, 'all-in-rate');
    assert.equal(allRate.confusedFixedVar, true);
    assert.equal(formatMarketFormula(allRate.builtFormula), '13a');
    assert.doesNotMatch(allRate.feedback, /5a \+ 8/);

    const swapped = evaluateMarketModelSlots(lv2, {
      'm2-bike': 'fixed',
      'm2-helmet': 'rate',
    });
    assert.equal(swapped.ok, false);
    assert.equal(swapped.code, 'swapped');
    assert.equal(swapped.confusedFixedVar, true);
  });

  it('第 3 关固定项在前（12 元包装费）、变化项在后（2 元/件）仍准确判定', () => {
    const ok = evaluateMarketModelSlots(lv3, {
      'm3-pack': 'fixed',
      'm3-ship': 'rate',
    });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.builtFormula, { variable: 'x', ratePerUnit: 2, fixedFee: 12 });

    const incomplete = evaluateMarketModelSlots(lv3, { 'm3-pack': 'fixed' });
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.code, 'incomplete');
    assert.deepEqual(buildFormulaFromSlots(lv3, { 'm3-pack': 'fixed' }), {
      variable: 'x',
      ratePerUnit: 0,
      fixedFee: 12,
    });
  });
});

describe('marketModelLogic: 开张试算台先猜后核对', () => {
  it('第 1-3 关预测命中与典型错误（漏加固定项 / 固定项重复乘）准确识别且不剧透', () => {
    const ok1 = evaluateTrialPrediction(lv1, 14);
    assert.equal(ok1.matched, true);
    assert.equal(ok1.actualTotal, 14);

    const forgotFixed = evaluateTrialPrediction(lv1, 12);
    assert.equal(forgotFixed.matched, false);
    assert.match(forgotFixed.feedback, /忘加|固定/);
    assert.doesNotMatch(forgotFixed.feedback, /14/);

    const repeatedFixed = evaluateTrialPrediction(lv2, 39);
    assert.equal(repeatedFixed.matched, false);
    assert.match(repeatedFixed.feedback, /乘了 3 次|只加 1 次/);
    assert.doesNotMatch(repeatedFixed.feedback, /23/);

    const ok3 = evaluateTrialPrediction(lv3, 22);
    assert.equal(ok3.matched, true);
  });
});

describe('marketModelLogic: 第 4 关雨天小考验（模型边界意识）', () => {
  it('识别雨天差额原因并温柔驳回误判', () => {
    const ok = evaluateRainyCause('missing-rain-cover');
    assert.equal(ok.ok, true);

    const wrongPrice = evaluateRainyCause('price-hiked');
    assert.equal(wrongPrice.ok, false);
    assert.doesNotMatch(wrongPrice.feedback, /防雨布/);

    const wrongBag = evaluateRainyCause('double-bag');
    assert.equal(wrongBag.ok, false);
  });

  it('路径 A 升级模型：防雨布放进固定底座得 3x + 6 且 4 本等于 18 元，放进单价区则报错', () => {
    const wrongRate = evaluateRainyUpgrade(lv4, 'rate');
    assert.equal(wrongRate.ok, false);
    assert.equal(wrongRate.code, 'wrong-slot-rate');
    assert.equal(formatMarketFormula(wrongRate.newFormula), '7x + 2');
    assert.equal(wrongRate.predictedAtTarget, 30);

    const okFixed = evaluateRainyUpgrade(lv4, 'fixed');
    assert.equal(okFixed.ok, true);
    assert.equal(okFixed.code, 'exact');
    assert.equal(formatMarketFormula(okFixed.newFormula), '3x + 6');
    assert.equal(okFixed.predictedAtTarget, 18);
    assert.equal(okFixed.actualAtTarget, 18);
  });
});

describe('marketModelLogic: 过程证据汇总与 60 字档案摘要', () => {
  it('无混淆全通并选择升级模型时生成合理成就且 <= 60 字', () => {
    const records: MarketLevelRecord[] = MARKET_MODEL_LEVELS.map((lv) => ({
      levelId: lv.id,
      levelTitle: lv.title,
      skillTag: lv.skillTag,
      modelAttempts: 1,
      trialAttempts: 1,
      confusedFixedVar: false,
      predictedBeforeCheck: lv.kind === 'build-and-trial',
      predictionFirstTryOk: true,
      recognizedBoundary: lv.kind === 'rainy-boundary',
      boundaryStrategy: lv.kind === 'rainy-boundary' ? 'upgrade-model' : undefined,
      usedHints: 0,
      completed: true,
    }));
    const summary = buildMarketModelSummary(records);
    assert.equal(summary.completedLevels, 4);
    assert.equal(summary.confusedFixedVarAny, false);
    assert.equal(summary.predictedBeforeCheckCount, 3);
    assert.equal(summary.recognizedBoundary, true);
    assert.ok(summary.achievements.includes('固定与变化零混淆'));
    assert.ok(summary.achievements.includes('会随现实升级模型'));
    assert.ok(summary.profileText.length > 0 && summary.profileText.length <= 60);
  });

  it('曾混淆固定与变化项并选择标明适用边界时准确记录且 <= 60 字', () => {
    const records: MarketLevelRecord[] = MARKET_MODEL_LEVELS.map((lv, i) => ({
      levelId: lv.id,
      levelTitle: lv.title,
      skillTag: lv.skillTag,
      modelAttempts: i === 1 ? 2 : 1,
      trialAttempts: i === 0 ? 2 : 1,
      confusedFixedVar: i === 1,
      predictedBeforeCheck: lv.kind === 'build-and-trial',
      predictionFirstTryOk: i !== 0,
      recognizedBoundary: lv.kind === 'rainy-boundary',
      boundaryStrategy: lv.kind === 'rainy-boundary' ? 'scope-limit' : undefined,
      usedHints: 1,
      completed: true,
    }));
    const summary = buildMarketModelSummary(records);
    assert.equal(summary.confusedFixedVarAny, true);
    assert.equal(summary.boundaryStrategy, 'scope-limit');
    assert.ok(summary.achievements.includes('看破重复计费陷阱'));
    assert.ok(summary.achievements.includes('明晰模型适用边界'));
    assert.ok(summary.profileText.length > 0 && summary.profileText.length <= 60);
  });
});
