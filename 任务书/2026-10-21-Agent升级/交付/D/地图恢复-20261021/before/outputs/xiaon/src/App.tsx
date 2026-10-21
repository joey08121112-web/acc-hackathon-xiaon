import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Download,
  Flower2,
  HeartHandshake,
  Leaf,
  Lightbulb,
  List,
  LoaderCircle,
  Map,
  MessageCircle,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  TriangleAlert,
  Upload as UploadIcon,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { HeroArt, MapArt, Mascot, SpaceShape } from "./Art";
import { useLearning } from "./agents/useLearning";
import { LearningPages, LearningStatus } from "./components/learning/LearningPages";
import { aiConfigured, chatWithAI } from "./ai";
import {
  correct,
  dimensionDetails,
  dimensions,
  getTask,
  type Dimension,
} from "./data";
import {
  hydrate,
  initial,
  memoryAfter,
  MEMORY_KEY,
  nextNewCalcId,
  observations,
  planDraft,
  PROGRESS_KEY,
  reducer,
  replyFor,
  taskStatus,
  timeLabel,
  type Memory,
  type State,
} from "./domain";
import { IMAGE_KEY, Upload } from "./Upload";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const icons = [Flower2, BookOpen, Plus, ShoppingBagIcon, Compass];
function ShoppingBagIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 7h16l-1 14H5L4 7ZM8 7V5a4 4 0 018 0v2" />
    </svg>
  );
}
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
function App() {
  const learning = useLearning();
  const learningPages = ["chat","explore","task","growth","report","plan","today","review","memory"];
  const [s, dispatch] = useReducer(reducer, null, () => {
    try {
      return hydrate(localStorage.getItem(PROGRESS_KEY));
    } catch {
      return {
        ...initial(),
        storageNotice:
          "本机存储不可用，当前体验可以继续，但刷新后可能无法恢复。",
      };
    }
  });
  const [memories, setMemories] = useState<Memory[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState(""),
    [modal, setModal] = useState<string | null>(null),
    [offline, setOffline] = useState(false),
    [large, setLarge] = useState(false),
    [mapMode, setMapMode] = useState(true),
    [taskError, setTaskError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [helpFail, setHelpFail] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState("");
  const submitLock = useRef(false),
    chatEnd = useRef<HTMLDivElement>(null),
    taskTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patch = (p: Partial<State>) => dispatch({ type: "patch", patch: p });
  const contact = s.helpContact;
  const setContact = (value: string) =>
    patch({ helpContact: value, helpStatus: "none" });
  const stateRef = useRef(s);
  stateRef.current = s;
  const say = (text: string) => setToast(text);
  const navigate = (page: string, tab?: string) => {
    patch({ page, ...(tab ? { tab } : {}) });
    window.history.pushState({ page, tab: tab || s.tab }, "", `#${page}`);
  };
  const goTab = (tab: string) =>
    navigate(
      (
        {
          小N: "home",
          探索: "explore",
          今日: "today",
          成长: "growth",
        } as Record<string, string>
      )[tab],
      tab,
    );
  const remember = (m: Memory) =>
    setMemories((items) => memoryAfter(stateRef.current, items, m));
  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(s));
    } catch {
      setToast("本机空间不足，进度未能保存。当前页面仍可继续。");
    }
  }, [s]);
  useEffect(() => {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
    } catch {
      setToast("学习记忆未能保存，请检查本机存储空间。");
    }
  }, [memories]);
  useEffect(() => {
    window.history.replaceState({ page: s.page, tab: s.tab }, "", `#${s.page}`);
    const pop = (e: PopStateEvent) => {
      if (!e.state?.page) return;
      if (e.state.page === "task" && e.state.taskId) {
        const known = stateRef.current.records[e.state.taskId];
        patch({
          page: known ? "task" : "home",
          tab: known ? e.state.tab || stateRef.current.tab : "小N",
          activeTask: known ? e.state.taskId : stateRef.current.activeTask,
        });
        return;
      }
      const valid = e.state.page !== "task" || stateRef.current.activeTask;
      patch({
        page: valid ? e.state.page : "home",
        tab: valid ? e.state.tab || "小N" : "小N",
      });
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setTaskError("");
  }, [s.page, s.tab, s.activeTask, s.onboarded, s.onboardStep]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector(".modal") as HTMLElement | null;
    dialog?.querySelector<HTMLButtonElement>(".modal-close")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab" && dialog) {
        const els = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,textarea,select,[tabindex="0"]',
          ),
        );
        if (event.shiftKey && document.activeElement === els[0]) {
          event.preventDefault();
          els.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === els.at(-1)) {
          event.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (learning.enabled || s.chatStatus !== "waiting") return;
    let cancelled = false;
    const replyLocally = () =>
      dispatch({
        type: "chat-reply",
        text: replyFor(s.pendingChat, s.rest, s.questionInvitePaused),
      });
    const timer = setTimeout(async () => {
      if (offline || !navigator.onLine) {
        patch({ chatStatus: "failed" });
        return;
      }
      if (!aiConfigured()) {
        replyLocally();
        return;
      }
      try {
        const reply = await chatWithAI(
          s.chat.map((m) => ({
            role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
            content: m.text,
          })),
        );
        if (!cancelled) dispatch({ type: "chat-reply", text: reply });
      } catch {
        if (!cancelled) replyLocally();
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [s.chatStatus, s.chat, offline, s.rest, s.questionInvitePaused]);
  useEffect(() => {
    if (s.rights !== "processing") return;
    const timer = setTimeout(() => patch({ rights: "result" }), 1000);
    return () => clearTimeout(timer);
  }, [s.rights]);
  useEffect(() => {
    if (s.helpStatus !== "sending") return;
    const timer = setTimeout(
      () => patch({ helpStatus: helpFail || offline ? "failed" : "sent" }),
      900,
    );
    return () => clearTimeout(timer);
  }, [s.helpStatus, helpFail, offline]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [s.chat.length, s.chatStatus]);
  useEffect(
    () => () => {
      if (taskTimer.current) clearTimeout(taskTimer.current);
    },
    [],
  );
  const openTask = (id: string) => {
    if (learning.enabled) { const candidate = learning.view?.tasks.find(t=>t.id===id); if (candidate) { learning.choose(candidate); navigate("task"); } else say("本地服务未就绪，请先连接后选择题目。"); return; }
    if (s.safety) {
      say("当前已暂停学习。请在支持页面中自主选择恢复。");
      return;
    }
    if (
      getTask(id).dim === "计算" &&
      !s.calcSeen.includes(id) &&
      s.calcSeen.length >= 10
    ) {
      say("本次计算探索已达到 10 题上限。可以回看已有记录。");
      return;
    }
    dispatch({ type: "open-task", id });
    window.history.pushState(
      { page: "task", tab: s.tab, taskId: id },
      "",
      "#task",
    );
  };
  const chatSend = (text: string) => {
    if (!text.trim() || s.chatStatus === "waiting" || s.chatStatus === "paused")
      return;
    dispatch({ type: "chat-send", id: uid(), text: text.trim() });
    if (/^(我想休息|今天先休息|我先休息|先休息)[。！! ]*$/.test(text.trim()))
      patch({ rest: true });
    if (/记住我/.test(text) && !/(难过|懒|笨|差|焦虑)/.test(text))
      remember({
        id: uid(),
        category: "你告诉小N的",
        text: text.replace("记住", ""),
        source: "你主动告诉小N · 本地示例对话",
        time: timeLabel(),
        active: true,
      });
  };
  const rest = () => {
    if (learning.enabled) void learning.pause().catch(()=>{});
    patch({
      rest: true,
      chatStatus: s.chatStatus === "waiting" ? "paused" : s.chatStatus,
      page: "home",
      tab: "小N",
    });
    say("今天先休息。任务提醒已暂停，回来时由你决定。");
  };
  const help = () => {
    if (learning.enabled) { learning.cancel(); void learning.pause().catch(()=>{}); }
    if (taskTimer.current) clearTimeout(taskTimer.current);
    submitLock.current = false;
    setSubmitting(false);
    if (s.activeTask && s.records[s.activeTask])
      dispatch({ type: "pause", id: s.activeTask });
    patch({
      safety: true,
      chatStatus: s.chatStatus === "waiting" ? "paused" : s.chatStatus,
    });
    navigate("help");
  };
  const submit = (taskId: string) => {
    const r = s.records[taskId];
    if (submitLock.current || !r?.draft.trim()) return;
    submitLock.current = true;
    setSubmitting(true);
    setTaskError("");
    const value = r.draft,
      id = uid();
    taskTimer.current = setTimeout(() => {
      submitLock.current = false;
      setSubmitting(false);
      if (offline || !navigator.onLine) {
        setTaskError(
          "演示提交失败，输入已保留。恢复连接后可重试，不会重复计题。",
        );
        return;
      }
      dispatch({ type: "attempt", taskId, id, value, time: timeLabel() });
      if (correct(getTask(taskId), value))
        remember({
          id: `task-${taskId}`,
          category: "学习过程中记录的",
          text: `${getTask(taskId).title}：${r.hint ? "提示后完成" : r.attempts.length ? "原题修改完成" : "首次独立完成"}`,
          source: `任务 ${getTask(taskId).question}`,
          time: timeLabel(),
          active: true,
        });
    }, 600);
  };
  const reset = async () => {
    if (learning.enabled) { try { await learning.reset(); } catch { say("新版服务未完成清除，请重连服务后重试；原数据保留。"); return; } }
    if (taskTimer.current) clearTimeout(taskTimer.current);
    submitLock.current = false;
    setSubmitting(false);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(MEMORY_KEY);
    localStorage.removeItem(IMAGE_KEY);
    localStorage.removeItem("xiaon-image-work-v1");
    setMemories([]);
    dispatch({ type: "reset" });
    setModal(null);
    setOffline(false);
    setHelpFail(false);
    window.history.replaceState({ page: "home", tab: "小N" }, "", "#home");
    say("这台设备上的演示进度、图片和记忆已清空。");
  };
  useEffect(()=>{
    if (s.onboarded && learning.connected && learning.view && !learning.view.consentConfigured && !learning.busy) void learning.run('consent',{optionalMemory:s.longMemory},{persist:false}).catch(()=>{});
  },[s.onboarded,learning.connected,learning.view?.consentConfigured]);
  const report = observations(s),
    plan = planDraft(s),
    planTasks =
      s.plan === "lighter" ? plan.tasks.slice(0, -1) : plan.tasks,
    doneCount = dimensions.filter((d) =>
      report
        .find((o) => o.dim === d)!
        .basis.some((r) => r.attempts.some((a) => a.correct)),
    ).length;
  const task = s.activeTask ? getTask(s.activeTask) : null,
    record = task ? s.records[task.id] : null;
  const reviewId = nextNewCalcId(s);
  const headerTitles: Record<string, string> = {
    home: "学伴小N",
    chat: "和小N聊聊",
    explore: "五维探索",
    task: "一起看题",
    upload: "题目小工坊",
    growth: "我的成长",
    report: "学习观察",
    plan: "这一周，慢慢来",
    today: "今日小任务",
    review: "看看新的变化",
    settings: "我的与设置",
    memory: "我的学习记忆",
    privacy: "信息与授权",
    help: "你可以得到支持",
    guardian: "监护人演示",
  };
  function guardianPanel() {
    return (
      <div className="guardian-panel">
        <ShieldCheck size={24} />
        <h3>监护人确认 · 仅演示</h3>
        <p>
          未满 14
          周岁的示例使用者，需要监护人了解基本服务后确认。前端切换不构成真实身份核验。
        </p>
        <div className="status-line">
          当前状态：
          <strong>
            {
              {
                none: "尚未发起",
                pending: "待确认",
                complete: "演示完成",
                failed: "确认失败",
                cancelled: "已取消",
              }[s.guardian]
            }
          </strong>
        </div>
        {s.guardian !== "pending" ? (
          <button
            className="secondary wide"
            onClick={() => patch({ guardian: "pending" })}
          >
            {s.guardian === "complete" ? "重新演示确认" : "发起监护人确认演示"}
          </button>
        ) : (
          <>
            <p className="small muted">
              请模拟监护人阅读：仅提供数学学习支持；可选用途分别决定；不自动分享敏感倾诉。
            </p>
            <button
              className="primary wide"
              onClick={() => patch({ guardian: "complete" })}
            >
              模拟监护人阅读并确认
            </button>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => patch({ guardian: "failed" })}
              >
                模拟失败
              </button>
              <button
                className="text-button"
                onClick={() => patch({ guardian: "cancelled" })}
              >
                取消确认
              </button>
            </div>
          </>
        )}
        {s.guardian === "failed" && (
          <p className="error">
            没有完成确认。可以重试，当前没有真实请求发出。
          </p>
        )}
      </div>
    );
  }
  const onboarding = (
    <div className="onboarding">
      <div className="onboard-top">
        <span className="brand">
          <Sprout size={23} /> 学伴小N
        </span>
        <span className="muted small">认识彼此 · {s.onboardStep + 1}/3</span>
      </div>
      <div className="progress-line">
        <span style={{ width: `${((s.onboardStep + 1) / 3) * 100}%` }} />
      </div>
      {s.onboardStep === 0 ? (
        <>
          <HeroArt />
          <div className="onboard-copy">
            <span className="eyebrow">HELLO, I'M N</span>
            <h1>
              慢慢来，
              <br />
              也会到达。
            </h1>
            <p>
              我是小N，一个 AI 学伴。
              <br />
              陪你看懂一道题，也陪你找回自己的节奏。
            </p>
            <div className="intro-facts">
              <span>
                <BookOpen size={17} /> 先从七年级数学开始
              </span>
              <span>
                <Leaf size={17} /> 由你选择开始、暂停或休息
              </span>
              <span>
                <CircleHelp size={17} /> AI 也会出错，可以一起核对
              </span>
            </div>
            <p className="small muted">
              提供日常学习支持，不作智力、人格或心理疾病诊断，也不替代现实中的老师和家人。
            </p>
            <button
              className="primary wide"
              onClick={() => patch({ onboardStep: 1 })}
            >
              认识一下小N <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : s.onboardStep === 1 ? (
        <div className="onboard-copy">
          <SectionHeading
            eyebrow="A LITTLE ABOUT YOU"
            title="从适合你的起点开始"
          >
            仅用于选择学习内容。这里使用虚构信息体验。
          </SectionHeading>
          <label className="field">
            年龄段
            <select
              value={s.age}
              onChange={(e) => patch({ age: e.target.value, guardian: "none" })}
            >
              <option value="under14">未满 14 周岁</option>
              <option value="14-17">14—17 周岁</option>
              <option value="adult">成年体验者</option>
            </select>
          </label>
          <div className="two-fields">
            <label className="field">
              年级
              <select
                value={s.grade}
                onChange={(e) => patch({ grade: e.target.value })}
              >
                <option>七年级</option>
              </select>
            </label>
            <label className="field">
              教材
              <select
                value={s.book}
                onChange={(e) => patch({ book: e.target.value })}
              >
                <option>人教版</option>
                <option>北师大版</option>
                <option>暂不确定</option>
              </select>
            </label>
          </div>
          <div className="info-paper">
            <h3>基本体验需要什么？</h3>
            <p>
              年龄段、年级、教材，以及你在演示中提交的作答与任务进度，用于提供合适的内容和恢复学习。
            </p>
            <p className="small">
              本机模式保存在浏览器或本地 SQLite。启用真实模型时，会发送必要对话、作答和许可偏好到智谱。请勿输入真实姓名、学校或联系方式。
            </p>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={s.necessary}
              onChange={(e) => patch({ necessary: e.target.checked })}
            />
            <span>我已了解基本服务所需信息与本机演示规则</span>
          </label>
          {s.age === "under14" && guardianPanel()}
          <button
            className="primary wide"
            disabled={
              !s.necessary || (s.age === "under14" && s.guardian !== "complete")
            }
            onClick={() => patch({ onboardStep: 2 })}
          >
            继续，选择可选功能 <ArrowRight size={18} />
          </button>
          <button
            className="text-button"
            onClick={() => patch({ onboardStep: 0 })}
          >
            返回介绍
          </button>
        </div>
      ) : (
        <div className="onboard-copy">
          <SectionHeading eyebrow="YOUR CHOICE, ALWAYS" title="这些，由你决定">
            两项都默认关闭。拒绝后，也可以正常聊天、看题和探索。
          </SectionHeading>
          <Toggle
            title="跨会话长期记忆"
            description="可保存你主动分享的偏好和学习观察，供以后参考。关闭后不再新增或使用长期记忆；本机演示进度仍单独保留。"
            checked={s.longMemory}
            onChange={() => patch({ longMemory: !s.longMemory })}
          />
          <Toggle
            title="用于学习研究"
            description="独立的用途授权演示。本版本没有研究数据收集或传输；切换仅展示授权状态。"
            checked={s.research}
            onChange={() => patch({ research: !s.research })}
          />
          <div className="notice">
            <ShieldCheck size={18} />
            以后随时可在“我的与设置”里更改选择、查看信息用途或清除本机数据。
          </div>
          <button
            className="primary wide"
            onClick={() => patch({ onboarded: true, page: "home", tab: "小N" })}
          >
            按我的选择，开始 <ArrowRight size={18} />
          </button>
          <button
            className="secondary wide"
            onClick={() =>
              patch({
                longMemory: false,
                research: false,
                onboarded: true,
                page: "home",
                tab: "小N",
              })
            }
          >
            关闭可选功能，进入基本体验
          </button>
          <button
            className="text-button"
            onClick={() => patch({ onboardStep: 1 })}
          >
            返回基本信息
          </button>
        </div>
      )}
      <footer className="onboard-footer">
        本机合成材料体验 · 模型模式见连接状态 · 通知为演示
      </footer>
    </div>
  );
  return (
    <div className={large ? "root large-text" : "root"}>
      <aside className="desktop-aside">
        <div className="aside-brand">
          <Sprout size={31} />
          <span>
            学伴小N<small>YOUR LEARNING COMPANION</small>
          </span>
        </div>
        <div>
          <span className="aside-kicker">一点点，重新出发</span>
          <h2>
            学习的路上，
            <br />
            有自己的<span>节奏。</span>
          </h2>
          <p>
            不急着找到所有答案。
            <br />
            先从你愿意迈出的那一步开始。
          </p>
          <div className="aside-line" />
          <span className="aside-foot">
            七年级数学 · 交互原型
            <br />
            原创形象 / 合成材料 / 模式见页面说明
          </span>
        </div>
        <span className="aside-bottom">
          GROW AT YOUR OWN PACE. <Leaf size={17} />
        </span>
      </aside>
      <div className="app-shell">
        {!s.onboarded ? (
          onboarding
        ) : (
          <>
            <header className="app-header">
              {["home", "explore", "today", "growth"].includes(s.page) ? (
                <div className="brand">
                  <span className="brand-mark">
                    <Sprout size={21} />
                  </span>
                  <div>
                    {headerTitles[s.page]}
                    <small>
                      {s.page === "home"
                        ? "你的 AI 学伴"
                        : "按自己的节奏，向前一点点"}
                    </small>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="icon-button"
                    aria-label="返回"
                    onClick={() => goTab(s.tab)}
                  >
                    <ArrowLeft size={22} />
                  </button>
                  <h2>{headerTitles[s.page]}</h2>
                </>
              )}
              <div className="header-actions">
                <button
                  className="icon-button"
                  aria-label="帮助与支持"
                  onClick={help}
                >
                  <HeartHandshake size={21} />
                </button>
                <button
                  className="avatar-button"
                  aria-label="我的与设置"
                  onClick={() => navigate("settings")}
                >
                  <UserRound size={20} />
                </button>
              </div>
            </header>
            {offline && (
              <div className="offline-bar">
                <WifiOff size={15} />
                断网演示已开启 · 输入会保留
                <button onClick={() => setOffline(false)}>恢复连接</button>
              </div>
            )}
            {s.safety && s.page !== "help" && (
              <div className="safety-bar">
                <HeartHandshake size={16} />
                学习已暂停
                <button onClick={() => navigate("help")}>
                  查看支持与恢复入口
                </button>
              </div>
            )}
            {s.storageNotice && <div className="notice">{s.storageNotice}</div>}
            <LearningStatus l={learning} />
            {learning.enabled && (s.page === "privacy" || s.page === "settings") && <div className="notice learning-disclosure">新版学习记录、评分、报告、计划保存在本机SQLite；草稿是浏览器恢复缓存。真实模型模式会向智谱发送当前消息、必要题目/作答/评分依据和获准偏好。以下旧授权、身份与通知仍为演示；上传仍无OCR。学习记忆请以新版记忆页为准。</div>}
            <main className={`page page-${s.page}`}>
              {learning.enabled && learningPages.includes(s.page) && <LearningPages l={learning} page={s.page} navigate={navigate} safety={s.safety} />}
              {s.page === "home" && (
                <>
                  <div className="home-heading">
                    <div>
                      <span className="eyebrow">HI, 很高兴见到你</span>
                      <h1>
                        {s.rest ? "今天，先好好休息。" : "今天，按你的节奏来。"}
                      </h1>
                    </div>
                    <button className="ai-pill" onClick={() => setModal("ai")}>
                      AI 学伴 <CircleHelp size={12} />
                    </button>
                  </div>
                  <HeroArt sleeping={s.rest} />
                  <div className="home-dialogue">
                    <div className="little-label">
                      <span className="green-dot" /> 小N 轻轻说
                    </div>
                    <h2>
                      {s.rest
                        ? "不用赶路，歇一歇也很好。"
                        : "这次数学考试之后，\n你现在最想做什么？"}
                    </h2>
                    <p>
                      {s.rest
                        ? "任务提醒已暂停。你不需要完成什么来证明自己。"
                        : "不用马上振作，也不用一下子想清楚。"}
                    </p>
                  </div>
                  {s.rest ? (
                    <div className="home-choices">
                      <button
                        className="primary wide"
                        onClick={() => {
                          patch({ rest: false, questionInvitePaused: true });
                          navigate("chat");
                        }}
                      >
                        我想继续聊聊 <MessageCircle size={19} />
                      </button>
                      <p className="center small muted">
                        由你决定什么时候再开始。
                      </p>
                    </div>
                  ) : (
                    <div className="home-choices">
                      <button
                        className="primary choice-main"
                        onClick={() => navigate("chat")}
                      >
                        <span className="choice-icon">
                          <MessageCircle size={22} />
                        </span>
                        <span>
                          先聊聊<small>我想先说说现在的心情</small>
                        </span>
                        <ArrowRight size={20} />
                      </button>
                      <div className="choice-pair">
                        <button onClick={() => setModal("start-question")}>
                          <BookOpen size={20} />
                          <span>一起看一道题</span>
                          <ChevronRight size={16} />
                        </button>
                        <button onClick={rest}>
                          <Leaf size={20} />
                          <span>今天先休息</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                  {!s.rest &&
                    s.activeTask &&
                    s.records[s.activeTask]?.paused && (
                      <div className="resume-strip">
                        <Pause size={17} />
                        <div>
                          <strong>上次停在这里</strong>
                          <small>
                            {getTask(s.activeTask).title} · 草稿已保留
                          </small>
                        </div>
                        <button onClick={() => openTask(s.activeTask!)}>
                          继续 <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  {!s.rest && (
                    <div className="home-explore">
                      <div className="home-explore-illustration">
                        <Compass size={28} />
                        <i />
                        <i />
                      </div>
                      <div>
                        <span className="eyebrow">还有一个小小的世界</span>
                        <h3>去探索，你的解题方式</h3>
                        <p>五个地点，没有排名，只有发现。</p>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="进入五维探索"
                        onClick={() => goTab("探索")}
                      >
                        <ArrowRight size={21} />
                      </button>
                    </div>
                  )}
                  <div className="home-foot">
                    <ShieldCheck size={13} />
                    你的选择会被尊重。{" "}
                    <button onClick={() => navigate("privacy")}>
                      了解信息与授权
                    </button>
                  </div>
                </>
              )}
              {!learning.enabled && s.page === "chat" && (
                <div className="chat-page">
                  <div className="chat-identity">
                    <Mascot small />
                    <div>
                      <strong>小N在这里</strong>
                      <span>AI · 本地预设回复演示</span>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setModal("ai")}
                    >
                      能力说明
                    </button>
                  </div>
                  <div className="chat-date">此刻，只聊你想聊的</div>
                  <div className="messages">
                    {s.chat.map((m) => (
                      <div className={`message ${m.role}`} key={m.id}>
                        {m.role === "ai" && (
                          <span className="message-label">小N · AI</span>
                        )}
                        <div>{m.text}</div>
                      </div>
                    ))}
                    {s.chatStatus === "waiting" && (
                      <div className="message ai">
                        <div className="typing">
                          <i />
                          <i />
                          <i />
                          <span>小N正在整理回应…</span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => patch({ chatStatus: "paused" })}
                        >
                          <Pause size={14} />
                          暂停回应
                        </button>
                      </div>
                    )}
                    {s.chatStatus === "failed" && (
                      <div className="notice error">
                        回复没有成功，上一条消息已保留。
                        <button
                          className="secondary"
                          onClick={() => patch({ chatStatus: "waiting" })}
                        >
                          重试回复
                        </button>
                      </div>
                    )}
                    {s.chatStatus === "paused" && (
                      <div className="notice">
                        回应已暂停。
                        <button
                          className="secondary"
                          onClick={() => patch({ chatStatus: "waiting" })}
                        >
                          <Play size={15} />
                          恢复回应
                        </button>
                      </div>
                    )}
                    <div ref={chatEnd} />
                  </div>
                  {!s.rest && !s.questionInvitePaused && (
                    <div className="chat-invitation">
                      <Leaf size={17} />
                      <p>如果愿意，我们可以只看一道题。</p>
                      <button onClick={() => setModal("start-question")}>
                        我愿意 <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  {!s.rest && s.questionInvitePaused && (
                    <div className="notice">
                      先聊聊，暂不邀请看题。想开始时，由你决定。
                      <button
                        className="text-button"
                        onClick={() => setModal("start-question")}
                      >
                        我想开始看题
                      </button>
                    </div>
                  )}
                  {s.rest ? (
                    <div className="notice">
                      今天的任务提醒已暂停。你可以继续说说，不必开始任务。
                    </div>
                  ) : (
                    <div className="quick-replies">
                      {(s.questionInvitePaused
                        ? ["这次考砸了，有点难过", "我想说说"]
                        : ["这次考砸了，有点难过", "我想说说", "我愿意试试"]).map(
                        (t) => (
                          <button
                            key={t}
                            onClick={() => chatSend(t)}
                            disabled={
                              s.chatStatus === "waiting" ||
                              s.chatStatus === "paused"
                            }
                          >
                            {t}
                          </button>
                        ),
                      )}
                      <button onClick={rest}>今天先休息</button>
                    </div>
                  )}
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      chatSend(s.chatDraft);
                    }}
                  >
                    <textarea
                      aria-label="对小N说"
                      placeholder="想说什么都可以，慢慢说…"
                      rows={1}
                      value={s.chatDraft}
                      onChange={(e) => patch({ chatDraft: e.target.value })}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          chatSend(s.chatDraft);
                        }
                      }}
                    />
                    <button
                      className="send-button"
                      aria-label="发送"
                      disabled={
                        !s.chatDraft.trim() ||
                        ["waiting", "paused"].includes(s.chatStatus)
                      }
                    >
                      <Send size={19} />
                    </button>
                  </form>
                  <p className="composer-caption">
                    AI 回答可能有误。需要现实中的支持？{" "}
                    <button onClick={help}>点这里</button>
                  </p>
                </div>
              )}
              {!learning.enabled && s.page === "explore" && (
                <>
                  <SectionHeading
                    eyebrow="A SMALL WORLD TO EXPLORE"
                    title="每一种思考，都值得发现。"
                  >
                    不用证明什么。去几个地方，看看你怎样理解和解决问题。
                  </SectionHeading>
                  <div className="explore-toolbar">
                    <span>
                      <i className="green-dot" />
                      已探索 {doneCount} / 5 个地点
                    </span>
                    <div className="segmented">
                      <button
                        aria-label="地图入口"
                        className={mapMode ? "active" : ""}
                        onClick={() => setMapMode(true)}
                      >
                        <Map size={17} />
                      </button>
                      <button
                        aria-label="列表入口"
                        className={!mapMode ? "active" : ""}
                        onClick={() => setMapMode(false)}
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>
                  {mapMode ? (
                    <div className="exploration-map">
                      <MapArt />
                      <span className="map-stamp">
                        小N的探索手记
                        <br />
                        <small>VOL. 01 · 数学</small>
                      </span>
                      {dimensionDetails.map((d, i) => {
                        const Icon = icons[i],
                          id = [
                            "understand",
                            "logic",
                            "bracket",
                            "model",
                            "space",
                          ][i],
                          status = taskStatus(s, id);
                        return (
                          <button
                            className={`map-node node-${i}`}
                            key={d.name}
                            onClick={() => setModal(`dimension-${i}`)}
                          >
                            <span
                              className="node-icon"
                              style={{ background: d.color }}
                            >
                              <Icon size={25} />
                              {status === "完成" && (
                                <i>
                                  <Check size={12} />
                                </i>
                              )}
                            </span>
                            <strong>{d.place}</strong>
                            <small>
                              {status === "未开始" && i < 2
                                ? "从这里开始"
                                : status}
                            </small>
                          </button>
                        );
                      })}
                      <span className="map-key">
                        <span /> 路线只作导航，没有分数排名
                      </span>
                    </div>
                  ) : (
                    <div className="dimension-list">
                      {dimensionDetails.map((d, i) => {
                        const Icon = icons[i];
                        return (
                          <button
                            key={d.name}
                            onClick={() => setModal(`dimension-${i}`)}
                          >
                            <span
                              className="dimension-icon"
                              style={{ background: d.color }}
                            >
                              <Icon size={23} />
                            </span>
                            <span>
                              <strong>{d.place}</strong>
                              <small>{d.note}</small>
                            </span>
                            <Tag>
                              {taskStatus(
                                s,
                                [
                                  "understand",
                                  "logic",
                                  "bracket",
                                  "model",
                                  "space",
                                ][i],
                              )}
                            </Tag>
                            <ChevronRight size={17} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="explore-note">
                    <Sprout size={23} />
                    <div>
                      <h3>先从理解和逻辑出发</h3>
                      <p>你可以随时暂停。结果只代表这些任务中的表现。</p>
                    </div>
                  </div>
                  <button
                    className="secondary wide"
                    onClick={() => navigate("report", "成长")}
                  >
                    看看已有的学习观察 <ArrowRight size={17} />
                  </button>
                  <p className="small muted center">
                    本次计算题已打开 {s.calcSeen.length} / 10 · 包含补充题
                  </p>
                </>
              )}
              {!learning.enabled && s.page === "task" && task && record && (
                <>
                  <div className="task-top">
                    <Tag>
                      {task.dim} ·{" "}
                      {task.phase === "new" ? "同类新题" : "轻量探索"}
                    </Tag>
                    <button
                      className="text-button"
                      disabled={submitting}
                      onClick={() => dispatch({ type: "pause", id: task.id })}
                    >
                      <Pause size={16} />
                      先暂停
                    </button>
                  </div>
                  <div className="question-paper">
                    <span className="eyebrow">只专注这一小步</span>
                    <h1>{task.title}</h1>
                    <p
                      className={
                        task.dim === "计算" ? "math-question" : "task-question"
                      }
                    >
                      {task.question}
                    </p>
                    {task.kind === "space" && (
                      <div className="space-source">
                        <SpaceShape />
                        <span>
                          顺时针转 90°{" "}
                          <RotateCcw className="clockwise" size={21} />
                        </span>
                      </div>
                    )}
                    <span className="paper-corner" />
                  </div>
                  {task.id === "bracket" && !record.attempts.length && (
                    <div className="gentle-invite">
                      <Mascot small />
                      <p>
                        你可以先试试，也可以从
                        <br />
                        <button
                          onClick={() =>
                            dispatch({
                              type: "draft",
                              id: task.id,
                              value: "x − 5",
                            })
                          }
                        >
                          填入虚构学生的符号错误示例
                        </button>
                        开始。
                      </p>
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit(task.id);
                    }}
                  >
                    <label className="field">
                      {task.choices ? "选择你的答案" : "写下你的答案或关键一步"}
                      {task.choices ? (
                        <div
                          className={
                            task.kind === "space"
                              ? "answer-options spatial"
                              : "answer-options"
                          }
                        >
                          {task.choices.map((choice) => (
                            <button
                              type="button"
                              key={choice}
                              className={
                                record.draft === choice ? "selected" : ""
                              }
                              disabled={submitting}
                              onClick={() =>
                                dispatch({
                                  type: "draft",
                                  id: task.id,
                                  value: choice,
                                })
                              }
                            >
                              {task.kind === "space" && (
                                <SpaceShape variant={choice} />
                              )}
                              <span>{choice}</span>
                              {record.draft === choice && <Check size={17} />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          aria-label="你的解题步骤"
                          placeholder="写化简结果，也可用 = 连接等式步骤…"
                          value={record.draft}
                          rows={3}
                          disabled={submitting}
                          onChange={(e) =>
                            dispatch({
                              type: "draft",
                              id: task.id,
                              value: e.target.value,
                            })
                          }
                        />
                      )}
                    </label>
                    {!task.choices && (
                      <div className="math-keys">
                        {["−", "+", "(", ")", "x", "a", "="].map((k) => (
                          <button
                            type="button"
                            key={k}
                            disabled={submitting}
                            onClick={() =>
                              dispatch({
                                type: "draft",
                                id: task.id,
                                value: record.draft + k,
                              })
                            }
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="task-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={submitting}
                        onClick={() => dispatch({ type: "hint", id: task.id })}
                      >
                        <Lightbulb size={18} />
                        给一点提示
                      </button>
                      <button
                        className="primary"
                        disabled={submitting || !record.draft.trim()}
                      >
                        {submitting ? (
                          <LoaderCircle size={18} className="spin" />
                        ) : (
                          <ArrowRight size={18} />
                        )}{" "}
                        {record.attempts.length ? "提交修改" : "我先试试"}
                      </button>
                    </div>
                  </form>
                  {taskError && (
                    <div className="notice error" role="alert">
                      {taskError}
                      <button
                        className="secondary"
                        onClick={() => submit(task.id)}
                      >
                        重试提交
                      </button>
                    </div>
                  )}
                  {record.hint && (
                    <div className="hint-box">
                      <span className="eyebrow">
                        <Lightbulb size={14} /> 一级提示
                      </span>
                      <p>{task.hint}</p>
                      <small>使用提示后完成，会如实记为“提示下完成”。</small>
                    </div>
                  )}
                  {record.attempts.length > 0 && (
                    <div
                      className={`feedback ${record.attempts.at(-1)!.correct ? "success" : ""}`}
                      aria-live="polite"
                    >
                      <span className="eyebrow">小N · AI · 基于这次作答</span>
                      <h3>
                        {record.attempts.at(-1)!.correct
                          ? record.hint
                            ? "你在提示后完成了这一步。"
                            : record.attempts.length === 1
                              ? "这次，你独立完成了。"
                              : "你修正了这道原题。"
                          : "先停在这一步，一起看看。"}
                      </h3>
                      <p>
                        {record.attempts.at(-1)!.correct
                          ? task.explanation
                          : task.dim === "计算"
                            ? "先观察去括号这一步，尤其是括号前的符号。你可以再试一次，或选择一级提示。"
                            : "这次选择与参考解答还没有对上。可以检查题目条件，或选择一个提示。"}
                      </p>
                      {!record.attempts.at(-1)!.correct && !record.hint && (
                        <small>
                          上面的观察已提供线索；点击提示后会记录提示使用情况。
                        </small>
                      )}
                      {!record.attempts.at(-1)!.correct &&
                        task.phase === "new" && (
                          <div className="adaptive-note">
                            <p>
                              这次的新题还需要一点支持。可以先补一道题，专注同一个符号环节，不增加其他知识点。
                            </p>
                            <button
                              className="secondary wide"
                              onClick={() => openTask(reviewId)}
                            >
                              换一题，先练这个小环节
                            </button>
                          </div>
                        )}
                      {record.attempts.at(-1)!.correct && (
                        <>
                          <div className="method-note">
                            <BookOpen size={19} />
                            <div>
                              已整理一张方法笔记
                              <small>固定学习成果 · 不重复领取</small>
                            </div>
                          </div>
                          <div className="button-stack">
                            {task.dim === "计算" ? (
                              task.phase === "new" &&
                              record.attempts[0]?.correct &&
                              !record.attempts[0].hinted ? (
                                <button
                                  className="primary wide"
                                  onClick={() => navigate("review", "成长")}
                                >
                                  回顾这一步的变化 <Sprout size={17} />
                                </button>
                              ) : (
                                <button
                                  className="primary wide"
                                  onClick={() => openTask(reviewId)}
                                >
                                  用一道新题检验 <ArrowRight size={17} />
                                </button>
                              )
                            ) : (
                              <button
                                className="primary wide"
                                onClick={() => goTab("探索")}
                              >
                                回到探索地图 <Map size={17} />
                              </button>
                            )}
                            <button
                              className="secondary wide"
                              onClick={() => navigate("report", "成长")}
                            >
                              看看这次学习观察
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <details className="attempt-log">
                    <summary>
                      查看作答与提示记录{" "}
                      <span>{record.attempts.length} 次尝试</span>
                    </summary>
                    {record.attempts.length ? (
                      record.attempts.map((a, i) => (
                        <div key={a.id}>
                          <strong>
                            {i === 0 ? "第一次尝试" : "修改尝试"} ·{" "}
                            {a.hinted
                              ? "已用提示"
                              : i === 0
                                ? "未用提示"
                                : "原题重做"}
                          </strong>
                          <p>{a.value}</p>
                          <small>
                            {a.correct ? "结果正确" : "需要继续观察"} · {a.time}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p>尚未提交。你可以随时暂停。</p>
                    )}
                    {record.hint && <p>提示记录：{task.hint}</p>}
                  </details>
                  <button
                    className="text-button"
                    onClick={() => navigate("upload")}
                  >
                    <UploadIcon size={15} /> 题目识别错了？重新核对
                  </button>
                  <p className="small muted center">
                    {task.dim === "计算"
                      ? `本次计算已打开 ${s.calcSeen.length}/10 题 · 修改与重试不重复计题`
                      : "所有任务均为原创示例，不用于能力排名。"}
                  </p>
                </>
              )}
              {s.page === "upload" && (
                <>
                  <SectionHeading
                    eyebrow="ONE QUESTION AT A TIME"
                    title="把题目，清楚地带过来。"
                  >
                    不用上传整页，只留下想一起看的部分。
                  </SectionHeading>
                  <Upload
                    initialText={s.uploadText}
                    onConfirm={(text) => {
                      patch({ uploadText: text, uploadConfirmed: !!text });
                    }}
                  />
                  {s.uploadConfirmed && (
                    <div className="info-paper">
                      <h3>已核对的题目</h3>
                      <p className="math-inline">{s.uploadText}</p>
                      <p>
                        当前可完整体验的解题流程使用原创示例 3x − (2x −
                        5)。你修改的内容保留在上方，不会假装已被自动理解。
                      </p>
                      <button
                        className="primary wide"
                        onClick={() => openTask("bracket")}
                      >
                        明确选择：体验原创示例题
                      </button>
                    </div>
                  )}
                </>
              )}
              {!learning.enabled && s.page === "growth" && (
                <>
                  <SectionHeading
                    eyebrow="LITTLE STEPS, REAL CHANGES"
                    title="成长，藏在具体的一步里。"
                  >
                    不用分数定义自己。每一次尝试，都有它自己的来处。
                  </SectionHeading>
                  <div className="growth-hero">
                    <div>
                      <span className="eyebrow">我的学习手记</span>
                      <h2>
                        看见过程，
                        <br />
                        也看见变化。
                      </h2>
                      <p>
                        {doneCount
                          ? "已有 " + doneCount + " 个维度留下完成记录。"
                          : "还没有记录，也没关系。"}
                      </p>
                      <button
                        className="primary"
                        onClick={() => navigate("report")}
                      >
                        打开学习观察 <ArrowRight size={17} />
                      </button>
                    </div>
                    <Mascot />
                  </div>
                  <div className="section-title">
                    <h2>五个方向，慢慢了解</h2>
                    <span>不作能力排名</span>
                  </div>
                  <div className="observation-list">
                    {report.map((o, i) => {
                      const Icon = icons[i];
                      return (
                        <button key={o.dim} onClick={() => navigate("report")}>
                          <span
                            style={{ background: dimensionDetails[i].color }}
                          >
                            <Icon size={21} />
                          </span>
                          <strong>{o.dim}</strong>
                          <small>{o.status}</small>
                          <ChevronRight size={16} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="growth-links">
                    <button onClick={() => navigate("plan")}>
                      <Target size={22} />
                      <span>
                        我的一周小计划
                        <small>
                          {s.plan === "none"
                            ? "一个目标，少量任务"
                            : "查看当前安排与调整"}
                        </small>
                      </span>
                      <ChevronRight size={19} />
                    </button>
                    <button onClick={() => navigate("review")}>
                      <Sprout size={22} />
                      <span>
                        阶段回顾<small>用一道新题，看看变化</small>
                      </span>
                      <ChevronRight size={19} />
                    </button>
                    <button onClick={() => navigate("memory")}>
                      <BookOpen size={22} />
                      <span>
                        方法笔记与学习记忆
                        <small>
                          {
                            Object.values(s.records).filter((r) =>
                              r.attempts.some((a) => a.correct),
                            ).length
                          }{" "}
                          张固定方法笔记
                        </small>
                      </span>
                      <ChevronRight size={19} />
                    </button>
                  </div>
                </>
              )}
              {!learning.enabled && s.page === "report" && (
                <>
                  <SectionHeading
                    eyebrow="OBSERVATIONS, WITH EVIDENCE"
                    title="这一次，我们发现了什么？"
                  >
                    这是 AI
                    根据本机作答记录整理的学习观察。结果只代表这些任务，不是智力或人格判断。
                  </SectionHeading>
                  <div className="report-summary">
                    <Sprout size={25} />
                    <div>
                      <strong>
                        {Object.values(s.records).reduce(
                          (n, r) => n + r.attempts.length,
                          0,
                        )}{" "}
                        次尝试，有迹可循
                      </strong>
                      <p>提示、修改与独立完成，分别记录。</p>
                    </div>
                  </div>
                  {[...report]
                    .sort((a, b) => b.basis.length - a.basis.length)
                    .map((o, i) => (
                      <article
                        className={
                          o.basis.length
                            ? "report-item"
                            : "report-item unobserved"
                        }
                        key={o.dim}
                      >
                        <header>
                          <span className="report-number">0{i + 1}</span>
                          <h2>{o.dim}</h2>
                          <Tag>{o.status}</Tag>
                        </header>
                        {(s.statusTrail?.[o.dim]?.length ?? 0) > 1 && (
                          <p className="small muted">
                            结论轨迹：
                            {s.statusTrail[o.dim].map((t, j) => (
                              <span key={`${t.time}-${t.status}`}>
                                {j > 0 && " → "}
                                {t.time} {t.status}
                              </span>
                            ))}
                          </p>
                        )}
                        <h3>本次发现</h3>
                        <p>{o.finding}</p>
                        <details>
                          <summary>
                            观察依据{" "}
                            <span>
                              {o.basis.length} 道题 <ChevronDown size={15} />
                            </span>
                          </summary>
                          {o.basis.length ? (
                            o.basis.map((r) => (
                              <div className="evidence-entry" key={r.id}>
                                <strong>{getTask(r.id).question}</strong>
                                {r.attempts.map((a, j) => (
                                  <p key={a.id}>
                                    {j === 0 ? "首次" : "修改"}：{a.value} ·{" "}
                                    {a.correct ? "正确" : "待继续观察"} ·{" "}
                                    {a.hinted ? "已用提示" : "未用提示"}
                                    <small>{a.time}</small>
                                  </p>
                                ))}
                                {r.hint && (
                                  <p className="small">
                                    提示：{getTask(r.id).hint}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p>尚无已提交的作答，不能推断能力。</p>
                          )}
                        </details>
                        <h3>还需要了解</h3>
                        <p>
                          {o.status === "多次独立完成"
                            ? "这些记录来自不同题目；换一种情境或过几天后，表现是否稳定还需要继续了解。"
                            : "目前题量有限。需要更多独立作答，才能了解这个小环节是否稳定。"}
                        </p>
                        <h3>下一步可以试试</h3>
                        <p>{o.next}</p>
                      </article>
                    ))}
                  <button
                    className="primary wide"
                    onClick={() => navigate("plan")}
                  >
                    按这些观察，安排一小周 <ArrowRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      const content = `学伴小N｜AI 整理的本地演示学习观察\n不是智力、人格或心理诊断。\n\n${report.map((o) => `${o.dim}｜${o.status}\n本次发现：${o.finding}\n观察依据：${o.basis.map((r) => `${getTask(r.id).question}；${r.attempts.map((a) => `${a.value}（${a.hinted ? "提示后" : "未提示"}，${a.correct ? "正确" : "待观察"}）`).join("、")}`).join("；") || "无"}\n还需要了解：题量有限，需继续观察。\n下一步：${o.next}`).join("\n\n")}`;
                      const a = document.createElement("a"),
                        url = URL.createObjectURL(
                          new Blob([content], {
                            type: "text/plain;charset=utf-8",
                          }),
                        );
                      a.href = url;
                      a.download = "小N-学习观察-AI演示.txt";
                      a.click();
                      URL.revokeObjectURL(url);
                      say("已生成带 AI 来源和作答依据的本地文本。");
                    }}
                  >
                    <Download size={16} /> 导出这份观察（AI 演示）
                  </button>
                </>
              )}
              {!learning.enabled && s.page === "plan" && (
                <>
                  <SectionHeading
                    eyebrow="A GENTLE PLAN FOR THIS WEEK"
                    title="这一周，只照顾一个小目标。"
                  >
                    计划为你服务。少一点、晚一点，或者暂时不开始，都可以。
                  </SectionHeading>
                  <div className="plan-goal">
                    <span className="eyebrow">{plan.eyebrow}</span>
                    <h2>{plan.goal}</h2>
                    <p>{plan.note}</p>
                    <Target size={65} />
                  </div>
                  <div className="plan-timeline">
                    {planTasks.map((t, i) => (
                      <div key={t.day}>
                        <span>{i + 1}</span>
                        <div>
                          <small>{t.day}</small>
                          <h3>{t.title}</h3>
                          <p>{t.note}</p>
                        </div>
                        <Leaf size={19} />
                      </div>
                    ))}
                  </div>
                  {s.plan !== "none" && (
                    <div className="notice" role="status">
                      {s.plan === "deferred"
                        ? "当前暂不开始。今日页不会催促任务。"
                        : s.plan === "rescheduled"
                          ? `已改期至 ${s.planDate}。到时也由你主动开始。`
                          : s.plan === "lighter"
                            ? `已减量为 ${planTasks.length} 个小任务，总计约 ${planTasks.reduce((n, t) => n + t.mins, 0)} 分钟。`
                            : "已接受这周计划。随时可以调整。"}
                    </div>
                  )}
                  <div className="button-stack">
                    <button
                      className="primary wide"
                      onClick={() => {
                        patch({ plan: "accepted", rest: false });
                        navigate("today", "今日");
                      }}
                    >
                      接受这个小计划 <Check size={18} />
                    </button>
                    <div className="choice-pair">
                      <button
                        onClick={() => {
                          patch({ plan: "lighter" });
                          say(
                            `已减量：只保留前 ${Math.max(plan.tasks.length - 1, 1)} 个小任务。`,
                          );
                        }}
                      >
                        <Minus size={18} />
                        少做一点
                      </button>
                      <button onClick={() => setModal("date")}>
                        <Clock3 size={18} />
                        换个时间
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        patch({ plan: "deferred" });
                        say("计划暂不开始，今日任务已搁置。");
                      }}
                    >
                      这周先不开始
                    </button>
                    <button
                      className="secondary wide"
                      onClick={() => navigate("today", "今日")}
                    >
                      去今日页，看看当前安排 <ArrowRight size={17} />
                    </button>
                  </div>
                </>
              )}
              {!learning.enabled && s.page === "today" && (
                <>
                  <SectionHeading
                    eyebrow="A LITTLE IS ENOUGH TODAY"
                    title={
                      s.rest ? "今天，留一点空白。" : "今天，只向前一小步。"
                    }
                  >
                    {s.rest
                      ? "你已选择休息。没有需要赶上的进度。"
                      : "有一个小目标就够了，做多久由你决定。"}
                  </SectionHeading>
                  {s.rest || s.plan === "deferred" ? (
                    <div className="rest-panel">
                      <Mascot sleeping />
                      <h2>休息不是落后。</h2>
                      <p>任务已暂停，提醒也已停止。</p>
                      <button
                        className="secondary"
                        onClick={() => {
                          patch({ rest: false, plan: "none" });
                          navigate("plan", "成长");
                        }}
                      >
                        我想自己重新安排
                      </button>
                    </div>
                  ) : s.plan === "none" ? (
                    <div className="empty-state">
                      <Target size={40} />
                      <h2>还没有需要完成的计划</h2>
                      <p>可以先了解一道题，也可以选一个温和的小目标。</p>
                      <button
                        className="primary"
                        onClick={() => navigate("plan", "成长")}
                      >
                        为自己安排一小周 <ArrowRight size={17} />
                      </button>
                    </div>
                  ) : s.plan === "rescheduled" ? (
                    <div className="empty-state">
                      <Clock3 size={42} />
                      <h2>已经换到 {s.planDate}</h2>
                      <p>今天没有安排任务。没有真实通知会自动发送。</p>
                      <button
                        className="secondary"
                        onClick={() => navigate("plan", "成长")}
                      >
                        重新调整计划
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          patch({ plan: "accepted" });
                          say("已由你主动恢复今日计划。");
                        }}
                      >
                        我现在想开始
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="today-ticket">
                        <header>
                          <Tag>我的主要目标</Tag>
                          <span>
                            <Clock3 size={15} />约 {plan.tasks[0].mins} 分钟
                          </span>
                        </header>
                        <h2>{plan.goal}</h2>
                        <div className="ticket-divider" />
                        {plan.tasks.slice(0, 2).map((t, i) => {
                          const st = t.taskId
                            ? taskStatus(s, t.taskId)
                            : "";
                          return (
                            <div className="today-task" key={t.day}>
                              <span className="task-check">
                                {t.taskId && st === "完成" ? (
                                  <Check size={19} />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <div>
                                <h3>{t.title}</h3>
                                <p>
                                  {t.taskId
                                    ? getTask(t.taskId).question.replace(
                                        /^化简：/,
                                        "",
                                      )
                                    : t.note}
                                </p>
                                <small>{t.taskId ? st : "自由安排"}</small>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          className="primary wide"
                          onClick={() => {
                            const target = plan.tasks
                              .map((t) => t.taskId)
                              .filter(Boolean)
                              .find((id) => taskStatus(s, id!) !== "完成");
                            if (target) openTask(target);
                            else navigate("review", "成长");
                          }}
                        >
                          开始今日小任务 <Play size={17} />
                        </button>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          patch({ rest: true });
                          say("今日任务已暂停。想继续时再回来。");
                        }}
                      >
                        <Pause size={16} />
                        今天先暂停
                      </button>
                      <div className="quiet-note">
                        <Leaf size={19} />
                        <p>
                          小进步不是多做几题，
                          <br />
                          而是看懂一个原来容易忽略的地方。
                        </p>
                      </div>
                      <button
                        className="secondary wide"
                        onClick={() => navigate("review", "成长")}
                      >
                        进入阶段回顾 <Sprout size={18} />
                      </button>
                      <button
                        className="text-button"
                        onClick={() => navigate("plan", "成长")}
                      >
                        调整这周计划
                      </button>
                    </>
                  )}
                </>
              )}
              {!learning.enabled && s.page === "review" && (
                <>
                  <SectionHeading
                    eyebrow="NOTICE WHAT HAS CHANGED"
                    title="这一次，有什么不一样？"
                  >
                    用具体的解题变化回顾自己，不用连续天数或聊天时长衡量。
                  </SectionHeading>
                  <div className="review-steps">
                    {[
                      {
                        label: "原题重做",
                        id: "bracket",
                        desc: "看懂修改过程，不算新题独立掌握",
                      },
                      {
                        label: "提示后完成",
                        id: "bracket",
                        desc: "得到帮助后做对，如实记录",
                      },
                      {
                        label: "新题独立完成",
                        id: "transfer",
                        desc: "首次尝试、没有提示，才留下独立依据",
                      },
                    ].map((item, i) => (
                      <div key={item.label}>
                        <span>0{i + 1}</span>
                        <h3>{item.label}</h3>
                        <Tag>
                          {i === 0
                            ? s.records.bracket?.attempts.length > 1
                              ? "已有重做记录"
                              : "暂无重做记录"
                            : i === 1
                              ? s.records.bracket?.attempts.some(
                                  (a) => a.correct && a.hinted,
                                )
                                ? "已有提示完成记录"
                                : "暂无对应记录"
                              : Object.values(s.records).some(
                                    (r) =>
                                      getTask(r.id).phase === "new" &&
                                      r.attempts[0]?.correct &&
                                      !r.attempts[0].hinted,
                                  )
                                ? "已有新题独立记录"
                                : "等待新题观察"}
                        </Tag>
                        <p>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  {Object.values(s.records).some(
                    (r) =>
                      getTask(r.id).phase === "new" &&
                      r.attempts[0]?.correct &&
                      !r.attempts[0].hinted,
                  ) && (
                    <div className="feedback success">
                      <h3>一个具体的新变化</h3>
                      <p>
                        这道同类新题，你没有使用提示就处理对了括号前的负号。表现是否稳定，还可以过几天再看看。
                      </p>
                    </div>
                  )}
                  <button
                    className="primary wide"
                    onClick={() => openTask(reviewId)}
                  >
                    用一道同类新题回顾 <ArrowRight size={18} />
                  </button>
                  <button
                    className="secondary wide"
                    onClick={() => navigate("report")}
                  >
                    查看完整证据与观察
                  </button>
                </>
              )}
              {s.page === "settings" && (
                <>
                  <div className="profile-card">
                    <span className="profile-avatar">
                      <UserRound size={30} />
                    </span>
                    <div>
                      <h1>我的小小空间</h1>
                      <p>
                        虚构体验者 · {s.grade} · {s.book}
                      </p>
                    </div>
                    <Tag>本地演示</Tag>
                  </div>
                  <div className="settings-group">
                    {[
                      {
                        icon: BookOpen,
                        title: "我的学习记忆",
                        desc: "查看来源、更正、删除与停止使用",
                        page: "memory",
                      },
                      {
                        icon: ShieldCheck,
                        title: "信息与授权",
                        desc: "必要用途、可选功能和保存规则",
                        page: "privacy",
                      },
                      {
                        icon: HeartHandshake,
                        title: "求助与安全支持",
                        desc: "找到现实中值得信任的人",
                        page: "help",
                      },
                      {
                        icon: UserRound,
                        title: "监护人演示",
                        desc: "授权、学习概览与信息权利",
                        page: "guardian",
                      },
                    ].map((item) => (
                      <button
                        key={item.page}
                        onClick={() =>
                          item.page === "help" ? help() : navigate(item.page)
                        }
                      >
                        <item.icon size={22} />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.desc}</small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  </div>
                  <div className="settings-group">
                    <Toggle
                      title="大字体"
                      description="让正文更容易阅读，保留系统缩放能力。"
                      checked={large}
                      onChange={() => setLarge(!large)}
                    />
                    <Toggle
                      title="断网与失败演示"
                      description="开启后，聊天回复、任务提交和通知演示会失败；草稿保留。本次页面有效，刷新后关闭。"
                      checked={offline}
                      onChange={() => setOffline(!offline)}
                    />
                    <button onClick={() => setModal("ai")}>
                      <CircleHelp size={22} />
                      <span>
                        <strong>关于小N与服务说明</strong>
                        <small>AI 身份、模拟范围与帮助</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="settings-group">
                    <button
                      onClick={() => {
                        patch({ onboarded: false, onboardStep: 0 });
                        say("重新进入首次介绍，原有学习进度保留。");
                      }}
                    >
                      <RotateCcw size={20} />
                      <span>
                        <strong>重新体验首次进入</strong>
                        <small>保留原有学习进度与选择</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                    <button
                      className="danger"
                      onClick={() => setModal("reset")}
                    >
                      <Trash2 size={20} />
                      <span>
                        <strong>重置整个演示</strong>
                        <small>清空这台设备上的进度、图片与记忆</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <p className="center small muted">
                    学伴小N · 交互原型 1.0
                    <br />
                    模型状态见连接栏；真实模式会外发必要学习上下文，通知仍为演示。
                  </p>
                </>
              )}
              {!learning.enabled && s.page === "memory" && (
                <>
                  <SectionHeading
                    eyebrow="YOU DECIDE WHAT STAYS"
                    title="记住什么，由你决定。"
                  >
                    记忆与演示进度分开。关闭长期记忆，不会抹去当前题目和计划。
                  </SectionHeading>
                  <Toggle
                    title="跨会话长期记忆"
                    description={
                      s.longMemory
                        ? "已开启。只记录你主动分享的偏好和任务表现，不保存短期情绪标签。"
                        : "已关闭。已有条目不再供后续使用，也不会新增长期条目。作答进度仍独立保存在本机。"
                    }
                    checked={s.longMemory}
                    onChange={() => patch({ longMemory: !s.longMemory })}
                  />
                  {(
                    [
                      "你告诉小N的",
                      "学习过程中记录的",
                      "目前的学习观察",
                    ] as const
                  ).map((category) => (
                    <section className="memory-section" key={category}>
                      <h2>{category}</h2>
                      {memories.filter((m) => m.category === category)
                        .length ? (
                        memories
                          .filter((m) => m.category === category)
                          .map((m) => (
                            <article key={m.id}>
                              <Tag>
                                {s.longMemory && m.active
                                  ? "正在使用"
                                  : "已停止使用"}
                              </Tag>
                              {editing === m.id ? (
                                <>
                                  <textarea
                                    aria-label="更正记忆内容"
                                    value={editText}
                                    onChange={(e) =>
                                      setEditText(e.target.value)
                                    }
                                  />
                                  <button
                                    className="primary"
                                    onClick={() => {
                                      if (!editText.trim()) return;
                                      setMemories((ms) =>
                                        ms.map((x) =>
                                          x.id === m.id
                                            ? {
                                                ...x,
                                                text: editText.trim(),
                                                source:
                                                  "你手动更正 · 原来源：" +
                                                  x.source,
                                                time: timeLabel(),
                                              }
                                            : x,
                                        ),
                                      );
                                      setEditing(null);
                                      say("记忆内容已更正。");
                                    }}
                                  >
                                    保存更正
                                  </button>
                                </>
                              ) : (
                                <p>{m.text}</p>
                              )}
                              <small>
                                来源：{m.source}
                                <br />
                                {m.time}
                              </small>
                              <div className="memory-actions">
                                <button
                                  onClick={() => {
                                    setEditing(m.id);
                                    setEditText(m.text);
                                  }}
                                >
                                  更正
                                </button>
                                <button
                                  onClick={() =>
                                    setMemories((ms) =>
                                      ms.map((x) =>
                                        x.id === m.id
                                          ? { ...x, active: !x.active }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  {m.active ? "停止使用" : "恢复使用"}
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    setMemories((ms) =>
                                      ms.filter((x) => x.id !== m.id),
                                    );
                                    say(
                                      "该条长期记忆已从本机删除。原始任务记录仍可在学习观察中管理。",
                                    );
                                  }}
                                >
                                  删除
                                </button>
                              </div>
                            </article>
                          ))
                      ) : (
                        <p className="memory-empty">
                          这里还没有长期条目。不会为了填满页面而推断你的性格或感受。
                        </p>
                      )}
                    </section>
                  ))}
                  <button
                    className="secondary wide"
                    disabled={!s.longMemory}
                    onClick={() =>
                      remember({
                        id: "preference-demo",
                        category: "你告诉小N的",
                        text: "我更喜欢先看一个例子，再自己试一试。",
                        source: "你主动选择保存的虚构偏好",
                        time: timeLabel(),
                        active: true,
                      })
                    }
                  >
                    主动保存一条示例学习偏好
                  </button>
                  <button
                    className="secondary wide"
                    disabled={
                      !s.longMemory || !report.some((o) => o.basis.length)
                    }
                    onClick={() => {
                      const o = report.find((o) => o.basis.length)!;
                      remember({
                        id: `observation-${o.dim}-${o.basis.length}`,
                        category: "目前的学习观察",
                        text: o.finding,
                        source: `你选择保留的 ${o.dim} 任务观察 · ${o.basis.length} 道题`,
                        time: timeLabel(),
                        active: true,
                      });
                      say("已保留带来源的学习观察，可随时更正或删除。");
                    }}
                  >
                    选择保留当前一项学习观察
                  </button>
                  <div className="info-paper">
                    <h3>方法笔记 · 固定成果</h3>
                    {Object.values(s.records).filter((r) =>
                      r.attempts.some((a) => a.correct),
                    ).length ? (
                      Object.values(s.records)
                        .filter((r) => r.attempts.some((a) => a.correct))
                        .map((r) => (
                          <p key={r.id}>
                            <strong>{getTask(r.id).title}</strong>
                            <br />
                            {getTask(r.id).explanation}
                          </p>
                        ))
                    ) : (
                      <p>
                        完成一项任务后，会整理对应的方法。不会因重复提交重复增加。
                      </p>
                    )}
                    <small>方法笔记属于本机学习进度，不是可选长期记忆。</small>
                  </div>
                </>
              )}
              {s.page === "privacy" && (
                <>
                  <SectionHeading
                    eyebrow="CLEAR AND IN YOUR CONTROL"
                    title="信息，清清楚楚。"
                  >
                    本页说明的是当前本地原型的实际行为，不代表正式服务的合规认证。
                  </SectionHeading>
                  <div className="privacy-table">
                    <div>
                      <strong>基本服务 · 必要</strong>
                      <Tag>{s.necessary ? "已了解并确认" : "尚未确认"}</Tag>
                      <p>
                        年龄段、年级、教材用于匹配内容；聊天、作答、提示、计划用于当前体验与刷新恢复。
                      </p>
                    </div>
                    <div>
                      <strong>跨会话长期记忆 · 可选</strong>
                      <Tag>{(learning.enabled ? learning.view?.optionalMemory : s.longMemory) ? "开启" : "关闭"}</Tag>
                      <p>仅保存主动保留的偏好、任务表现与观察，独立存储。</p>
                      <button onClick={() => navigate("memory")}>
                        管理记忆与开关 <ArrowRight size={15} />
                      </button>
                    </div>
                    <div>
                      <strong>学习研究 · 可选</strong>
                      <Tag>{s.research ? "已选演示授权" : "关闭"}</Tag>
                      <p>当前原型没有研究收集服务，不传输任何研究材料。</p>
                      <Toggle
                        title="研究用途授权演示"
                        checked={s.research}
                        onChange={() => patch({ research: !s.research })}
                      />
                    </div>
                  </div>
                  <div className="info-paper">
                    <h3>第三方服务与生成来源</h3>
                    <p>
                      {learning.enabled ? "已接入本机受控Agent服务；真实模型模式向智谱发送当前消息、必要题目/原始作答/rubric与许可偏好。报告事实与计划来自程序核验的证据。" : "当前为离线规则原型，聊天来自本地预设，观察来自本机作答。"} OCR、身份核验、通知和研究平台仍未接入，插画为原创矢量绘制，未宣称安全认证。
                    </p>
                    <h3>保存与删除</h3>
                    <p>
                      {learning.enabled ? "新版学习记录、报告、计划与许可偏好保存在本机SQLite；草稿和导航使用浏览器恢复缓存。旧浏览器资料保留，需主动预览导入。" : "离线版在浏览器保留进度、可选记忆与图片。"} 移除图片清除对应核对内容；重置会同时请求清除新版SQLite与旧浏览器数据；服务未连接时不假装完成清除。
                    </p>
                    <h3>信息权利与反馈</h3>
                    <p>
                      可以查看、更正、停止使用或删除长期记忆，也可以清除全部演示。正式服务需要身份核验与可联系的权利受理渠道，这里只演示状态。
                    </p>
                    <button
                      className="secondary wide"
                      onClick={() => {
                        patch({ rights: "none" });
                        navigate("guardian");
                      }}
                    >
                      演示信息查阅申请
                    </button>
                    <button
                      className="secondary wide"
                      onClick={() => setModal("feedback")}
                    >
                      提交反馈演示
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => setModal("reset")}
                    >
                      清除本机演示内容
                    </button>
                  </div>
                </>
              )}
              {s.page === "help" && (
                <>
                  <div className="help-hero">
                    <HeartHandshake size={36} />
                    <span className="eyebrow">
                      YOU DON'T HAVE TO DO THIS ALONE
                    </span>
                    <h1>先照顾好此刻的你。</h1>
                    <p>
                      谢谢你愿意停下来。学习任务和测评已经暂停。
                      <br />
                      你可以慢慢说，也可以先不说。
                    </p>
                  </div>
                  <div className="support-paper">
                    <h2>找一个现实中可信任的人</h2>
                    <p>
                      如果可以，去一个有人陪伴、让你感觉更安全的地方，联系信任的老师、家人或其他成年人。
                    </p>
                    <p>
                      如果正在面临紧迫的人身危险，请优先离开危险环境，向身边可信成年人或当地紧急服务求助。这里没有人工值守，也无法派人到场。
                    </p>
                  </div>
                  <div className="contact-demo">
                    <div className="section-title">
                      <h2>联系支持 · 演示</h2>
                      <Tag>不会发送真实消息</Tag>
                    </div>
                    {s.unsafe ? (
                      <>
                        <div className="notice">
                          <ShieldCheck size={20} />
                          不会通知刚才那个可能不安全的联系人。
                        </div>
                        <h3>换一个更安全的支持方向</h3>
                        <p>
                          可以选择其他可信成年人；也可以在学校寻找负责学生保护的老师，请他们协助联系当地正规保护资源。
                        </p>
                        <label className="field">
                          你想考虑的支持
                          <select
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                          >
                            <option>学校里负责学生保护的老师</option>
                            <option>另一位我信任的成年人</option>
                          </select>
                        </label>
                      </>
                    ) : (
                      <label className="field">
                        选择你信任的人
                        <select
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                        >
                          <option>我信任的老师</option>
                          <option>我信任的家人</option>
                          <option>另一位我信任的成年人</option>
                        </select>
                      </label>
                    )}
                    <div className={`notification-state state-${s.helpStatus}`}>
                      <strong>
                        {
                          {
                            none: "尚未发起",
                            confirm: "等待你的确认",
                            sending: "发送中（演示）",
                            sent: "已发送（演示）",
                            failed: "发送失败（演示）",
                          }[s.helpStatus]
                        }
                      </strong>
                      <p>
                        {s.helpStatus === "sent"
                          ? "这仅表示模拟发送流程结束，不表示对方已读或已经提供帮助。"
                          : "你确认前，不会进入模拟发送。不会附带聊天原文。"}
                      </p>
                    </div>
                    {s.helpStatus === "none" && (
                      <button
                        className="primary wide"
                        onClick={() => patch({ helpStatus: "confirm" })}
                      >
                        准备求助信息 <ArrowRight size={17} />
                      </button>
                    )}
                    {s.helpStatus === "confirm" && (
                      <>
                        <div className="message-preview">
                          <span>给：{contact}</span>
                          <p>
                            “我现在需要一点陪伴。你方便和我待一会儿，听我说说吗？”
                          </p>
                          <small>不会包含你的敏感倾诉内容。</small>
                        </div>
                        <Toggle
                          title="模拟发送失败"
                          checked={helpFail}
                          onChange={() => setHelpFail(!helpFail)}
                        />
                        <button
                          className="primary wide"
                          onClick={() => {
                            patch({ helpStatus: "sending" });
                          }}
                        >
                          确认模拟发送
                        </button>
                        <button
                          className="text-button"
                          onClick={() => patch({ helpStatus: "none" })}
                        >
                          取消，不发送
                        </button>
                      </>
                    )}
                    {s.helpStatus === "sending" && (
                      <p role="status">
                        <LoaderCircle size={18} className="spin" />
                        正在演示发送状态…
                      </p>
                    )}
                    {s.helpStatus === "failed" && (
                      <>
                        <p className="error">
                          求助没有送达，先不要等待这条模拟消息。你可以当面去找可信任的人，或换一个联系方向。
                        </p>
                        <button
                          className="secondary wide"
                          onClick={() => {
                            setHelpFail(false);
                            patch({ helpStatus: "confirm" });
                          }}
                        >
                          重试前重新确认
                        </button>
                        <button
                          className="secondary wide"
                          onClick={() => {
                            patch({ unsafe: true, helpStatus: "none" });
                            setContact("学校里负责学生保护的老师");
                          }}
                        >
                          换一位可信成年人
                        </button>
                      </>
                    )}
                    {s.helpStatus === "sent" && (
                      <button
                        className="secondary wide"
                        onClick={() => patch({ helpStatus: "none" })}
                      >
                        还没得到帮助？考虑另一个支持方向
                      </button>
                    )}
                    <button
                      className="text-button danger"
                      onClick={() => {
                        patch({ unsafe: true, helpStatus: "none" });
                        setContact("学校里负责学生保护的老师");
                      }}
                    >
                      这个联系人可能让我不安全
                    </button>
                  </div>
                  <div className="support-paper">
                    <h3>你也可以先做一件很小的事</h3>
                    <p>
                      坐到让自己安心的位置，喝一点水，或邀请一个信任的人陪你。你不需要先完成学习任务。
                    </p>
                  </div>
                  <button
                    className="secondary wide"
                    onClick={() => {
                      patch({ safety: false });
                      goTab("小N");
                    }}
                  >
                    我想自主返回学习空间
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      patch({ safety: false });
                      rest();
                    }}
                  >
                    今天休息，停止任务提醒
                  </button>
                </>
              )}
              {s.page === "guardian" && (
                <>
                  <SectionHeading
                    eyebrow="GUARDIAN VIEW · DEMO ONLY"
                    title="支持孩子，也尊重边界。"
                  >
                    这是权限设计演示。前端切换页面没有实现真实身份核验或数据访问隔离。
                  </SectionHeading>
                  {guardianPanel()}
                  <div className="guardian-overview">
                    <h2>学习概览</h2>
                    <Tag>不展示敏感倾诉原文</Tag>
                    <dl>
                      <dt>当前目标</dt>
                      <dd>
                        {s.plan === "none"
                          ? "尚未接受计划"
                          : "看清括号前的负号"}
                      </dd>
                      <dt>任务进度</dt>
                      <dd>
                        {doneCount} 个维度留下完成记录 · 计算已打开{" "}
                        {s.calcSeen.length} 题
                      </dd>
                      <dt>具体学习表现</dt>
                      <dd>{report[2].finding}</dd>
                    </dl>
                  </div>
                  <div className="rights-card">
                    <h2>信息查阅申请 · 演示</h2>
                    <label className="field">
                      申请范围
                      <select
                        value={s.rightsScope}
                        disabled={s.rights === "processing"}
                        onChange={(e) =>
                          patch({ rightsScope: e.target.value, rights: "none" })
                        }
                      >
                        <option>学习目标与任务记录</option>
                        <option>授权状态与保存规则</option>
                        <option>涉及敏感内容的查阅请求</option>
                      </select>
                    </label>
                    <div className="status-line">
                      状态：
                      <strong>
                        {
                          {
                            none: "尚未申请",
                            verify: "等待必要核验",
                            processing: "处理中",
                            result: "结果可查看",
                          }[s.rights]
                        }
                      </strong>
                    </div>
                    {s.rights === "none" && (
                      <button
                        className="secondary wide"
                        onClick={() => patch({ rights: "verify" })}
                      >
                        提交申请演示
                      </button>
                    )}
                    {s.rights === "verify" && (
                      <>
                        <p>
                          正式服务应核验身份、关系、申请范围与适用权限。本原型不采集身份证件。
                        </p>
                        <button
                          className="primary wide"
                          onClick={() => {
                            patch({ rights: "processing" });
                          }}
                        >
                          模拟完成必要核验
                        </button>
                        <button
                          className="text-button"
                          onClick={() => patch({ rights: "none" })}
                        >
                          取消申请
                        </button>
                      </>
                    )}
                    {s.rights === "processing" && (
                      <p>
                        <LoaderCircle size={17} className="spin" />
                        正在处理申请演示…
                      </p>
                    )}
                    {s.rights === "result" && (
                      <div className="notice">
                        {s.rightsScope === "涉及敏感内容的查阅请求"
                          ? "结果：需进一步核实必要性与权限，没有直接展示敏感倾诉内容。"
                          : s.rightsScope === "授权状态与保存规则"
                            ? `演示结果：长期记忆${s.longMemory ? "开启" : "关闭"}；研究用途${s.research ? "选择授权演示" : "关闭"}。内容保留在本机，直至主动删除。`
                            : `演示结果：${s.plan === "none" ? "尚未接受计划" : "目标为看清括号前的负号"}；已有 ${doneCount} 个维度留下完成记录。`}
                      </div>
                    )}
                  </div>
                  <div className="info-paper">
                    <h3>安全提醒状态</h3>
                    <p>
                      {s.unsafe
                        ? "当前选择了其他可信成年人或学校保护路径；没有通知可能不安全的联系人。"
                        : `当前：${{ none: "尚未发起", confirm: "等待学生确认", sending: "发送中（演示）", sent: "已发送（演示），不代表已读或帮助已到达", failed: "发送失败（演示），需选择其他支持路径" }[s.helpStatus]}`}
                    </p>
                    <small>不会默认共享敏感聊天原文。所有通知均为模拟。</small>
                  </div>
                </>
              )}
            </main>
            <nav className="bottom-nav" aria-label="主导航">
              {[
                { name: "小N", icon: MessageCircle },
                { name: "探索", icon: Compass },
                { name: "今日", icon: BookOpen },
                { name: "成长", icon: Sprout },
              ].map((item) => (
                <button
                  key={item.name}
                  className={s.tab === item.name ? "active" : ""}
                  aria-current={s.tab === item.name ? "page" : undefined}
                  onClick={() => goTab(item.name)}
                >
                  <span>
                    <item.icon size={22} />
                    {s.tab === item.name && <i />}
                  </span>
                  {item.name}
                </button>
              ))}
            </nav>
          </>
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            {toast}
          </div>
        )}
        {modal && (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="提示与确认"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close icon-button"
                aria-label="关闭弹窗"
                onClick={() => setModal(null)}
              >
                <X size={22} />
              </button>
              {modal === "ai" && (
                <>
                  <Mascot small />
                  <span className="eyebrow">很高兴，认识你</span>
                  <h2>我是小N，一个 AI 学伴。</h2>
                  <p>
                    陪你做日常数学学习，不评判智力或人格，不诊断心理疾病，不承诺治疗或保证提高成绩。
                  </p>
                  <p>
                    服务未连接时使用离线规则；连接后运行受控Tutor、Assessor与PlannerReporter。真实模型会收到当前消息、必要题目/作答/rubric和获准偏好；模型可能出错，数学步骤与观察请一起核对。
                  </p>
                  <p>
                    你可以随时暂停、休息、关闭可选记忆；需要现实中的帮助时，去找值得信任的人。
                  </p>
                  <button
                    className="primary wide"
                    onClick={() => setModal(null)}
                  >
                    我了解了
                  </button>
                </>
              )}
              {modal === "start-question" && (
                <>
                  <BookOpen size={31} />
                  <h2>一起看一道题，好吗？</h2>
                  <p>只看一小步。先自己试试，也能随时要一点提示或暂停。</p>
                  <button
                    className="primary wide"
                    onClick={() => {
                      setModal(null);
                      openTask("bracket");
                    }}
                  >
                    我愿意，从示例题开始
                  </button>
                  <button
                    className="secondary wide"
                    onClick={() => {
                      setModal(null);
                      navigate("upload");
                    }}
                  >
                    我想先带来一道题
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      patch({ questionInvitePaused: true });
                      setModal(null);
                      say("好的，先不看题。想开始时由你决定。");
                    }}
                  >
                    现在先不看
                  </button>
                </>
              )}
              {modal.startsWith("dimension-") &&
                (() => {
                  const i = Number(modal.split("-")[1]),
                    d = dimensionDetails[i],
                    id = ["understand", "logic", "bracket", "model", "space"][
                      i
                    ],
                    Icon = icons[i];
                  return (
                    <>
                      <span
                        className="dimension-icon"
                        style={{ background: d.color }}
                      >
                        <Icon size={29} />
                      </span>
                      <span className="eyebrow">
                        {d.name} · {taskStatus(s, id)}
                      </span>
                      <h2>欢迎来到{d.place}</h2>
                      <p>
                        通过几个小任务，看看你现在怎样理解和解决问题。你可以随时暂停，结果只代表这些任务中的表现。
                      </p>
                      {i > 1 &&
                      (!s.records.understand?.attempts.length ||
                        !s.records.logic?.attempts.length) ? (
                        <>
                          <div className="notice">
                            这次探索先从理解与逻辑两站开始。不需要答对才能继续，暂停也不代表能力弱。
                          </div>
                          <button
                            className="primary wide"
                            onClick={() => {
                              setModal(null);
                              openTask(
                                s.records.understand?.attempts.length
                                  ? "logic"
                                  : "understand",
                              );
                            }}
                          >
                            {s.records.understand?.attempts.length
                              ? "先去逻辑小桥"
                              : "先去理解花园"}{" "}
                            <ArrowRight size={17} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="primary wide"
                          onClick={() => {
                            setModal(null);
                            openTask(id);
                          }}
                        >
                          我愿意，进入这个小任务 <ArrowRight size={17} />
                        </button>
                      )}
                      <button
                        className="text-button"
                        onClick={() => setModal(null)}
                      >
                        先看看地图
                      </button>
                    </>
                  );
                })()}
              {modal === "date" && (
                <>
                  <Clock3 size={30} />
                  <h2>换到你方便的时候</h2>
                  <label className="field">
                    希望开始的日期
                    <input
                      type="date"
                      value={s.planDate || "2026-10-22"}
                      onChange={(e) => patch({ planDate: e.target.value })}
                    />
                  </label>
                  <p className="small muted">
                    只调整本机计划，不会发送真实通知。
                  </p>
                  <button
                    className="primary wide"
                    onClick={() => {
                      patch({
                        plan: "rescheduled",
                        planDate: s.planDate || "2026-10-22",
                      });
                      setModal(null);
                      say("计划日期已调整，今日页会同步显示。");
                    }}
                  >
                    确认改期
                  </button>
                </>
              )}
              {modal === "reset" && (
                <>
                  <Trash2 size={30} />
                  <h2>清空这台设备的演示？</h2>
                  <p>
                    将删除本原型的聊天、作答、计划、长期记忆和图片，重新开始首次介绍。这个本机删除无法撤销。新版会同时请求本地服务清除SQLite记录。
                  </p>
                  <p>连接新版时，同时清除本机 SQLite 的作答、证据、历史报告、计划、偏好和新版草稿，以及旧浏览器进度与图片。服务未连接时会停止清除，避免刷新后记录复活。</p>
                  <button className="primary wide danger-fill" onClick={()=>void reset()}>
                    确认清空本机演示
                  </button>
                  <button
                    className="secondary wide"
                    onClick={() => setModal(null)}
                  >
                    保留内容，返回
                  </button>
                </>
              )}
              {modal === "feedback" && (
                <>
                  <MessageCircle size={30} />
                  <h2>反馈演示</h2>
                  <label className="field">
                    你想告诉我们
                    <textarea
                      id="feedback"
                      placeholder="请勿填写真实个人信息"
                      rows={4}
                    />
                  </label>
                  <p>当前没有受理服务，这段内容不会传输。</p>
                  <button
                    className="primary wide"
                    onClick={() => {
                      setModal(null);
                      say("反馈演示结束。没有向任何服务发送内容。");
                    }}
                  >
                    结束演示，不发送
                  </button>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
function Toggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={`switch ${checked ? "on" : ""}`}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}
export default App;
