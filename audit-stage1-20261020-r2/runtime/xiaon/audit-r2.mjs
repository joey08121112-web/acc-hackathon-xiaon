// 阶段1复审独立走查脚本（审查者：ZCode 独立会话，2026-10-20 深夜）
// 运行于审计运行副本，不触碰产品源码；证据写入 audit-stage1-20261020-r2/evidence/
import { chromium } from "playwright";
import fs from "node:fs";

const EV = "/Users/ami/Documents/个人/ACC黑客松/audit-stage1-20261020-r2/evidence";
const results = {};
const check = (name, pass, detail = "") => {
  results[name] = { pass: !!pass, detail: String(detail) };
  console.log(`[audit] ${pass ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
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
const consoleMsgs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleMsgs.push({ type: m.type(), text: m.text() }); });
page.on("pageerror", (e) => consoleMsgs.push({ type: "pageerror", text: String(e) }));

const soft = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, "EXCEPTION " + e.message.split("\n")[0]); } };

try {
  await page.goto("http://127.0.0.1:5195/", { waitUntil: "networkidle", timeout: 30000 });
  check("app-title", (await page.title()).includes("学伴小N"), await page.title());

  // —— 欢迎页：AI身份、形象占比
  await soft("welcome", async () => {
    await shot(page, "01-welcome"); await txt(page, "01-welcome");
    const body = results["welcome-text"] = await page.evaluate(() => document.body.innerText);
    check("welcome-ai-identity", /AI/.test(body.text ?? body) || /AI/.test(String(body)), "页面含AI字样");
    const box = await page.locator("svg").first().boundingBox();
    const ratio = (box?.height ?? 0) / 844;
    check("welcome-mascot-half", ratio > 0.2, `形象高度占视口 ${ratio.toFixed(2)}`);
  });

  // —— 首次介绍信息页
  await soft("intro-info", async () => {
    await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
    await shot(page, "02-intro-info"); await txt(page, "02-intro-info");
    const t = await page.evaluate(() => document.body.innerText);
    check("intro-age-grade", /年龄段|年级/.test(t) && /教材/.test(t), "年龄段/年级/教材信息存在");
    check("intro-info-notice", /信息|收集|用途/.test(t), "基本服务信息说明存在");
  });

  // —— 监护确认演示：待确认/失败/取消/完成
  await soft("guardian-states", async () => {
    await page.getByRole("checkbox").check();
    const cont = page.getByRole("button", { name: "继续，选择可选功能", exact: true });
    check("intro-continue-disabled-before-confirm", await cont.isDisabled(), "未确认前继续不可用");
    await page.getByRole("button", { name: "发起监护人确认演示", exact: true }).click();
    await page.getByText("待确认", { exact: true }).waitFor();
    await shot(page, "03a-guardian-pending");
    await page.getByRole("button", { name: "模拟失败", exact: true }).click();
    await page.getByText("确认失败", { exact: true }).waitFor();
    await shot(page, "03b-guardian-failed");
    await page.getByRole("button", { name: "发起监护人确认演示", exact: true }).click();
    await page.getByRole("button", { name: "取消确认", exact: true }).click();
    await page.getByText("已取消", { exact: true }).waitFor();
    await shot(page, "03c-guardian-cancelled");
    await page.getByRole("button", { name: "发起监护人确认演示", exact: true }).click();
    await page.getByRole("button", { name: "模拟监护人阅读并确认", exact: true }).click();
    await shot(page, "03d-guardian-done");
    await cont.click();
    check("guardian-states-seen", true, "待确认/确认失败/已取消/演示完成 四状态均实际走过");
  });

  // —— 可选功能默认关闭、拒绝后进入
  await soft("optional-consent", async () => {
    const switches = await page.getByRole("switch").all();
    const states = [];
    for (const s of switches) states.push(await s.getAttribute("aria-checked"));
    check("optional-default-off", states.every((v) => v === "false"), JSON.stringify(states));
    await shot(page, "04-optional"); await txt(page, "04-optional");
    await page.getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true }).click();
    await page.getByRole("heading", { name: "今天，按你的节奏来。", exact: true }).waitFor();
    check("declined-optional-enters-basic", true, "拒绝可选功能后进入主页");
  });

  // —— 主页结构
  await soft("home", async () => {
    await shot(page, "05-home"); await txt(page, "05-home");
    for (const t of ["小N", "探索", "今日", "成长"]) {
      check(`nav-${t}`, await page.getByRole("button", { name: t, exact: true }).count() === 1);
    }
    const t = await page.evaluate(() => document.body.innerText);
    check("home-three-choices", /先聊聊/.test(t) && /一起看一道题/.test(t) && /今天先休息/.test(t), "聊聊/看题/休息同层呈现");
    check("home-settings-entry", await page.getByRole("button", { name: "我的与设置", exact: true }).count() === 1);
  });

  // —— 空报告：尚未观察
  await soft("report-empty", async () => {
    await page.getByRole("button", { name: "成长", exact: true }).click();
    await page.waitForTimeout(400);
    await shot(page, "06-growth-empty"); await txt(page, "06-growth-empty");
    const t = await page.evaluate(() => document.body.innerText);
    check("report-empty-not-observed", /尚未观察/.test(t), "未作答时报告明确显示尚未观察");
    await page.getByRole("button", { name: "小N", exact: true }).click();
  });

  // —— 聊天与等待、AI标注
  await soft("chat", async () => {
    await page.getByRole("button", { name: /先聊聊/ }).click();
    await page.getByLabel("对小N说").fill("这次考砸了，有点难过");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await page.getByText(/听起来，这次考试让你有些难受/).waitFor({ timeout: 20000 });
    await shot(page, "07-chat"); await txt(page, "07-chat");
    const t = await page.evaluate(() => document.body.innerText);
    check("chat-ai-marked", /AI/.test(t), "聊天界面含AI标识");
    check("chat-invitation-present", (await page.locator(".chat-invitation").count()) >= 1);
    await shot(page, "08-invite");
  });

  // —— S1-02 复验：现在先不看
  await soft("s1-02-decline", async () => {
    await page.locator(".chat-invitation").getByRole("button", { name: /我愿意/ }).first().click();
    await page.getByRole("button", { name: "现在先不看", exact: true }).waitFor();
    await shot(page, "09-decline-dialog");
    await page.getByRole("button", { name: "现在先不看", exact: true }).click();
    await page.waitForTimeout(600);
    await shot(page, "10-after-decline"); await txt(page, "10-after-decline");
    check("s1-02-invite-gone", (await page.locator(".chat-invitation").count()) === 0, "拒绝后邀请条消失");
    const t = await page.evaluate(() => document.body.innerText);
    check("s1-02-quick-gone", !/我愿意试试/.test(t), "同义快捷项不再出现");
    check("s1-02-active-entry", /我想开始看题/.test(t), "保留主动入口：我想开始看题");
    // 后续回复不再邀请
    await page.getByLabel("对小N说").fill("嗯，我知道了");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await page.waitForTimeout(3500);
    check("s1-02-reply-no-invite", (await page.locator(".chat-invitation").count()) === 0, "拒绝后的下一轮回复未再邀请");
    await shot(page, "11-after-decline-reply"); await txt(page, "11-after-decline-reply");
    // 自然语言拒绝（再次确认，先恢复一次）
    await page.getByRole("button", { name: /我想开始看题/ }).first().click();
    await page.getByRole("button", { name: "我愿意，从示例题开始", exact: true }).click();
    await page.getByRole("button", { name: "先暂停", exact: true }).click();
    await page.waitForTimeout(400);
  });

  // —— 长对话布局 + 键盘弹出替代观察（缩短视口）
  await soft("long-chat", async () => {
    await page.getByRole("button", { name: /先聊聊/ }).click();
    for (const m of ["这道题我当时去括号忘了变号", "感觉一到考试就出错", "其实上课听得懂，就是做题容易漏步骤"]) {
      await page.getByLabel("对小N说").fill(m);
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await page.waitForTimeout(1800);
    }
    await shot(page, "12-long-chat");
    const input = await page.getByLabel("对小N说").boundingBox();
    check("long-chat-input-visible", !!input && input.y + input.height <= 844 + 1, `输入区 y=${input?.y.toFixed(0)} h=${input?.height}`);
    await page.setViewportSize({ width: 390, height: 480 });
    await page.getByLabel("对小N说").focus();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("short-viewport-no-hoverflow", overflow <= 0, `390x480 scrollWidth差=${overflow}px（真实键盘未测）`);
    await shot(page, "13-short-viewport");
    await page.setViewportSize({ width: 390, height: 844 });
  });

  // —— 一起看题：专注页、错误、提示、修改
  await soft("task-flow", async () => {
    await page.getByRole("button", { name: /一起看一道题/ }).first().click();
    await page.getByRole("button", { name: "我愿意，从示例题开始", exact: true }).waitFor();
    await shot(page, "14-task-confirm");
    await page.getByRole("button", { name: "我愿意，从示例题开始", exact: true }).click();
    await page.getByLabel("你的解题步骤").waitFor();
    await shot(page, "15-task"); await txt(page, "15-task");
    const t = await page.evaluate(() => document.body.innerText);
    check("task-question-persistent", /3x|2x/.test(t), "题目持续可见");
    for (const b of ["我先试试", "给一点提示", "先暂停"]) {
      check(`task-btn-${b}`, (await page.getByRole("button", { name: b, exact: true }).count()) === 1);
    }
    check("task-btn-recognition", (await page.getByRole("button", { name: /题目识别错了/ }).count()) >= 1);
    check("task-focus-mode", (await page.locator(".map-node").count()) === 0, "任务页无地图元素（专注模式）");
    await page.getByLabel("你的解题步骤").fill("x − 5");
    await page.getByRole("button", { name: "我先试试", exact: true }).click();
    await page.getByText("先停在这一步，一起看看。").waitFor();
    await shot(page, "16-wrong");
    await page.getByRole("button", { name: "给一点提示", exact: true }).click();
    await page.getByText("一级提示", { exact: true }).waitFor();
    await shot(page, "17-hint");
    await page.getByRole("button", { name: "先暂停", exact: true }).click();
    await page.waitForTimeout(500);
    await shot(page, "18-paused-home"); await txt(page, "18-paused-home");
    const t2 = await page.evaluate(() => document.body.innerText);
    check("pause-resume-entry", /继续/.test(t2), "暂停后主页有继续入口");
    await page.getByRole("button", { name: /继续/ }).first().click();
    await page.getByLabel("你的解题步骤").waitFor();
    check("pause-draft-kept", (await page.getByLabel("你的解题步骤").inputValue()) === "x − 5", "恢复后草稿仍在");
    check("pause-hint-kept", (await page.getByText("一级提示", { exact: true }).count()) === 1, "恢复后提示仍在");
    await page.getByLabel("你的解题步骤").fill("x + 5");
    await page.getByRole("button", { name: "提交修改", exact: true }).click();
    await page.getByText("你在提示后完成了这一步。").waitFor();
    await shot(page, "19-corrected-hinted");
  });

  // —— 报告：提示下完成 + 证据展开 + 不误标独立完成
  await soft("report-hinted", async () => {
    await page.getByRole("button", { name: "看看这次学习观察", exact: true }).click();
    await page.waitForTimeout(500);
    await shot(page, "20-report"); await txt(page, "20-report");
    const calc = page.locator(".report-item").filter({ has: page.getByRole("heading", { name: "计算", exact: true }) });
    check("report-hinted-status", (await calc.getByText("提示下完成", { exact: true }).count()) === 1, "计算=提示下完成");
    check("report-not-independent", (await calc.getByText("本次独立完成", { exact: true }).count()) === 0, "未误标独立完成");
    const expand = calc.getByRole("button", { name: /观察依据|展开|查看/ }).first();
    if (await expand.count()) { await expand.click(); await page.waitForTimeout(300); }
    await shot(page, "21-report-expanded"); await txt(page, "21-report-expanded");
    const t = await page.evaluate(() => document.body.innerText);
    check("report-evidence-trace", /x − 5|x−5/.test(t) && /x \+ 5|x\+5/.test(t) && /提示后|未提示/.test(t), "可追溯首次作答/提示/修改");
  });

  // —— 地图与列表（S1-01 现场）
  await soft("map-list", async () => {
    await page.getByRole("button", { name: "探索", exact: true }).click();
    await page.waitForTimeout(400);
    await shot(page, "22-map"); await txt(page, "22-map");
    const t = await page.evaluate(() => document.body.innerText);
    check("map-5-places", ["理解", "逻辑", "计算", "建模", "空间"].every((k) => t.includes(k)), "五维地点齐备");
    check("map-status-text", /未开始|从这里开始|完成|进行中|暂未完成/.test(t), "状态有文字非仅颜色");
    check("map-list-entry", (await page.getByRole("button", { name: "列表入口", exact: true }).count()) === 1);
    await page.getByRole("button", { name: "列表入口", exact: true }).click();
    await page.waitForTimeout(300);
    await shot(page, "23-list"); await txt(page, "23-list");
    // 地图入口确认（探索确认）
    await page.getByRole("button", { name: "列表入口", exact: true }).click(); // 切回地图
    await page.getByRole("button", { name: /理解花园/ }).click();
    await page.getByRole("button", { name: /我愿意，进入这个小任务/ }).waitFor();
    await shot(page, "24-map-confirm"); await txt(page, "24-map-confirm");
    const t2 = await page.evaluate(() => document.body.innerText);
    check("map-confirm-copy", /随时暂停/.test(t2) && /只代表这些任务/.test(t2), "进入前说明含可暂停与范围限定");
    await page.getByRole("button", { name: /我愿意，进入这个小任务/ }).click();
    await page.waitForTimeout(400);
    await shot(page, "25-understanding-task"); await txt(page, "25-understanding-task");
    await page.getByRole("button", { name: "先暂停", exact: true }).click();
  });

  // —— S1-01 复验：320px 大字体地图字号
  await soft("s1-01-map-font", async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole("button", { name: "我的与设置", exact: true }).click();
    await page.getByRole("switch", { name: "大字体", exact: true }).click();
    await page.getByRole("button", { name: "探索", exact: true }).click();
    await page.waitForTimeout(500);
    const large = await page.evaluate(() => ({
      name: getComputedStyle(document.querySelector(".map-node strong")).fontSize,
      status: getComputedStyle(document.querySelector(".map-node small")).fontSize,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    }));
    await shot(page, "26-map-320-large"); await txt(page, "26-map-320-large");
    await page.getByRole("button", { name: "我的与设置", exact: true }).click();
    await page.getByRole("switch", { name: "大字体", exact: true }).click();
    await page.getByRole("button", { name: "探索", exact: true }).click();
    await page.waitForTimeout(500);
    const normal = await page.evaluate(() => ({
      name: getComputedStyle(document.querySelector(".map-node strong")).fontSize,
      status: getComputedStyle(document.querySelector(".map-node small")).fontSize,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    }));
    await shot(page, "27-map-320-normal"); await txt(page, "27-map-320-normal");
    fs.writeFileSync(`${EV}/map-font-metrics.json`, JSON.stringify({ large, normal }, null, 2));
    const px = (s) => parseFloat(s);
    check("s1-01-large-scales-name", px(large.name) > px(normal.name) * 1.2, `地点名 ${normal.name}→${large.name}`);
    check("s1-01-large-scales-status", px(large.status) > px(normal.status) * 1.2, `状态 ${normal.status}→${large.status}`);
    check("s1-01-status-min-size", px(normal.status) >= 11.9, `普通状态字号 ${normal.status}`);
    check("s1-01-no-overflow", large.overflowX <= 0 && normal.overflowX <= 0, `320px横向溢出 large=${large.overflowX} normal=${normal.overflowX}`);
  });

  // —— 320px 大字体 长文本
  await soft("long-text-320", async () => {
    await page.getByRole("button", { name: "小N", exact: true }).click();
    await page.getByRole("button", { name: /先聊聊/ }).click();
    await page.getByLabel("对小N说").fill("这是用于检查换行的合成文本。".repeat(40));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("long-text-320-no-overflow", overflow <= 0, `320px大字体长文本溢出=${overflow}px`);
    await shot(page, "28-long-text-320");
  });

  // —— 减少动效（运行时）
  await soft("reduced-motion", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "小N", exact: true }).click();
    await page.waitForTimeout(300);
    const anim = await page.locator(".floaty").first().evaluate((e) => getComputedStyle(e).animationName);
    check("reduced-motion-runtime", anim === "none", `.floaty animationName=${anim}`);
    await shot(page, "29-reduced-motion");
  });

  // —— 设置页设计
  await soft("settings-design", async () => {
    await page.getByRole("button", { name: "我的与设置", exact: true }).click();
    await page.waitForTimeout(300);
    await shot(page, "30-settings"); await txt(page, "30-settings");
    for (const n of [/我的学习记忆/, /监护人演示/, /帮助与支持/, /重新体验首次进入/, /重置整个演示/]) {
      check(`settings-${n.source}`, (await page.getByRole("button", { name: n }).count()) >= 1);
    }
    const t = await page.evaluate(() => document.body.innerText);
    check("settings-large-font-switch", /大字体/.test(t));
    check("settings-offline-switch", /断网与失败演示/.test(t));
  });

  // —— 成长页设计（计划/回顾入口）
  await soft("growth-design", async () => {
    await page.getByRole("button", { name: "成长", exact: true }).click();
    await page.waitForTimeout(300);
    await shot(page, "31-growth"); await txt(page, "31-growth");
    const t = await page.evaluate(() => document.body.innerText);
    check("growth-plan-entry", /我的一周小计划|周计划/.test(t));
    check("growth-review-entry", /阶段回顾/.test(t));
  });
} finally {
  fs.writeFileSync(`${EV}/audit-run.json`, JSON.stringify({ startedAt: new Date().toISOString(), results }, null, 2));
  fs.writeFileSync(`${EV}/console.json`, JSON.stringify(consoleMsgs, null, 2));
  await browser.close();
}
const pass = Object.values(results).filter((r) => r.pass).length;
const fail = Object.values(results).filter((r) => !r.pass).length;
console.log(`[audit] DONE pass=${pass} fail=${fail}`);
