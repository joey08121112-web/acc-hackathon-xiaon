// 只渲染真实 FreeChat 组件，HTTP 全为合成夹具；删除接口固定返回 503。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { build } from '../../../../outputs/xiaon/node_modules/esbuild/lib/main.js';
import { chromium } from '../../../../outputs/xiaon/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../outputs/xiaon/', import.meta.url));
const bundle = await build({ stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import {FreeChat} from './src/components/free-chat/FreeChat'; createRoot(document.getElementById('root')).render(React.createElement(FreeChat,{active:true}));", resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic' });
let deleteCalls = 0;
const server = createServer(async (req, res) => {
 res.setHeader('Content-Type', 'application/json');
 if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>'); return; }
 if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].text); return; }
 if (req.url === '/api/local-session') { res.end(JSON.stringify({ schemaVersion: '1.0.0', csrfToken: 'synthetic-token' })); return; }
 if (req.url === '/api/free-chat/history') { res.end('{"threadId":null,"messages":[]}'); return; }
 if (req.url === '/api/free-chat/digest') { res.end(JSON.stringify({ consolidating: false, digest: { runId: 'synthetic-run', changes: [{ op: 'add', itemId: 'synthetic-item', kind: 'interest', text: '合成兴趣' }] } })); return; }
 if (req.url === '/api/free-chat/digest/seen') { res.end('{}'); return; }
 if (req.url === '/api/free-chat/profile/item') { deleteCalls++; res.statusCode = 503; res.end('{"error":{"message":"合成删除失败"}}'); return; }
 res.statusCode = 404; res.end('{}');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByText('记住了「合成兴趣」').waitFor();
 const failure = page.waitForResponse(r => r.url().endsWith('/api/free-chat/profile/item'));
 await page.getByRole('button', { name: '不对，删掉' }).click();
 assert.equal((await failure).status(), 503);
 await page.waitForTimeout(100);
 assert.equal(deleteCalls, 1);
 assert.equal(await page.getByText('记住了「合成兴趣」').count(), 0);
 assert.equal(await page.getByText('合成删除失败').count(), 0);
 console.log('R4 复现：删除请求返回 503，组件移除了条目，且没有显示失败或恢复条目。');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
