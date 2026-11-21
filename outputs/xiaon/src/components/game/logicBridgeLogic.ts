/** 逻辑小桥 · 《断桥真伪录》确定性反例判定、奇偶配对验证、控制变量试水与过程证据引擎。
 * 所有前提检查、反例校验、奇偶点阵分解、水流试算与档案摘要均为 100% 确定性纯函数。 */

export type LogicSkillTag = '反例入门' | '前提检查' | '反例迁移' | '控制变量';

export type LogicHintTier = {
  readonly tier: 1 | 2 | 3;
  readonly title: string;
  readonly body: string;
};

export type PremiseLamp = {
  readonly label: string;
  readonly passed: boolean;
};

export type CounterexampleCard = {
  readonly id: string;
  readonly title: string;
  readonly expression: string;
  readonly badge: string;
  readonly premiseLamps: readonly PremiseLamp[];
  readonly premiseOk: boolean;
  readonly conclusionLabel: string;
  readonly refutesClaim: boolean;
  readonly failureCode?:
    | 'premise-not-negative'
    | 'premise-wrong-op'
    | 'premise-mixed-sign'
    | 'premise-not-positive'
    | 'premise-equal-numbers'
    | 'premise-zero-not-positive';
  readonly rebuttalHeadline: string;
  readonly rebuttalDetail: string;
  /** 仅第 2 关「平方跷跷板」用于数值条可视化对比 */
  readonly comparePair?: {
    readonly leftNum: number;
    readonly rightNum: number;
    readonly leftSq: number;
    readonly rightSq: number;
    readonly relation: '<' | '=';
  };
};

export type LogicCardEval = {
  readonly ok: boolean;
  readonly premiseViolated: boolean;
  readonly code: 'exact' | NonNullable<CounterexampleCard['failureCode']>;
  readonly headline: string;
  readonly feedback: string;
  readonly card: CounterexampleCard;
};

export type ParityEvalCode = 'exact' | 'premise-both-even' | 'premise-one-even';

export type ParityDecomposition = {
  readonly value: number;
  readonly pairs: number;
  readonly leftover: 0 | 1;
  readonly isOdd: boolean;
};

export type ParityEvalResult = {
  readonly ok: boolean;
  readonly premiseViolated: boolean;
  readonly code: ParityEvalCode;
  readonly left: ParityDecomposition;
  readonly right: ParityDecomposition;
  readonly sum: number;
  readonly sumIsEven: boolean;
  readonly headline: string;
  readonly feedback: string;
};

export type PipeJointId = 'A' | 'B' | 'C';

export type CanalTrialStatus =
  | 'no-change'
  | 'multi-change'
  | 'single-no-fix'
  | 'solved-fair';

export type CanalTrialResult = {
  readonly solved: boolean;
  readonly status: CanalTrialStatus;
  readonly sourceDrops: number;
  readonly deliveredDrops: number;
  readonly replacedJoints: readonly PipeJointId[];
  readonly predictedDrops: 6 | 8 | null;
  readonly predictionMatched: boolean | null;
  readonly isSingleChange: boolean;
  readonly isMultiChange: boolean;
  readonly headline: string;
  readonly feedback: string;
};

export type LogicBridgeLevelMeta = {
  readonly id: string;
  readonly index: number;
  readonly kind: 'card-check' | 'square-seesaw' | 'parity-builder' | 'canal-control';
  readonly title: string;
  readonly subtitle: string;
  readonly skillTag: LogicSkillTag;
  readonly speaker: string;
  readonly claim: string;
  readonly story: string;
  readonly praise: string;
  readonly hints: readonly [LogicHintTier, LogicHintTier, LogicHintTier];
  readonly cards?: readonly CounterexampleCard[];
  readonly numberPool?: readonly number[];
  readonly leakyJoint?: PipeJointId;
};

export type LogicLevelRecord = {
  readonly levelId: string;
  readonly levelTitle: string;
  readonly skillTag: LogicSkillTag;
  readonly attempts: number;
  readonly pickedPremiseViolation: boolean;
  readonly usedSingleChangeStrategy: boolean;
  readonly triggeredMultiChange: boolean;
  readonly predictedBeforeTrial: boolean;
  readonly usedHints: number;
  readonly completed: boolean;
};

export type LogicBridgeSummary = {
  readonly completedLevels: number;
  readonly totalLevels: number;
  readonly totalAttempts: number;
  readonly firstTryCount: number;
  readonly counterexampleFirstTryCount: number;
  readonly counterexampleTotal: number;
  readonly pickedPremiseViolationAny: boolean;
  readonly usedSingleChangeStrategy: boolean;
  readonly triggeredMultiChangeAny: boolean;
  readonly predictedBeforeTrialAny: boolean;
  readonly achievements: string[];
  readonly assessment: string;
  readonly profileText: string;
};

export const PIPE_JOINTS: readonly { readonly id: PipeJointId; readonly name: string }[] = [
  { id: 'A', name: 'A 段接头' },
  { id: 'B', name: 'B 段接头' },
  { id: 'C', name: 'C 段接头' },
] as const;

export const CANAL_SOURCE_DROPS = 8;
export const CANAL_LEAK_LOSS = 2;

export const LOGIC_BRIDGE_LEVELS: readonly LogicBridgeLevelMeta[] = [
  {
    id: 'bridge-pass-neg-sum',
    index: 1,
    kind: 'card-check',
    title: '第一案 · 桥头假铭文',
    subtitle: '以真反例击碎石碑上的伪命题',
    skillTag: '反例入门',
    speaker: '古桥石碑铭文',
    claim: '“两个负数相加，结果一定是正数。”',
    story:
      '星溪古桥的通行石碑被人篡改了一条铁律。作为石桥调查员，从 4 份案卷样本中选出一张既严格满足前提、又能当场推翻结论的「关键证物」，送上核验台揭穿它。',
    praise:
      '干净利落！−2 与 −3 都是负数且运算为加法，结果 −5 却不是正数——在数学推理里，只要一条符合前提的反例，就足以击碎“一定”！',
    cards: [
      {
        id: 'l1-pos-add',
        title: '证物 A',
        expression: '2 + 3 = 5',
        badge: '案卷 #01',
        premiseLamps: [
          { label: '两个都是负数', passed: false },
          { label: '用的是加法', passed: true },
        ],
        premiseOk: false,
        conclusionLabel: '结果 5（正数）',
        refutesClaim: false,
        failureCode: 'premise-not-negative',
        rebuttalHeadline: '核验驳回：这份证物里并没有负数',
        rebuttalDetail:
          '2 和 3 都是正数，没有满足石碑设定的“两个负数”前提。想反驳一条论断，举出的证物必须先遵守对方的全部前提。',
      },
      {
        id: 'l1-neg-add',
        title: '证物 B',
        expression: '(−2) + (−3) = −5',
        badge: '案卷 #02',
        premiseLamps: [
          { label: '两个都是负数', passed: true },
          { label: '用的是加法', passed: true },
        ],
        premiseOk: true,
        conclusionLabel: '结果 −5（非正数，推翻结论）',
        refutesClaim: true,
        rebuttalHeadline: '真反例锁定！假铭文当场失效',
        rebuttalDetail:
          '−2 与 −3 均为负数且进行加法运算，两项前提全部达标；但和为 −5 并非正数，直接击穿“一定是正数”的伪命题。',
      },
      {
        id: 'l1-neg-mul',
        title: '证物 C',
        expression: '(−2) × (−3) = 6',
        badge: '案卷 #03',
        premiseLamps: [
          { label: '两个都是负数', passed: true },
          { label: '用的是加法', passed: false },
        ],
        premiseOk: false,
        conclusionLabel: '结果 6（正数）',
        refutesClaim: false,
        failureCode: 'premise-wrong-op',
        rebuttalHeadline: '核验驳回：铭文限定的是相加，这份证物是相乘',
        rebuttalDetail:
          '虽然两个数都是负数，但中间悄悄换成了乘号「×」而不是加号「+」。偷换运算方式无法驳倒原命题，再核对一下符号。',
      },
      {
        id: 'l1-mix-add',
        title: '证物 D',
        expression: '(−2) + 5 = 3',
        badge: '案卷 #04',
        premiseLamps: [
          { label: '两个都是负数', passed: false },
          { label: '用的是加法', passed: true },
        ],
        premiseOk: false,
        conclusionLabel: '结果 3（正数）',
        refutesClaim: false,
        failureCode: 'premise-mixed-sign',
        rebuttalHeadline: '核验驳回：只有一个负数，不满足“两个负数”',
        rebuttalDetail:
          '式子里的 5 是正数，属于一负一正，不符合石碑“两个都是负数”的限定范围。筛出两个加数全为负数的案卷再试。',
      },
    ],
    hints: [
      {
        tier: 1,
        title: '先拆解命题的两条硬前提',
        body: '原铭文限定了两个条件：① 两个数都必须是负数；② 它们之间是加法（+）。有效反例必须同时过这两关。',
      },
      {
        tier: 2,
        title: '排查悄悄掉包的运算符号',
        body: '有些干扰案卷虽然出现两个负数，却偷偷把加号换成了乘号「×」，放上核验台会被直接判为前提不符。',
      },
      {
        tier: 3,
        title: '前提全绿后，再看结论是否被打脸',
        body: '找到那张既满足“两负数相加”、结果又不是正数的证物卡，就能一击推翻原铭文。',
      },
    ],
  },
  {
    id: 'square-seesaw',
    index: 2,
    kind: 'square-seesaw',
    title: '第二案 · 平方失衡碑',
    subtitle: '严查前提边界，识破负数与零的陷阱',
    skillTag: '前提检查',
    speaker: '桥廊旧告示',
    claim: '“任意两个正数里，越大的数，平方反而越小。”',
    story:
      '桥廊里钉着一张荒谬的旧告示。把备选案卷放上「数轴平方核验台」，先核查是否属于“两个不相等的正数”，再观察原数在数轴上的位置与平方高度的真实变化。',
    praise:
      '判断非常精准！1 与 2 都是大于 0 的正数且 1 < 2，但平方后 1 < 4，大数的平方反而更大，伪告示不攻自破。',
    cards: [
      {
        id: 'l2-neg-pair',
        title: '样本甲',
        expression: '−2 < −1，平方：4 > 1',
        badge: '案卷 #01',
        premiseLamps: [
          { label: '两个都是正数', passed: false },
          { label: '两数一大一小', passed: true },
        ],
        premiseOk: false,
        conclusionLabel: '平方虽变小，但前提越界',
        refutesClaim: false,
        failureCode: 'premise-not-positive',
        rebuttalHeadline: '前提警报：负数不在“两个正数”的讨论范围内',
        rebuttalDetail:
          '−2 在数轴上位于 −1 左侧（−2 < −1），且平方确实变小，但它们都是负数，不是告示限定的正数，不能作为有效检验样本。',
        comparePair: { leftNum: -2, rightNum: -1, leftSq: 4, rightSq: 1, relation: '<' },
      },
      {
        id: 'l2-eq-pair',
        title: '样本乙',
        expression: '1 = 1，平方：1 = 1',
        badge: '案卷 #02',
        premiseLamps: [
          { label: '两个都是正数', passed: true },
          { label: '两数一大一小', passed: false },
        ],
        premiseOk: false,
        conclusionLabel: '两数相等，分不出大小',
        refutesClaim: false,
        failureCode: 'premise-equal-numbers',
        rebuttalHeadline: '前提警报：两数完全相等，无法比较“越大的数”',
        rebuttalDetail:
          '1 和 1 虽然都是正数，但分不出谁更大，没法检验“越大的数平方怎样变化”。换一对不相等的正数再试。',
        comparePair: { leftNum: 1, rightNum: 1, leftSq: 1, rightSq: 1, relation: '=' },
      },
      {
        id: 'l2-zero-pair',
        title: '样本丙',
        expression: '0 < 2，平方：0 < 4',
        badge: '案卷 #03',
        premiseLamps: [
          { label: '两个都是正数', passed: false },
          { label: '两数一大一小', passed: true },
        ],
        premiseOk: false,
        conclusionLabel: '0 不是正数，前提未过关',
        refutesClaim: false,
        failureCode: 'premise-zero-not-positive',
        rebuttalHeadline: '细节扣分：0 既不是正数也不是负数',
        rebuttalDetail:
          '告示严格写了“两个正数”，必须两个数都严格大于 0。虽然 0 < 4 看起来像反例，但逻辑推理讲究滴水不漏，不能拿 0 冒充正数。',
        comparePair: { leftNum: 0, rightNum: 2, leftSq: 0, rightSq: 4, relation: '<' },
      },
      {
        id: 'l2-pos-pair',
        title: '样本丁',
        expression: '1 < 2，平方：1 < 4',
        badge: '案卷 #04',
        premiseLamps: [
          { label: '两个都是正数', passed: true },
          { label: '两数一大一小', passed: true },
        ],
        premiseOk: true,
        conclusionLabel: '2 > 1 且平方 4 > 1，反驳成立',
        refutesClaim: true,
        rebuttalHeadline: '反驳生效！旧告示被彻底推翻',
        rebuttalDetail:
          '1 和 2 均严格大于 0 且 2 更大；平方后 4 > 1 反而更大而非更小，前提严密、结论直击要害。',
        comparePair: { leftNum: 1, rightNum: 2, leftSq: 1, rightSq: 4, relation: '<' },
      },
    ],
    hints: [
      {
        tier: 1,
        title: '先框定严格的取值范围',
        body: '“两个正数”意味着两个数都必须严格大于 0；同时要比较“越大的数”，所以两数不能相等。',
      },
      {
        tier: 2,
        title: '警惕 0 与负数两类经典陷阱',
        body: '0 不是正数，负数的平方规律与正数相反。先把包含 0 或负数的案卷全部排除掉。',
      },
      {
        tier: 3,
        title: '对比剩下正数样本的数轴与平方条',
        body: '选中两个严格大于 0 且一高一低的案卷，放上核验台就能看到较大数的平方也明显更高。',
      },
    ],
  },
  {
    id: 'parity-gate',
    index: 3,
    kind: 'parity-builder',
    title: '第三案 · 奇偶密码闸',
    subtitle: '自主构造反例，看穿奇偶相加的本质',
    skillTag: '反例迁移',
    speaker: '石桥密闸铭文',
    claim: '“两个奇数相加，结果一定是奇数。”',
    story:
      '石桥密闸没有现成选项了——从数字盘中自己挑 2 个整数送入检验器，亲手构造一个推翻铭文的反例，并透过配对点阵看穿背后的代数规律。',
    praise:
      '直击本质！每个奇数按两两配对都会余出 1，两个奇数的余数 1 + 1 正好凑成新的一对，所以任意两个奇数之和必为偶数！',
    numberPool: [2, 3, 4, 5, 6, 7, 8, 9],
    hints: [
      {
        tier: 1,
        title: '第一步：确保两个槽位都是奇数',
        body: '不能被 2 整除的整数才是奇数。左右两个加数槽都必须放入奇数，才符合密闸的前提。',
      },
      {
        tier: 2,
        title: '观察两个奇数的“余数 1”',
        body: '奇数可以写成“若干对 + 1”。左边多出 1，右边也多出 1，合并后这两个多出来的 1 会发生什么？',
      },
      {
        tier: 3,
        title: '任选两个奇数放进去验证',
        body: '任意挑两个奇数（哪怕选同一个奇数两次也可以），点击「执行合并核验」，看看总和是不是偶数。',
      },
    ],
  },
  {
    id: 'canal-leak-detective',
    index: 4,
    kind: 'canal-control',
    title: '第四案 · 暗渠控变追踪',
    subtitle: '单变量公平比较，锁定唯一渗漏阀门',
    skillTag: '控制变量',
    speaker: '桥下暗渠水表',
    claim: '上游发水 8 单位，流经 A、B、C 三段阀门后终点仅剩 6 单位——哪一段在漏水？',
    story:
      '三段旧阀门中恰好有 1 处破损渗漏（每次损耗 2 单位水量）。你可以随时更换新阀门、先预测终点水量再开闸试水——但怎样实验，才能拿出无可辩驳的单一归因证据？',
    praise:
      '教科书级的单变量排查！其他两段保持原状，仅更换唯一变量就让终点从 6 恢复到 8，铁证锁定渗漏点！',
    leakyJoint: 'B',
    hints: [
      {
        tier: 1,
        title: '思考：同时换两段阀门为什么拿不到铁证？',
        body: '如果一次把两段旧阀门一起换掉，哪怕水量变回 8 单位，你也无法证明刚才到底是哪一段在漏水。',
      },
      {
        tier: 2,
        title: '控制变量法：每次只改动 1 个接头',
        body: '保持其余两段不变，仅把其中 1 段换成新阀门再开闸：若终点仍为 6 单位，即可确凿排除这一段！',
      },
      {
        tier: 3,
        title: '排除一段后先复原，再测下一段',
        body: '点击「恢复原状」把已排除的阀门复原，再单独测试下一段，直到只换 1 段就让终点恢复 8 单位。',
      },
    ],
  },
] as const;

/** 第 1、2 关：确定性检验样本卡是否构成有效反例。 */
export function evaluateCounterexampleCard(
  level: LogicBridgeLevelMeta,
  cardId: string,
): LogicCardEval | null {
  const card = level.cards?.find((c) => c.id === cardId);
  if (!card) return null;

  if (card.premiseOk && card.refutesClaim) {
    return {
      ok: true,
      premiseViolated: false,
      code: 'exact',
      headline: card.rebuttalHeadline,
      feedback: card.rebuttalDetail,
      card,
    };
  }

  return {
    ok: false,
    premiseViolated: !card.premiseOk,
    code: card.failureCode ?? 'premise-not-negative',
    headline: card.rebuttalHeadline,
    feedback: card.rebuttalDetail,
    card,
  };
}

/** 分解正整数的奇偶配对结构（用于可视化点阵方块）。 */
export function decomposeParity(n: number): ParityDecomposition {
  const safe = Math.max(0, Math.floor(n));
  const isOdd = safe % 2 === 1;
  return {
    value: safe,
    pairs: Math.floor(safe / 2),
    leftover: isOdd ? 1 : 0,
    isOdd,
  };
}

/** 第 3 关：校验孩子自己挑的两个数是否推翻“两个奇数相加一定是奇数”。 */
export function evaluateParityBuilder(leftNum: number, rightNum: number): ParityEvalResult {
  const left = decomposeParity(leftNum);
  const right = decomposeParity(rightNum);
  const sum = left.value + right.value;
  const sumIsEven = sum % 2 === 0;

  if (left.isOdd && right.isOdd) {
    return {
      ok: true,
      premiseViolated: false,
      code: 'exact',
      left,
      right,
      sum,
      sumIsEven,
      headline: `真反例构造成功：${left.value} + ${right.value} = ${sum}（偶数）`,
      feedback: `${left.value} 与 ${right.value} 都是奇数，各自余出的 1 合并后正好凑成新的一对，总和 ${sum} 可以完全两两配对——“一定是奇数”的假铭文当场失效！`,
    };
  }

  if (!left.isOdd && !right.isOdd) {
    return {
      ok: false,
      premiseViolated: true,
      code: 'premise-both-even',
      left,
      right,
      sum,
      sumIsEven,
      headline: '前提不符：放入的两个数都是偶数',
      feedback:
        '密闸前提是“两个奇数相加”。观察配对点阵：这两个数都能完全两两配对，没有余数 1。换两个无法被 2 整除的奇数试试。',
    };
  }

  const evenVal = left.isOdd ? right.value : left.value;
  return {
    ok: false,
    premiseViolated: true,
    code: 'premise-one-even',
    left,
    right,
    sum,
    sumIsEven,
    headline: `前提不符：其中 ${evenVal} 是偶数，必须两个都是奇数`,
    feedback: `当前是一奇一偶，合起来 ${left.value} + ${right.value} = ${sum}，还没按“两个奇数”的前提去检验。把偶数 ${evenVal} 换成奇数再核验。`,
  };
}

/** 第 4 关：确定性水渠试水与控制变量诊断。 */
export function evaluateCanalTrial(
  replacedJoints: readonly PipeJointId[],
  predictedDrops: 6 | 8 | null,
  leakyJoint: PipeJointId = 'B',
): CanalTrialResult {
  const uniqueReplaced = Array.from(new Set(replacedJoints));
  const fixedLeak = uniqueReplaced.includes(leakyJoint);
  const deliveredDrops = fixedLeak
    ? CANAL_SOURCE_DROPS
    : Math.max(0, CANAL_SOURCE_DROPS - CANAL_LEAK_LOSS);
  const predictionMatched =
    predictedDrops === null ? null : predictedDrops === deliveredDrops;

  if (uniqueReplaced.length === 0) {
    return {
      solved: false,
      status: 'no-change',
      sourceDrops: CANAL_SOURCE_DROPS,
      deliveredDrops,
      replacedJoints: uniqueReplaced,
      predictedDrops,
      predictionMatched,
      isSingleChange: false,
      isMultiChange: false,
      headline: '三段仍为旧阀门，终点仅收到 6 单位水量',
      feedback:
        '还没有更换任何阀门。试着仅将其中 1 段更换为新阀门，再开闸试水对比水量变化。',
    };
  }

  if (uniqueReplaced.length >= 2) {
    const names = uniqueReplaced.join('、');
    return {
      solved: false,
      status: 'multi-change',
      sourceDrops: CANAL_SOURCE_DROPS,
      deliveredDrops,
      replacedJoints: uniqueReplaced,
      predictedDrops,
      predictionMatched,
      isSingleChange: false,
      isMultiChange: true,
      headline: `同时换了 ${uniqueReplaced.length} 处（${names}），无法锁定唯一渗漏点`,
      feedback:
        deliveredDrops === CANAL_SOURCE_DROPS
          ? `虽然水量恢复到 8 单位，但因为同时动了 ${names}，没法证明刚才究竟是谁在漏水。点击「恢复原状」，用单变量法一次只换 1 段再测。`
          : `同时换了 ${names}，水量依然是 6 单位。严谨实验讲究控制变量：每次只改 1 段阀门，排除证据才最清晰。`,
    };
  }

  const singleJoint = uniqueReplaced[0];
  if (deliveredDrops === CANAL_SOURCE_DROPS) {
    return {
      solved: true,
      status: 'solved-fair',
      sourceDrops: CANAL_SOURCE_DROPS,
      deliveredDrops,
      replacedJoints: uniqueReplaced,
      predictedDrops,
      predictionMatched,
      isSingleChange: true,
      isMultiChange: false,
      headline: `铁证锁定！仅更换 ${singleJoint} 段，终点立刻恢复 8 单位`,
      feedback: `其余两段原封不动，只更换 ${singleJoint} 段阀门便让终点水量从 6 升至 8——这就是无可辩驳的单变量归因证据！`,
    };
  }

  return {
    solved: false,
    status: 'single-no-fix',
    sourceDrops: CANAL_SOURCE_DROPS,
    deliveredDrops,
    replacedJoints: uniqueReplaced,
    predictedDrops,
    predictionMatched,
    isSingleChange: true,
    isMultiChange: false,
    headline: `单换 ${singleJoint} 段后仍为 6 单位——有效线索：已排除 ${singleJoint} 段`,
    feedback: `一次标准的单变量排查！只换 ${singleJoint} 段水量未变，说明渗漏不在这里。已为你标记排除 ${singleJoint} 段，恢复原状再单独测下一段吧。`,
  };
}

/** 汇总 4 关的过程证据：成就徽章、质性观察评语与严格 <= 60 字的「我的档案 · 近况」摘要。 */
export function buildLogicBridgeSummary(
  records: readonly LogicLevelRecord[],
): LogicBridgeSummary {
  const totalLevels = LOGIC_BRIDGE_LEVELS.length;
  const completed = records.filter((r) => r.completed);
  const completedLevels = completed.length;

  const totalAttempts = completed.reduce((sum, r) => sum + Math.max(1, r.attempts), 0);
  const firstTryCount = completed.filter((r) => r.attempts <= 1).length;

  const counterexampleRecords = completed.filter((r) => r.levelId !== 'canal-leak-detective');
  const counterexampleTotal = counterexampleRecords.length;
  const counterexampleFirstTryCount = counterexampleRecords.filter((r) => r.attempts <= 1).length;

  const pickedPremiseViolationAny = completed.some((r) => r.pickedPremiseViolation);
  const canalRecord = completed.find((r) => r.levelId === 'canal-leak-detective');
  const usedSingleChangeStrategy = canalRecord?.usedSingleChangeStrategy ?? false;
  const triggeredMultiChangeAny = completed.some((r) => r.triggeredMultiChange);
  const predictedBeforeTrialAny = completed.some((r) => r.predictedBeforeTrial);

  const achievements: string[] = [];
  if (counterexampleTotal > 0 && counterexampleFirstTryCount === counterexampleTotal) {
    achievements.push('反例火眼金睛 · 3关一次识破');
  } else if (counterexampleFirstTryCount >= 2) {
    achievements.push(`找茬能手 · ${counterexampleFirstTryCount}关一次命中`);
  }

  if (!pickedPremiseViolationAny && counterexampleTotal > 0) {
    achievements.push('前提把关零踩坑');
  } else if (pickedPremiseViolationAny) {
    achievements.push('识破前提干扰卡');
  }

  if (usedSingleChangeStrategy && !triggeredMultiChangeAny) {
    achievements.push('控制变量 · 一次只改一项');
  } else if (usedSingleChangeStrategy) {
    achievements.push('学会单变量公平比较');
  }

  if (predictedBeforeTrialAny) {
    achievements.push('先猜后试好习惯');
  }

  const parts: string[] = [];
  if (counterexampleTotal > 0 && counterexampleFirstTryCount === counterexampleTotal) {
    parts.push(
      '前 3 关找反例全部一次命中！你能先检查前提（负数/正数/奇数与运算符号），再看结论有没有被推翻。',
    );
  } else {
    parts.push(
      `经过 ${totalAttempts} 次检验完成全部 4 关，逐步摸清了“好反例必须先满足前提、再推翻结论”的门道。`,
    );
  }

  if (pickedPremiseViolationAny) {
    parts.push('在踩到不符合前提的干扰卡后能迅速调整回来，记住“前提不符不算反例”特别关键。');
  }

  if (usedSingleChangeStrategy) {
    parts.push(
      triggeredMultiChangeAny
        ? '在修桥找漏点时，从同时换多段调整为“一次只换 1 段”公平比较，成功锁定唯一漏水接头。'
        : '在修桥找漏点中全程坚持“一次只换 1 段”公平比较，逻辑非常严谨！',
    );
  }

  let profileText: string;
  if (
    completedLevels === totalLevels &&
    counterexampleFirstTryCount === counterexampleTotal &&
    usedSingleChangeStrategy &&
    !triggeredMultiChangeAny
  ) {
    profileText = '逻辑小桥通关：反例3关一次命中，前提把关稳准，修桥坚持一次只改一项。';
  } else if (usedSingleChangeStrategy && triggeredMultiChangeAny) {
    profileText = `逻辑小桥通关：反例${counterexampleFirstTryCount}/${counterexampleTotal}次命中，修桥掌握一次只改一项公平比较。`;
  } else if (pickedPremiseViolationAny) {
    profileText = `逻辑小桥通关：共验${totalAttempts}次，辨明前提干扰卡并完成单变量找漏点。`;
  } else {
    profileText = `逻辑小桥通关：共验${totalAttempts}次，反例${counterexampleFirstTryCount}/${counterexampleTotal}一次命中，会控制变量。`;
  }

  return {
    completedLevels,
    totalLevels,
    totalAttempts,
    firstTryCount,
    counterexampleFirstTryCount,
    counterexampleTotal,
    pickedPremiseViolationAny,
    usedSingleChangeStrategy,
    triggeredMultiChangeAny,
    predictedBeforeTrialAny,
    achievements,
    assessment: parts.join(' '),
    profileText: profileText.slice(0, 60),
  };
}
