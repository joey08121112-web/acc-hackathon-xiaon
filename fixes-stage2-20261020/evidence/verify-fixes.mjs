// 阶段2修复自验脚本：在独立 origin（127.0.0.1:5179，已修复源码）验证 S2-01/02/03。
// 不触碰 5173 端口的演示进度。证据写入 fixes-stage2-20261020/evidence/。
import { chromium } from "../../outputs/xiaon/node_modules/playwright-core/index.mjs";
import fs from "node:fs/promises";

const shot = async (page, name) => {
  await page.screenshot({ path: `evidence/${name}.png`, fullPage: false });
  await fs.writeFile(`evidence/${name}.txt`, await page.locator("body").ariaSnapshot());
};
const results = {};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://127.0.0.1:5179/");

await page.getByRole("button", { name: "认识一下小N" }).click();
await page.getByLabel("年龄段").selectOption("14-17");
await page.getByText("我已了解基本服务所需信息与本机演示规则").click();
await page.getByRole("button", { name: /继续，选择可选功能/ }).click();
await page.getByRole("button", { name: /关闭可选功能，进入基本体验/ }).click();
await page.waitForSelector("text=今天，按你的节奏来");

// --- 对照1：错误答案仍判错；提示后完成流程不受影响 ---
await page.getByRole("button", { name: "一起看一道题" }).click();
await page.getByRole("button", { name: /我愿意，从示例题开始/ }).click();
await page.waitForSelector("text=只专注这一小步");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("x - 5");
await page.getByRole("button", { name: /我先试试|提交修改/ }).click();
await page.waitForSelector("text=先停在这一步");
results.wrongAnswerStillRejected = true;
await page.getByRole("button", { name: "给一点提示" }).click();
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("x+5");
await page.getByRole("button", { name: /提交修改/ }).click();
await page.waitForSelector("text=你在提示后完成了这一步");
results.hintedCompletionIntact = true;
await shot(page, "01-hinted-completion-intact");

// --- S2-01 修复：新题等价写法 4*a+2 判对并记为独立完成 ---
await page.getByRole("button", { name: "用一道新题检验" }).click();
await page.waitForSelector("text=换一道，看看新变化");
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("4*a+2");
await page.getByRole("button", { name: /我先试试/ }).click();
await page.waitForSelector("text=这次，你独立完成了。", { timeout: 5000 })
  .then(() => (results.equivalentFormAccepted = true))
  .catch(() => (results.equivalentFormAccepted = false));
await shot(page, "02-equivalent-accepted");

// --- S2-02 修复：新题答错 -> 补充题 -> 浏览器返回恢复上一题 ---
await page.getByRole("button", { name: /回顾这一步的变化|用一道新题检验/ }).click();
await page.waitForSelector("text=有什么不一样");
await page.getByRole("button", { name: /用一道同类新题回顾/ }).click();
await page.waitForSelector("text=再观察一个小步骤");
const calcQuestion = (await page.locator("main .question-paper p").first().innerText()).trim();
await page.getByRole("textbox", { name: "你的解题步骤" }).fill("0");
await page.getByRole("button", { name: /我先试试/ }).click();
await page.waitForSelector("text=先停在这一步");
await page.getByRole("button", { name: "换一题，先练这个小环节" }).click();
await page.waitForFunction(
  (prev) => {
    const q = document.querySelector("main .question-paper p")?.textContent?.trim();
    return q && q !== prev;
  },
  calcQuestion,
);
await shot(page, "03a-supplement-task");
await page.goBack();
await page.waitForTimeout(500);
const restoredQuestion = (await page.locator("main .question-paper p").first().innerText()).trim();
const attempts = await page.locator(".attempt-log summary span").first().innerText();
results.backRestoresPreviousTask = {
  restoredQuestionEqualsOpened: restoredQuestion === calcQuestion,
  attemptsLabel: attempts.trim(),
};
await shot(page, "03b-back-restores-previous");

// --- S2-01 报告层：首次 4*a+2 记为本次独立完成 ---
await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "成长" }).click();
await page.waitForSelector("text=成长，藏在具体的一步里");
await page.getByRole("button", { name: /打开学习观察/ }).click();
await page.waitForSelector("text=这一次，我们发现了什么");
const calcArticle = page.locator("article", { hasText: "计算" }).first();
await calcArticle.locator("summary").first().click(); // 展开观察依据
await page.waitForTimeout(300);
const calcReport = await calcArticle.innerText();
results.reportRecordsIndependent = calcReport.includes("本次独立完成");
results.reportFirstAttemptEvidence = calcReport.includes("4*a+2") && calcReport.includes("正确");
await shot(page, "04-report-independent");

// --- S2-03 修复：休息 -> 我想继续聊聊 -> 邀请暂缓且刷新保留 ---
await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "小N" }).click();
await page.waitForSelector("text=今天，按你的节奏来");
await page.getByRole("button", { name: "今天先休息" }).click();
await page.waitForSelector("text=今天，先好好休息");
await page.getByRole("button", { name: "我想继续聊聊" }).click();
await page.waitForSelector("text=和小N聊聊");
await page.waitForTimeout(300);
results.restResumePausesInvite = {
  bannerGone: (await page.locator(".chat-invitation").count()) === 0,
  pausedNotice: (await page.locator("text=先聊聊，暂不邀请看题").count()) > 0,
  manualEntry: (await page.getByRole("button", { name: "我想开始看题" }).count()) > 0,
  quickInviteGone: (await page.getByRole("button", { name: "我愿意试试" }).count()) === 0,
};
await shot(page, "05-rest-resume-paused");
await page.reload();
await page.waitForSelector("text=和小N聊聊");
results.pausedSurvivesReload = (await page.locator("text=先聊聊，暂不邀请看题").count()) > 0;
await shot(page, "06-paused-after-reload");

// --- 恢复语义不受影响：主动开始看题仍可进入任务 ---
await page.getByRole("button", { name: "我想开始看题" }).click();
await page.getByRole("button", { name: /我愿意，从示例题开始/ }).click();
await page.waitForSelector("text=只专注这一小步");
results.manualRestartStillWorks = true;

console.log(JSON.stringify(results, null, 2));
await browser.close();
