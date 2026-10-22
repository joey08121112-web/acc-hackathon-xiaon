import { test, expect, type Page } from "@playwright/test";
const screenshot = (p: Page, name: string) =>
  p.screenshot({ path: `../evidence/${name}.png`, fullPage: false });
async function basic(p: Page) {
  // Exercise the same local-ID fallback needed by plain HTTP LAN previews.
  await p.addInitScript(() => { Object.defineProperty(crypto, "randomUUID", { value: undefined }); });
  await p.goto("/");
  await p.getByRole("button", { name: "认识一下小N", exact: true }).click();
  await p
    .getByRole("combobox", { name: "年龄段", exact: true })
    .selectOption("14-17");
  await p.getByRole("checkbox").check();
  await p
    .getByRole("button", { name: "继续，选择可选功能", exact: true })
    .click();
  await p
    .getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true })
    .click();
}
async function settings(p: Page) {
  await p.getByRole("button", { name: "我的与设置", exact: true }).click();
}
async function question(p: Page) {
  await p.getByRole("button", { name: "一起看一道题", exact: false }).click();
  await p
    .getByRole("button", { name: "我愿意，从示例题开始", exact: true })
    .click();
}
const state = (p: Page) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("xiaon-progress-v1") || "{}"),
  );
test("01 首次未满14确认失败、取消、完成；可选默认关闭；拒绝可进入", async ({
  page,
}) => {
  await page.goto("/");
  await screenshot(page, "01-onboarding");
  await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "继续，选择可选功能", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "发起监护人确认演示", exact: true })
    .click();
  await expect(page.getByText("待确认", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "模拟失败", exact: true }).click();
  await expect(page.getByText("确认失败", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "发起监护人确认演示", exact: true })
    .click();
  await page.getByRole("button", { name: "取消确认", exact: true }).click();
  await expect(page.getByText("已取消", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "发起监护人确认演示", exact: true })
    .click();
  await page
    .getByRole("button", { name: "模拟监护人阅读并确认", exact: true })
    .click();
  await page
    .getByRole("button", { name: "继续，选择可选功能", exact: true })
    .click();
  for (const t of await page.getByRole("switch").all())
    await expect(t).toHaveAttribute("aria-checked", "false");
  await screenshot(page, "02-consent");
  await page
    .getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "今天，按你的节奏来。", exact: true }),
  ).toBeVisible();
  await screenshot(page, "03-home");
  expect((await state(page)).longMemory).toBe(false);
});
test("02 选择休息、刷新与今日页都停止任务催促", async ({ page }) => {
  await basic(page);
  await page.getByRole("button", { name: "今天先休息", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "今天，先好好休息。" }),
  ).toBeVisible();
  await expect(page.locator(".home-explore")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("任务已暂停，提醒也已停止。")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "开始今日小任务", exact: false }),
  ).toHaveCount(0);
  await screenshot(page, "04-rest");
});
test("03 错误、提示、暂停、刷新、修正、新题独立完成改变报告", async ({
  page,
}) => {
  await basic(page);
  await question(page);
  await page.getByLabel("你的解题步骤").fill("x − 5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await expect(page.getByText("先停在这一步，一起看看。")).toBeVisible();
  await page.getByRole("button", { name: "给一点提示", exact: true }).click();
  await screenshot(page, "05-task-hint");
  await page.getByRole("button", { name: "先暂停", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "继续", exact: false })
    .filter({ hasText: "继续" })
    .click();
  await expect(page.getByLabel("你的解题步骤")).toHaveValue("x − 5");
  await expect(page.getByText("一级提示", { exact: true })).toBeVisible();
  await page.getByLabel("你的解题步骤").fill("x + 5");
  await page.getByRole("button", { name: "提交修改", exact: true }).click();
  await expect(page.getByText("你在提示后完成了这一步。")).toBeVisible();
  await page
    .getByRole("button", { name: "看看这次学习观察", exact: true })
    .click();
  const calc = page
    .locator(".report-item")
    .filter({ has: page.getByRole("heading", { name: "计算", exact: true }) });
  await expect(calc.getByText("提示下完成", { exact: true })).toBeVisible();
  await screenshot(page, "06-report-hinted");
  await page.getByRole("button", { name: "成长", exact: true }).click();
  await page.getByRole("button", { name: /阶段回顾/ }).click();
  await page
    .getByRole("button", { name: "用一道同类新题回顾", exact: false })
    .click();
  await page.getByLabel("你的解题步骤").fill("4a + 2");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await expect(page.getByText("这次，你独立完成了。")).toBeVisible();
  await page
    .getByRole("button", { name: "看看这次学习观察", exact: true })
    .click();
  await expect(
    page
      .locator(".report-item")
      .filter({ has: page.getByRole("heading", { name: "计算", exact: true }) })
      .getByText("本次独立完成", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "07-report-changed");
  expect((await state(page)).calcSeen).toHaveLength(2);
});
test("04 断网提交保留草稿，失败重试、重复点击与刷新不重复计题", async ({
  page,
}) => {
  await basic(page);
  await settings(page);
  await page.getByRole("switch", { name: "断网与失败演示" }).click();
  await page.getByRole("button", { name: "小N", exact: true }).click();
  await question(page);
  await page.getByLabel("你的解题步骤").fill("x+5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("演示提交失败");
  expect((await state(page)).records.bracket.attempts).toHaveLength(0);
  await page.getByRole("button", { name: "恢复连接", exact: true }).click();
  await page.getByRole("button", { name: "重试提交", exact: true }).dblclick();
  await expect(page.getByText("这次，你独立完成了。")).toBeVisible();
  expect((await state(page)).calcSeen).toHaveLength(1);
  expect((await state(page)).records.bracket.attempts).toHaveLength(1);
  await page.reload();
  expect((await state(page)).calcSeen).toHaveLength(1);
});
test("05 五维地图和列表完整任务、空间视觉选择与报告证据", async ({ page }) => {
  await basic(page);
  await page.getByRole("button", { name: "探索", exact: true }).click();
  await screenshot(page, "08-map");
  await page.getByRole("button", { name: "列表入口", exact: true }).click();
  for (const [place, index] of [
    ["理解花园", 0],
    ["逻辑小桥", 0],
    ["生活集市", 0],
    ["空间山丘", 1],
  ] as const) {
    await page.getByRole("button", { name: new RegExp(place) }).click();
    await page
      .getByRole("button", { name: "我愿意，进入这个小任务", exact: false })
      .click();
    if (place === "空间山丘") await screenshot(page, "09-spatial");
    await page.locator(".answer-options button").nth(index).click();
    await page.getByRole("button", { name: "我先试试", exact: true }).click();
    await expect(page.getByText("这次，你独立完成了。")).toBeVisible();
    await page
      .getByRole("button", { name: "回到探索地图", exact: false })
      .click();
  }
  await page
    .getByRole("button", { name: "看看已有的学习观察", exact: false })
    .click();
  expect((await state(page)).records.space.attempts[0].correct).toBe(true);
  await expect(
    page
      .locator(".report-item")
      .filter({
        has: page.getByRole("heading", { name: "空间想象", exact: true }),
      })
      .getByText("本次独立完成", { exact: true }),
  ).toBeVisible();
});
test("06 周计划接受、减量、改期、暂不开始与今日接续", async ({ page }) => {
  await basic(page);
  await page.getByRole("button", { name: "成长", exact: true }).click();
  await page.getByRole("button", { name: /我的一周小计划/ }).click();
  await page.getByRole("button", { name: "少做一点", exact: false }).click();
  expect(await page.locator(".plan-timeline>div").count()).toBe(2);
  await screenshot(page, "10-plan");
  await page
    .getByRole("button", { name: "去今日页，看看当前安排", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "开始今日小任务", exact: false }),
  ).toBeVisible();
  await screenshot(page, "11-today");
  await page.getByRole("button", { name: "调整这周计划", exact: true }).click();
  await page.getByRole("button", { name: "换个时间", exact: false }).click();
  await page.getByLabel("希望开始的日期").fill("2026-10-24");
  await page.getByRole("button", { name: "确认改期", exact: true }).click();
  await page
    .getByRole("button", { name: "去今日页，看看当前安排", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "已经换到 2026-10-24" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新调整计划", exact: true }).click();
  await page.getByRole("button", { name: "这周先不开始", exact: true }).click();
  await page
    .getByRole("button", { name: "去今日页，看看当前安排", exact: false })
    .click();
  await expect(page.getByText("任务已暂停，提醒也已停止。")).toBeVisible();
});
test("07 记忆开启、主动保存、更正、停止、删除；关闭不新增长期记忆", async ({
  page,
}) => {
  await basic(page);
  await settings(page);
  await page.getByRole("button", { name: /我的学习记忆/ }).click();
  await expect(
    page.getByRole("button", { name: "主动保存一条示例学习偏好", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("switch", { name: "跨会话长期记忆", exact: true })
    .click();
  await page
    .getByRole("button", { name: "主动保存一条示例学习偏好", exact: true })
    .click();
  await page.getByRole("button", { name: "更正", exact: true }).click();
  await page.getByLabel("更正记忆内容").fill("我喜欢把关键步骤圈出来。");
  await page.getByRole("button", { name: "保存更正", exact: true }).click();
  await expect(
    page.getByText("我喜欢把关键步骤圈出来。", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "12-memory");
  await page.getByRole("button", { name: "停止使用", exact: true }).click();
  await expect(page.getByText("已停止使用", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(
    page.getByText("我喜欢把关键步骤圈出来。", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("switch", { name: "跨会话长期记忆", exact: true })
    .click();
  await page.getByRole("button", { name: "小N", exact: true }).click();
  await question(page);
  await page.getByLabel("你的解题步骤").fill("x+5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await expect(page.getByText("这次，你独立完成了。")).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("xiaon-memory-v1") || "[]"),
    ),
  ).toHaveLength(0);
  await page.reload();
  expect((await state(page)).records.bracket.attempts).toHaveLength(1);
});
test("08 示例图片真实裁剪、像素遮挡、刷新恢复、手动核对与移除清理", async ({
  page,
}) => {
  await basic(page);
  await page
    .getByRole("button", { name: "一起看一道题", exact: false })
    .click();
  await page
    .getByRole("button", { name: "我想先带来一道题", exact: true })
    .click();
  await page
    .getByRole("button", { name: "使用示例学习单", exact: false })
    .click();
  await page.getByLabel("裁剪左边").fill("10");
  await page
    .getByRole("button", { name: "应用裁剪，继续遮挡", exact: false })
    .click();
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBe(900);
  await page
    .getByRole("button", { name: "遮挡顶部信息栏", exact: true })
    .click();
  await expect(page.getByText("已遮挡 1 处")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((c) =>
          Array.from(
            (c as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(10, 80, 1, 1).data,
          ).slice(0, 3),
        ),
    )
    .toEqual([41, 60, 50]);
  await screenshot(page, "13-upload-mask");
  await page.reload();
  await expect(page.getByText("已遮挡 1 处")).toBeVisible();
  await page
    .getByRole("button", { name: "确认使用处理后的图片", exact: true })
    .click();
  await page.getByLabel("核对题目内容").fill("3x − (2x − 5)，请核对括号");
  await page
    .getByRole("button", { name: "确认题目内容", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "已核对的题目" }),
  ).toBeVisible();
  await screenshot(page, "14-upload-confirmed");
  expect((await state(page)).uploadText).toContain("请核对括号");
  await page
    .getByRole("button", { name: "移除图片和核对内容", exact: false })
    .click();
  expect((await state(page)).uploadText).toBe("");
  expect(
    await page.evaluate(() => localStorage.getItem("xiaon-image-v1")),
  ).toBeNull();
});
test("09 求助失败、取消、安全联系人替代、模拟成功并非已读", async ({
  page,
}) => {
  await basic(page);
  await page.getByRole("button", { name: "帮助与支持", exact: true }).click();
  // 打开求助页不打断学习；暂停由学生在求助页里自己选。
  expect((await state(page)).safety).toBe(false);
  await page
    .getByRole("button", { name: "先暂停学习任务和测评", exact: true })
    .click();
  expect((await state(page)).safety).toBe(true);
  await page
    .getByRole("button", { name: "准备求助信息", exact: false })
    .click();
  await page.getByRole("switch", { name: "模拟发送失败", exact: true }).click();
  await page.getByRole("button", { name: "确认模拟发送", exact: true }).click();
  await expect(
    page.getByText("发送失败（演示）", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "15-help-failed");
  await page
    .getByRole("button", { name: "这个联系人可能让我不安全", exact: true })
    .click();
  await expect(
    page.getByText("不会通知刚才那个可能不安全的联系人。"),
  ).toBeVisible();
  await expect(page.getByLabel("你想考虑的支持")).toHaveValue(
    "学校里负责学生保护的老师",
  );
  await screenshot(page, "16-help-alternative");
  await page
    .getByRole("button", { name: "准备求助信息", exact: false })
    .click();
  await page.getByRole("button", { name: "取消，不发送", exact: true }).click();
  await expect(page.getByText("尚未发起", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "准备求助信息", exact: false })
    .click();
  await page.getByRole("switch", { name: "模拟发送失败", exact: true }).click();
  await page.getByRole("button", { name: "确认模拟发送", exact: true }).click();
  await expect(page.getByText("已发送（演示）", { exact: true })).toBeVisible();
  await expect(
    page.getByText("这仅表示模拟发送流程结束，不表示对方已读或已经提供帮助。"),
  ).toBeVisible();
});
test("10 聊天等待、暂停、恢复、断网失败、重试不重复消息", async ({ page }) => {
  await basic(page);
  await settings(page);
  await page
    .getByRole("switch", { name: "断网与失败演示", exact: true })
    .click();
  await page.getByRole("button", { name: "小N", exact: true }).click();
  await page.getByRole("button", { name: /先聊聊/ }).click();
  await page.getByLabel("对小N说").fill("这次考试让我有点难过。");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(
    page.getByText("回复没有成功，上一条消息已保留。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复连接", exact: true }).click();
  await page.getByRole("button", { name: "重试回复", exact: true }).click();
  await page.getByRole("button", { name: "暂停回应", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "恢复回应", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复回应", exact: false }).click();
  await expect(page.getByText(/听起来，这次考试让你有些难受/)).toBeVisible();
  expect(
    (await state(page)).chat.filter((m: { role: string }) => m.role === "user"),
  ).toHaveLength(1);
  await screenshot(page, "17-chat");
});
test("11 监护人信息申请范围、必要核验、处理中、结果", async ({ page }) => {
  await basic(page);
  await settings(page);
  await page.getByRole("button", { name: /监护人演示/ }).click();
  await page.getByLabel("申请范围").selectOption("涉及敏感内容的查阅请求");
  await page.getByRole("button", { name: "提交申请演示", exact: true }).click();
  await expect(page.getByText("等待必要核验", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "模拟完成必要核验", exact: true })
    .click();
  await expect(page.getByText("处理中", { exact: true })).toBeVisible();
  await expect(page.getByText("结果可查看", { exact: true })).toBeVisible();
  await expect(page.getByText(/没有直接展示敏感倾诉内容/)).toBeVisible();
  await screenshot(page, "18-guardian");
});
test("12 常见手机宽度、长文本、大字体与减少动效，无横向溢出", async ({
  page,
}) => {
  await basic(page);
  await settings(page);
  await page.getByRole("switch", { name: "大字体", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tab of ["小N", "探索", "今日", "成长"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${tab}`,
      ).toBe(true);
    }
    await page.getByRole("button", { name: "小N", exact: true }).click();
    await page.getByRole("button", { name: /先聊聊/ }).click();
    await page
      .getByLabel("对小N说")
      .fill("这是用于检查换行的合成文本。".repeat(40));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width} long`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "小N", exact: true }).click();
  expect(
    await page
      .locator(".floaty")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await screenshot(page, "19-large-reduced-motion");
});
test("13 错误后的补充题分支与10题上限经刷新仍生效", async ({ page }) => {
  await basic(page);
  await question(page);
  await page.getByRole("button", { name: "给一点提示", exact: true }).click();
  await page.getByLabel("你的解题步骤").fill("x+5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await page
    .getByRole("button", { name: "用一道新题检验", exact: false })
    .click();
  for (let count = 2; count <= 10; count++) {
    await page.getByLabel("你的解题步骤").fill("0");
    await page.getByRole("button", { name: "我先试试", exact: true }).click();
    await expect(page.getByText("先停在这一步，一起看看。")).toBeVisible();
    await page
      .getByRole("button", { name: "换一题，先练这个小环节", exact: true })
      .click();
    if (count === 10) break;
  }
  expect((await state(page)).calcSeen).toHaveLength(10);
  await expect(page.getByRole("status")).toContainText("10 题上限");
  await page.reload();
  expect((await state(page)).calcSeen).toHaveLength(10);
  await page
    .getByRole("button", { name: "换一题，先练这个小环节", exact: true })
    .click();
  expect((await state(page)).calcSeen).toHaveLength(10);
});
test("14 提交等待期间关闭长期记忆，迟到结果不追加长期条目", async ({
  page,
}) => {
  await basic(page);
  await settings(page);
  await page.getByRole("button", { name: /我的学习记忆/ }).click();
  await page
    .getByRole("switch", { name: "跨会话长期记忆", exact: true })
    .click();
  await page.getByRole("button", { name: "小N", exact: true }).click();
  await question(page);
  await page.getByLabel("你的解题步骤").fill("x+5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await settings(page);
  await page.getByRole("button", { name: /我的学习记忆/ }).click();
  await page
    .getByRole("switch", { name: "跨会话长期记忆", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).records.bracket.attempts.length)
    .toBe(1);
  expect((await state(page)).longMemory).toBe(false);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("xiaon-memory-v1") || "[]"),
    ),
  ).toHaveLength(0);
});
test("15 聊天中明确选择休息，后续回应和入口停止学习邀请", async ({ page }) => {
  await basic(page);
  await page.getByRole("button", { name: /先聊聊/ }).click();
  await page.getByLabel("对小N说").fill("今天先休息");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(
    page.getByText("今天的任务提醒已暂停。你可以继续说说，不必开始任务。"),
  ).toBeVisible();
  await expect.poll(async () => (await state(page)).chatStatus).toBe("idle");
  await page.getByLabel("对小N说").fill("嗯，谢谢");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(
    page.getByText("我在听。今天不用急着回到题目上。你还想说说什么？", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".chat-invitation")).toHaveCount(0);
});
test("16 重新首次介绍保留进度，重置演示清空进度与图片", async ({ page }) => {
  await basic(page);
  await question(page);
  await page.getByLabel("你的解题步骤").fill("x+5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await expect(page.getByText("这次，你独立完成了。")).toBeVisible();
  await settings(page);
  await page.getByRole("button", { name: /重新体验首次进入/ }).click();
  await expect(
    page.getByRole("heading", { name: "慢慢来， 也会到达。" }),
  ).toBeVisible();
  expect((await state(page)).calcSeen).toHaveLength(1);
  await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  await page
    .getByRole("button", { name: "继续，选择可选功能", exact: true })
    .click();
  await page
    .getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true })
    .click();
  await settings(page);
  await page.getByRole("button", { name: /重置整个演示/ }).click();
  await page
    .getByRole("button", { name: "确认清空本机演示", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "慢慢来， 也会到达。" }),
  ).toBeVisible();
  expect((await state(page)).calcSeen).toHaveLength(0);
  expect((await state(page)).records).toEqual({});
  expect(
    await page.evaluate(() => localStorage.getItem("xiaon-image-v1")),
  ).toBeNull();
});
