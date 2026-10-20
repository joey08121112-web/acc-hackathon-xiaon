import {
  correct,
  dimensions,
  getTask,
  normalize,
  type Dimension,
} from "./data";
export const PROGRESS_KEY = "xiaon-progress-v1",
  MEMORY_KEY = "xiaon-memory-v1";
export type Attempt = {
  id: string;
  value: string;
  correct: boolean;
  hinted: boolean;
  time: string;
};
export type RecordItem = {
  id: string;
  attempts: Attempt[];
  hint: boolean;
  paused: boolean;
  draft: string;
};
export type Chat = { id: string; role: "ai" | "user"; text: string };
export type Memory = {
  id: string;
  category: "你告诉小N的" | "学习过程中记录的" | "目前的学习观察";
  text: string;
  source: string;
  time: string;
  active: boolean;
};
export type State = {
  version: 1;
  onboarded: boolean;
  onboardStep: number;
  age: string;
  grade: string;
  book: string;
  necessary: boolean;
  guardian: "none" | "pending" | "complete" | "failed" | "cancelled";
  longMemory: boolean;
  research: boolean;
  rest: boolean;
  questionInvitePaused: boolean;
  safety: boolean;
  tab: string;
  page: string;
  activeTask: string | null;
  records: Record<string, RecordItem>;
  calcSeen: string[];
  chat: Chat[];
  chatDraft: string;
  chatStatus: "idle" | "waiting" | "failed" | "paused";
  pendingChat: string;
  plan: "none" | "accepted" | "lighter" | "rescheduled" | "deferred";
  planDate: string;
  helpContact: string;
  helpStatus: "none" | "confirm" | "sending" | "sent" | "failed";
  unsafe: boolean;
  rights: "none" | "verify" | "processing" | "result";
  rightsScope: string;
  uploadText: string;
  uploadConfirmed: boolean;
  storageNotice: string;
};
export function initial(): State {
  return {
    version: 1,
    onboarded: false,
    onboardStep: 0,
    age: "under14",
    grade: "七年级",
    book: "人教版",
    necessary: false,
    guardian: "none",
    longMemory: false,
    research: false,
    rest: false,
    questionInvitePaused: false,
    safety: false,
    tab: "小N",
    page: "home",
    activeTask: null,
    records: {},
    calcSeen: [],
    chat: [
      { id: "hello", role: "ai", text: "这次数学考试之后，你现在最想做什么？" },
    ],
    chatDraft: "",
    chatStatus: "idle",
    pendingChat: "",
    plan: "none",
    planDate: "",
    helpContact: "我信任的老师",
    helpStatus: "none",
    unsafe: false,
    rights: "none",
    rightsScope: "学习目标与任务记录",
    uploadText: "3x − (2x − 5)",
    uploadConfirmed: false,
    storageNotice: "",
  };
}
export function hydrate(raw: string | null): State {
  try {
    if (!raw) return initial();
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return initial();
    const s = { ...initial(), ...parsed };
    if (s.chatStatus === "waiting") s.chatStatus = "failed";
    if (s.helpStatus === "sending") s.helpStatus = "failed";
    if (s.rights === "processing") s.rights = "verify";
    return s;
  } catch {
    return {
      ...initial(),
      storageNotice: "本机进度无法读取，已进入新的演示。",
    };
  }
}
export type Action =
  | { type: "patch"; patch: Partial<State> }
  | { type: "open-task"; id: string }
  | { type: "draft"; id: string; value: string }
  | { type: "hint"; id: string }
  | { type: "attempt"; taskId: string; id: string; value: string; time: string }
  | { type: "pause"; id: string }
  | { type: "chat-send"; id: string; text: string }
  | { type: "chat-reply"; text: string }
  | { type: "reset" };
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return initial();
    case "patch":
      return { ...s, ...a.patch };
    case "open-task": {
      if (s.safety) return s;
      const t = getTask(a.id);
      if (!t) return s;
      if (
        t.dim === "计算" &&
        !s.calcSeen.includes(t.id) &&
        s.calcSeen.length >= 10
      )
        return s;
      return {
        ...s,
        rest: false,
        questionInvitePaused: false,
        activeTask: t.id,
        page: "task",
        calcSeen:
          t.dim === "计算" && !s.calcSeen.includes(t.id)
            ? [...s.calcSeen, t.id]
            : s.calcSeen,
        records: {
          ...s.records,
          [t.id]: {
            ...(s.records[t.id] || {
              id: t.id,
              attempts: [],
              hint: false,
              draft: "",
            }),
            paused: false,
          },
        },
      };
    }
    case "draft":
      return {
        ...s,
        records: {
          ...s.records,
          [a.id]: { ...s.records[a.id], draft: a.value },
        },
      };
    case "hint":
      return {
        ...s,
        records: { ...s.records, [a.id]: { ...s.records[a.id], hint: true } },
      };
    case "pause":
      return {
        ...s,
        page: "home",
        tab: "小N",
        records: { ...s.records, [a.id]: { ...s.records[a.id], paused: true } },
      };
    case "attempt": {
      const r = s.records[a.taskId];
      if (
        s.safety ||
        !r ||
        !a.value.trim() ||
        r.attempts.some((x) => x.id === a.id)
      )
        return s;
      return {
        ...s,
        records: {
          ...s.records,
          [a.taskId]: {
            ...r,
            attempts: [
              ...r.attempts,
              {
                id: a.id,
                value: a.value,
                correct: correct(getTask(a.taskId), a.value),
                hinted: r.hint,
                time: a.time,
              },
            ],
          },
        },
      };
    }
    case "chat-send":
      if (s.chatStatus === "waiting" || s.chat.some((m) => m.id === a.id))
        return s;
      return {
        ...s,
        chat: [...s.chat, { id: a.id, role: "user", text: a.text }],
        chatDraft: "",
        pendingChat: a.text,
        questionInvitePaused:
          s.questionInvitePaused ||
          /(?:不想|暂不|先不|不愿意)(?:看题|做题|探索)|只想聊聊/.test(a.text),
        chatStatus: "waiting",
      };
    case "chat-reply":
      if (s.chatStatus !== "waiting") return s;
      return {
        ...s,
        chat: [
          ...s.chat,
          {
            id: `reply-${s.chat[s.chat.length - 1].id}`,
            role: "ai",
            text: a.text,
          },
        ],
        chatStatus: "idle",
        pendingChat: "",
      };
  }
}
export type Observation = {
  dim: Dimension;
  status: string;
  finding: string;
  basis: RecordItem[];
  next: string;
};
export function observations(s: State): Observation[] {
  return dimensions.map((dim) => {
    const basis = Object.values(s.records).filter(
      (r) => getTask(r.id).dim === dim && r.attempts.length,
    );
    const independent = basis.filter(
      (r) => r.attempts[0]?.correct && !r.attempts[0]?.hinted,
    );
    const hinted = basis.filter((r) =>
      r.attempts.some((a) => a.correct && a.hinted),
    );
    const status =
      independent.length >= 2
        ? "多次独立完成"
        : independent.length
          ? "本次独立完成"
          : hinted.length
            ? "提示下完成"
            : basis.length
              ? "需要继续观察"
              : "尚未观察";
    const signErrors = basis.filter((r) => {
      const t = getTask(r.id),
        wrongSign = t.answer[0].replace("+", "-");
      return (
        t.dim === "计算" &&
        r.attempts.some(
          (a) =>
            !a.correct && normalize(a.value).split("=").at(-1) === wrongSign,
        )
      );
    });
    let finding = !basis.length
      ? "还没有足够的作答依据。未开始或暂停，都不代表能力弱。"
      : independent.length
        ? `这次有 ${independent.length} 道不同的题，你在首次尝试时没有使用提示就完成了。`
        : hinted.length
          ? "你在提示的帮助下完成了答案。还需要用一道新题，看看能否独立完成。"
          : "这次作答还没有完成正确解答。我们需要继续了解具体步骤。";
    if (dim === "计算" && signErrors.length)
      finding = `这次 ${signErrors.length} 道题中，出现了与去括号时漏改符号一致的结果，具体步骤仍需核对。${independent.length ? "另有题目留下首次独立完成记录。" : "可以先一起观察这个小环节。"}`;
    return {
      dim,
      status,
      finding,
      basis,
      next:
        dim === "计算"
          ? "在新题中先圈出括号前的符号，再逐项去括号。"
          : "换一个同类情境，看看是否仍能独立解释自己的想法。",
    };
  });
}
export function taskStatus(s: State, id: string) {
  const r = s.records[id];
  return !r
    ? "未开始"
    : r.attempts.some((a) => a.correct)
      ? "完成"
      : r.paused
        ? "暂未完成"
        : "进行中";
}
export function memoryAfter(s: State, items: Memory[], item: Memory): Memory[] {
  return s.longMemory && !items.some((m) => m.id === item.id)
    ? [...items, item]
    : items;
}
export const timeLabel = () =>
  new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function replyFor(text: string, rest = false, questionInvitePaused = false) {
  if (rest && !/休息/.test(text))
    return "我在听。今天不用急着回到题目上。你还想说说什么？";
  if (questionInvitePaused && !/休息/.test(text))
    return "我在听，我们先聊聊。你现在最想说的是什么？";
  if (/不想|失败|难过|考砸|累|烦|失落|不好/.test(text))
    return "听起来，这次考试让你有些难受。现在不用急着解决所有问题。你愿意说说，最让你在意的是哪一部分吗？";
  if (/休息/.test(text))
    return "可以，休息也是你的选择。今天先把任务放一放。等你想继续时，我会在这里。";
  if (/题|试试|开始/.test(text))
    return "我们可以只看一道题，不用一下子做很多。你愿意从一道去括号的题开始吗？";
  return "谢谢你告诉我。我先听着，不急着给你下结论。你希望我继续听你说，还是陪你看一道题？";
}
