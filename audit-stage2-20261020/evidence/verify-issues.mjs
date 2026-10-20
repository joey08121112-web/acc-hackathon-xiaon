// 阶段2审查复验脚本（ZCode 接手后运行）。只操作审查运行副本 http://127.0.0.1:5178，
// 不接触产品 5173 端口，不修改产品源码。证据输出到同目录 evidence/。
import { chromium } from "../runtime/node_modules/playwright-core/index.mjs";
import fs from "node:fs/promises";

const shot = async (page, name) => {
  await page.screenshot({ path: `evidence/${name}.png` });
  await fs.writeFile(`evidence/${name}.txt`, await page.locator("body").ariaSnapshot());
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://127.0.0.1:5178/");

// 首次介绍：选14-17岁跳过监护演示（监护流程阶段1已验，此处为快速进入）
await page.getByRole("button", { name: "认识一下小N" }).click();
await page.getByLabel("年龄段").selectOption("14-17");
await page.getByText("我已了解基本服务所需信息与本机演示规则").click();
await page.getByRole("button", { name: /继续，选择可选功能/ }).click();
await page.getByRole("button", { name: /关闭可选功能，进入基本体验/ }).click();
await page.waitForSelector("text=今天，按你的节奏来");
await shot(page, "32-zcode-verify-start-home");

// 问题2复验：进入原题 -> 答对 -> 打开新题 -> 浏览器返回 -> 观察停留在哪题
await page.getByRole("button", { name: "一起看一道题" }).click();
await page.getByRole("button", { name: /我愿意，从示例题开始/ }).click();
await page.waitForSelector("text=只专注这一小步");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("x+5");
await page.getByRole("button", { name: /我先试试|提交修改/ }).click();
await page.waitForSelector("text=你独立完成了");
await page.getByRole("button", { name: "用一道新题检验" }).click();
await page.waitForSelector("text=换一道，看看新变化");
const newTaskUrl = page.url();
await shot(page, "33-zcode-back-before"); // 当前在新题页
await page.goBack(); // 浏览器返回：应回到上一题（原题）
await page.waitForTimeout(400);
const afterBackUrl = page.url();
const heading = await page.locator("main h1").first().innerText();
const attempts = await page.locator(".attempt-log summary span").first().innerText().catch(() => "无记录");
await shot(page, "34-zcode-back-after");
console.log(JSON.stringify({
  check: "browser-back-after-new-task",
  newTaskUrl, afterBackUrl, headingAfterBack: heading.trim(), attemptsLabel: attempts.trim(),
  staysOnNewTask: heading.includes("新") || heading.includes("换一道"),
}, null, 2));

// 问题3复验：休息 -> 我想继续聊聊 -> 观察邀请条是否立即出现
await page.getByRole("button", { name: "今天先休息" }).first().click();
await page.waitForSelector("text=今天，先好好休息");
await shot(page, "35-zcode-rest-home");
await page.getByRole("button", { name: "我想继续聊聊" }).click();
await page.waitForSelector("text=和小N聊聊");
await page.waitForTimeout(300);
const invitation = await page.locator(".chat-invitation").count();
const invitationText = invitation ? (await page.locator(".chat-invitation p").innerText()).trim() : "";
const pausedNotice = await page.locator("text=先聊聊，暂不邀请看题").count();
await shot(page, "36-zcode-rest-resume-chat");
console.log(JSON.stringify({
  check: "rest-then-resume-chat-invitation",
  invitationVisible: invitation > 0, invitationText, pausedNoticeVisible: pausedNotice > 0,
}, null, 2));

await browser.close();
