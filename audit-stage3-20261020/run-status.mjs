// 状态真实性检查：暂停→暂未完成；错答未暂停→进行中；列表入口可用
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

// 逻辑站：进入后直接暂停 → 地图应显示 暂未完成
await enterPlace(page, "逻辑小桥");
await page.getByRole("button", { name: "先暂停" }).click();
await page.waitForTimeout(400);
await page.getByRole("navigation").getByText("探索").click();
await page.waitForTimeout(400);
const tagAfterPause = await page
  .locator(".map-node", { hasText: "逻辑小桥" })
  .locator("small")
  .innerText();
console.log(`暂停后逻辑小桥状态：${tagAfterPause}`);

// 理解站：进入后答错（选错误项 2(x − 3)）→ 地图应显示 进行中
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
await page.getByRole("navigation").getByText("探索").click();
await page.waitForTimeout(400);
const tagAfterWrong = await page
  .locator(".map-node", { hasText: "理解花园" })
  .locator("small")
  .innerText();
console.log(`答错后理解花园状态：${tagAfterWrong}`);

// 列表入口
await page.getByRole("button", { name: "列表入口" }).click();
await page.waitForTimeout(300);
const listItems = await page
  .locator(".dimension-list button")
  .allInnerTexts();
console.log(
  "列表模式条目：\n" +
    listItems.map((t) => "  " + t.replace(/\s+/g, " ").trim()).join("\n"),
);
const okPause = tagAfterPause.includes("暂未完成");
const okWrong = tagAfterWrong.includes("进行中");
const okList = listItems.length === 5;
console.log(
  `${okPause ? "PASS" : "FAIL"} 暂停→暂未完成；${okWrong ? "PASS" : "FAIL"} 错答→进行中；${okList ? "PASS" : "FAIL"} 列表入口5维齐备`,
);
await browser.close();
