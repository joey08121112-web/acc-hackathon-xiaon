// 阶段3独立审查批量验证脚本（审查工具，不属于产品源码）
// 运行：node audit-stage3-20261020/run-checks.mjs（在仓库根目录）
import { createRequire } from "module";
const require = createRequire(
  "/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/package.json",
);
const { chromium } = require("@playwright/test");
import path from "path";

const BASE = "http://localhost:5190/";
const EV = path.resolve(
  "/Users/ami/Documents/个人/ACC黑客松/audit-stage3-20261020/evidence",
);
const results = [];
const note = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail ?? ""}`);
};

async function onboard(page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "认识一下小N" }).click();
  await page
    .getByLabel("我已了解基本服务所需信息与本机演示规则")
    .check();
  await page.getByRole("button", { name: "发起监护人确认演示" }).click();
  await page.getByRole("button", { name: "模拟监护人阅读并确认" }).click();
  await page.getByRole("button", { name: "继续，选择可选功能" }).click();
  await page.getByRole("button", { name: "关闭可选功能，进入基本体验" }).click();
  await page.getByRole("navigation").waitFor();
}

async function choice(page, label) {
  const btns = page.locator(".answer-options button");
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    if ((await btns.nth(i).innerText()).trim() === label) {
      await btns.nth(i).click();
      return true;
    }
  }
  return false;
}

async function submitAndWait(page) {
  await page.locator("form button.primary").click();
  await page.locator(".feedback").waitFor({ timeout: 5000 });
}

async function openPlace(page, place) {
  await page.getByRole("navigation").getByText("探索").click();
  const node = page.locator(".map-node", { hasText: place });
  await node.scrollIntoViewIfNeeded();
  await node.click();
  await page.locator(".modal").waitFor();
  await page.getByRole("button", { name: /我愿意|先去理解花园/ }).click();
  await page.locator(".question-paper").waitFor({ timeout: 5000 });
}

async function doTwoFirstStations(page) {
  await openPlace(page, "理解花园");
  if (!(await choice(page, "2x − 3"))) throw new Error("理解选项未找到");
  await submitAndWait(page);
  await openPlace(page, "逻辑小桥");
  if (!(await choice(page, "(−2) + (−3) = −5"))) throw new Error("逻辑选项未找到");
  await submitAndWait(page);
}

const browser = await chromium.launch();

// ---------- 测试A：计算10题上限 + 刷新后仍受限 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await onboard(page);
  await doTwoFirstStations(page);
  await openPlace(page, "计算工坊");
  const ta = page.locator("textarea");
  await ta.fill("x-5");
  await submitAndWait(page); // calcSeen=1 (bracket)
  for (let i = 2; i <= 10; i++) {
    await page.getByRole("navigation").getByText("成长").click();
    await page.getByRole("button", { name: "阶段回顾" }).first().click();
    await page.getByRole("button", { name: "用一道同类新题回顾" }).click();
    await page.locator(".question-paper").waitFor({ timeout: 5000 });
    const q = await page.locator(".math-question").innerText();
    await page.locator("textarea").fill("0");
    await submitAndWait(page);
    const counter = await page
      .locator("text=/本次计算已打开 \\d+\\/10/")
      .first()
      .innerText();
    console.log(`  第${i}题：${q.trim()} → ${counter.replace(/\s+/g, "")}`);
  }
  // 第11次尝试
  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: "阶段回顾" }).first().click();
  await page.getByRole("button", { name: "用一道同类新题回顾" }).click();
  await page.waitForTimeout(600);
  const stillReview = await page
    .locator(".review-steps")
    .count()
    .then((c) => c === 1);
  const toast = await page.locator(".toast, [role=status]").allInnerTexts();
  note(
    "A1 计算达到10题后第11题被阻止",
    stillReview,
    `停留在回顾页=${stillReview}；toast=${JSON.stringify(toast).slice(0, 120)}`,
  );
  await page.screenshot({ path: path.join(EV, "10-calc-limit-reached.png") });
  // 地图计数
  await page.getByRole("navigation").getByText("探索").click();
  const mapCounter = await page
    .locator("text=/本次计算题已打开/")
    .innerText();
  note("A2 地图计数显示10/10", /10\s*\/\s*10/.test(mapCounter), mapCounter.replace(/\s+/g, " "));
  // 刷新后仍受限
  await page.reload();
  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: "阶段回顾" }).first().click();
  await page.getByRole("button", { name: "用一道同类新题回顾" }).click();
  await page.waitForTimeout(600);
  const stillReview2 = (await page.locator(".review-steps").count()) === 1;
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("xiaon-progress-v1")),
  );
  note(
    "A3 刷新后10题上限仍生效",
    stillReview2 && stored.calcSeen.length === 10,
    `calcSeen=${stored.calcSeen.length}`,
  );
  await ctx.close();
}

// ---------- 测试B：画像对照（全部独立完成）+ S2-02 返回 + S2-03 休息恢复 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await onboard(page);
  await doTwoFirstStations(page);
  await openPlace(page, "计算工坊");
  await page.locator("textarea").fill("x+5");
  await submitAndWait(page);
  // 画像B的计划页
  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: "一周小计划" }).first().click();
  const goalB = await page.locator(".plan-goal").innerText();
  await page.screenshot({ path: path.join(EV, "11-plan-profileB.png"), fullPage: false });
  note(
    "B1 全独立画像的计划页",
    goalB.includes("看清括号前的负号") && goalB.includes("根据当前计算任务记录"),
    goalB.replace(/\s+/g, " ").slice(0, 80),
  );
  // S2-02：跨题后浏览器返回恢复上一题
  await page.getByRole("button", { name: "回到探索地图" }).count();
  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: "阶段回顾" }).first().click();
  await page.getByRole("button", { name: "用一道同类新题回顾" }).click();
  await page.locator(".question-paper").waitFor();
  const newQ = await page.locator(".math-question").innerText();
  await page.goBack();
  await page.waitForTimeout(500);
  const backTitle = await page.locator(".question-paper h1").count()
    ? await page.locator(".question-paper h1").innerText()
    : null;
  const backDraft = await page.locator("textarea").inputValue().catch(() => "");
  note(
    "B2(S2-02) 跨题浏览器返回恢复上一题",
    backTitle === "一起看看这个括号",
    `进入新题=${newQ.trim()}；返回后任务=${backTitle}；草稿=${JSON.stringify(backDraft)}`,
  );
  // S2-03：休息→我想继续聊聊→不再立即邀请
  await page.getByRole("navigation").getByText("小N").click();
  await page.getByRole("button", { name: "今天先休息" }).first().click();
  await page.getByRole("button", { name: "我想继续聊聊" }).click();
  await page.waitForTimeout(400);
  const inviteVisible = await page.locator(".chat-invitation").count();
  const pausedNotice = await page
    .locator(".notice", { hasText: "暂不邀请看题" })
    .count();
  note(
    "B3(S2-03) 休息恢复后不立即重新邀请",
    inviteVisible === 0 && pausedNotice >= 1,
    `chat-invitation=${inviteVisible}；暂缓提示=${pausedNotice}`,
  );
  await page.screenshot({ path: path.join(EV, "12-chat-resume-no-invite.png") });
  await ctx.close();
}

await browser.close();
console.log("\n==== 汇总 ====");
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.name}`);
const failed = results.filter((r) => !r.pass).length;
console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
