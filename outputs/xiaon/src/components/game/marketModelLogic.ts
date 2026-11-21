/** 生活集市 · 《星溪策算司》确定性线性费用建模、趋势试算台、雨夜模型边界与过程证据引擎。
 * 所有模型拼装判定、分步费用拆解、试算预测校验、雨天边界决策与档案摘要均为 100% 确定性纯函数。 */

export type MarketVariable = 'x' | 'a';
export type CostSlotKind = 'rate' | 'fixed';
export type MarketSkillTag = '固定与变化' | '防重复计费' | '顺序迁移' | '模型边界';

export type MarketHintTier = {
  readonly tier: 1 | 2 | 3;
  readonly title: string;
  readonly body: string;
};

export type CostBlock = {
  readonly id: string;
  readonly label: string;
  readonly amount: number;
  readonly unitHint: string;
  readonly expectedSlot: CostSlotKind;
  readonly emojiTag: string;
};

export type MarketModelFormula = {
  readonly variable: MarketVariable;
  readonly ratePerUnit: number;
  readonly fixedFee: number;
};

export type MarketModelEvalCode =
  | 'exact'
  | 'incomplete'
  | 'all-in-rate'
  | 'all-in-fixed'
  | 'swapped';

export type MarketModelEvaluation = {
  readonly ok: boolean;
  readonly confusedFixedVar: boolean;
  readonly code: MarketModelEvalCode;
  readonly builtFormula: MarketModelFormula;
  readonly headline: string;
  readonly feedback: string;
};

export type TrialCheckResult = {
  readonly matched: boolean;
  readonly qty: number;
  readonly rateSubtotal: number;
  readonly fixedSubtotal: number;
  readonly actualTotal: number;
  readonly predictedTotal: number;
  readonly diff: number;
  readonly headline: string;
  readonly feedback: string;
};

export type UnitBreakdownRow = {
  readonly unitIndex: number;
  readonly label: string;
  readonly unitCharge: number;
  readonly cumulative: number;
};

export type RainyCauseId = 'missing-rain-cover' | 'price-hiked' | 'double-bag';
export type RainyStrategy = 'upgrade-model' | 'scope-limit';

export type RainyCauseEval = {
  readonly ok: boolean;
  readonly causeId: RainyCauseId;
  readonly headline: string;
  readonly feedback: string;
};

export type RainyUpgradeEval = {
  readonly ok: boolean;
  readonly code: 'exact' | 'wrong-slot-rate' | 'not-placed';
  readonly newFormula: MarketModelFormula;
  readonly predictedAtTarget: number;
  readonly actualAtTarget: number;
  readonly headline: string;
  readonly feedback: string;
};

export type MarketBuildLevel = {
  readonly id: string;
  readonly index: number;
  readonly kind: 'build-and-trial';
  readonly title: string;
  readonly subtitle: string;
  readonly skillTag: MarketSkillTag;
  readonly stallName: string;
  readonly story: string;
  readonly variable: MarketVariable;
  readonly unitName: string;
  readonly blocks: readonly CostBlock[];
  readonly targetFormula: MarketModelFormula;
  readonly trialTargetQty: number;
  readonly sampleQuantities: readonly number[];
  readonly quickGuesses: readonly number[];
  readonly praise: string;
  readonly hints: readonly [MarketHintTier, MarketHintTier, MarketHintTier];
};

export type MarketRainyLevel = {
  readonly id: string;
  readonly index: number;
  readonly kind: 'rainy-boundary';
  readonly title: string;
  readonly subtitle: string;
  readonly skillTag: '模型边界';
  readonly stallName: string;
  readonly story: string;
  readonly baseFormula: MarketModelFormula;
  readonly extraLabel: string;
  readonly extraFixedFee: number;
  readonly targetQty: number;
  readonly unitName: string;
  readonly causeOptions: readonly {
    readonly id: RainyCauseId;
    readonly title: string;
    readonly subtitle: string;
  }[];
  readonly hints: readonly [MarketHintTier, MarketHintTier, MarketHintTier];
};

export type MarketModelLevel = MarketBuildLevel | MarketRainyLevel;

export type MarketLevelRecord = {
  readonly levelId: string;
  readonly levelTitle: string;
  readonly skillTag: MarketSkillTag;
  readonly modelAttempts: number;
  readonly trialAttempts: number;
  readonly confusedFixedVar: boolean;
  readonly predictedBeforeCheck: boolean;
  readonly predictionFirstTryOk: boolean;
  readonly recognizedBoundary: boolean;
  readonly boundaryStrategy?: RainyStrategy;
  readonly usedHints: number;
  readonly completed: boolean;
};

export type MarketModelSummary = {
  readonly completedLevels: number;
  readonly totalLevels: number;
  readonly totalAttempts: number;
  readonly firstTryCount: number;
  readonly confusedFixedVarAny: boolean;
  readonly predictedBeforeCheckCount: number;
  readonly recognizedBoundary: boolean;
  readonly boundaryStrategy: RainyStrategy | null;
  readonly achievements: string[];
  readonly assessment: string;
  readonly profileText: string;
};

export const MARKET_MODEL_LEVELS: readonly MarketModelLevel[] = [
  {
    id: 'notebook-stall',
    index: 1,
    kind: 'build-and-trial',
    title: '方案一 · 星溪书社手账摊',
    subtitle: '区分随数量增长的单价项与单次基准费',
    skillTag: '固定与变化',
    stallName: '星溪书社 · 集市摊位',
    story:
      '星火集市开市在即，书社委托策算司拟定手账本计费模型：每本单价 3 元，选购 x 本，另配 1 个 2 元环保礼袋。把下面两项费用归入对应模型槽位，生成自动报价式。',
    variable: 'x',
    unitName: '本',
    blocks: [
      {
        id: 'm1-notebook',
        label: '手账本单价',
        amount: 3,
        unitHint: '按选购本数计费',
        expectedSlot: 'rate',
        emojiTag: '3 元 / 本',
      },
      {
        id: 'm1-bag',
        label: '环保礼袋费',
        amount: 2,
        unitHint: '整单附配 1 只礼袋',
        expectedSlot: 'fixed',
        emojiTag: '2 元 / 单',
      },
    ],
    targetFormula: { variable: 'x', ratePerUnit: 3, fixedFee: 2 },
    trialTargetQty: 4,
    sampleQuantities: [1, 2, 3, 4, 5],
    quickGuesses: [12, 14, 18, 20],
    praise:
      '模型精准对齐！3x 刻画随本数增长的书价，+2 刻画整单一次性的礼袋基准费，购买 4 本实付 3×4 + 2 = 14 元。',
    hints: [
      {
        tier: 1,
        title: '判别标准：多买 1 本时，这项费用会跟着增加吗？',
        body: '手账本买得越多，书价随之成倍增加；环保礼袋只装整单，不论买几本都只计 1 次。',
      },
      {
        tier: 2,
        title: '对应建模结构：单价 × 数量 + 基准费',
        body: '会随变量 x 变化的单价放入「变量累加项（× x）」，整单只计一次的放入「固定基数项（+ 常数）」。',
      },
      {
        tier: 3,
        title: '试算时分两步核对',
        body: '先算出 4 本手账本本身的总价，再加上一次性的环保礼袋费，就能核对订单总额。',
      },
    ],
  },
  {
    id: 'lake-bike',
    index: 2,
    kind: 'build-and-trial',
    title: '方案二 · 环湖骑行驿站',
    subtitle: '杜绝一次性护具费被按小时重复计费',
    skillTag: '防重复计费',
    stallName: '星溪环湖驿站',
    story:
      '星溪环湖骑行季开启：单车每小时租金 5 元，骑行 a 小时；安全头盔整趟一次性租用 8 元。请搭建计费模型，谨防把一次性护具费错算成按小时累加！',
    variable: 'a',
    unitName: '小时',
    blocks: [
      {
        id: 'm2-bike',
        label: '单车时租费',
        amount: 5,
        unitHint: '按骑行时长计费',
        expectedSlot: 'rate',
        emojiTag: '5 元 / 小时',
      },
      {
        id: 'm2-helmet',
        label: '安全头盔费',
        amount: 8,
        unitHint: '整趟租用 1 顶护具',
        expectedSlot: 'fixed',
        emojiTag: '8 元 / 趟',
      },
    ],
    targetFormula: { variable: 'a', ratePerUnit: 5, fixedFee: 8 },
    trialTargetQty: 3,
    sampleQuantities: [1, 2, 3, 4, 5],
    quickGuesses: [15, 23, 29, 39],
    praise:
      '避开了经典的重复计费陷阱！5a 随骑行时长增长，8 元护具费作为固定起点只计 1 次，骑 3 小时共 5×3 + 8 = 23 元。',
    hints: [
      {
        tier: 1,
        title: '拆解骑满 3 小时的真实账单',
        body: '第 1、2、3 小时都要累加单车租金；但头盔从头戴到尾，不会每过 1 小时就再收一次 8 元。',
      },
      {
        tier: 2,
        title: '不要把 5 和 8 合并后再乘 a',
        body: '如果两项都放入变量项，公式会变成 13a，等于每小时多收一顶头盔的钱——观察下方趋势图立刻能看出坡度异常陡峭。',
      },
      {
        tier: 3,
        title: '试算 3 小时总账',
        body: '先算 3 小时车费（3 个 5 元），最后再叠加一次性的 8 元护具费。',
      },
    ],
  },
  {
    id: 'club-parcel',
    index: 3,
    kind: 'build-and-trial',
    title: '方案三 · 星溪驿站寄件台',
    subtitle: '破除语序干扰，精准识别前置固定费',
    skillTag: '顺序迁移',
    stallName: '星溪镇务驿站',
    story:
      '星溪天文社团要寄出一批星图明信片：寄件前须先付 12 元总防震封装费，之后按每件 2 元收取运费，共寄 x 件。注意语序倒过来了，仍要看清谁随件数变化！',
    variable: 'x',
    unitName: '件',
    blocks: [
      {
        id: 'm3-pack',
        label: '总防震封装费',
        amount: 12,
        unitHint: '整批寄件前付 1 次',
        expectedSlot: 'fixed',
        emojiTag: '12 元 / 批',
      },
      {
        id: 'm3-ship',
        label: '单件运费',
        amount: 2,
        unitHint: '按寄出件数累加',
        expectedSlot: 'rate',
        emojiTag: '2 元 / 件',
      },
    ],
    targetFormula: { variable: 'x', ratePerUnit: 2, fixedFee: 12 },
    trialTargetQty: 5,
    sampleQuantities: [1, 2, 3, 5, 6],
    quickGuesses: [14, 22, 62, 70],
    praise:
      '完全不受语序干扰！12 元封装费只计一次作固定基数，x 件运费为 2x，寄 5 件总计 2×5 + 12 = 22 元。',
    hints: [
      {
        tier: 1,
        title: '别按文字出现的先后顺序机械套公式',
        body: '这一单特意把“前置固定费”写在了第一句。判断依据永远是“是否随件数 x 增加”，而不是谁先出现。',
      },
      {
        tier: 2,
        title: '多寄 1 件时，哪一项会再计一次？',
        body: '每多寄 1 件只需多付 2 元运费，所以 2 属于变量项；12 元总封装费只付一次，属于固定基数。',
      },
      {
        tier: 3,
        title: '2x + 12 与 12 + 2x 完全等价',
        body: '试算寄 5 件时，先算 5 件的运费小计，再加上 12 元总封装费即可。',
      },
    ],
  },
  {
    id: 'rainy-day-test',
    index: 4,
    kind: 'rainy-boundary',
    title: '方案四 · 雨夜集市边界测试',
    subtitle: '当现实多出新变量，旧模型如何演进？',
    skillTag: '模型边界',
    stallName: '雨夜 · 星溪书社摊位',
    story:
      '次日傍晚星溪镇突降骤雨！书社摊位临时添置了 1 块 4 元防雨篷布。访客买了 4 本手账本，昨天的晴天模型 3x + 2 预测只需 14 元，可实际账本流水却记了 18 元！',
    baseFormula: { variable: 'x', ratePerUnit: 3, fixedFee: 2 },
    extraLabel: '防雨篷布费',
    extraFixedFee: 4,
    targetQty: 4,
    unitName: '本',
    causeOptions: [
      {
        id: 'missing-rain-cover',
        title: '旧模型未纳入雨夜新增的防雨篷布支出',
        subtitle: '晴天模型假设天气干燥，没有覆盖雨天临时固定开销',
      },
      {
        id: 'price-hiked',
        title: '手账本单价临时上涨了',
        subtitle: '怀疑每本手账不再是 3 元',
      },
      {
        id: 'double-bag',
        title: '环保礼袋费被按本重复收取了',
        subtitle: '怀疑系统每买一本都多算了 2 元礼袋费',
      },
    ],
    hints: [
      {
        tier: 1,
        title: '先算清预测值与实际值的差额',
        body: '晴天模型预测 14 元，雨夜实际流水 18 元，差额正好是 +4 元。对照案情，哪一项雨夜新支出恰好是 4 元？',
      },
      {
        tier: 2,
        title: '旧模型本身没算错，是前提条件变了',
        body: '任何数学模型都有适用前提。现实条件变化后，策算师有两种严谨做法：把新条件并入模型升级公式，或明确标注旧模型的适用边界。',
      },
      {
        tier: 3,
        title: '如果升级模型，思考篷布费该进哪个槽',
        body: '防雨篷布整摊只需添置 1 次，不会每卖 1 本书就新买一块，所以它属于固定基数项。',
      },
    ],
  },
] as const;

/** 格式化线性费用模型（如 3x + 2、5a + 8、13a、14）。 */
export function formatMarketFormula(formula: MarketModelFormula): string {
  const { variable, ratePerUnit, fixedFee } = formula;
  if (ratePerUnit === 0 && fixedFee === 0) return '0';
  if (ratePerUnit === 0) return `${fixedFee}`;
  const rateStr = ratePerUnit === 1 ? variable : `${ratePerUnit}${variable}`;
  if (fixedFee === 0) return rateStr;
  return `${rateStr} + ${fixedFee}`;
}

/** 根据费用模型与数量计算精确总费用。 */
export function evaluateMarketFormula(formula: MarketModelFormula, qty: number): number {
  return formula.ratePerUnit * qty + formula.fixedFee;
}

/** 从槽位分配实时汇总出当前拼装的费用模型。 */
export function buildFormulaFromSlots(
  level: MarketBuildLevel,
  slotMap: Readonly<Record<string, CostSlotKind | undefined>>,
): MarketModelFormula {
  let ratePerUnit = 0;
  let fixedFee = 0;
  for (const b of level.blocks) {
    const slot = slotMap[b.id];
    if (slot === 'rate') ratePerUnit += b.amount;
    else if (slot === 'fixed') fixedFee += b.amount;
  }
  return { variable: level.variable, ratePerUnit, fixedFee };
}

/** 校验费用积木槽位分配，精准识别“固定费误入变化区”等典型混淆，且绝不剧透答案。 */
export function evaluateMarketModelSlots(
  level: MarketBuildLevel,
  slotMap: Readonly<Record<string, CostSlotKind | undefined>>,
): MarketModelEvaluation {
  const builtFormula = buildFormulaFromSlots(level, slotMap);
  const allAssigned = level.blocks.every(
    (b) => slotMap[b.id] === 'rate' || slotMap[b.id] === 'fixed',
  );

  if (!allAssigned) {
    return {
      ok: false,
      confusedFixedVar: false,
      code: 'incomplete',
      builtFormula,
      headline: '先把两张费用积木都放进对应的区域吧',
      feedback: '点击上面的费用积木，决定它是「随数量变化的单价」还是「只付一次的底座」哦！',
    };
  }

  const allCorrect = level.blocks.every((b) => slotMap[b.id] === b.expectedSlot);
  if (allCorrect) {
    return {
      ok: true,
      confusedFixedVar: false,
      code: 'exact',
      builtFormula,
      headline: `账单模型 ${formatMarketFormula(builtFormula)} 拼好啦！`,
      feedback: `分得清清楚楚！现在打开下面的「开张试算台」，先猜猜买 ${level.trialTargetQty} ${level.unitName}一共多少钱，再模拟结账核对！`,
    };
  }

  const fixedBlock = level.blocks.find((b) => b.expectedSlot === 'fixed')!;
  const rateBlock = level.blocks.find((b) => b.expectedSlot === 'rate')!;
  const allInRate = level.blocks.every((b) => slotMap[b.id] === 'rate');
  const allInFixed = level.blocks.every((b) => slotMap[b.id] === 'fixed');

  if (allInRate) {
    return {
      ok: false,
      confusedFixedVar: true,
      code: 'all-in-rate',
      builtFormula,
      headline: `哎呀！「${fixedBlock.label}」被按每${level.unitName}重复算啦！`,
      feedback: `现在两项都在变化区，变成每多 1 ${level.unitName}就要多付一次「${fixedBlock.label}」（${fixedBlock.amount} 元）。看看下面的分${level.unitName}计费条：它真的需要每${level.unitName}都付一次吗？`,
    };
  }

  if (allInFixed) {
    return {
      ok: false,
      confusedFixedVar: true,
      code: 'all-in-fixed',
      builtFormula,
      headline: `这两项都放在底座区，买再多${level.unitName}总价都不会变啦！`,
      feedback: `想想看：买 1 ${level.unitName}和买 4 ${level.unitName}，哪一项费用应该跟着数量变多呢？把它移到「随数量变化区」试试！`,
    };
  }

  return {
    ok: false,
    confusedFixedVar: true,
    code: 'swapped',
    builtFormula,
    headline: '两张费用积木好像住反房间啦！',
    feedback: `再读一遍卡片小字：「${rateBlock.label}」是随${level.unitName}数增加的，而「${fixedBlock.label}」整单只需要付 1 次。交换一下它们的位置再看看计费条吧！`,
  };
}

/** 生成逐单位（逐本/逐小时/逐件）计费可视化拆解条，让孩子直观看到单价累加与固定项区别。 */
export function buildUnitBreakdown(
  formula: MarketModelFormula,
  qty: number,
  unitName: string,
): readonly UnitBreakdownRow[] {
  const safeQty = Math.max(1, Math.min(8, Math.floor(qty)));
  const rows: UnitBreakdownRow[] = [];
  for (let i = 1; i <= safeQty; i += 1) {
    rows.push({
      unitIndex: i,
      label: `第 ${i} ${unitName}`,
      unitCharge: formula.ratePerUnit,
      cumulative: formula.ratePerUnit * i + formula.fixedFee,
    });
  }
  return rows;
}

/** 开张试算台：校验孩子的预测总价与模拟结账真实总价。 */
export function evaluateTrialPrediction(
  level: MarketBuildLevel,
  predictedTotal: number,
): TrialCheckResult {
  const qty = level.trialTargetQty;
  const rateSubtotal = level.targetFormula.ratePerUnit * qty;
  const fixedSubtotal = level.targetFormula.fixedFee;
  const actualTotal = rateSubtotal + fixedSubtotal;
  const diff = predictedTotal - actualTotal;
  const matched = diff === 0;

  if (matched) {
    return {
      matched: true,
      qty,
      rateSubtotal,
      fixedSubtotal,
      actualTotal,
      predictedTotal,
      diff: 0,
      headline: `预判精准！订单实付分毫不差（${actualTotal} 元）`,
      feedback: level.praise,
    };
  }

  const forgotFixed = predictedTotal === rateSubtotal;
  const repeatedFixed =
    predictedTotal === (level.targetFormula.ratePerUnit + level.targetFormula.fixedFee) * qty;

  let feedback: string;
  if (forgotFixed) {
    feedback = `你算出了 ${qty} ${level.unitName}的变量部分 ${rateSubtotal} 元，但忘加整单一次性的固定基数了。对照上方明细条再核算一遍。`;
  } else if (repeatedFixed) {
    feedback = `这个数字偏高了不少——看起来把固定基数也重复乘了 ${qty} 次！固定基数整单只加 1 次，调整后再结账核对。`;
  } else {
    feedback = `你的预测是 ${predictedTotal} 元，与模型结算仍有出入。先算 ${qty} ${level.unitName}的变量部分，再叠加 1 次固定基数重试。`;
  }

  return {
    matched: false,
    qty,
    rateSubtotal,
    fixedSubtotal,
    actualTotal,
    predictedTotal,
    diff,
    headline: '预测值还有一点偏差，对照清单再算一次',
    feedback,
  };
}

/** 第 4 关第一步：检查孩子是否识别出雨天账本出现差额的原因。 */
export function evaluateRainyCause(causeId: RainyCauseId): RainyCauseEval {
  if (causeId === 'missing-rain-cover') {
    return {
      ok: true,
      causeId,
      headline: '一针见血！旧模型遗漏了雨夜新增条件',
      feedback:
        '晴天模型 3x + 2 本身没有算错，但骤雨带来 1 次 4 元防雨篷布支出，使实际流水（18 元）比预测（14 元）多出 4 元。现在由你决策：升级模型，还是标注适用边界？',
    };
  }
  if (causeId === 'price-hiked') {
    return {
      ok: false,
      causeId,
      headline: '再核对一下手账本的单价记录',
      feedback:
        '摊位上的手账本依然是每本 3 元，4 本还是 12 元，并没有临时涨价。回头看案情：雨夜那天额外采购了哪一项？',
    };
  }
  return {
    ok: false,
    causeId,
    headline: '环保礼袋整单仍只计了 1 次 2 元',
    feedback:
      '访客选购 4 本手账，礼袋依旧只收 1 次 2 元，并没有按本重复计费。多出来的 4 元来自雨夜哪项新支出？',
  };
}

/** 第 4 关第二步（路径 A）：验证把雨天防雨布补入模型后的槽位是否正确。 */
export function evaluateRainyUpgrade(
  level: MarketRainyLevel,
  extraSlot: CostSlotKind | null,
): RainyUpgradeEval {
  const actualAtTarget =
    evaluateMarketFormula(level.baseFormula, level.targetQty) + level.extraFixedFee;

  if (!extraSlot) {
    return {
      ok: false,
      code: 'not-placed',
      newFormula: level.baseFormula,
      predictedAtTarget: evaluateMarketFormula(level.baseFormula, level.targetQty),
      actualAtTarget,
      headline: '先给「4 元防雨布」选一个安放位置',
      feedback: '想想看：防雨布是每卖 1 本都要新买一块，还是整摊只付 1 次？',
    };
  }

  if (extraSlot === 'rate') {
    const wrongFormula: MarketModelFormula = {
      variable: level.baseFormula.variable,
      ratePerUnit: level.baseFormula.ratePerUnit + level.extraFixedFee,
      fixedFee: level.baseFormula.fixedFee,
    };
    const predictedAtTarget = evaluateMarketFormula(wrongFormula, level.targetQty);
    return {
      ok: false,
      code: 'wrong-slot-rate',
      newFormula: wrongFormula,
      predictedAtTarget,
      actualAtTarget,
      headline: `放进变化区变成 ${formatMarketFormula(wrongFormula)}，4 本会算成 ${predictedAtTarget} 元啦！`,
      feedback:
        '防雨布不是每卖 1 本练习本就多买一块，整摊雨天只买 1 次就够啦！把它移到「只付一次的底座区」试试？',
    };
  }

  const newFormula: MarketModelFormula = {
    variable: level.baseFormula.variable,
    ratePerUnit: level.baseFormula.ratePerUnit,
    fixedFee: level.baseFormula.fixedFee + level.extraFixedFee,
  };
  const predictedAtTarget = evaluateMarketFormula(newFormula, level.targetQty);
  return {
    ok: true,
    code: 'exact',
    newFormula,
    predictedAtTarget,
    actualAtTarget,
    headline: `雨天模型升级成功：${formatMarketFormula(newFormula)}！`,
    feedback: `把只买 1 次的 4 元防雨布并入固定底座后，新模型是 ${formatMarketFormula(newFormula)}；买 4 本正好算出 ${predictedAtTarget} 元，和雨天流水严丝合缝！`,
  };
}

/** 汇总 4 关的过程证据：成就徽章、质性评价与严格 <= 60 字的「我的档案 · 近况」摘要。 */
export function buildMarketModelSummary(
  records: readonly MarketLevelRecord[],
): MarketModelSummary {
  const totalLevels = MARKET_MODEL_LEVELS.length;
  const completed = records.filter((r) => r.completed);
  const completedLevels = completed.length;

  const totalAttempts = completed.reduce(
    (sum, r) => sum + Math.max(1, r.modelAttempts) + Math.max(0, r.trialAttempts - 1),
    0,
  );
  const firstTryCount = completed.filter(
    (r) => r.modelAttempts <= 1 && r.trialAttempts <= 1 && !r.confusedFixedVar,
  ).length;

  const confusedFixedVarAny = completed.some((r) => r.confusedFixedVar);
  const predictedBeforeCheckCount = completed.filter((r) => r.predictedBeforeCheck).length;
  const rainyRec = completed.find((r) => r.levelId === 'rainy-day-test');
  const recognizedBoundary = rainyRec?.recognizedBoundary ?? false;
  const boundaryStrategy = rainyRec?.boundaryStrategy ?? null;

  const achievements: string[] = [];
  if (completedLevels === totalLevels && firstTryCount === totalLevels) {
    achievements.push('首席策算师 · 全关一次对齐');
  } else if (firstTryCount >= 2) {
    achievements.push(`建模巧手 · ${firstTryCount}关一次搭准`);
  }

  if (!confusedFixedVarAny && completedLevels > 0) {
    achievements.push('固定与变化零混淆');
  } else if (confusedFixedVarAny) {
    achievements.push('看破重复计费陷阱');
  }

  if (predictedBeforeCheckCount >= 3) {
    achievements.push('先预测再试算达人');
  } else if (predictedBeforeCheckCount > 0) {
    achievements.push('善于试算核对');
  }

  if (recognizedBoundary) {
    achievements.push(
      boundaryStrategy === 'scope-limit' ? '明晰模型适用边界' : '会随现实升级模型',
    );
  }

  const parts: string[] = [];
  if (!confusedFixedVarAny && firstTryCount >= 3) {
    parts.push(
      '4 个集市小摊账本搭得又快又稳！你能一眼分清“随数量变化的单价项”和“只付一次的固定底座”，顺序调换也没被带偏。',
    );
  } else if (confusedFixedVarAny) {
    parts.push(
      `共试了 ${totalAttempts} 次完成 4 关，在对比计费条后迅速区分出“只付一次”和“每单位重复计费”，进步非常扎实。`,
    );
  } else {
    parts.push(
      `共经过 ${totalAttempts} 次试算完成全部 4 关，已经熟练掌握用一次式表示生活里的固定费和变动费。`,
    );
  }

  if (predictedBeforeCheckCount > 0) {
    parts.push(
      `在 ${predictedBeforeCheckCount} 个小摊都坚持“先预测总价、再模拟结账”，用具体数字验证式子是个特别棒的建模习惯！`,
    );
  }

  if (recognizedBoundary) {
    parts.push(
      boundaryStrategy === 'scope-limit'
        ? '面对雨天新增条件，你敏锐发现旧模型差额并主动标明“仅限晴天适用”，很有建模边界意识！'
        : '面对雨天新增防雨布开销，你敏锐发现旧模型差额，并把新固定费补充升级为 3x + 6，真正理解了模型随现实演进！',
    );
  }

  let profileText: string;
  if (completedLevels === totalLevels && !confusedFixedVarAny && recognizedBoundary) {
    profileText = '生活集市通关：固定与变化项零混淆，先预测再试算，能识别雨天模型边界。';
  } else if (confusedFixedVarAny && recognizedBoundary) {
    profileText = `生活集市通关：借计费条理清固定与变化项，${predictedBeforeCheckCount}关先预测试算并识破雨天边界。`;
  } else if (recognizedBoundary) {
    profileText = `生活集市通关：共试${totalAttempts}次，完成一次式建模试算，能应对雨天新增条件。`;
  } else {
    profileText = `生活集市通关：共试${totalAttempts}次，掌握固定费与单价建模及试算核对。`;
  }

  return {
    completedLevels,
    totalLevels,
    totalAttempts,
    firstTryCount,
    confusedFixedVarAny,
    predictedBeforeCheckCount,
    recognizedBoundary,
    boundaryStrategy,
    achievements,
    assessment: parts.join(' '),
    profileText: profileText.slice(0, 60),
  };
}
