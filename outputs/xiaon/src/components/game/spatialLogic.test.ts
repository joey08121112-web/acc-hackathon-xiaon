import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPATIAL_LEVELS,
  buildSpatialSummary,
  evaluatePrediction,
  isWithinGrid,
  polylineSquaredLengths,
  rotatePoint,
  rotatePolyline,
  type SpatialLevelRecord,
} from './spatialLogic';

test('原点与非原点中心的顺时针 90° / 180° / 270° 精确整数旋转无浮点误差且无 -0', () => {
  // 绕原点 (0,0)
  assert.deepEqual(rotatePoint({ x: 0, y: 3 }, { x: 0, y: 0 }, 90), { x: 3, y: 0 });
  assert.deepEqual(rotatePoint({ x: 1, y: 3 }, { x: 0, y: 0 }, 90), { x: 3, y: -1 });
  assert.deepEqual(rotatePoint({ x: 2, y: -1 }, { x: 0, y: 0 }, 180), { x: -2, y: 1 });
  assert.deepEqual(rotatePoint({ x: 0, y: 2 }, { x: 0, y: 0 }, 270), { x: -2, y: 0 });

  // 验证不会产出 -0
  const zeroCheck = rotatePoint({ x: 0, y: 2 }, { x: 0, y: 0 }, 90);
  assert.equal(Object.is(zeroCheck.y, -0), false);
  assert.equal(Object.is(zeroCheck.y, 0), true);

  // 绕非原点中心旋转
  assert.deepEqual(rotatePoint({ x: 3, y: 1 }, { x: 1, y: 1 }, 180), { x: -1, y: 1 });
  assert.deepEqual(rotatePoint({ x: 3, y: 2 }, { x: 1, y: 1 }, 180), { x: -1, y: 0 });
  assert.deepEqual(rotatePoint({ x: -1, y: 2 }, { x: -1, y: 0 }, 270), { x: -3, y: 0 });
  assert.deepEqual(rotatePoint({ x: 2, y: 2 }, { x: -1, y: 0 }, 270), { x: -3, y: 3 });
  assert.deepEqual(rotatePoint({ x: -2, y: -1 }, { x: 0, y: -1 }, 90), { x: 0, y: 1 });
  assert.deepEqual(rotatePoint({ x: -2, y: 1 }, { x: 0, y: -1 }, 90), { x: 2, y: 1 });

  // 连续 4 次顺时针 90° 回到原点；90° + 270° = 原点；180° + 180° = 原点
  const p = { x: -2, y: 3 };
  const c = { x: 1, y: -1 };
  const r90 = rotatePoint(p, c, 90);
  const r180 = rotatePoint(r90, c, 90);
  const r270 = rotatePoint(r180, c, 90);
  const r360 = rotatePoint(r270, c, 90);
  assert.deepEqual(r180, rotatePoint(p, c, 180));
  assert.deepEqual(r270, rotatePoint(p, c, 270));
  assert.deepEqual(r360, p);
  assert.deepEqual(rotatePoint(rotatePoint(p, c, 180), c, 180), p);
  assert.deepEqual(rotatePoint(rotatePoint(p, c, 90), c, 270), p);
});

test('全部 4 个关卡的预期落点精确、均在 [-4..4] 网格内且满足刚体边长不变性', () => {
  assert.equal(SPATIAL_LEVELS.length, 4);

  const expectedByLevel = [
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: -1 },
    ],
    [
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
    ],
    [
      { x: -1, y: 0 },
      { x: -3, y: 0 },
      { x: -3, y: 3 },
    ],
    [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ],
  ] as const;

  SPATIAL_LEVELS.forEach((level, idx) => {
    assert.equal(isWithinGrid(level.center), true, `${level.id} center`);
    for (const pt of level.source) {
      assert.equal(isWithinGrid(pt), true, `${level.id} source within grid`);
    }

    const rotated = rotatePolyline(level.source, level.center, level.clockwiseDeg);
    assert.deepEqual(rotated, expectedByLevel[idx], `${level.id} expected rotated points`);

    for (const pt of rotated) {
      assert.equal(isWithinGrid(pt), true, `${level.id} target within grid`);
    }

    // 旋转前后两段边长及首尾跨度完全不变
    assert.deepEqual(
      polylineSquaredLengths(rotated),
      polylineSquaredLengths(level.source),
      `${level.id} rigid length invariance`,
    );

    // 3 级非剧透锦囊齐全
    assert.equal(level.hints.length, 3);
  });
});

test('evaluatePrediction 准确识别正向/反向完全命中与具体偏差原因', () => {
  const level1 = SPATIAL_LEVELS[0]; // (0,0)→(0,3)→(1,3), CW 90° around (0,0) => (0,0)→(3,0)→(3,-1)
  const level2 = SPATIAL_LEVELS[1]; // (1,1)→(3,1)→(3,2), CW 180° around (1,1) => (1,1)→(-1,1)→(-1,0)
  const level3 = SPATIAL_LEVELS[2]; // (-1,0)→(-1,2)→(2,2), CW 270° around (-1,0) => (-1,0)→(-3,0)→(-3,3)

  // 正向命中
  const exactFwd = evaluatePrediction(
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: -1 },
    ],
    level1,
  );
  assert.equal(exactFwd.matched, true);
  assert.equal(exactFwd.code, 'exact');
  assert.equal(exactFwd.reversedOrder, false);

  // 反向描绘同一折线也算完全命中
  const exactRev = evaluatePrediction(
    [
      { x: 3, y: -1 },
      { x: 3, y: 0 },
      { x: 0, y: 0 },
    ],
    level1,
  );
  assert.equal(exactRev.matched, true);
  assert.equal(exactRev.code, 'exact');
  assert.equal(exactRev.reversedOrder, true);

  // 未放满 3 点
  const incomplete = evaluatePrediction([{ x: 0, y: 0 }, { x: 3, y: 0 }], level1);
  assert.equal(incomplete.matched, false);
  assert.equal(incomplete.code, 'incomplete');

  // 方向转反（顺时针 90° 误转成逆时针 90°）
  const wrongDir = evaluatePrediction(
    [
      { x: 0, y: 0 },
      { x: -3, y: 0 },
      { x: -3, y: 1 },
    ],
    level1,
  );
  assert.equal(wrongDir.matched, false);
  assert.equal(wrongDir.code, 'wrong-direction');
  assert.match(wrongDir.feedback, /逆时针|顺时针/);

  // 第 3 关顺时针 270° 误转成顺时针 90°
  const wrongDir270 = evaluatePrediction(
    [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: -3 },
    ],
    level3,
  );
  assert.equal(wrongDir270.matched, false);
  assert.equal(wrongDir270.code, 'wrong-direction');

  // 长边方向对、短边拐反（(0,0)→(3,0)→(3,1) 而非 (3,-1)）
  const shortFlipped = evaluatePrediction(
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
    ],
    level1,
  );
  assert.equal(shortFlipped.matched, false);
  assert.equal(shortFlipped.code, 'short-arm-flipped');
  assert.match(shortFlipped.feedback, /第一段|硬纸板|拐弯/);

  // 第 2 关误绕原点 (0,0) 旋转 180°
  const wrongOrigin = evaluatePrediction(
    [
      { x: -1, y: -1 },
      { x: -3, y: -1 },
      { x: -3, y: -2 },
    ],
    level2,
  );
  assert.equal(wrongOrigin.matched, false);
  assert.equal(wrongOrigin.code, 'wrong-center-origin');
  assert.match(wrongOrigin.feedback, /\(1, 1\)/);

  // 第 2 关只转了 90°
  const quarterOnly = evaluatePrediction(
    [
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: 2, y: -1 },
    ],
    level2,
  );
  assert.equal(quarterOnly.matched, false);
  assert.equal(quarterOnly.code, 'wrong-angle-quarter');

  // 整体平移偏了（方向形状全对但中心错位）
  const shifted = evaluatePrediction(
    [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ],
    level1,
  );
  assert.equal(shifted.matched, false);
  assert.equal(shifted.code, 'center-shifted');
  assert.match(shifted.feedback, /平移|中心|移动/);

  // 第一段方向对但长度错
  const lenMismatch = evaluatePrediction(
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: -1 },
    ],
    level1,
  );
  assert.equal(lenMismatch.matched, false);
  assert.equal(lenMismatch.code, 'length-mismatch');
});

test('buildSpatialSummary 统计字段准确且档案摘要始终 <= 60 字符', () => {
  const perfectRecords: SpatialLevelRecord[] = SPATIAL_LEVELS.map((lv) => ({
    levelId: lv.id,
    levelTitle: lv.title,
    isOriginCenter: lv.isOriginCenter,
    clockwiseDeg: lv.clockwiseDeg,
    attempts: 1,
    usedGuide: false,
    usedHints: 0,
    completed: true,
  }));
  const perfect = buildSpatialSummary(perfectRecords);
  assert.equal(perfect.completedLevels, 4);
  assert.equal(perfect.totalLevels, 4);
  assert.equal(perfect.totalAttempts, 4);
  assert.equal(perfect.firstTryCount, 4);
  assert.equal(perfect.nonOriginFirstTryCount, 3);
  assert.equal(perfect.nonOriginTotal, 3);
  assert.equal(perfect.usedGuideAny, false);
  assert.ok(perfect.profileText.length > 0 && perfect.profileText.length <= 60);
  assert.ok(perfect.achievements.includes('四星连珠 · 全关一次点亮'));
  assert.ok(perfect.achievements.includes('非原点轴心稳准'));

  const guidedRetryRecords: SpatialLevelRecord[] = SPATIAL_LEVELS.map((lv, i) => ({
    levelId: lv.id,
    levelTitle: lv.title,
    isOriginCenter: lv.isOriginCenter,
    clockwiseDeg: lv.clockwiseDeg,
    attempts: i === 0 ? 1 : 3,
    usedGuide: i >= 2,
    usedHints: i === 2 ? 2 : 0,
    completed: true,
  }));
  const guided = buildSpatialSummary(guidedRetryRecords);
  assert.equal(guided.totalAttempts, 10);
  assert.equal(guided.firstTryCount, 1);
  assert.equal(guided.nonOriginFirstTryCount, 0);
  assert.equal(guided.usedGuideCount, 2);
  assert.equal(guided.usedGuideAny, true);
  assert.ok(guided.profileText.length <= 60);
  assert.ok(guided.achievements.includes('善用逐边追踪'));
  assert.ok(guided.achievements.includes('越调越准 · 善于校准'));

  // 极端尝试次数也不得超过 60 字符
  const extremeRecords: SpatialLevelRecord[] = SPATIAL_LEVELS.map((lv) => ({
    levelId: lv.id,
    levelTitle: lv.title,
    isOriginCenter: lv.isOriginCenter,
    clockwiseDeg: lv.clockwiseDeg,
    attempts: 999,
    usedGuide: false,
    usedHints: 3,
    completed: true,
  }));
  const extreme = buildSpatialSummary(extremeRecords);
  assert.ok(extreme.profileText.length <= 60);
});
