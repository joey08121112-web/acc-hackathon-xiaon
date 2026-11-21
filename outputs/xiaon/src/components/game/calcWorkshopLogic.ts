/** 计算工坊 · 《符号炼金台》确定性代数规则、反转闸诊断、黄铜试数天平与过程证据引擎。
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

/** 4 份星溪钟楼递进工单：完全同源专业模式题库「计算·合并同类项」与「计算·去括号负号」。 */
export const CALC_WORKSHOP_LEVELS: readonly CalcWorkshopLevel[] = [
  {
    id: 'like-class-fund',
    index: 1,
    title: '一号工单 · 钟楼配重账',
    subtitle: '合并同类项 · 2x + 3x − 4',
    skillTag: '合并同类项',
    story:
      '星溪钟楼正在重校主缆配重：上午挂入 2x 组主齿轮，下午追加 3x 组主齿轮，同时卸下 4 单位旧铅块。把带字母 x 的齿轮项和纯数值砝码分别归入对应工作槽！',
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
    praise: '校准精准！2x 与 3x 同属 x 齿轮槽，合并为 5x；常数砝码槽保留 −4，整条配重指令化简为 5x − 4。',
    hints: [
      {
        tier: 1,
        title: '同类构件才能进入同一工作槽',
        body: '带字母 x 的项归入「x 齿轮槽」，不含字母的纯数字归入「常数砝码槽」，两类项不能直接相加减。',
      },
      {
        tier: 2,
        title: '合并变量项时只算系数',
        body: '2x 与 3x 的字母部分相同，把前面的系数 2 和 3 相加，字母 x 保持不变。',
      },
      {
        tier: 3,
        title: '常数项前的负号必须一起带走',
        body: '卸下的 4 单位是 −4，归入常数砝码槽时切记连同它前面的负号一起计入。',
      },
    ],
  },
  {
    id: 'like-points-ledger',
    index: 2,
    title: '二号工单 · 风灯蓄能表',
    subtitle: '带符号归槽 · 7a + 2 − 4a + 5',
    skillTag: '合并同类项',
    story:
      '镇口风灯塔的蓄能记录正负交错：充入 7a、补压 +2、分流损耗 −4a、再补压 +5。把每枚构件连同它前面的「+ / −」极性标牌一起归槽，再分别合并！',
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
    praise: '极性零失误！+7a 与 −4a 抵消后剩 3a，两枚正砝码 +2 与 +5 合并为 +7，最终输出 3a + 7。',
    hints: [
      {
        tier: 1,
        title: '符号永远绑在它紧跟着的项上',
        body: '看 −4a：负号属于 4a；看 +2 与 +5：两者都带正号，归槽时各带各的符号。',
      },
      {
        tier: 2,
        title: '计算 a 齿轮槽内的正负抵消',
        body: '把 +7a 和 −4a 放进同一槽位，相当于 7 − 4，看看剩下几个 a。',
      },
      {
        tier: 3,
        title: '常数砝码槽不受 −4a 干扰',
        body: '常数槽里只有 +2 和 +5，都是正值，直接合并即可。',
      },
    ],
  },
  {
    id: 'bracket-card-gate',
    index: 3,
    title: '三号工单 · 负号反转闸',
    subtitle: '去括号变号 · 3x − (2x − 5)',
    skillTag: '去括号负号',
    story:
      '主轴箱外存有 3x 能量，需扣除封装箱内的 (2x − 5)。注意封装箱前挂着红色「负号反转闸」——箱内每一枚构件通过闸门时，必须由你亲手切换过闸后的新极性！',
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
    praise: '反转闸一气呵成！−(2x − 5) 拆出 −2x 与 +5，与外部 3x 合并得 x + 5——减去一个负数，相当于反向补回 +5！',
    hints: [
      {
        tier: 1,
        title: '闸门外的负号作用于箱内每一项',
        body: '不仅第一项 +2x 过闸要变号，排在括号后面的第二项同样要经过负号反转闸。',
      },
      {
        tier: 2,
        title: '理解“少扣了 5”的直观含义',
        body: '本来要减去 2x，但实际扣除的量比 2x 少了 5，所以最终剩余的能量反而多了 5。',
      },
      {
        tier: 3,
        title: '善用下方「黄铜试数天平」自检',
        body: '拿不准符号时，打开天平代入 x = 2：原式为 3×2 − (2×2 − 5) = 7，看看哪种拆法能让天平严丝合缝！',
      },
    ],
  },
  {
    id: 'bracket-allowance-exam',
    index: 4,
    title: '四号工单 · 蓄水闸门校准',
    subtitle: '常数在前 + 负括号 · 8 − (3x − 4)',
    skillTag: '去括号负号',
    story:
      '蓄水主阀初始水压为 8，需要扣除支路密封箱内的 (3x − 4)。外置的 +8 不经过闸门，先把箱内两枚构件逐项完成极性反转，再归槽合成最终指令！',
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
    praise: '高阶工单稳稳通关！外置 +8 保持不变，−(3x − 4) 拆出 −3x 与 +4，合并得 12 − 3x！',
    hints: [
      {
        tier: 1,
        title: '括号外面的项保持原样',
        body: '+8 位于括号外，不需要过反转闸；只有括号里面的 +3x 和 −4 需要逐项变号。',
      },
      {
        tier: 2,
        title: '盯紧括号里排在后面的 −4',
        body: '负号在括号外，箱内两项都要反号：正变负，负变正。检查一下 −4 过闸后该是什么符号。',
      },
      {
        tier: 3,
        title: '变量项系数可以是负数',
        body: 'x 齿轮槽合并后是 −3x，常数砝码槽有 +8 和 +4，最终写成 12 − 3x（与 −3x + 12 完全等价）。',
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
      headline: '先为封装箱内每一项选定过闸极性',
      feedback: '点击每枚构件上的「+ / −」按钮，决定它通过反转闸后的新符号，再点击「解锁反转闸门」。',
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
        headline: '红色负号反转闸还没触发',
        feedback:
          '括号外面是一个负号「−」，箱内每一项过闸都必须正变负、负变正。打开下方「黄铜试数天平」看清左右差值，再逐项反转！',
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
        headline: '差一步全对：检查排在后面的第二项！',
        feedback: `第一项极性翻得很准！不过后面的 ${origStr} 仍停在原符号。括号外的「−」管辖箱内每一项——点下方「黄铜试数天平」验证一下偏差，再调整它。`,
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
    headline: '有一项的过闸符号尚未对齐',
    feedback:
      box.outerSign === -1
        ? `再核对一下原箱内的 ${wrongLabel}：前有负号反转闸，每一项都要变成相反符号。可用「黄铜试数天平」代入数字自查。`
        : `这个封装箱外是正号「+」，内部的 ${wrongLabel} 保持原符号即可。`,
  };
}

/** 校验散装构件投入目标工作槽是否同类。 */
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
          ? `${label} 已归入「${variable} 齿轮槽」。`
          : `${label} 已归入「常数砝码槽」。`,
    };
  }
  const label = formatTermToken(token, variable);
  return {
    ok: false,
    code: 'mixed-unlike-terms',
    message:
      token.kind === 'const'
        ? `${label} 是纯数值常数，与带字母 ${variable} 的项不是同类项，应放入「常数砝码槽」。`
        : `${label} 带有变量 ${variable}，不能与纯数字混装，应放入「${variable} 齿轮槽」。`,
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
      headline: `第 ${level.index} 号工单验收通过！`,
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
        headline: `${variable} 齿轮槽准确无误，再复查常数槽的正负号`,
        feedback: `含 ${variable} 项系数完全正确，但常数砝码槽的符号似乎反了。打开「黄铜试数天平」代入一个数字称重，立刻就能看清偏差。`,
      };
    }
    return {
      matched: false,
      code: 'const-val-mismatch',
      expected: level.target,
      headline: `${variable} 齿轮槽准确，再核对常数砝码槽`,
      feedback: `${variable} 项系数已经校准完成！把常数砝码槽里的数值带着各自符号再合并一次。`,
    };
  }

  if (!varOk && constOk) {
    return {
      matched: false,
      code: 'var-coeff-mismatch',
      expected: level.target,
      headline: `常数砝码槽准确，再核对 ${variable} 齿轮槽`,
      feedback: `常数部分完全正确！回头再算一次 ${variable} 齿轮槽里的系数加减，留意每枚构件前的符号。`,
    };
  }

  return {
    matched: false,
    code: 'both-mismatch',
    expected: level.target,
    headline: '两组槽位还有一点偏差',
    feedback: '打开「黄铜试数天平」代入具体数值验算，再对照两个工作槽里的构件逐项合并。',
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
