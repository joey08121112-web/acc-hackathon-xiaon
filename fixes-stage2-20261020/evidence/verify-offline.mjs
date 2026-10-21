// 在新版单文件体验版上验证 S2-01 修复（4*a+2 判对并记独立完成）。
import { chromium } from "../../outputs/xiaon/node_modules/playwright-core/index.mjs";
import fs from "node:fs/promises";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/offline.html");
await page.getByRole("button", { name: "认识一下小N" }).click();
await page.getByLabel("年龄段").selectOption("adult");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "继续，选择可选功能", exact: true }).click();
await page.getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true }).click();
await page.getByRole("button", { name: "一起看一道题", exact: true }).click();
await page.getByRole("button", { name: /我愿意，从示例题开始/ }).click();
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("x+5");
await page.getByRole("button", { name: /我先试试/ }).click();
await page.waitForSelector("text=你独立完成了");
await page.getByRole("button", { name: "用一道新题检验" }).click();
await page.waitForSelector("text=换一道，看看新变化");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("4*a+2");
await page.getByRole("button", { name: /我先试试/ }).click();
await page.waitForSelector("text=这次，你独立完成了。", { timeout: 5000 });
await page.screenshot({ path: "evidence/07-offline-equivalent-accepted.png" });
await fs.writeFile("evidence/07-offline-equivalent-accepted.txt", await page.locator("body").ariaSnapshot());
console.log(JSON.stringify({ offlineEquivalentAccepted: true, pageErrors: errors }, null, 2));
await browser.close();
