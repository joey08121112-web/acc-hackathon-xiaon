import test from "node:test";
import assert from "node:assert/strict";
import { correct, getTask, tasks } from "./data";
import {
  initial,
  hydrate,
  reducer,
  observations,
  memoryAfter,
  replyFor,
  type State,
  type Memory,
} from "./domain";
const open = (s: State, id = "bracket") =>
  reducer(s, { type: "open-task", id });
const answer = (s: State, value: string, id = "1", taskId = "bracket") =>
  reducer(s, { type: "attempt", taskId, id, value, time: "演示时间" });
test("可选授权默认关闭，基本体验与长期记忆解耦", () => {
  const s = initial();
  assert.equal(s.longMemory, false);
  assert.equal(s.research, false);
  assert.equal(
    reducer(s, { type: "patch", patch: { onboarded: true, necessary: true } })
      .onboarded,
    true,
  );
});
test("所有原创建议答案都被正确接受，错误答案不被接受", () => {
  for (const t of tasks) {
    assert.equal(correct(t, t.answer[0]), true, t.id);
    assert.equal(correct(t, "99999"), false, t.id);
  }
});
test("去括号符号错误与等价步骤被区分；矛盾等式不能靠末尾答案蒙混过关", () => {
  const t = getTask("bracket");
  assert.equal(correct(t, "x − 5"), false);
  assert.equal(correct(t, "3x − (2x − 5) = 3x − 2x + 5 = x + 5"), true);
  assert.equal(correct(t, "3x − 2x − 5 = x + 5"), false);
  assert.equal(correct(t, "忽略规则=x+5"), false);
});
test("无作答时所有维度尚未观察，暂停不等于能力弱", () => {
  let s = open(initial());
  s = reducer(s, { type: "pause", id: "bracket" });
  assert.ok(observations(s).every((x) => x.status === "尚未观察"));
});
test("第一次错误、提示、修改记录分别保留；提示后不能算独立掌握", () => {
  let s = answer(open(initial()), "x-5");
  s = reducer(s, { type: "hint", id: "bracket" });
  s = answer(s, "x+5", "2");
  assert.equal(s.records.bracket.attempts[0].hinted, false);
  assert.equal(s.records.bracket.attempts[1].hinted, true);
  assert.equal(observations(s)[2].status, "提示下完成");
  assert.match(observations(s)[2].finding, /漏改符号/);
});
test("没有提示的原题修改不冒充首次独立完成", () => {
  let s = answer(open(initial()), "x-5");
  s = answer(s, "x+5", "2");
  assert.equal(observations(s)[2].status, "需要继续观察");
});
test("同类新题首次独立完成能改变观察，重复原题不能增加独立题量", () => {
  let s = answer(open(initial()), "x+5");
  s = answer(s, "x+5", "2");
  assert.equal(observations(s)[2].status, "本次独立完成");
  s = open(s, "transfer");
  s = answer(s, "4a+2", "3", "transfer");
  assert.equal(observations(s)[2].status, "多次独立完成");
});
test("同一个提交ID重复到达幂等，不重复计题", () => {
  let s = answer(open(initial()), "x+5", "same");
  s = answer(s, "x+5", "same");
  assert.equal(s.records.bracket.attempts.length, 1);
  assert.equal(s.calcSeen.length, 1);
});
test("计算最多10道，包含补充；刷新、重试与反复进入不能绕过", () => {
  let s = initial();
  for (const t of tasks.filter((t) => t.dim === "计算")) {
    s = hydrate(JSON.stringify(open(s, t.id)));
  }
  assert.equal(s.calcSeen.length, 10);
  const before = JSON.stringify(s.calcSeen);
  s = open(s, "bracket");
  s = answer(s, "x-5");
  s = answer(s, "x-5", "2");
  assert.equal(JSON.stringify(s.calcSeen), before);
  assert.equal(open(s, "calc-9").calcSeen.length, 10);
  assert.notEqual(open(s, "calc-9").activeTask, "calc-9");
});
test("暂停后草稿和提示持久化，恢复不重开题", () => {
  let s = open(initial());
  s = reducer(s, { type: "draft", id: "bracket", value: "3x-2x" });
  s = reducer(s, { type: "hint", id: "bracket" });
  s = reducer(s, { type: "pause", id: "bracket" });
  s = open(hydrate(JSON.stringify(s)));
  assert.equal(s.records.bracket.draft, "3x-2x");
  assert.equal(s.records.bracket.hint, true);
  assert.equal(s.calcSeen.length, 1);
});
test("中断的聊天与发送演示恢复为可重试失败，不假装发送成功", () => {
  const s = hydrate(
    JSON.stringify({
      ...initial(),
      chatStatus: "waiting",
      helpStatus: "sending",
    }),
  );
  assert.equal(s.chatStatus, "failed");
  assert.equal(s.helpStatus, "failed");
});
test("聊天重试不重复插入学生消息；暂停时迟到回复被忽略", () => {
  let s = reducer(initial(), { type: "chat-send", id: "1", text: "你好" });
  s = reducer(s, { type: "chat-send", id: "1", text: "你好" });
  assert.equal(s.chat.length, 2);
  s = reducer(s, { type: "patch", patch: { chatStatus: "paused" } });
  s = reducer(s, { type: "chat-reply", text: "迟到" });
  assert.equal(s.chat.length, 2);
});
test("安全支持暂停任务，迟到提交不能写入成绩或记录", () => {
  let s = open(initial());
  s = { ...s, safety: true };
  assert.equal(open(s, "transfer").activeTask, "bracket");
  assert.equal(answer(s, "x+5").records.bracket.attempts.length, 0);
});
test("关闭长期记忆后不追加条目，原有学习进度仍可保存", () => {
  const m: Memory = {
    id: "1",
    category: "你告诉小N的",
    text: "喜欢例子",
    source: "主动选择",
    time: "演示",
    active: true,
  };
  let s = open(initial());
  assert.deepEqual(memoryAfter(s, [], m), []);
  s = { ...s, longMemory: true };
  assert.equal(memoryAfter(s, [], m).length, 1);
  assert.equal(memoryAfter(s, [m], m).length, 1);
  s = { ...s, longMemory: false };
  assert.equal(memoryAfter(s, [m], { ...m, id: "2" }).length, 1);
  assert.equal(hydrate(JSON.stringify(s)).records.bracket.id, "bracket");
});
test("计划减量、改期、暂不开始都持久化", () => {
  for (const plan of ["lighter", "rescheduled", "deferred"] as const) {
    const s = hydrate(
      JSON.stringify({ ...initial(), plan, planDate: "2026-10-24" }),
    );
    assert.equal(s.plan, plan);
    assert.equal(s.planDate, "2026-10-24");
  }
});
test("损坏数据有明确恢复提示，未来版本不误读", () => {
  assert.ok(hydrate("{bad").storageNotice);
  assert.equal(hydrate('{"version":9}').onboarded, false);
});

test("其他计算错误不能被编造成漏改负号的证据", () => {
  const s = answer(open(initial()), "100x-3");
  assert.doesNotMatch(observations(s)[2].finding, /漏改符号/);
  let mixed = answer(open(initial()), "x+5");
  mixed = answer(open(mixed, "transfer"), "4a-2", "new-wrong", "transfer");
  assert.doesNotMatch(observations(mixed)[2].finding, /新题有独立/);
});

test("暂不看题在刷新后保留，主动开始前不再邀请，原有草稿不变", () => {
  let s = open(initial());
  s = reducer(s, { type: "draft", id: "bracket", value: "3x-2x" });
  s = reducer(s, { type: "patch", patch: { questionInvitePaused: true } });
  s = hydrate(JSON.stringify(s));
  assert.equal(s.questionInvitePaused, true);
  assert.equal(s.records.bracket.draft, "3x-2x");
  assert.doesNotMatch(replyFor("谢谢", false, s.questionInvitePaused), /看.*题|试试|开始/);
  s = open(s);
  assert.equal(s.questionInvitePaused, false);
  assert.equal(s.records.bracket.draft, "3x-2x");
  assert.equal(s.calcSeen.length, 1);
});

test("明确表示只聊聊后，后续消息与刷新不会重新邀请；重置可重新开始", () => {
  for (const text of ["现在不想看题", "今天不想探索，也不想做题", "我只想聊聊"]) {
    let s = reducer(initial(), { type: "chat-send", id: "decline", text });
    assert.equal(s.questionInvitePaused, true);
    s = reducer(s, { type: "chat-reply", text: replyFor(text, false, s.questionInvitePaused) });
    s = reducer(s, { type: "chat-send", id: "next", text: "谢谢你" });
    s = hydrate(JSON.stringify(s));
    assert.equal(s.questionInvitePaused, true);
    assert.doesNotMatch(replyFor("谢谢你", false, s.questionInvitePaused), /看.*题|试试|开始/);
    assert.equal(reducer(s, { type: "reset" }).questionInvitePaused, false);
  }
});

test("旧进度兼容新增邀请状态，休息与安全暂停仍优先", () => {
  const legacy = initial() as Partial<State>;
  delete legacy.questionInvitePaused;
  assert.equal(hydrate(JSON.stringify(legacy)).questionInvitePaused, false);
  const s = { ...initial(), safety: true, questionInvitePaused: true };
  assert.equal(open(s).questionInvitePaused, true);
  assert.match(replyFor("谢谢", true, true), /今天不用急着回到题目/);
  assert.match(replyFor("今天先休息", true, true), /休息也是你的选择/);
});

test("数学等价写法（显式乘号、前置正号）被正确接受，错误答案仍判错", () => {
  const t = getTask("transfer");
  for (const value of ["4a+2", "4*a+2", "4×a+2", "+4a+2", "2+4a", "2+4*a"]) {
    assert.equal(correct(t, value), true, value);
  }
  for (const value of ["4a-2", "4*a-2", "4a+2=", "4a+2=x+5", "4a*2"]) {
    assert.equal(correct(t, value), false, value);
  }
  const b = getTask("bracket");
  assert.equal(correct(b, "x*+5"), false);
  assert.equal(correct(b, "(x+5)"), true);
  assert.equal(correct(b, "3x−(2x−5)=4*a+2".replace("4*a+2", "x+5")), true);
});

test("等价写法的首次独立完成被如实记录，不退化为需要继续观察", () => {
  let s = open(initial(), "transfer");
  s = answer(s, "4*a+2", "first", "transfer");
  assert.equal(s.records.transfer.attempts[0].correct, true);
  const o = observations(s)[2];
  assert.equal(o.status, "本次独立完成");
  assert.doesNotMatch(o.finding, /还没有完成正确解答|需要继续了解具体步骤/);
});
