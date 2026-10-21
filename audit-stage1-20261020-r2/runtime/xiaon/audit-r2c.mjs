// 阶段1复审 · 第三轮补测：报告证据展开（details/summary）、能力说明弹窗、任务页长公式
import { chromium } from "playwright";
import fs from "node:fs";

const EV = "/Users/ami/Documents/个人/ACC黑客松/audit-stage1-20261020-r2/evidence";
const results = {};
const check = (name, pass, detail = "") => {
  results[name] = { pass: !!pass, detail: String(detail) };
  console.log(`[audit3] ${pass ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
};
const shot = async (p, n) => { await p.screenshot({ path: `${EV}/${n}.png` }); };
const txt = async (p, n) => {
  fs.writeFileSync(`${EV}/${n}.txt`, await p.evaluate(() => document.body.innerText));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
try {
  await page.goto("http://127.0.0.1:5195/", { waitUntil: "networkidle", timeout: 30000 });
  await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "发起监护人确认演示", exact: true }).click();
  await page.getByRole("button", { name: "模拟监护人阅读并确认", exact: true }).click();
  await page.getByRole("button", { name: "继续，选择可选功能", exact: true }).click();
  await page.getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true }).click();
  await page.getByRole("heading", { name: "今天，按你的节奏来。", exact: true }).waitFor();

  // 聊天 → 能力说明弹窗
  await page.getByRole("button", { name: /先聊聊/ }).click();
  await page.getByRole("button", { name: "能力说明", exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, "44-ai-capability"); await txt(page, "44-ai-capability");
  const cap = await page.evaluate(() => document.body.innerText);
  check("ai-capability-boundaries",
    /AI/.test(cap) && /不诊断心理疾病|不作智力/.test(cap) && /不承诺治疗|保证提高成绩/.test(cap),
    "能力说明含AI身份与不作诊断/不承诺边界");
  check("ai-capability-local-demo", /本地|预设|演示/.test(cap), "说明回复为本地演示、不伪装真实模型");
  await page.getByRole("button", { name: "我了解了", exact: true }).click();
  await page.getByRole("button", { name: "小N", exact: true }).click(); // 聊天页经底部导航返回主页
  await page.waitForTimeout(300);

  // 看题 → 长公式输入不溢出 → 错→提示→改
  await page.getByRole("button", { name: /一起看一道题/ }).first().click();
  await page.getByRole("button", { name: "我愿意，从示例题开始", exact: true }).click();
  await page.getByLabel("你的解题步骤").waitFor();
  await page.getByLabel("你的解题步骤").fill("3x − (2x − 5) = 3x − 2x + 5 = x + 5，这是用于检查长公式换行的合成步骤文本，继续延长以观察布局。");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("long-formula-no-overflow", overflow <= 0, `长公式输入横向溢出=${overflow}px`);
  await shot(page, "45-long-formula-task");
  await page.getByLabel("你的解题步骤").fill("x − 5");
  await page.getByRole("button", { name: "我先试试", exact: true }).click();
  await page.getByText("先停在这一步，一起看看。").waitFor();
  await page.getByRole("button", { name: "给一点提示", exact: true }).click();
  await page.getByText("一级提示", { exact: true }).waitFor();
  await page.getByLabel("你的解题步骤").fill("x + 5");
  await page.getByRole("button", { name: "提交修改", exact: true }).click();
  await page.getByText("你在提示后完成了这一步。").waitFor();

  // 报告证据展开（details/summary）
  await page.getByRole("button", { name: "看看这次学习观察", exact: true }).click();
  await page.waitForTimeout(500);
  const calc = page.locator(".report-item").filter({ has: page.getByRole("heading", { name: "计算", exact: true }) });
  await calc.locator("summary").click();
  await page.waitForTimeout(300);
  await shot(page, "46-report-evidence-expanded"); await txt(page, "46-report-evidence-expanded");
  const ev = await calc.locator(".evidence-entry").innerText();
  check("evidence-first-attempt", /首次：x − 5/.test(ev) && /待继续观察/.test(ev) && /未用提示/.test(ev), "首次作答x−5·待继续观察·未用提示");
  check("evidence-revision", /修改：x \+ 5/.test(ev) && /正确/.test(ev) && /已用提示/.test(ev), "修改x+5·正确·已用提示");
  check("evidence-hint-record", /提示：/.test(ev), "提示内容有记录");
  const openAttr = await calc.locator("details").evaluate((d) => d.open);
  check("evidence-details-toggle", openAttr === true, "details 展开状态=true");
} catch (e) {
  check("run3-exception", false, String(e.message).split("\n")[0]);
} finally {
  fs.writeFileSync(`${EV}/audit-run3.json`, JSON.stringify({ startedAt: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
const pass = Object.values(results).filter((r) => r.pass).length;
const fail = Object.values(results).filter((r) => !r.pass).length;
console.log(`[audit3] DONE pass=${pass} fail=${fail}`);
