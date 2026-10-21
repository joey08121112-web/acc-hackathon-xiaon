// S2-02 精确复验：任务→任务 相邻跳转后，浏览器返回应恢复上一题
import { createRequire } from "module";
const require = createRequire(
  "/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/package.json",
);
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:5190/";

async function onboard(page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "认识一下小N" }).click();
  await page.getByLabel("我已了解基本服务所需信息与本机演示规则").check();
  await page.getByRole("button", { name: "发起监护人确认演示" }).click();
  await page.getByRole("button", { name: "模拟监护人阅读并确认" }).click();
  await page.getByRole("button", { name: "继续，选择可选功能" }).click();
  await page.getByRole("button", { name: "关闭可选功能，进入基本体验" }).click();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await onboard(page);

// 直接走一起看题主链：主页 → 一起看一道题 → bracket
await page.getByRole("button", { name: "一起看一道题" }).click();
await page.locator(".modal").waitFor();
await page.getByRole("button", { name: /我愿意/ }).click();
await page.locator(".question-paper").waitFor();
const q1 = await page.locator(".math-question").innerText();
await page.locator("textarea").fill("x+5");
await page.locator("form button.primary").click();
await page.locator(".feedback").waitFor();
// 任务→任务：用一道新题检验
await page.getByRole("button", { name: "用一道新题检验" }).click();
await page.locator(".question-paper").waitFor();
const q2 = await page.locator(".math-question").innerText();
// 浏览器返回
await page.goBack();
await page.waitForTimeout(600);
const backH1 = (await page.locator(".question-paper h1").count())
  ? await page.locator(".question-paper h1").innerText()
  : null;
const backQ = (await page.locator(".math-question").count())
  ? await page.locator(".math-question").innerText()
  : null;
const logText = (await page.locator(".attempt-log summary").count())
  ? await page.locator(".attempt-log summary").innerText()
  : "";
console.log(`进入1=${q1.trim()} → 新题=${q2.trim()} → 返回后=${backH1} ${backQ?.trim() ?? ""} ${logText.trim()}`);
const pass = backH1 === "一起看看这个括号" && backQ?.includes("3x − (2x − 5)");
console.log(pass ? "PASS S2-02" : "FAIL S2-02");
await browser.close();
