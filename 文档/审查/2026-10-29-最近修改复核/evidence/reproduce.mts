// 审查证据：断言当前缺陷确实存在；通过不代表产品行为正确。只用合成文本和临时/内存 SQLite。
import test from 'node:test';
import assert from 'node:assert/strict';
import { FreeChatStore } from '../../../../outputs/xiaon/server/free-chat/store.ts';
import { TestClock } from '../../../../outputs/xiaon/server/core/clock.ts';
import { consolidate } from '../../../../outputs/xiaon/server/free-chat/consolidate.ts';
import { freeChat } from '../../../../outputs/xiaon/server/free-chat/chat.ts';
import { createRuntime } from '../../../../outputs/xiaon/server/bootstrap.ts';
import { installLearning } from '../../../../outputs/xiaon/server/agents/learning.ts';
import { createHttpServer } from '../../../../outputs/xiaon/server/http/server.ts';
import { freePort, temporaryRepository } from '../../../../outputs/xiaon/server/storage/testing.ts';
const signal = new AbortController().signal;
const setup = () => {
 const clock = new TestClock('2026-10-29T02:00:00.000Z');
 return { clock, store: new FreeChatStore(':memory:', clock) };
};
function delayed() {
 let release!: (content: string) => void;
 const promise = new Promise<string>(resolve => { release = resolve; });
 const provider = { kind: 'synthetic' as const, supportsTools: false, async complete() { return { content: await promise, toolCalls: [] }; } };
 return { provider, release };
}
const ops = JSON.stringify({ ops: [{ op: 'add', kind: 'interest', text: '喜欢打篮球' }] });
test('R1 HTTP：自由聊等待模型时，重置返回成功，晚到的回答仍重新写入原文', async () => {
 const f = temporaryRepository(), gate = delayed(), runtime = createRuntime({ ...f, provider: gate.provider });
 installLearning(runtime);
 const port = await freePort(), origin = 'http://127.0.0.1:5299', base = `http://127.0.0.1:${port}`;
 const server = createHttpServer(runtime, { host: `127.0.0.1:${port}`, allowedOrigins: [origin] });
 await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
 try {
  const login = await fetch(base + '/api/local-session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  const { csrfToken } = await login.json(), cookie = login.headers.get('set-cookie')!.split(';')[0];
  const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-Xiaon-CSRF': csrfToken }, body: JSON.stringify(body) });
  const pending = post('/api/free-chat', { text: '合成旧消息' });
  await new Promise(resolve => setTimeout(resolve, 50));
  const reset = await post('/api/learning/reset', { operationId: 'audit-reset', confirmation: '清除本机学习记录与偏好' });
  assert.equal(reset.status, 200); assert.deepEqual(await reset.json(), { cleared: true });
  assert.equal(runtime.freeChat.history().messages.length, 0);
  gate.release('合成晚到回答'); assert.equal((await pending).status, 200);
  assert.deepEqual(runtime.freeChat.history().messages.map(m => m.content), ['合成旧消息', '合成晚到回答']);
 } finally { await new Promise<void>(resolve => server.close(() => resolve())); runtime.freeChat.close(); f.dispose(); }
});
test('R1b：后台整理等待中重置，返回后仍写回档案和整理结果', async () => {
 const { clock, store } = setup(), gate = delayed();
 try {
  store.appendExchange(null, '我喜欢打篮球', '好呀');
  const pending = consolidate(store, gate.provider, () => clock.now(), signal);
  store.reset(); gate.release(ops); await pending;
  assert.deepEqual(store.profile().items.map(i => i.text), ['喜欢打篮球']);
  assert.ok(store.digest());
 } finally { store.close(); }
});
test('R2：后台整理等待中关闭自动记忆，返回后仍新增档案', async () => {
 const { clock, store } = setup(), gate = delayed();
 try {
  store.appendExchange(null, '我喜欢打篮球', '好呀');
  const pending = consolidate(store, gate.provider, () => clock.now(), signal);
  store.setAutoRemember(false); gate.release(ops); await pending;
  assert.equal(store.autoRemember(), false);
  assert.deepEqual(store.profile().items.map(i => i.text), ['喜欢打篮球']);
 } finally { store.close(); }
});
test('R3：删除后仅说一句无关话，旧兴趣仍被模型操作重新加回', async () => {
 const { clock, store } = setup(), gate = delayed();
 try {
  store.appendExchange(null, '我喜欢打篮球', '好呀');
  const id = store.insert({ kind: 'interest', text: '喜欢打篮球', source: 'chat', editedByStudent: false });
  clock.advance(1000); store.studentEdit({ action: 'delete', id });
  clock.advance(1000); store.appendExchange(store.currentThread(), '今天的数学题怎么做', '我们看看题');
  const pending = consolidate(store, gate.provider, () => clock.now(), signal);
  gate.release(ops); await pending;
  assert.deepEqual(store.profile().items.map(i => i.text), ['喜欢打篮球']);
 } finally { store.close(); }
});
test('设计取舍（不列为缺陷）：8000 字之外的旧消息未发给模型，整批仍标为已整理', async () => {
 const { clock, store } = setup(); let sent = '';
 const provider = { kind: 'synthetic' as const, supportsTools: false, async complete({ messages }: any) { sent = messages[1].content; return { content: '{"ops":[]}', toolCalls: [] }; } };
 try {
  store.appendExchange(null, '旧消息标记：我喜欢下棋', '好');
  for (let i = 0; i < 6; i++) store.appendExchange(store.currentThread(), '新'.repeat(1800), '答'.repeat(100));
  await consolidate(store, provider, () => clock.now(), signal);
  assert.equal(sent.includes('旧消息标记'), false);
  assert.equal(store.pendingMessages().length, 0);
 } finally { store.close(); }
});
test('R5：健康词换一种说法即可通过服务端敏感内容过滤', async () => {
 const { clock, store } = setup(), gate = delayed();
 try {
  store.appendExchange(null, '我患有哮喘', '请跟信任的大人沟通');
  const pending = consolidate(store, gate.provider, () => clock.now(), signal);
  gate.release(JSON.stringify({ ops: [{ op: 'add', kind: 'about', text: '患有哮喘' }] })); await pending;
  assert.deepEqual(store.profile().items.map(i => i.text), ['患有哮喘']);
 } finally { store.close(); }
});
test('补充：首条消息等待时另开一段，旧消息会新建线程并覆盖当前线程', async () => {
 const { store } = setup(), gate = delayed();
 try {
  const pending = freeChat(store, gate.provider, { text: '首条消息' }, signal);
  const fresh = store.newThread(); gate.release('首条回复'); await pending;
  assert.notEqual(store.currentThread(), fresh.threadId);
  assert.deepEqual(store.history().messages.map(m => m.content), ['首条消息', '首条回复']);
 } finally { store.close(); }
});
test('R6：只有旧版小结而没有 chatLog 的已有用户，首页对话记录变成空白', async () => {
 const React = await import('../../../../outputs/xiaon/node_modules/react/index.js');
 const { renderToStaticMarkup } = await import('../../../../outputs/xiaon/node_modules/react-dom/server.node.js');
 const { ChatHistory } = await import('../../../../outputs/xiaon/src/components/learning/home/ChatHistory.tsx');
 const l = { cache: { chat: [] }, view: { chatLog: [], summaries: [{ id: 'old-summary', sessionId: 'old-session', createdAt: '2026-10-28T00:00:00.000Z', topics: ['合成旧话题'], planSuggestions: ['合成旧建议'] }] } };
 const html = renderToStaticMarkup(React.createElement(ChatHistory, { l: l as any, navigate() {} }));
 assert.equal(html, '');
});
