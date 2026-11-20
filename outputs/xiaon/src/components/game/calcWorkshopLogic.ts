/** 计算工坊 · 《符号拆包工坊》确定性代数规则、拆盒诊断、试数天平与过程证据引擎。
 * 所有表达式求值、符号翻转校验、同类项归槽校验与恒等核验均为 100% 确定性纯函数。 */

export type VariableName = 'x' | 'a';
export type TermKind = 'var' | 'const';
export type TermSign = 1 | -1;

export type LinearExpr = {
  readonly variable: VariableName;
  readonly varCoeff: number;
  readonly constVal: number;
};

export type TermToken = {
  readonly id: string;
  readonly kind: TermKind;
  readonly coeff: number; // 带符号非零整数，如 +2、-5、+7、-4
  readonly fromBox?: boolean;
};

export type BracketBox = {
  readonly id: string;
  readonly outerSign: TermSign; // -1 表示 −(...)，+1 表示 +(...)
  readonly innerTerms: readonly TermToken[];
};

export type CalcHintTier = {
  readonly tier: 1 | 2 | 3;
  readonly title: string;
  readonly body: string;
};

export type CalcWorkshopLevel = {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly subtitle: string;
  readonly skillTag: '合并同类项' | '去括号负号';
  readonly story: string;
  readonly expressionDisplay: string;
  readonly variable: VariableName;
  readonly looseTerms: readonly TermToken[];
  readonly bracketBox: BracketBox | null;
  readonly target: LinearExpr;
  readonly sampleValues: readonly number[];
  readonly praise: string;
  readonly hints: readonly [CalcHintTier, CalcHintTier, CalcHintTier];
};

export type UnpackDiagnosisCode =
  | 'exact'
  | 'incomplete'
  | 'forgot-second-sign'
  | 'forgot-all-signs'
  | 'flipped-wrong-term';

export type UnpackEvaluation = {
  readonly ok: boolean;
  readonly code: UnpackDiagnosisCode;
  readonly unpackedTerms: readonly TermToken[];
  readonly headline: string;
  readonly feedback: string;
};

export type SlotCheckResult = {
  readonly ok: boolean;
  readonly code: 'matched' | 'mixed-unlike-terms';
  readonly message: string;
};

export type SubmissionDiagnosisCode =
  | 'exact'
  | 'const-sign-error'
  | 'var-coeff-mismatch'
  | 'const-val-mismatch'
  | 'both-mismatch';

export type SubmissionEvaluation = {
  readonly matched: boolean;
  readonly code: SubmissionDiagnosisCode;
  readonly expected: LinearExpr;
  readonly headline: string;
  readonly feedback: string;
};

export type BalanceScaleResult = {
  readonly sampleValue: number;
  readonly leftValue: number;
  readonly rightValue: number;
  readonly diff: number;
  readonly balanced: boolean;
  readonly tiltDeg: number; // 限制在 [-16, 16]，正值表示右侧更重（右沉左翘）
};

export type CalcLevelRecord = {
  readonly levelId: string;
  readonly levelTitle: string;
  readonly skillTag: '合并同类项' | '去括号负号';
  readonly hasBracket: boolean;
  readonly unpackAttempts: number;
  readonly submitAttempts: number;
  readonly triggeredForgotSecondSign: boolean;
  readonly fixedForgotSecondSign: boolean;
  readonly unlikeTermMistakes: number;
  readonly usedBalanceScale: boolean;
  readonly usedHints: number;
  readonly completed: boolean;
};

export type CalcWorkshopSummary = {
  readonly completedLevels: number;
  readonly totalLevels: number;
  readonly totalAttempts: number;
  readonly firstTryCount: number;
  readonly bracketLevelsTotal: number;
  readonly bracketFirstTryCount: number;
  readonly triggeredForgotSecondSignAny: boolean;
  readonly fixedForgotSecondSignAny: boolean;
  readonly totalUnlikeTermMistakes: number;
  readonly usedBalanceScaleCount: number;
  readonly usedBalanceScaleAny: boolean;
  readonly achievements: string[];
  readonly assessment: string;
  readonly profileText: string;
};

function cleanZero(n: number): number {
  return n === 0 ? 0 : n;
}

export function signOf(n: number): TermSign {
  return n < 0 ? -1 : 1;
}

/** 将单个工件格式化为易读数学符号，例如 +3x、−4、+x、−x。 */
export function formatTermToken(
  token: Pick<TermToken, 'kind' | 'coeff'>,
  variable: VariableName,
  options?: { omitLeadingPlus?: boolean },
): string {
  const c = cleanZero(token.coeff);
  const signStr = c < 0 ? '−' : options?.omitLeadingPlus ? '' : '+';
  const abs = Math.abs(c);
  if (token.kind === 'const') {
    return `${signStr}${abs}`;
  }
  if (abs === 1) {
    return `${signStr}${variable}`;
  }
  return `${signStr}${abs}${variable}`;
}

/** 格式化线性表达式为规范化简展示，如 5x − 4、3a + 7、x + 5、12 − 3x。 */
export function formatLinearExpr(
  expr: LinearExpr,
  options?: { preferConstFirstWhenVarNeg?: boolean },
): string {
  const v = cleanZero(expr.varCoeff);
  const c = cleanZero(expr.constVal);
  const preferConstFirst = options?.preferConstFirstWhenVarNeg ?? true;

  if (v === 0 && c === 0) return '0';
  if (v === 0) return c < 0 ? `−${Math.abs(c)}` : `${c}`;
  if (c === 0) {
    if (v === 1) return expr.variable;
    if (v === -1) return `−${expr.variable}`;
    return v < 0 ? `−${Math.abs(v)}${expr.variable}` : `${v}${expr.variable}`;
  }

  const absV = Math.abs(v);
  const varCore = absV === 1 ? expr.variable : `${absV}${expr.variable}`;

  if (preferConstFirst && v < 0 && c > 0) {
    return `${c} − ${varCore}`;
  }

  const varPart = v < 0 ? `−${varCore}` : varCore;
  const constPart = c < 0 ? ` − ${Math.abs(c)}` : ` + ${c}`;
  return `${varPart}${constPart}`;
}

/** 按指定变量值求一次表达式精确值。 */
export function evaluateLinearExpr(expr: LinearExpr, sampleValue: number): number {
  return cleanZero(expr.varCoeff * sampleValue + expr.constVal);
}

/** 直接从关卡原式（散装项 + 封箱礼盒）求精确数值，独立于 target，用于试数天平与恒等测试。 */
export function evaluateLevelOriginal(
  level: CalcWorkshopLevel,
  sampleValue: number,
): number {
  let total = 0;
  for (const t of level.looseTerms) {
    total += t.kind === 'var' ? t.coeff * sampleValue : t.coeff;
  }
  if (level.bracketBox) {
    let inner = 0;
    for (const t of level.bracketBox.innerTerms) {
      inner += t.kind === 'var' ? t.coeff * sampleValue : t.coeff;
    }
    total += level.bracketBox.outerSign * inner;
  }
  return cleanZero(total);
}

/** 汇总一组散装工件的未知数系数与常数值。 */
export function summarizeTerms(
  terms: readonly TermToken[],
  variable: VariableName,
): LinearExpr {
  let varCoeff = 0;
  let constVal = 0;
  for (const t of terms) {
    if (t.kind === 'var') {
      varCoeff += t.coeff;
    } else {
      constVal += t.coeff;
    }
  }
  return {
    variable,
    varCoeff: cleanZero(varCoeff),
    constVal: cleanZero(constVal),
  };
}

/** 4 个递进工坊订单：完全同源专业模式题库「计算·合并同类项」与「计算·去括号负号」。 */
export const CALC_WORKSHOP_LEVELS: readonly CalcWorkshopLevel[] = [
  {
    id: 'like-class-fund',
    index: 1,
    title: '班费小账本',
    subtitle: '合并同类项 · 2x + 3x − 4',
    skillTag: '合并同类项',
    story:
      '班长在理班费：周一收了 2x 元，周二又收了 3x 元，买粉笔花了 4 元。把带 x 的小袋子和纯数字小星星分别放进对应的口袋里吧！',
    expressionDisplay: '2x + 3x − 4',
    variable: 'x',
    looseTerms: [
      { id: 'l1-t1', kind: 'var', coeff: 2 },
      { id: 'l1-t2', kind: 'var', coeff: 3 },
      { id: 'l1-t3', kind: 'const', coeff: -4 },
    ],
    bracketBox: null,
    target: { variable: 'x', varCoeff: 5, constVal: -4 },
    sampleValues: [1, 2, 3, 4],
    praise: '理得真清楚！2x 和 3x 都是 x 小袋子，合起来是 5x；花了 4 元记作 −4，一共 5x − 4。',
    hints: [
      {
        tier: 1,
        title: '同类才能住进同一个口袋',
        body: '带着字母 x 的放进「x 小袋子」，只有数字的放进「星星数字袋」，它们不能混在一起数哦。',
      },
      {
        tier: 2,
        title: '数数一共有几袋 x',
        body: '2 袋 x 加上 3 袋 x，一共是几袋 x？字母 x 本身不用变样。',
      },
      {
        tier: 3,
        title: '别落下数字前面的减号',
        body: '买粉笔花掉 4 元是 −4，搬进口袋时要把减号一起带走。',
      },
    ],
  },
  {
    id: 'like-points-ledger',
    index: 2,
    title: '积分小本子',
    subtitle: '带符号归类 · 7a + 2 − 4a + 5',
    skillTag: '合并同类项',
    story:
      '小美这周的积分：周一得 7a 分，周二奖 2 分，周三扣 4a 分，周四又奖 5 分。记得让每个宝贝带着自己前面的「+ / −」小牌子一起搬家哦！',
    expressionDisplay: '7a + 2 − 4a + 5',
    variable: 'a',
    looseTerms: [
      { id: 'l2-t1', kind: 'var', coeff: 7 },
      { id: 'l2-t2', kind: 'const', coeff: 2 },
      { id: 'l2-t3', kind: 'var', coeff: -4 },
      { id: 'l2-t4', kind: 'const', coeff: 5 },
    ],
    bracketBox: null,
    target: { variable: 'a', varCoeff: 3, constVal: 7 },
    sampleValues: [1, 2, 3, 4],
    praise: '算得一分不差！+7a 和 −4a 抵消后剩 3a，两份奖励 +2 和 +5 合起来是 +7，一共 3a + 7。',
    hints: [
      {
        tier: 1,
        title: '符号小牌子跟着后面的数走',
        body: '看 −4a：减号是跟着 4a 的；看 +2 和 +5：它们都是加分，各带各的符号进袋。',
      },
      {
        tier: 2,
        title: 'a 袋子里的加与减',
        body: '把 +7a 和 −4a 放进同一个 a 袋子：7 袋扣掉 4 袋，还剩几袋 a 呢？',
      },
      {
        tier: 3,
        title: '数字袋单独合起来',
        body: '星星数字袋里有 +2 和 +5，它们两个都是正的，别被旁边的 −4a 带偏啦。',
      },
    ],
  },
  {
    id: 'bracket-card-gate',
    index: 3,
    title: '卡片魔法盒',
    subtitle: '去括号变号 · 3x − (2x − 5)',
    skillTag: '去括号负号',
    story:
      '小林攒了 3x 张卡片，送给同桌的张数比 2x 少 5 张，也就是 (2x − 5) 张。盒子外面贴着红色「减号」贴纸——过变号小门时，先把盒里每一项的新符号选好！',
    expressionDisplay: '3x − (2x − 5)',
    variable: 'x',
    looseTerms: [{ id: 'l3-t1', kind: 'var', coeff: 3 }],
    bracketBox: {
      id: 'b3',
      outerSign: -1,
      innerTerms: [
        { id: 'l3-b1', kind: 'var', coeff: 2 },
        { id: 'l3-b2', kind: 'const', coeff: -5 },
      ],
    },
    target: { variable: 'x', varCoeff: 1, constVal: 5 },
    sampleValues: [1, 2, 3, 4],
    praise: '魔法盒拆得太棒啦！−(2x − 5) 变成 −2x 和 +5，再和 3x 合起来就是 x + 5——少送 5 张，手里就多留 5 张！',
    hints: [
      {
        tier: 1,
        title: '盒外的减号管着盒里的每一个',
        body: '不只第一个 +2x 要变号，盒子里排在后面的那一项，也要经过变号小门哦！',
      },
      {
        tier: 2,
        title: '想想“少送了 5 张”的意思',
        body: '原本要送 2x 张，结果“少送了 5 张”，那小林自己手里是多了 5 张还是少了 5 张呢？',
      },
      {
        tier: 3,
        title: '打开下面的「试数小天平」',
        body: '拿不准符号时，点开试数小天平设 x = 2 看一看：原式是 3×2 − (2×2 − 5) = 7，你的拆法能让天平平下来吗？',
      },
    ],
  },
  {
    id: 'bracket-allowance-exam',
    index: 4,
    title: '零花钱小挑战',
    subtitle: '数字在前 + 负括号 · 8 − (3x − 4)',
    skillTag: '去括号负号',
    story:
      '小美有 8 元零花钱，买文具花的钱比 3x 元少 4 元，也就是 (3x − 4) 元。外面的 +8 不用进小门，先把魔法盒里的两项变好号拆出来，再分类合起来吧！',
    expressionDisplay: '8 − (3x − 4)',
    variable: 'x',
    looseTerms: [{ id: 'l4-t1', kind: 'const', coeff: 8 }],
    bracketBox: {
      id: 'b4',
      outerSign: -1,
      innerTerms: [
        { id: 'l4-b1', kind: 'var', coeff: 3 },
        { id: 'l4-b2', kind: 'const', coeff: -4 },
      ],
    },
    target: { variable: 'x', varCoeff: -3, constVal: 12 },
    sampleValues: [1, 2, 3, 4],
    praise: '零花钱挑战稳稳拿下！外面的 8 保持 +8，盒里的 −(3x − 4) 变成 −3x 和 +4，合起来就是 12 − 3x！',
    hints: [
      {
        tier: 1,
        title: '只变盒子里面的项',
        body: '+8 在括号外面，它不用过变号小门；只有盒里的 +3x 和 −4 需要变号。',
      },
      {
        tier: 2,
        title: '别漏掉排在后面的 −4',
        body: '想想刚才那关的规律：盒外是减号，盒里的两项都要变一次号，−4 变完会是加还是减呢？',
      },
      {
        tier: 3,
        title: 'x 袋子里可以是负的哦',
        body: 'x 袋子里放的是 −3x，星星数字袋里有 +8 和 +4，合起来写成 12 − 3x（和 −3x + 12 是一样的）。',
      },
    ],
  },
] as const;

/** 拆盒校验纯函数：绝不替学生自动变号，必须逐项亲手选择过闸后的符号并精准诊断错因。 */
export function evaluateBracketUnpack(
  box: BracketBox,
  chosenSigns: Readonly<Record<string, TermSign | undefined>>,
  variable: VariableName,
): UnpackEvaluation {
  const missing = box.innerTerms.some((t) => chosenSigns[t.id] !== 1 && chosenSigns[t.id] !== -1);
  if (missing) {
    return {
      ok: false,
      code: 'incomplete',
      unpackedTerms: [],
      headline: '先给礼盒里每一项都选好出闸符号',
      feedback: '点击每一张工件卡上的「+ / −」按钮，决定它通过闸门后的新符号，再点「通过反转闸门」。',
    };
  }

  const unpackedTerms: TermToken[] = box.innerTerms.map((t) => {
    const picked = chosenSigns[t.id] as TermSign;
    return {
      id: `${t.id}-out`,
      kind: t.kind,
      coeff: cleanZero(picked * Math.abs(t.coeff)),
      fromBox: true,
    };
  });

  const checks = box.innerTerms.map((t) => {
    const originalSign = signOf(t.coeff);
    const expectedSign: TermSign = (originalSign * box.outerSign) as TermSign;
    const pickedSign = chosenSigns[t.id] as TermSign;
    return {
      term: t,
      originalSign,
      expectedSign,
      pickedSign,
      isCorrect: pickedSign === expectedSign,
      stayedOriginal: pickedSign === originalSign,
    };
  });

  if (checks.every((c) => c.isCorrect)) {
    const preview = unpackedTerms
      .map((t) => formatTermToken(t, variable))
      .join(' 和 ');
    return {
      ok: true,
      code: 'exact',
      unpackedTerms,
      headline: '反转闸门解锁成功！',
      feedback: `盒内每一项都准确完成了符号转换，拆出散装工件 ${preview}，现在可以把所有工件归入同类槽啦！`,
    };
  }

  if (box.outerSign === -1) {
    // 全部忘翻（所有项都保持了原符号）
    if (checks.every((c) => c.stayedOriginal)) {
      return {
        ok: false,
        code: 'forgot-all-signs',
        unpackedTerms,
        headline: '红色反转闸门还没生效哦',
        feedback:
          '括号外面是一个负号「−」，盒内每一项过闸门都要把正变负、负变正。点一下试数天平看看现在的差值，再逐项翻转吧！',
      };
    }

    // 最经典错误：第一项翻对了，但第二项（或后续某项）漏翻、仍停在原符号（温和引导，不直接剧透答案）
    const firstRight = checks[0]?.isCorrect;
    const missedLater = checks.slice(1).find((c) => !c.isCorrect && c.stayedOriginal);
    if (firstRight && missedLater) {
      const origStr = formatTermToken(missedLater.term, variable);
      return {
        ok: false,
        code: 'forgot-second-sign',
        unpackedTerms,
        headline: '差一点就全对啦：看看排在后面的第二项！',
        feedback: `第一项变号很准！不过后面的 ${origStr} 好像还留着原来的符号。盒外的「−」会照顾到里面的每一项，点下面的「试数小天平」看看为什么歪了，再试试翻一下它？`,
      };
    }
  }

  // 其他情况（如只翻了第二项没翻第一项，或正括号误翻）
  const wrongItem = checks.find((c) => !c.isCorrect);
  const wrongLabel = wrongItem ? formatTermToken(wrongItem.term, variable) : '其中一项';
  return {
    ok: false,
    code: 'flipped-wrong-term',
    unpackedTerms,
    headline: '有一项的符号还没对上',
    feedback:
      box.outerSign === -1
        ? `再检查一下原盒里的 ${wrongLabel}：前面有负号闸门，每一项都要变成相反符号。也可以打开「试数天平」验证一下！`
        : `这个礼盒外面是正号「+」，里面的 ${wrongLabel} 不需要反转符号哦。`,
  };
}

/** 校验散装工件投入目标收纳槽是否同类。 */
export function checkSlotAssignment(
  token: TermToken,
  targetSlot: TermKind,
  variable: VariableName,
): SlotCheckResult {
  if (token.kind === targetSlot) {
    const label = formatTermToken(token, variable);
    return {
      ok: true,
      code: 'matched',
      message:
        targetSlot === 'var'
          ? `${label} 放进「${variable} 小袋子」啦！`
          : `${label} 放进「星星数字袋」啦！`,
    };
  }
  const label = formatTermToken(token, variable);
  return {
    ok: false,
    code: 'mixed-unlike-terms',
    message:
      token.kind === 'const'
        ? `${label} 是纯数字小星星，和 ${variable} 小袋子不是同一种，放进「星星数字袋」更合适哦！`
        : `${label} 带着字母 ${variable}，和纯数字不是同一种，放进「${variable} 小袋子」吧！`,
  };
}

/** 确定性最终打包单等价校验与精准诊断。 */
export function evaluateWorkshopSubmission(
  level: CalcWorkshopLevel,
  submittedVarCoeff: number,
  submittedConstVal: number,
): SubmissionEvaluation {
  const v = cleanZero(submittedVarCoeff);
  const c = cleanZero(submittedConstVal);
  const { varCoeff: targetV, constVal: targetC, variable } = level.target;

  if (v === targetV && c === targetC) {
    return {
      matched: true,
      code: 'exact',
      expected: level.target,
      headline: `第 ${level.index} 关过关啦！`,
      feedback: level.praise,
    };
  }

  const varOk = v === targetV;
  const constOk = c === targetC;

  // 常见符号错误：常数恰好是目标的相反数，或者负括号漏翻导致常数差了 2 倍内项
  if (varOk && !constOk) {
    const flippedSignConst =
      c === -targetC ||
      (level.bracketBox !== null &&
        level.bracketBox.innerTerms.some(
          (t) => t.kind === 'const' && c === targetC + 2 * t.coeff,
        ));
    if (flippedSignConst) {
      return {
        matched: false,
        code: 'const-sign-error',
        expected: level.target,
        headline: `${variable} 小袋子算对啦，再看看数字的正负号！`,
        feedback: `带 ${variable} 的部分完全正确，不过星星数字袋的符号好像反了一点。点开「试数小天平」代个数字看看，马上就能发现！`,
      };
    }
    return {
      matched: false,
      code: 'const-val-mismatch',
      expected: level.target,
      headline: `${variable} 小袋子对啦，再数数星星数字袋`,
      feedback: `${variable} 的数量已经算准啦！把星星数字袋里的几个数带着符号再合一次就能过关。`,
    };
  }

  if (!varOk && constOk) {
    return {
      matched: false,
      code: 'var-coeff-mismatch',
      expected: level.target,
      headline: `星星数字袋对啦，再数数 ${variable} 小袋子`,
      feedback: `纯数字部分完全对啦！再看看 ${variable} 小袋子里的加减抵消，注意每个数前面的符号哦。`,
    };
  }

  return {
    matched: false,
    code: 'both-mismatch',
    expected: level.target,
    headline: '还差一点点就对齐啦',
    feedback: '点开下面的「试数小天平」代个数字称一称，再对着两个口袋慢慢数一遍！',
  };
}

/** 随身「试数天平」纯函数：比较原式精确值与当前工作台线性结果值，返回平衡状态与 [-16, 16] 倾角。 */
export function evaluateBalanceScale(
  level: CalcWorkshopLevel,
  currentVarCoeff: number,
  currentConstVal: number,
  sampleValue: number,
): BalanceScaleResult {
  const leftValue = evaluateLevelOriginal(level, sampleValue);
  const rightValue = cleanZero(currentVarCoeff * sampleValue + currentConstVal);
  const diff = cleanZero(rightValue - leftValue);
  const balanced = diff === 0;

  let tiltDeg = 0;
  if (!balanced) {
    const magnitude = Math.min(16, 4 + Math.abs(diff) * 1.5);
    tiltDeg = Number((Math.sign(diff) * magnitude).toFixed(1));
  }

  return {
    sampleValue,
    leftValue,
    rightValue,
    diff,
    balanced,
    tiltDeg,
  };
}

/** 汇总 4 关的过程证据：成就标签、质性评价与严格 <= 60 字符的「我的档案 · 近况」摘要。 */
export function buildCalcWorkshopSummary(
  records: readonly CalcLevelRecord[],
): CalcWorkshopSummary {
  const totalLevels = CALC_WORKSHOP_LEVELS.length;
  const completed = records.filter((r) => r.completed);
  const completedLevels = completed.length;

  const totalAttempts = completed.reduce(
    (sum, r) =>
      sum + Math.max(1, r.submitAttempts) + (r.hasBracket ? Math.max(0, r.unpackAttempts - 1) : 0),
    0,
  );
  const firstTryCount = completed.filter(
    (r) =>
      (!r.hasBracket || r.unpackAttempts <= 1) &&
      r.submitAttempts <= 1 &&
      r.unlikeTermMistakes === 0,
  ).length;

  const bracketRecords = completed.filter((r) => r.hasBracket);
  const bracketLevelsTotal = bracketRecords.length;
  const bracketFirstTryCount = bracketRecords.filter(
    (r) => r.unpackAttempts <= 1 && r.submitAttempts <= 1,
  ).length;

  const triggeredForgotSecondSignAny = completed.some((r) => r.triggeredForgotSecondSign);
  const fixedForgotSecondSignAny = completed.some(
    (r) => r.triggeredForgotSecondSign && r.fixedForgotSecondSign,
  );
  const totalUnlikeTermMistakes = completed.reduce((sum, r) => sum + r.unlikeTermMistakes, 0);
  const usedBalanceScaleCount = completed.filter((r) => r.usedBalanceScale).length;
  const usedBalanceScaleAny = usedBalanceScaleCount > 0;

  const achievements: string[] = [];
  if (completedLevels === totalLevels && firstTryCount === totalLevels) {
    achievements.push('符号零失误 · 全关一次通关');
  } else if (firstTryCount >= 2) {
    achievements.push(`工坊巧手 · ${firstTryCount}关一次打包`);
  }

  if (bracketLevelsTotal > 0 && bracketFirstTryCount === bracketLevelsTotal) {
    achievements.push('反转闸门一次稳过');
  } else if (fixedForgotSecondSignAny) {
    achievements.push('攻克“漏翻第二项”陷阱');
  }

  if (totalUnlikeTermMistakes === 0 && completedLevels > 0) {
    achievements.push('同类项边界清晰');
  }

  if (usedBalanceScaleAny) {
    achievements.push('善用试数天平验算');
  }

  const parts: string[] = [];
  if (firstTryCount === totalLevels) {
    parts.push(
      '4 份计算工坊订单全部一次精准验收！不管是正负混排的合并同类项，还是负括号逐项变号，你都能稳稳守住每一个符号。',
    );
  } else if (firstTryCount >= 2) {
    parts.push(
      `4 份工坊订单中有 ${firstTryCount} 份一次命中，合并同类项与去括号的节奏已经很清楚了。`,
    );
  } else {
    parts.push(
      `共经过 ${totalAttempts} 次拆包校准完成全部 4 份订单，每次发现符号偏差后都能自己调回来，非常扎实。`,
    );
  }

  if (fixedForgotSecondSignAny) {
    parts.push(
      '在负号礼盒关卡里，你亲眼识破并修正了最容易踩坑的“漏翻第二项”，真正记住了括号外的减号要照顾到盒内每一项。',
    );
  } else if (bracketLevelsTotal > 0 && bracketFirstTryCount === bracketLevelsTotal) {
    parts.push(
      '面对 −(2x − 5) 与 8 − (3x − 4) 两道负括号订单，两项符号都一次翻准，完全没有漏翻第二项。',
    );
  }

  if (usedBalanceScaleAny) {
    parts.push(
      `共有 ${usedBalanceScaleCount} 关主动用「试数天平」代入具体数值自查，这是代数化简里特别可靠的验算好习惯！`,
    );
  }

  let profileText: string;
  if (completedLevels === totalLevels && firstTryCount === totalLevels) {
    profileText = usedBalanceScaleAny
      ? '计算工坊通关：4关一次打包成功，善用试数天平验算，去括号变号零失误。'
      : '计算工坊通关：4关一次打包成功，合并同类项与负括号逐项变号稳准。';
  } else if (fixedForgotSecondSignAny) {
    profileText = usedBalanceScaleAny
      ? `计算工坊通关：共试${totalAttempts}次，借试数天平修正负括号漏翻第二项。`
      : `计算工坊通关：共试${totalAttempts}次，发现并自主修正负括号漏翻第二项。`;
  } else if (usedBalanceScaleAny) {
    profileText = `计算工坊通关：共试${totalAttempts}次，${firstTryCount}/${totalLevels}关一次命中，善用试数天平自查。`;
  } else {
    profileText = `计算工坊通关：共试${totalAttempts}次，${firstTryCount}/${totalLevels}关一次命中，掌握合并与去括号。`;
  }

  return {
    completedLevels,
    totalLevels,
    totalAttempts,
    firstTryCount,
    bracketLevelsTotal,
    bracketFirstTryCount,
    triggeredForgotSecondSignAny,
    fixedForgotSecondSignAny,
    totalUnlikeTermMistakes,
    usedBalanceScaleCount,
    usedBalanceScaleAny,
    achievements,
    assessment: parts.join(' '),
    profileText: profileText.slice(0, 60),
  };
}
