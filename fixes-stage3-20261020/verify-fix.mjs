// S3-01/S3-02 修复验证脚本（fixes-stage3-20261020/verify-fix.mjs）
// 前置：npx vite --port 5191 --strictPort
import { createRequire } from "module";
const require = createRequire(
  "/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/package.json",
);
const { chromium } = require("@playwright/test");
import path from "path";

const BASE = "http://localhost:5191/";
const EV = "/Users/ami/Documents/个人/ACC黑客松/fixes-stage3-20261020/evidence";
const results = [];
const note = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
};

async function onboard(page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "认识一下小N" }).click();
  await page
    .getByRole("combobox", { name: "年龄段", exact: true })
    .selectOption("14-17");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "继续，选择可选功能" }).click();
  await page.getByRole("button", { name: "关闭可选功能，进入基本体验" }).click();
}
async function startQuestion(page, value) {
  await page.getByRole("button", { name: "一起看一道题" }).click();
  await page.getByRole("button", { name: "我愿意，从示例题开始" }).click();
  await page.getByLabel("你的解题步骤").fill(value);
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await page.locator(".feedback").waitFor();
}
const browser = await chromium.launch();

// ---------- 画像A：符号错误 → 提示 → 修正 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await onboard(page);
  await startQuestion(page, "x-5");
  await page.getByRole("button", { name: "给一点提示" }).click();
  await page.getByLabel("你的解题步骤").fill("x+5");
  await page.getByRole("button", { name: "提交修改" }).click();
  await page.locator(".feedback.success, .feedback").last().waitFor();

  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: /我的一周小计划/ }).click();
  await page.waitForTimeout(300);
  const goalA = await page.locator(".plan-goal h2").innerText();
  const eyebrowA = await page.locator(".plan-goal .eyebrow").innerText();
  const tlA = await page.locator(".plan-timeline > div").count();
  note("A 计划-画像A=看清括号前的负号（3任务）", goalA === "看清括号前的负号" && tlA === 3, `goal=${goalA} eyebrow=${eyebrowA} 任务数=${tlA}`);
  await page.screenshot({ path: path.join(EV, "01-plan-profileA.png") });

  await page.getByRole("button", { name: "少做一点" }).click();
  await page.waitForTimeout(300);
  const tlLight = await page.locator(".plan-timeline > div").count();
  const noticeLight = await page.locator(".notice").innerText();
  note("A 减量→2任务+动态提示", tlLight === 2 && /已减量为 2 个小任务，总计约 6 分钟/.test(noticeLight), noticeLight.replace(/\s+/g, ""));
  await page.getByRole("button", { name: "接受这个小计划" }).click();
  await page.waitForTimeout(400);

  const todayGoal = await page.locator(".today-ticket h2").innerText();
  const task2Status = await page.locator(".today-task").nth(1).locator("small").innerText();
  note("A 今日票=计划目标+真实状态", todayGoal === "看清括号前的负号" && task2Status === "未开始", `goal=${todayGoal} 任务2=${task2Status}`);
  await page.screenshot({ path: path.join(EV, "02-today-profileA.png") });

  await page.getByRole("button", { name: "开始今日小任务" }).click();
  await page.waitForTimeout(400);
  const opened = await page.locator(".math-question").innerText();
  note("A CTA打开未完成的transfer", opened.includes("7a − (3a − 2)"), opened.trim());

  await page.getByLabel("你的解题步骤").fill("4a+2");
  await page.locator("form button.primary").click();
  await page.locator(".feedback").last().waitFor();
  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: "打开学习观察" }).click();
  await page.waitForTimeout(400);
  const calcCard = page.locator(".report-item", { hasText: "计算" });
  const trail = (await calcCard.locator("p.small").first().innerText()).replace(/\s+/g, "");
  note("A 报告计算维显示结论轨迹", /结论轨迹：/.test(trail) && trail.includes("需要继续观察") && trail.includes("提示下完成") && trail.includes("本次独立完成"), trail.slice(0, 90));
  await page.screenshot({ path: path.join(EV, "03-report-trail-profileA.png") });
  await ctx.close();
}

// ---------- 画像B：全部首次独立完成 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await onboard(page);
  await startQuestion(page, "x+5");
  await page.getByRole("button", { name: "用一道新题检验" }).click();
  await page.waitForTimeout(400);
  await page.getByLabel("你的解题步骤").fill("4a+2");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await page.locator(".feedback").waitFor();

  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: /我的一周小计划/ }).click();
  await page.waitForTimeout(300);
  const goalB = await page.locator(".plan-goal h2").innerText();
  const eyebrowB = await page.locator(".plan-goal .eyebrow").innerText();
  const tlB = await page.locator(".plan-timeline > div").count();
  note("B 计划-画像B=把去括号的方法用活（2任务）", goalB === "把去括号的方法用活" && eyebrowB === "根据当前计算任务记录" && tlB === 2, `goal=${goalB} eyebrow=${eyebrowB}`);
  await page.screenshot({ path: path.join(EV, "04-plan-profileB-multi.png") });

  await page.getByRole("button", { name: "接受这个小计划" }).click();
  await page.waitForTimeout(400);
  const t1q = await page.locator(".today-task").nth(0).locator("p").innerText();
  const t2small = await page.locator(".today-task").nth(1).locator("small").innerText();
  note("B 今日票任务=新题+自由安排", t1q.includes("5x − (2x − 1)") && t2small === "自由安排", `任务1=${t1q.trim()} 任务2=${t2small}`);
  await page.screenshot({ path: path.join(EV, "05-today-profileB.png") });
  await page.getByRole("button", { name: "开始今日小任务" }).click();
  await page.waitForTimeout(400);
  const openedB = await page.locator(".math-question").innerText();
  note("B CTA打开calc-0新题", openedB.includes("5x − (2x − 1)"), openedB.trim());
  await ctx.close();
}

// ---------- 画像C：仅原题独立完成（本次独立完成档） ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await onboard(page);
  await startQuestion(page, "x+5");
  await page.getByRole("navigation").getByText("成长").click();
  await page.getByRole("button", { name: /我的一周小计划/ }).click();
  await page.waitForTimeout(300);
  const goalC = await page.locator(".plan-goal h2").innerText();
  const firstTask = await page.locator(".plan-timeline > div").first().innerText();
  note("C 计划-仅原题独立=站稳去括号这一步", goalC === "站稳去括号这一步" && /换一道同类新题/.test(firstTask), `goal=${goalC}`);
  await page.screenshot({ path: path.join(EV, "06-plan-profileC-once.png") });
  await ctx.close();
}

// ---------- 旧进度（无 statusTrail 字段）兼容 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem(
      "xiaon-progress-v1",
      JSON.stringify({
        version: 1,
        onboarded: true,
        onboardStep: 3,
        age: "under14",
        grade: "七年级",
        book: "人教版",
        necessary: true,
        guardian: "complete",
        longMemory: false,
        research: false,
        rest: false,
        questionInvitePaused: false,
        safety: false,
        tab: "成长",
        page: "report",
        activeTask: null,
        records: {
          bracket: {
            id: "bracket",
            attempts: [
              { id: "a1", value: "x-5", correct: false, hinted: false, time: "10/20 23:20" },
              { id: "a2", value: "x+5", correct: true, hinted: true, time: "10/20 23:21" },
            ],
            hint: true,
            paused: false,
            draft: "",
          },
        },
        calcSeen: ["bracket"],
        chat: [],
        chatDraft: "",
        chatStatus: "idle",
        pendingChat: "",
        plan: "accepted",
        planDate: "",
        helpContact: "我信任的老师",
        helpStatus: "none",
        unsafe: false,
        rights: "none",
        rightsScope: "学习目标与任务记录",
        uploadText: "3x − (2x − 5)",
        uploadConfirmed: false,
        storageNotice: "",
      }),
    );
  });
  await page.goto(BASE);
  await page.waitForTimeout(500);
  const calcTag = await page
    .locator(".report-item", { hasText: "计算" })
    .locator(".tag, [class*=tag]")
    .first()
    .innerText()
    .catch(() => "");
  const bodyOk = await page.locator(".report-item").count();
  const trailShown = await page.locator("text=/结论轨迹/").count();
  note("D 旧进度（无statusTrail）加载不崩溃", bodyOk === 5, `报告卡数=${bodyOk} 计算Tag=${calcTag} 轨迹行=${trailShown}(应为0)`);
  await page.screenshot({ path: path.join(EV, "07-legacy-progress.png") });
  await ctx.close();
}

await browser.close();
console.log("\n==== 汇总 ====");
console.log(results.filter((r) => !r.pass).length === 0 ? "ALL PASS" : `${results.filter((r) => !r.pass).length} FAILED`);
