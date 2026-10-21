export type AiMessage = { role: "user" | "assistant"; content: string };

const BASE_URL = import.meta.env.VITE_LLM_BASE_URL ?? "";
const API_KEY = import.meta.env.VITE_LLM_API_KEY ?? "";
const MODEL = import.meta.env.VITE_LLM_MODEL ?? "";

export function aiConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY && MODEL);
}

const SYSTEM_PROMPT = [
  "你是「学伴小N」，一名七年级学生的数学学习伙伴，语气温暖、简短、口语化。",
  "原则：先共情再引导；不直接给出题目答案，用提问帮学生自己想到下一步；",
  "只聊数学与学习感受，其他话题温和地拉回来；每次回复不超过80字；",
  "学生想做题时，鼓励从一道小题开始；学生想休息时，尊重学生的选择。",
].join("");

export async function chatWithAI(history: AiMessage[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-20),
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("LLM empty reply");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
