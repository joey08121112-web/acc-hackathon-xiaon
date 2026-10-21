// 报告状态核验：错答未对→需要继续观察；未作答维度→尚未观察+不推断
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
async function enterPlace(page, place) {
  await page.getByRole("navigation").getByText("探索").click();
  const node = page.locator(".map-node", { hasText: place });
  await node.scrollIntoViewIfNeeded();
  await node.click();
  await page.locator(".modal").waitFor();
  await page.getByRole("button", { name: /我愿意|先去理解花园/ }).click();
  await page.locator(".question-paper").waitFor();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await onboard(page);
// 理解站只答错一次（不提示、不修正）
await enterPlace(page, "理解花园");
const btns = page.locator(".answer-options button");
const n = await btns.count();
for (let i = 0; i < n; i++) {
  if ((await btns.nth(i).innerText()).trim() === "2(x − 3)") {
    await btns.nth(i).click();
    break;
  }
}
await page.locator("form button.primary").click();
await page.locator(".feedback").waitFor();
// 打开报告
await page.getByRole("navigation").getByText("成长").click();
await page.getByRole("button", { name: "打开学习观察" }).click();
await page.waitForTimeout(500);
const items = await page.locator(".report-item").allInnerTexts();
for (const t of items) {
  const head = t.replace(/\s+/g, " ").slice(0, 30);
  console.log(head);
}
const understand = items[0].replace(/\s+/g, " ");
const calc = items.find((t) => t.includes("计算")).replace(/\s+/g, " ");
const ok1 = understand.includes("需要继续观察");
const ok2 = calc.includes("尚未观察") && calc.includes("不能推断能力");
console.log(`${ok1 ? "PASS" : "FAIL"} 理解(仅错答)=需要继续观察`);
console.log(`${ok2 ? "PASS" : "FAIL"} 计算(未作答)=尚未观察+不推断`);
await page.screenshot({ path: "/Users/ami/Documents/个人/ACC黑客松/audit-stage3-20261020/evidence/13-report-unobserved.png" });
await browser.close();
