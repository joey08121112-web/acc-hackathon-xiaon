// 阶段1复审 · 补充走查（修正导航后的第二轮，独立运行副本）
import { chromium } from "playwright";
import fs from "node:fs";

const EV = "/Users/ami/Documents/个人/ACC黑客松/audit-stage1-20261020-r2/evidence";
const results = {};
const check = (name, pass, detail = "") => {
  results[name] = { pass: !!pass, detail: String(detail) };
  console.log(`[audit2] ${pass ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
};
const shot = async (p, n) => { await p.screenshot({ path: `${EV}/${n}.png` }); };
const txt = async (p, n) => {
  fs.writeFileSync(`${EV}/${n}.txt`, await p.evaluate(() => document.body.innerText));
};
const soft = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, "EXCEPTION " + e.message.split("\n")[0]); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
const consoleMsgs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleMsgs.push({ type: m.type(), text: m.text() }); });
page.on("pageerror", (e) => consoleMsgs.push({ type: "pageerror", text: String(e) }));

try {
  await page.goto("http://127.0.0.1:5195/", { waitUntil: "networkidle", timeout: 30000 });

  // 欢迎页形象占比（正确选择器 .hero-art）
  await soft("welcome-hero", async () => {
    const box = await page.locator(".hero-art").boundingBox();
    const ratio = (box?.height ?? 0) / 844;
    check("welcome-hero-half", ratio >= 0.2 && ratio <= 0.65, `欢迎页形象高度 ${box?.height.toFixed(0)}px，占视口 ${(ratio * 100).toFixed(0)}%`);
  });

  // 快速完成首次介绍（走一次成功的监护确认演示）
  await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "发起监护人确认演示", exact: true }).click();
  await page.getByRole("button", { name: "模拟监护人阅读并确认", exact: true }).click();
  await page.getByRole("button", { name: "继续，选择可选功能", exact: true }).click();
  await page.getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true }).click();
  await page.getByRole("heading", { name: "今天，按你的节奏来。", exact: true }).waitFor();
  check("onboard-fast-pass", true);

  // 一起看题：完整 错误→提示→暂停→恢复→修改
  await soft("task-flow", async () => {
    await page.getByRole("button", { name: /一起看一道题/ }).first().click();
    await page.getByRole("button", { name: "我愿意，从示例题开始", exact: true }).waitFor();
    await shot(page, "32-task-confirm-dialog");
    await page.getByRole("button", { name: "我愿意，从示例题开始", exact: true }).click();
    await page.getByLabel("你的解题步骤").waitFor();
    await shot(page, "33-task"); await txt(page, "33-task");
    const t = await page.evaluate(() => document.body.innerText);
    check("task-question-visible", /3x − \(2x − 5\)|3x−\(2x−5\)|3x/.test(t), "题目在任务页可见");
    for (const b of ["我先试试", "给一点提示", "先暂停"]) {
      check(`task-btn-${b}`, (await page.getByRole("button", { name: b, exact: true }).count()) === 1);
    }
    check("task-btn-recognition", (await page.getByRole("button", { name: /题目识别错了/ }).count()) >= 1);
    check("task-focus-no-map", (await page.locator(".map-node").count()) === 0, "任务页无地图节点（专注模式）");
    await page.getByLabel("你的解题步骤").fill("x − 5");
    await page.getByRole("button", { name: "我先试试", exact: true }).click();
    await page.getByText("先停在这一步，一起看看。").waitFor();
    await shot(page, "34-wrong");
    await page.getByRole("button", { name: "给一点提示", exact: true }).click();
    await page.getByText("一级提示", { exact: true }).waitFor();
    await shot(page, "35-hint");
    await page.getByRole("button", { name: "先暂停", exact: true }).click();
    await page.waitForTimeout(500);
    await shot(page, "36-paused-home"); await txt(page, "36-paused-home");
    const th = await page.evaluate(() => document.body.innerText);
    check("pause-home-resume", /继续/.test(th), "暂停回主页保留继续入口");
    await page.getByRole("button", { name: /继续/ }).first().click();
    await page.getByLabel("你的解题步骤").waitFor();
    check("resume-draft", (await page.getByLabel("你的解题步骤").inputValue()) === "x − 5");
    check("resume-hint", (await page.getByText("一级提示", { exact: true }).count()) === 1);
    await page.getByLabel("你的解题步骤").fill("x + 5");
    await page.getByRole("button", { name: "提交修改", exact: true }).click();
    await page.getByText("你在提示后完成了这一步。").waitFor();
    await shot(page, "37-corrected-hinted");
  });

  // 报告：提示下完成 + 证据可追溯 + 不误标
  await soft("report-hinted", async () => {
    await page.getByRole("button", { name: "看看这次学习观察", exact: true }).click();
    await page.waitForTimeout(500);
    await shot(page, "38-report"); await txt(page, "38-report");
    const calc = page.locator(".report-item").filter({ has: page.getByRole("heading", { name: "计算", exact: true }) });
    check("report-status-hinted", (await calc.getByText("提示下完成", { exact: true }).count()) === 1);
    check("report-not-independent", (await calc.getByText("本次独立完成", { exact: true }).count()) === 0);
    const t = await page.evaluate(() => document.body.innerText);
    check("report-evidence-visible", /x − 5/.test(t) && /x \+ 5/.test(t), "报告直接可见两次作答记录");
    const expand = calc.getByRole("button", { name: /观察依据|展开|查看|记录/ }).first();
    if (await expand.count()) {
      await expand.click(); await page.waitForTimeout(300);
      await shot(page, "39-report-expanded"); await txt(page, "39-report-expanded");
      check("report-expand-works", true, "依据展开按钮存在且可点");
    } else {
      check("report-expand-works", false, "未找到展开按钮（依据可能直接展示）");
    }
  });

  // 地图五地点 + 维度命名观察
  await soft("map-places", async () => {
    await page.getByRole("button", { name: "探索", exact: true }).click();
    await page.waitForTimeout(500);
    await shot(page, "40-map-after-task"); await txt(page, "40-map-after-task");
    const t = await page.evaluate(() => document.body.innerText);
    const places = ["理解花园", "逻辑小桥", "计算工坊", "生活集市", "空间山丘"];
    check("map-five-places", places.every((k) => t.includes(k)), "五地点齐备");
    check("map-dimension-naming", /建模|空间想象/.test(t), `地图/列表是否出现维度名：${/建模|空间想象/.test(t) ? "是" : "否（仅在任务页与报告出现）"}`);
    check("map-calc-status-honest", /暂未完成|进行中|提示下完成/.test(t), "提示后完成不作“完成”展示（记录状态）");
  });

  // S1-01：320px 大字体地图字号
  await soft("s1-01-map-font", async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole("button", { name: "我的与设置", exact: true }).click();
    await page.getByRole("switch", { name: "大字体", exact: true }).click();
    await page.getByRole("button", { name: "探索", exact: true }).click();
    await page.waitForTimeout(600);
    const nodeCount = await page.locator(".map-node").count();
    check("s1-01-map-nodes-present", nodeCount > 0, `探索页地图节点数=${nodeCount}`);
    if (nodeCount === 0) { await txt(page, "40b-map-diagnosis"); return; }
    const large = await page.evaluate(() => ({
      name: getComputedStyle(document.querySelector(".map-node strong")).fontSize,
      status: getComputedStyle(document.querySelector(".map-node small")).fontSize,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    }));
    await shot(page, "41-map-320-large"); await txt(page, "41-map-320-large");
    await page.getByRole("button", { name: "我的与设置", exact: true }).click();
    await page.getByRole("switch", { name: "大字体", exact: true }).click();
    await page.getByRole("button", { name: "探索", exact: true }).click();
    await page.waitForTimeout(600);
    const normal = await page.evaluate(() => ({
      name: getComputedStyle(document.querySelector(".map-node strong")).fontSize,
      status: getComputedStyle(document.querySelector(".map-node small")).fontSize,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    }));
    await shot(page, "42-map-320-normal"); await txt(page, "42-map-320-normal");
    fs.writeFileSync(`${EV}/map-font-metrics.json`, JSON.stringify({ large, normal }, null, 2));
    const px = (s) => parseFloat(s);
    check("s1-01-large-name", px(large.name) >= px(normal.name) * 1.2, `地点名 ${normal.name} → ${large.name}`);
    check("s1-01-large-status", px(large.status) >= px(normal.status) * 1.2, `状态 ${normal.status} → ${large.status}`);
    check("s1-01-normal-status-size", px(normal.status) >= 11.9, `普通模式状态字号 ${normal.status}（约12px）`);
    check("s1-01-no-overflow", large.overflowX <= 0 && normal.overflowX <= 0, `320px 横向溢出 large=${large.overflowX} normal=${normal.overflowX}`);
  });

  // 430px 抽查
  await soft("w430", async () => {
    await page.setViewportSize({ width: 430, height: 844 });
    await page.getByRole("button", { name: "小N", exact: true }).click();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("w430-home-no-overflow", overflow <= 0, `430px主页溢出=${overflow}px`);
    await shot(page, "43-home-430");
  });
} finally {
  fs.writeFileSync(`${EV}/audit-run2.json`, JSON.stringify({ startedAt: new Date().toISOString(), results }, null, 2));
  fs.writeFileSync(`${EV}/console2.json`, JSON.stringify(consoleMsgs, null, 2));
  await browser.close();
}
const pass = Object.values(results).filter((r) => r.pass).length;
const fail = Object.values(results).filter((r) => !r.pass).length;
console.log(`[audit2] DONE pass=${pass} fail=${fail}`);
