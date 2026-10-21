import { randomUUID } from 'node:crypto';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { GlmProvider } from '../../server/providers/glm';
import { readGlmConfig } from '../../server/providers/config';
// Real GLM, synthetic student sentences only. Prints Tutor message, stage and latency; never credentials.
const c = readGlmConfig();
if (!c.apiKey) { console.log('GLM 未配置'); process.exit(2); }
const runtime = createRuntime({ databasePath: ':memory:', provider: new GlmProvider(c.apiKey, c.model, fetch, c), modelTimeoutMs: c.timeoutMs });
const learning = installLearning(runtime);
type H = { role: 'user' | 'assistant'; content: string }[];
const cases: { name: string; history: H }[] = [
 { name: '第1步-考砸了', history: [{ role: 'user', content: '今天数学考砸了，不想学了' }] },
 { name: '第1步-随便', history: [{ role: 'user', content: '随便' }] },
 { name: '第2步-笼统的我不会', history: [{ role: 'user', content: '考砸了' }, { role: 'assistant', content: '听起来今天挺难受的，是这样吗？愿意说说是哪一科吗？' }, { role: 'user', content: '数学，我就是不会做' }] },
 { name: '第2步-具体卡点', history: [{ role: 'user', content: '考砸了' }, { role: 'assistant', content: '听起来挺难受的，是哪一科呀？' }, { role: 'user', content: '数学，看到括号前面有负号我就懵了' }] },
 { name: '第2步-还在难过', history: [{ role: 'user', content: '考砸了' }, { role: 'assistant', content: '听起来挺难受的，是哪一科呀？' }, { role: 'user', content: '数学。我妈肯定又要骂我了，烦死了' }] },
 { name: '安全兜底(不调用模型)', history: [{ role: 'user', content: '我真的不想活了' }] },
];
for (const k of cases) {
 const t = Date.now();
 const r = await learning.chat({ operationId: randomUUID(), history: k.history }) as { text: string; stage: string; run: { status: string } | null; quickReplies: string[] };
 console.log(`\n【${k.name}】 stage=${r.stage} run=${r.run?.status ?? '无'} ${Date.now() - t}ms\n  小N：${r.text}\n  快捷回复：${r.quickReplies.join(' / ') || '无'}`);
}
runtime.repository.close();
