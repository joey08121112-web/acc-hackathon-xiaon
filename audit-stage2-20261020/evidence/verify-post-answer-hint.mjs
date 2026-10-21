// 交接线索4复验：作答后再点提示，反馈标题是否被追溯改写（在当前已修复版本 5173 上，独立浏览器上下文）。
import { chromium } from "../../outputs/xiaon/node_modules/playwright-core/index.mjs";
import fs from "node:fs/promises";

const shot = async (page, name) => {
  await page.screenshot({ path: `evidence/${name}.png` });
  await fs.writeFile(`evidence/${name}.txt`, await page.locator("body").ariaSnapshot());
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://localhost:5173/");

await page.getByRole("button", { name: "认识一下小N" }).click();
await page.getByLabel("年龄段").selectOption("14-17");
await page.getByText("我已了解基本服务所需信息与本机演示规则").click();
await page.getByRole("button", { name: /继续，选择可选功能/ }).click();
await page.getByRole("button", { name: /关闭可选功能，进入基本体验/ }).click();
await page.waitForSelector("text=今天，按你的节奏来");

// 新题 5x − (2x − 1)：与交接线索同款路径（今日任务第二轮即同类新题）
await page.getByRole("button", { name: "一起看一道题" }).click();
await page.getByRole("button", { name: /我愿意，从示例题开始/ }).click();
await page.waitForSelector("text=只专注这一小步");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("x+5");
await page.getByRole("button", { name: /我先试试/ }).click();
await page.waitForSelector("text=你独立完成了");
await page.getByRole("button", { name: "用一道新题检验" }).click();
await page.waitForSelector("text=换一道，看看新变化");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("4*a+2");
await page.getByRole("button", { name: /我先试试/ }).click();
await page.waitForSelector("text=这次，你独立完成了。");
const titleBefore = (await page.locator(".feedback h3").first().innerText()).trim();
await shot(page, "40-hint-before-click");

// 独立完成后点击“给一点提示”
await page.getByRole("button", { name: "给一点提示" }).click();
await page.waitForTimeout(400);
const titleAfter = (await page.locator(".feedback h3").first().innerText()).trim();
await shot(page, "41-hint-after-click");

// 展开作答记录，核对该次尝试的提示标记
await page.locator(".attempt-log summary").first().click();
await page.waitForTimeout(300);
const logText = await page.locator(".attempt-log").first().innerText();

// 报告层是否仍为本次独立完成
await page.getByRole("button", { name: "看看这次学习观察" }).click();
await page.waitForSelector("text=这一次，我们发现了什么");
const article = page.locator("article", { hasText: "计算" }).first();
await article.locator("summary").first().click();
await page.waitForTimeout(300);
const reportText = await article.innerText();
await shot(page, "42-hint-report-intact");

console.log(JSON.stringify({
  check: "post-answer-hint-retroactive-title",
  titleBefore,
  titleAfter,
  titleFlippedToHinted: titleAfter.includes("提示后完成"),
  attemptLogSaysNoHint: logText.includes("未用提示") && logText.includes("3x+1"),
  reportStillIndependent: reportText.includes("本次独立完成"),
}, null, 2));
await browser.close();
