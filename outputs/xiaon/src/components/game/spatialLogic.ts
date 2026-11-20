/** 空间山丘 · 《星象风车台》确定性数学规则、关卡配置与诊断引擎。
 * 坐标约定：标准数学笛卡尔坐标系（横轴 x 向右、纵轴 y 向上），整数格点 [-4..4] × [-4..4]。
 * 所有旋转均通过相对坐标精确整数变换完成，绝无浮点误差。 */

export const GRID_MIN = -4;
export const GRID_MAX = 4;

export type GridPoint = {
  readonly x: number;
  readonly y: number;
};

export type ClockwiseDeg = 90 | 180 | 270;

export type Polyline = readonly [GridPoint, GridPoint, GridPoint];

export type SpatialHintTier = {
  readonly tier: 1 | 2 | 3;
  readonly title: string;
  readonly body: string;
};

export type SpatialLevel = {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly subtitle: string;
  readonly story: string;
  readonly center: GridPoint;
  readonly isOriginCenter: boolean;
  readonly clockwiseDeg: ClockwiseDeg;
  readonly source: Polyline;
  readonly praise: string;
  readonly hints: readonly [SpatialHintTier, SpatialHintTier, SpatialHintTier];
};

export type DiagnosisCode =
  | 'exact'
  | 'incomplete'
  | 'wrong-center-origin'
  | 'wrong-direction'
  | 'wrong-angle-quarter'
  | 'center-shifted'
  | 'short-arm-flipped'
  | 'length-mismatch'
  | 'general-mismatch';

export type PredictionEvaluation = {
  readonly matched: boolean;
  readonly code: DiagnosisCode;
  readonly reversedOrder: boolean;
  readonly expected: Polyline;
  readonly headline: string;
  readonly feedback: string;
};

export type SpatialLevelRecord = {
  readonly levelId: string;
  readonly levelTitle: string;
  readonly isOriginCenter: boolean;
  readonly clockwiseDeg: ClockwiseDeg;
  readonly attempts: number;
  readonly usedGuide: boolean;
  readonly usedHints: number;
  readonly completed: boolean;
};

export type SpatialSummary = {
  readonly completedLevels: number;
  readonly totalLevels: number;
  readonly totalAttempts: number;
  readonly firstTryCount: number;
  readonly nonOriginFirstTryCount: number;
  readonly nonOriginTotal: number;
  readonly usedGuideCount: number;
  readonly usedGuideAny: boolean;
  readonly achievements: string[];
  readonly assessment: string;
  readonly profileText: string;
};

function cleanZero(n: number): number {
  return n === 0 ? 0 : n;
}

export function isWithinGrid(p: GridPoint): boolean {
  return (
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x >= GRID_MIN &&
    p.x <= GRID_MAX &&
    p.y >= GRID_MIN &&
    p.y <= GRID_MAX
  );
}

export function pointsEqual(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function formatPoint(p: GridPoint): string {
  return `(${cleanZero(p.x)}, ${cleanZero(p.y)})`;
}

/** 精确整数顺时针旋转：将 point 绕 center 顺时针旋转 90° / 180° / 270°。
 * 标准笛卡尔坐标（x 向右、y 向上）：
 * - 顺时针 90°： (dx, dy) → (dy, -dx)
 * - 顺时针 180°：(dx, dy) → (-dx, -dy)
 * - 顺时针 270°：(dx, dy) → (-dy, dx)（等价于逆时针 90°） */
export function rotatePoint(
  point: GridPoint,
  center: GridPoint,
  clockwiseDeg: ClockwiseDeg,
): GridPoint {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  switch (clockwiseDeg) {
    case 90:
      return { x: cleanZero(center.x + dy), y: cleanZero(center.y - dx) };
    case 180:
      return { x: cleanZero(center.x - dx), y: cleanZero(center.y - dy) };
    case 270:
      return { x: cleanZero(center.x - dy), y: cleanZero(center.y + dx) };
  }
}

export function rotatePolyline(
  points: Polyline,
  center: GridPoint,
  clockwiseDeg: ClockwiseDeg,
): Polyline {
  return [
    rotatePoint(points[0], center, clockwiseDeg),
    rotatePoint(points[1], center, clockwiseDeg),
    rotatePoint(points[2], center, clockwiseDeg),
  ] as const;
}

/** 计算折线两段边长的平方与首尾跨度平方，用于验证旋转刚体保距不变性。 */
export function polylineSquaredLengths(points: Polyline): readonly [number, number, number] {
  const distSq = (a: GridPoint, b: GridPoint) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  };
  return [
    distSq(points[0], points[1]),
    distSq(points[1], points[2]),
    distSq(points[0], points[2]),
  ] as const;
}

/** 4 个递进关卡：从原点 90° 建立直觉，逐步迁移至非原点 180°、270° 及不同朝向独立校准。 */
export const SPATIAL_LEVELS: readonly SpatialLevel[] = [
  {
    id: 'flag-origin-90',
    index: 1,
    title: '山顶小风旗',
    subtitle: '绕图钉 (0, 0) · 顺时针 90°',
    story:
      '微风吹过空间山丘，小风旗的图钉钉在 (0, 0)。先在方格纸上点出它顺时针转 90° 后的 3 个点，再转一转看看对不对吧！',
    center: { x: 0, y: 0 },
    isOriginCenter: true,
    clockwiseDeg: 90,
    source: [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 1, y: 3 },
    ],
    praise: '山顶小风旗一次就位！向上的长边顺时针转 90° 朝右、小旗面朝下，直觉很稳！',
    hints: [
      {
        tier: 1,
        title: '先钉住金色小图钉',
        body: '旗杆底端正好钉在图钉 (0, 0) 上，不管怎么转，图钉自己都不会动哦。',
      },
      {
        tier: 2,
        title: '像时钟指针一样看长边',
        body: '原来朝上 3 格的长边，像时钟指针从 12 点顺时针走 90° 到 3 点，会转向哪个方向、走几格？',
      },
      {
        tier: 3,
        title: '把整面小旗当成硬纸板',
        body: '原来小旗面在长边右侧伸出 1 格，整块硬纸板一起顺时针转 90°，短边会朝哪边拐呢？',
      },
    ],
  },
  {
    id: 'windmill-nonorigin-180',
    index: 2,
    title: '转转小风车',
    subtitle: '绕图钉 (1, 1) · 顺时针 180°',
    story:
      '半山腰的小风车把图钉钉在了 (1, 1)——注意这次不在 (0, 0) 哦！猜猜叶片绕 (1, 1) 转半圈（180°）会落到哪里？',
    center: { x: 1, y: 1 },
    isOriginCenter: false,
    clockwiseDeg: 180,
    source: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ],
    praise: '图钉不在 (0, 0) 也稳稳拿捏！转半圈后长边朝左、短边朝下，一点没被原点带偏！',
    hints: [
      {
        tier: 1,
        title: '先找到金色小图钉',
        body: '这一关的小图钉在 (1, 1)，不在 (0, 0)。把目光先停在 (1, 1) 上，再从它开始数格数。',
      },
      {
        tier: 2,
        title: '180° 就是正好转半圈',
        body: '转半圈会走到正对面：原来从图钉向右 2 格的边，转半圈后会指向哪一边、走几格？',
      },
      {
        tier: 3,
        title: '短边也指向正对面',
        body: '原来拐弯后的短边向上走 1 格，整片风车转半圈后，它也会指向相反的方向哦。',
      },
    ],
  },
  {
    id: 'stargate-nonorigin-270',
    index: 3,
    title: '魔法旋转门',
    subtitle: '绕图钉 (-1, 0) · 顺时针 270°',
    story:
      '山丘小店的旋转门门轴在 (-1, 0)，要顺时针转 270°。悄悄想想：顺时针转三刻钟，是不是和逆时针转一刻钟落点一样？',
    center: { x: -1, y: 0 },
    isOriginCenter: false,
    clockwiseDeg: 270,
    source: [
      { x: -1, y: 0 },
      { x: -1, y: 2 },
      { x: 2, y: 2 },
    ],
    praise: '顺时针 270° 精准落位！把三刻钟想成逆时针 90°，再钉住 (-1, 0)，整扇门一步到位！',
    hints: [
      {
        tier: 1,
        title: '270° 的小妙招',
        body: '一整圈是 360°，顺时针转 270° 和逆时针转 90° 的落点完全一样！',
      },
      {
        tier: 2,
        title: '先转第一段边',
        body: '钉住门轴 (-1, 0)，原来向上 2 格的第一段边，逆时针转 90° 会转到哪一侧、走几格？',
      },
      {
        tier: 3,
        title: '数清楚第二段有几格',
        body: '原来从拐角向右伸出 3 格的第二段，跟着一起转——方向变了，3 格长度一格都不会少。',
      },
    ],
  },
  {
    id: 'twinstar-nonorigin-90',
    index: 4,
    title: '山丘双风翼',
    subtitle: '绕图钉 (0, -1) · 顺时针 90°',
    story:
      '最后一座小风翼的图钉钉在 (0, -1)，先向左再向上弯折。自己试试把它绕 (0, -1) 顺时针转 90°，点亮整座风车山丘！',
    center: { x: 0, y: -1 },
    isOriginCenter: false,
    clockwiseDeg: 90,
    source: [
      { x: 0, y: -1 },
      { x: -2, y: -1 },
      { x: -2, y: 1 },
    ],
    praise: '双风翼校准成功！换了图钉位置和朝向，你依然能把每条边的方向与格数稳稳对上！',
    hints: [
      {
        tier: 1,
        title: '锁定金色小图钉',
        body: '图钉 (0, -1) 是整片风翼旋转时唯一不动的地方，从它出发最不容易数错。',
      },
      {
        tier: 2,
        title: '朝左的边顺时针转 90°',
        body: '想象表盘上的指针原本指着 9 点（朝左 2 格），顺时针走 90° 会指到 12 点（朝上几格）？',
      },
      {
        tier: 3,
        title: '拐弯后的边跟着一起转',
        body: '原本朝上的 2 格边，顺时针转 90° 后会从新拐角朝哪边伸出 2 格呢？',
      },
    ],
  },
] as const;

function matchesExact(a: Polyline, b: Polyline): boolean {
  return pointsEqual(a[0], b[0]) && pointsEqual(a[1], b[1]) && pointsEqual(a[2], b[2]);
}

function matchesForwardOrReverse(a: Polyline, b: Polyline): { matched: boolean; reversed: boolean } {
  if (matchesExact(a, b)) return { matched: true, reversed: false };
  const rev: Polyline = [a[2], a[1], a[0]];
  if (matchesExact(rev, b)) return { matched: true, reversed: true };
  return { matched: false, reversed: false };
}

function isPureTranslation(candidate: Polyline, target: Polyline): boolean {
  const check = (pts: Polyline) => {
    const dx = pts[0].x - target[0].x;
    const dy = pts[0].y - target[0].y;
    if (dx === 0 && dy === 0) return false;
    return (
      pts[1].x - target[1].x === dx &&
      pts[1].y - target[1].y === dy &&
      pts[2].x - target[2].x === dx &&
      pts[2].y - target[2].y === dy
    );
  };
  return check(candidate) || check([candidate[2], candidate[1], candidate[0]]);
}

/** 校验学生摆放的预测折线，并给出温和、针对具体偏差原因的诊断反馈。 */
export function evaluatePrediction(
  predictedPoints: readonly GridPoint[],
  level: SpatialLevel,
): PredictionEvaluation {
  const expected = rotatePolyline(level.source, level.center, level.clockwiseDeg);

  if (predictedPoints.length !== 3) {
    return {
      matched: false,
      code: 'incomplete',
      reversedOrder: false,
      expected,
      headline: '还差一点就能拨动齿轮',
      feedback: '请在星盘上先放满 3 个顶点组成完整风叶折线，再拨动星象齿轮哦。',
    };
  }

  const candidate: Polyline = [predictedPoints[0], predictedPoints[1], predictedPoints[2]];
  const exact = matchesForwardOrReverse(candidate, expected);
  if (exact.matched) {
    return {
      matched: true,
      code: 'exact',
      reversedOrder: exact.reversed,
      expected,
      headline: `第 ${level.index} 座星台点亮啦！`,
      feedback: level.praise,
    };
  }

  const cStr = formatPoint(level.center);

  // 1. 误按原点 (0, 0) 旋转（常见定势错误）
  if (!level.isOriginCenter) {
    const originSame = rotatePolyline(level.source, { x: 0, y: 0 }, level.clockwiseDeg);
    const oppDeg: ClockwiseDeg =
      level.clockwiseDeg === 90 ? 270 : level.clockwiseDeg === 270 ? 90 : 180;
    const originOpp = rotatePolyline(level.source, { x: 0, y: 0 }, oppDeg);
    if (
      matchesForwardOrReverse(candidate, originSame).matched ||
      matchesForwardOrReverse(candidate, originOpp).matched
    ) {
      return {
        matched: false,
        code: 'wrong-center-origin',
        reversedOrder: false,
        expected,
        headline: '差点就对了——留意旋转中心不在原点',
        feedback: `你刚才像是按坐标原点 (0, 0) 在转啦！这一关的金色星钉在 ${cStr}，先把轴心稳稳钉在 ${cStr} 再跟着数格数。`,
      };
    }
  }

  // 2. 顺逆时针转反了（90° 与 270° 互反）
  if (level.clockwiseDeg === 90 || level.clockwiseDeg === 270) {
    const oppDeg: ClockwiseDeg = level.clockwiseDeg === 90 ? 270 : 90;
    const opposite = rotatePolyline(level.source, level.center, oppDeg);
    if (matchesForwardOrReverse(candidate, opposite).matched) {
      return {
        matched: false,
        code: 'wrong-direction',
        reversedOrder: false,
        expected,
        headline: '形状和轴心都准了，只是转反了方向',
        feedback:
          level.clockwiseDeg === 90
            ? '风叶的边长和拐角保持得特别稳，只是按逆时针转过去啦！顺时针要沿着钟表 12→3→6→9 的方向转 90°。'
            : '风叶转得非常整齐，不过刚刚转成了顺时针 90°！顺时针 270° 要转三刻钟，正好等于逆时针转 90°。',
      };
    }
  }

  // 3. 180° 关只转了 90° 或 270°
  if (level.clockwiseDeg === 180) {
    const cw90 = rotatePolyline(level.source, level.center, 90);
    const cw270 = rotatePolyline(level.source, level.center, 270);
    if (
      matchesForwardOrReverse(candidate, cw90).matched ||
      matchesForwardOrReverse(candidate, cw270).matched
    ) {
      return {
        matched: false,
        code: 'wrong-angle-quarter',
        reversedOrder: false,
        expected,
        headline: '轴心找得很准，再多转四分之一圈',
        feedback: `绕 ${cStr} 转得很稳，不过刚才只转了 90°（四分之一圈）。180° 需要继续再转 90°，走到正对面哦。`,
      };
    }
  }

  // 标准化起点方向：若第 3 点落在中心而第 1 点不在中心，按从中心出发来检查逐边偏差
  const normalized: Polyline =
    pointsEqual(candidate[2], level.center) && !pointsEqual(candidate[0], level.center)
      ? [candidate[2], candidate[1], candidate[0]]
      : candidate;

  // 4. 整条折线平移偏了或中心点没落到轴心上
  if (!pointsEqual(normalized[0], level.center)) {
    if (isPureTranslation(candidate, expected)) {
      return {
        matched: false,
        code: 'center-shifted',
        reversedOrder: false,
        expected,
        headline: '转后的朝向完全对啦，只是位置偏了一点',
        feedback: `叶片的角度和拐弯方向都找准了！记得旋转中心 ${cStr} 本身不会移动，把第一个点落回金色星钉 ${cStr} 就严丝合缝了。`,
      };
    }
    return {
      matched: false,
      code: 'center-shifted',
      reversedOrder: false,
      expected,
      headline: '先把轴心点稳稳钉在星钉上',
      feedback: `旋转时，金色星钉 ${cStr} 就像门轴一样固定不动。下次可以先从 ${cStr} 出发，再顺着第一段边数格数。`,
    };
  }

  // 5. 第一段边完全对了，第二段短边拐反或格数偏差
  if (pointsEqual(normalized[1], expected[1])) {
    const expArm2 = { x: expected[2].x - expected[1].x, y: expected[2].y - expected[1].y };
    const usrArm2 = { x: normalized[2].x - normalized[1].x, y: normalized[2].y - normalized[1].y };
    const isOppositeDir = usrArm2.x === -expArm2.x && usrArm2.y === -expArm2.y;
    const isSameRayWrongLen =
      usrArm2.x * expArm2.y === usrArm2.y * expArm2.x &&
      usrArm2.x * expArm2.x + usrArm2.y * expArm2.y > 0;

    if (isOppositeDir) {
      return {
        matched: false,
        code: 'short-arm-flipped',
        reversedOrder: false,
        expected,
        headline: '第一段完全命中，只是拐角短边拐反啦',
        feedback:
          '从中心出发的第一段方向和长度都找对了！拐角后的第二段像是镜像翻到了另一侧——把整片风叶当成硬纸板一起旋转，拐弯方向就不会反。',
      };
    }
    if (isSameRayWrongLen) {
      return {
        matched: false,
        code: 'length-mismatch',
        reversedOrder: false,
        expected,
        headline: '两段方向全对啦，再数数第二段格数',
        feedback: '长边和短边的方向都稳稳找准了！旋转不会改变边长，再对照原风叶数一下第二段的格数就好。',
      };
    }
    return {
      matched: false,
      code: 'short-arm-flipped',
      reversedOrder: false,
      expected,
      headline: '第一段已经稳稳对齐啦',
      feedback: `第一段已经准确停在 ${formatPoint(expected[1])}！接下来只看第二段，想想它跟着整体顺时针转过 ${level.clockwiseDeg}° 后朝哪边伸出。`,
    };
  }

  // 6. 第一段方向对了，但长度数错了
  const expArm1 = { x: expected[1].x - expected[0].x, y: expected[1].y - expected[0].y };
  const usrArm1 = { x: normalized[1].x - normalized[0].x, y: normalized[1].y - normalized[0].y };
  const arm1SameRay =
    usrArm1.x * expArm1.y === usrArm1.y * expArm1.x &&
    usrArm1.x * expArm1.x + usrArm1.y * expArm1.y > 0;
  if (arm1SameRay) {
    return {
      matched: false,
      code: 'length-mismatch',
      reversedOrder: false,
      expected,
      headline: '第一段方向找对了，再数数格数',
      feedback: '你把第一段转过去的方向找准了！旋转不会拉长或缩短边长，顺着这个方向再数清楚格数就能对齐。',
    };
  }

  // 7. 一般性温柔提醒
  return {
    matched: false,
    code: 'general-mismatch',
    reversedOrder: false,
    expected,
    headline: '对照星轨看看差在哪里',
    feedback: `不用着急！对照暖金实线的真实落点，看看从中心 ${cStr} 出发的第一段边先转到了哪一边，再点「重新校准」自己摆一遍。`,
  };
}

/** 汇总 4 关的过程证据：成就徽章、质性观察评语，以及 <= 60 字的「我的档案 · 近况」摘要。 */
export function buildSpatialSummary(records: readonly SpatialLevelRecord[]): SpatialSummary {
  const totalLevels = SPATIAL_LEVELS.length;
  const completed = records.filter((r) => r.completed);
  const completedLevels = completed.length;
  const totalAttempts = completed.reduce((sum, r) => sum + Math.max(1, r.attempts), 0);
  const firstTryCount = completed.filter((r) => r.attempts === 1).length;
  const nonOriginRecords = completed.filter((r) => !r.isOriginCenter);
  const nonOriginTotal = nonOriginRecords.length;
  const nonOriginFirstTryCount = nonOriginRecords.filter((r) => r.attempts === 1).length;
  const usedGuideCount = completed.filter((r) => r.usedGuide).length;
  const usedGuideAny = usedGuideCount > 0;

  const achievements: string[] = [];
  if (completedLevels === totalLevels && firstTryCount === totalLevels) {
    achievements.push('四星连珠 · 全关一次点亮');
  } else if (firstTryCount >= 2) {
    achievements.push(`星轨直觉 · ${firstTryCount}关一次命中`);
  }
  if (nonOriginTotal > 0 && nonOriginFirstTryCount === nonOriginTotal) {
    achievements.push('非原点轴心稳准');
  } else if (nonOriginTotal > 0) {
    achievements.push('突破原点定势');
  }
  if (totalAttempts > completedLevels) {
    achievements.push('越调越准 · 善于校准');
  }
  if (!usedGuideAny && completedLevels === totalLevels) {
    achievements.push('独立空间想象');
  } else if (usedGuideAny) {
    achievements.push('善用逐边追踪');
  }

  const parts: string[] = [];
  if (firstTryCount === totalLevels && !usedGuideAny) {
    parts.push('4 座星象风车台全部一次独立点亮！无论是绕原点还是非原点中心，顺时针 90°、180° 和 270° 的方向与边长都保持得很稳。');
  } else if (firstTryCount >= 3) {
    parts.push(`4 座星台中有 ${firstTryCount} 座一次命中，空间旋转的整体感已经很清晰。`);
  } else {
    parts.push(`共尝试 ${totalAttempts} 次完成全部 4 座星台校准，每次对照星轨后都能及时调整过来，过程非常扎实。`);
  }

  if (nonOriginTotal > 0) {
    if (nonOriginFirstTryCount === nonOriginTotal) {
      parts.push('面对非原点旋转中心（(1,1)、(-1,0)、(0,-1)）时没有被坐标原点带偏，能先钉住轴心再逐边推演。');
    } else {
      parts.push('在非原点旋转关卡中，通过观察轴心钉与星轨弧线，逐步掌握了“先相对轴心转、再看拐角方向”的方法。');
    }
  }

  if (usedGuideAny) {
    parts.push(`其中 ${usedGuideCount} 关开启了「逐边追踪辅助」，把整条折线拆成先看长边、再看短边是个很实用的空间策略。`);
  }

  let profileText: string;
  if (completedLevels === totalLevels && firstTryCount === totalLevels && !usedGuideAny) {
    profileText = '空间山丘通关：4关一次独立点亮，原点与非原点旋转稳准。';
  } else if (nonOriginTotal > 0 && nonOriginFirstTryCount === nonOriginTotal) {
    profileText = `空间山丘通关：共试${totalAttempts}次，${firstTryCount}/${totalLevels}关一次命中，非原点轴心稳准。`;
  } else if (usedGuideAny) {
    profileText = `空间山丘通关：共试${totalAttempts}次，借逐边辅助完成${completedLevels}座星台旋转校准。`;
  } else {
    profileText = `空间山丘通关：共试${totalAttempts}次，${firstTryCount}/${totalLevels}关一次点亮，完成非原点旋转。`;
  }

  return {
    completedLevels,
    totalLevels,
    totalAttempts,
    firstTryCount,
    nonOriginFirstTryCount,
    nonOriginTotal,
    usedGuideCount,
    usedGuideAny,
    achievements,
    assessment: parts.join(' '),
    profileText: profileText.slice(0, 60),
  };
}
