import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANAL_SOURCE_DROPS,
  LOGIC_BRIDGE_LEVELS,
  buildLogicBridgeSummary,
  decomposeParity,
  evaluateCanalTrial,
  evaluateCounterexampleCard,
  evaluateParityBuilder,
  type LogicLevelRecord,
} from './logicBridgeLogic';

describe('logicBridgeLogic: 关卡结构与非剧透锦囊完整性', () => {
  it('共 4 关且每关都配有 3 级非剧透锦囊', () => {
    assert.equal(LOGIC_BRIDGE_LEVELS.length, 4);
    for (const lv of LOGIC_BRIDGE_LEVELS) {
      assert.equal(lv.hints.length, 3, `${lv.id} should have 3 hints`);
      assert.deepEqual(
        lv.hints.map((h) => h.tier),
        [1, 2, 3],
      );
    }
  });
});

describe('logicBridgeLogic: 第 1 关小桥口令牌（反例入门）', () => {
  const lv1 = LOGIC_BRIDGE_LEVELS[0];

  it('真反例 (-2)+(-3)=-5 满足前提并推翻结论', () => {
    const res = evaluateCounterexampleCard(lv1, 'l1-neg-add');
    assert.ok(res);
    assert.equal(res.ok, true);
    assert.equal(res.premiseViolated, false);
    assert.equal(res.code, 'exact');
    assert.equal(res.card.premiseLamps.every((l) => l.passed), true);
  });

  it('不满足前提的干扰卡会被精准识别且不剧透答案', () => {
    const pos = evaluateCounterexampleCard(lv1, 'l1-pos-add')!;
    assert.equal(pos.ok, false);
    assert.equal(pos.premiseViolated, true);
    assert.equal(pos.code, 'premise-not-negative');
    assert.doesNotMatch(pos.feedback, /−5|-5/);

    const mul = evaluateCounterexampleCard(lv1, 'l1-neg-mul')!;
    assert.equal(mul.ok, false);
    assert.equal(mul.premiseViolated, true);
    assert.equal(mul.code, 'premise-wrong-op');
    assert.match(mul.headline, /相乘|相加/);
    assert.doesNotMatch(mul.feedback, /−5|-5/);

    const mix = evaluateCounterexampleCard(lv1, 'l1-mix-add')!;
    assert.equal(mix.ok, false);
    assert.equal(mix.premiseViolated, true);
    assert.equal(mix.code, 'premise-mixed-sign');
  });
});

describe('logicBridgeLogic: 第 2 关平方跷跷板（前提检查）', () => {
  const lv2 = LOGIC_BRIDGE_LEVELS[1];

  it('真反例 1 < 2 (平方 1 < 4) 命中', () => {
    const res = evaluateCounterexampleCard(lv2, 'l2-pos-pair')!;
    assert.equal(res.ok, true);
    assert.equal(res.premiseViolated, false);
    assert.equal(res.code, 'exact');
    assert.deepEqual(res.card.comparePair, {
      leftNum: 1,
      rightNum: 2,
      leftSq: 1,
      rightSq: 4,
      relation: '<',
    });
  });

  it('负数、相等、含零干扰卡全部标记为前提违规', () => {
    for (const [id, code] of [
      ['l2-neg-pair', 'premise-not-positive'],
      ['l2-eq-pair', 'premise-equal-numbers'],
      ['l2-zero-pair', 'premise-zero-not-positive'],
    ] as const) {
      const res = evaluateCounterexampleCard(lv2, id)!;
      assert.equal(res.ok, false);
      assert.equal(res.premiseViolated, true);
      assert.equal(res.code, code);
      assert.doesNotMatch(res.feedback, /1 < 2/);
    }
  });
});

describe('logicBridgeLogic: 第 3 关奇偶分拣门（自由造数反例）', () => {
  it('奇偶点阵分解准确', () => {
    assert.deepEqual(decomposeParity(5), { value: 5, pairs: 2, leftover: 1, isOdd: true });
    assert.deepEqual(decomposeParity(4), { value: 4, pairs: 2, leftover: 0, isOdd: false });
  });

  it('任意两个奇数（包含相同奇数）均可构造真反例且和为偶数', () => {
    for (const [a, b] of [
      [3, 5],
      [3, 7],
      [5, 7],
      [3, 3],
    ]) {
      const res = evaluateParityBuilder(a, b);
      assert.equal(res.ok, true);
      assert.equal(res.premiseViolated, false);
      assert.equal(res.code, 'exact');
      assert.equal(res.sum, a + b);
      assert.equal(res.sumIsEven, true);
    }
  });

  it('包含偶数或全偶组合会被判定为前提不满足', () => {
    const oneEven = evaluateParityBuilder(2, 3);
    assert.equal(oneEven.ok, false);
    assert.equal(oneEven.premiseViolated, true);
    assert.equal(oneEven.code, 'premise-one-even');

    const bothEven = evaluateParityBuilder(2, 4);
    assert.equal(bothEven.ok, false);
    assert.equal(bothEven.premiseViolated, true);
    assert.equal(bothEven.code, 'premise-both-even');
  });
});

describe('logicBridgeLogic: 第 4 关修桥找漏点（控制变量）', () => {
  it('未更换任何接头时水量为 6 且未过关', () => {
    const res = evaluateCanalTrial([], 6, 'B');
    assert.equal(res.solved, false);
    assert.equal(res.status, 'no-change');
    assert.equal(res.deliveredDrops, 6);
    assert.equal(res.predictionMatched, true);
  });

  it('一次同时换 2 段或 3 段即使水量达 8 滴也不会判通关，并提醒单变量比较', () => {
    const res2 = evaluateCanalTrial(['A', 'B'], 8, 'B');
    assert.equal(res2.solved, false);
    assert.equal(res2.status, 'multi-change');
    assert.equal(res2.deliveredDrops, CANAL_SOURCE_DROPS);
    assert.equal(res2.isMultiChange, true);
    assert.match(res2.headline, /同时换了 2 处/);

    const res3 = evaluateCanalTrial(['A', 'B', 'C'], 8, 'B');
    assert.equal(res3.solved, false);
    assert.equal(res3.status, 'multi-change');
  });

  it('只换未漏水段（A 或 C）给出公平排除反馈', () => {
    const resA = evaluateCanalTrial(['A'], 6, 'B');
    assert.equal(resA.solved, false);
    assert.equal(resA.status, 'single-no-fix');
    assert.equal(resA.deliveredDrops, 6);
    assert.equal(resA.isSingleChange, true);
  });

  it('只换漏水段 B 时水量恢复 8 滴并过关', () => {
    const resB = evaluateCanalTrial(['B'], 8, 'B');
    assert.equal(resB.solved, true);
    assert.equal(resB.status, 'solved-fair');
    assert.equal(resB.deliveredDrops, 8);
    assert.equal(resB.isSingleChange, true);
    assert.equal(resB.predictionMatched, true);
  });
});

describe('logicBridgeLogic: 过程证据汇总与 60 字档案上限', () => {
  it('全关顺畅通关时成就与档案摘要准确且 <= 60 字', () => {
    const perfect: LogicLevelRecord[] = LOGIC_BRIDGE_LEVELS.map((lv) => ({
      levelId: lv.id,
      levelTitle: lv.title,
      skillTag: lv.skillTag,
      attempts: 1,
      pickedPremiseViolation: false,
      usedSingleChangeStrategy: lv.id === 'canal-leak-detective',
      triggeredMultiChange: false,
      predictedBeforeTrial: lv.id === 'canal-leak-detective',
      usedHints: 0,
      completed: true,
    }));
    const summary = buildLogicBridgeSummary(perfect);
    assert.equal(summary.completedLevels, 4);
    assert.equal(summary.counterexampleFirstTryCount, 3);
    assert.equal(summary.pickedPremiseViolationAny, false);
    assert.equal(summary.usedSingleChangeStrategy, true);
    assert.ok(summary.achievements.includes('反例火眼金睛 · 3关一次识破'));
    assert.ok(summary.achievements.includes('控制变量 · 一次只改一项'));
    assert.ok(summary.profileText.length > 0 && summary.profileText.length <= 60);
  });

  it('踩过前提干扰卡并触发过同时改两处后修正时如实记录且 <= 60 字', () => {
    const retried: LogicLevelRecord[] = LOGIC_BRIDGE_LEVELS.map((lv, i) => ({
      levelId: lv.id,
      levelTitle: lv.title,
      skillTag: lv.skillTag,
      attempts: i === 0 ? 2 : i === 3 ? 3 : 1,
      pickedPremiseViolation: i === 0,
      usedSingleChangeStrategy: i === 3,
      triggeredMultiChange: i === 3,
      predictedBeforeTrial: i === 3,
      usedHints: 1,
      completed: true,
    }));
    const summary = buildLogicBridgeSummary(retried);
    assert.equal(summary.pickedPremiseViolationAny, true);
    assert.equal(summary.triggeredMultiChangeAny, true);
    assert.equal(summary.usedSingleChangeStrategy, true);
    assert.ok(summary.achievements.includes('识破前提干扰卡'));
    assert.ok(summary.achievements.includes('学会单变量公平比较'));
    assert.ok(summary.profileText.length > 0 && summary.profileText.length <= 60);
  });
});
