export type Dimension = "理解" | "逻辑" | "计算" | "建模" | "空间想象";
export type Task = {
  id: string;
  dim: Dimension;
  title: string;
  question: string;
  choices?: string[];
  answer: string[];
  hint: string;
  explanation: string;
  kind?: "space";
  phase?: "original" | "new";
};
export const dimensions: Dimension[] = [
  "理解",
  "逻辑",
  "计算",
  "建模",
  "空间想象",
];
export const tasks: Task[] = [
  {
    id: "understand",
    dim: "理解",
    title: "读懂一句数学语言",
    question: "“比 x 的 2 倍少 3”可以怎样表示？",
    choices: ["2x − 3", "2(x − 3)", "3 − 2x"],
    answer: ["2x-3"],
    hint: "先找到“x 的 2 倍”，再从它里面减去 3。",
    explanation: "“x 的 2 倍”是 2x，“少 3”是在这个结果上减 3，所以是 2x − 3。",
  },
  {
    id: "logic",
    dim: "逻辑",
    title: "一个例子，够不够？",
    question: "小林说：“两个负数的和一定是正数。”哪个例子能说明这句话不成立？",
    choices: ["(−2) + (−3) = −5", "2 + 3 = 5", "(−2) × (−3) = 6"],
    answer: ["(-2)+(-3)=-5"],
    hint: "要讨论的是“两个负数相加”，不是相乘。",
    explanation:
      "−2 和 −3 都是负数，它们的和是 −5。一个符合条件的反例就能否定“一定”。",
  },
  {
    id: "bracket",
    dim: "计算",
    title: "一起看看这个括号",
    question: "化简：3x − (2x − 5)",
    answer: ["x+5", "5+x"],
    hint: "括号前是减号，括号里的每一项都要变号：−(2x − 5) = −2x + 5。",
    explanation: "3x − (2x − 5) = 3x − 2x + 5 = x + 5。减去 −5，相当于加上 5。",
    phase: "original",
  },
  {
    id: "transfer",
    dim: "计算",
    title: "换一道，看看新变化",
    question: "化简：7a − (3a − 2)",
    answer: ["4a+2", "2+4a"],
    hint: "先只看减号与括号：−(3a − 2) = −3a + 2。",
    explanation: "7a − (3a − 2) = 7a − 3a + 2 = 4a + 2。",
    phase: "new",
  },
  {
    id: "model",
    dim: "建模",
    title: "把生活装进式子里",
    question: "每本练习本 3 元，买 x 本，另付 2 元纸袋费。一共需要多少元？",
    choices: ["3x + 2", "3(x + 2)", "2x + 3"],
    answer: ["3x+2", "2+3x"],
    hint: "练习本的总价是 3x 元，纸袋费只付一次。",
    explanation:
      "x 本练习本共 3x 元，加上一次纸袋费 2 元，总费用是 3x + 2 元。",
  },
  {
    id: "space",
    dim: "空间想象",
    title: "转一转，还是它吗？",
    question: "把左边的 L 形绕中心顺时针旋转 90°，会变成哪一个？",
    choices: ["A", "B", "C"],
    answer: ["B"],
    hint: "原来竖着向上的长边，转完会向右。小短边会朝下。",
    explanation:
      "顺时针旋转 90° 后，长边向右、短边向下，对应 B。旋转不会改变形状与边长。",
    kind: "space",
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `calc-${i}`,
    dim: "计算" as Dimension,
    title: "再观察一个小步骤",
    question: `化简：${i + 5}x − (${i + 2}x − ${i + 1})`,
    answer: [`3x+${i + 1}`, `${i + 1}+3x`],
    hint: `括号前是减号，最后一项 −${i + 1} 去括号后变成 +${i + 1}。`,
    explanation: `同类项合并后是 3x + ${i + 1}。`,
    phase: "new" as const,
  })),
];
export const getTask = (id: string) => tasks.find((t) => t.id === id)!;
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[−–—﹣]/g, "-")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[×·]/g, "*")
    .replace(/\s/g, "")
    .replace(/。$/, "");
// A small, non-evaluating linear-expression parser. Never execute uploaded or student text.
type Linear = { c: number; x: number; a: number };
function linear(source: string): Linear | null {
  let pos = 0;
  const zero = (): Linear => ({ c: 0, x: 0, a: 0 });
  const add = (u: Linear, v: Linear, sign = 1): Linear => ({
    c: u.c + v.c * sign,
    x: u.x + v.x * sign,
    a: u.a + v.a * sign,
  });
  const scale = (u: Linear, k: number): Linear => ({
    c: u.c * k,
    x: u.x * k,
    a: u.a * k,
  });
  function factor(): Linear {
    let sign = 1;
    while (source[pos] === "+" || source[pos] === "-") {
      if (source[pos++] === "-") sign *= -1;
    }
    let out: Linear;
    if (source[pos] === "(") {
      pos++;
      out = sum();
      if (source[pos++] !== ")") throw Error("parenthesis");
    } else if (source[pos] === "x" || source[pos] === "a") {
      out = zero();
      out[source[pos++] as "x" | "a"] = 1;
    } else {
      const match = source.slice(pos).match(/^\d+(?:\.\d+)?/);
      if (!match) throw Error("term");
      pos += match[0].length;
      out = { ...zero(), c: Number(match[0]) };
    }
    return scale(out, sign);
  }
  function product(): Linear {
    let out = factor();
    while (source[pos] === "*" || /[xa(]/.test(source[pos] || "!")) {
      if (source[pos] === "*") pos++;
      const v = factor();
      if ((out.x || out.a) && (v.x || v.a)) throw Error("nonlinear");
      out = out.x || out.a ? scale(out, v.c) : scale(v, out.c);
    }
    return out;
  }
  function sum(): Linear {
    let out = product();
    while (source[pos] === "+" || source[pos] === "-") {
      const sign = source[pos++] === "+" ? 1 : -1;
      out = add(out, product(), sign);
    }
    return out;
  }
  try {
    const result = sum();
    return pos === source.length ? result : null;
  } catch {
    return null;
  }
}
export const correct = (task: Task, value: string) => {
  const normalized = normalize(value);
  if (task.choices) return task.answer.some((a) => normalize(a) === normalized);
  const steps = normalized.split("=");
  if (!task.answer.some((a) => normalize(a) === steps.at(-1))) return false;
  const target = linear(normalize(task.answer[0]));
  return steps.every((step) => {
    const v = linear(step);
    return (
      v &&
      target &&
      Math.abs(v.c - target.c) < 1e-8 &&
      Math.abs(v.x - target.x) < 1e-8 &&
      Math.abs(v.a - target.a) < 1e-8
    );
  });
};
export const dimensionDetails = [
  {
    name: "理解",
    place: "理解花园",
    note: "从一句话，找到数学的意思",
    color: "#dbe8c9",
  },
  {
    name: "逻辑",
    place: "逻辑小桥",
    note: "让每一步，都有自己的理由",
    color: "#f1dfb8",
  },
  {
    name: "计算",
    place: "计算工坊",
    note: "留意符号，也看见小变化",
    color: "#d9e8e2",
  },
  {
    name: "建模",
    place: "生活集市",
    note: "把生活里的问题写成式子",
    color: "#f0d9cc",
  },
  {
    name: "空间想象",
    place: "空间山丘",
    note: "转个角度，发现另一种样子",
    color: "#e3dff0",
  },
];
