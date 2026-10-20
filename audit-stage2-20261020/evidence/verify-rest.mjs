// 问题3完整链路复验：拒绝看题 -> 主动再进任务(合法清除暂停) -> 休息 -> 我想继续聊聊 -> 邀请条是否出现
import { chromium } from "../runtime/node_modules/playwright-core/index.mjs";
import fs from "node:fs/promises";

const shot = async (page, name) => {
  await page.screenshot({ path: `evidence/${name}.png` });
  await fs.writeFile(`evidence/${name}.txt`, await page.locator("body").ariaSnapshot());
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://127.0.0.1:5178/");

await page.getByRole("button", { name: "认识一下小N" }).click();
await page.getByLabel("年龄段").selectOption("14-17");
await page.getByText("我已了解基本服务所需信息与本机演示规则").click();
await page.getByRole("button", { name: /继续，选择可选功能/ }).click();
await page.getByRole("button", { name: /关闭可选功能，进入基本体验/ }).click();
await page.waitForSelector("text=今天，按你的节奏来");

// 步骤1：拒绝看题邀请
await page.getByRole("button", { name: "先聊聊" }).click();
await page.waitForSelector("text=和小N聊聊");
await page.locator(".chat-invitation").getByRole("button", { name: "我愿意", exact: true }).click();
await page.getByRole("button", { name: "现在先不看" }).click();
await page.waitForTimeout(300);
const pausedAfterDecline = await page.locator("text=先聊聊，暂不邀请看题").count();
await shot(page, "37-zcode-declined");

// 步骤2：学生主动重新开始看题（合法清除暂停状态）
await page.getByRole("button", { name: "我想开始看题" }).click();
await page.getByRole("button", { name: /我愿意，从示例题开始/ }).click();
await page.waitForSelector("text=只专注这一小步");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("x+5");
await page.getByRole("button", { name: /我先试试|提交修改/ }).click();
await page.waitForSelector("text=独立完成了");

// 步骤3：休息
await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "小N" }).click();
await page.waitForSelector("text=今天，按你的节奏来");
await page.getByRole("button", { name: "今天先休息" }).click();
await page.waitForSelector("text=今天，先好好休息");
await shot(page, "38-zcode-rest");

// 步骤4：我想继续聊聊 -> 邀请条是否立即出现
await page.getByRole("button", { name: "我想继续聊聊" }).click();
await page.waitForSelector("text=和小N聊聊");
await page.waitForTimeout(300);
const invitation = await page.locator(".chat-invitation").count();
const invitationText = invitation ? (await page.locator(".chat-invitation p").innerText()).trim() : "";
const pausedNotice = await page.locator("text=先聊聊，暂不邀请看题").count();
const quickInvite = await page.getByRole("button", { name: "我愿意试试" }).count();
await shot(page, "39-zcode-rest-resume-chat");
console.log(JSON.stringify({
  check: "rest-then-resume-chat-invitation",
  pausedAfterDecline: pausedAfterDecline > 0,
  invitationVisible: invitation > 0,
  invitationText,
  pausedNoticeStillShown: pausedNotice > 0,
  quickReplyInviteShown: quickInvite > 0,
}, null, 2));

await browser.close();
