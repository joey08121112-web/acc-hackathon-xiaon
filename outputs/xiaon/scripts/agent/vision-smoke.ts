import { chromium } from '@playwright/test';
import { readGlmConfig } from '../../server/providers/config';
// Vision smoke for stage 0 (zCode route): render the synthetic worksheet from Upload.tsx's
// sample with a real browser, send the JPEG to glm-5.3-flash once, and report status only.
// Never logs the key or the image bytes. No key -> exit 2 with 未运行 (never faked as passed).
const config = readGlmConfig();
if (!config.apiKey) { console.log(JSON.stringify({ status: '未运行', reason: 'XIAON_GLM_API_KEY 未配置' })); process.exit(2); }
const started = Date.now();
// Same synthetic content as the sample sheet in src/Upload.tsx; no real student material.
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fffdf4;font-family:sans-serif">
<div style="width:880px;padding:48px 56px;color:#263c31">
<p style="color:#60695b;font-size:22px">示例学习单 · 虚构资料</p>
<p style="color:#60695b;font-size:22px">姓名：林同学（虚构）　班级：七年级 2 班</p>
<hr style="border:none;border-top:2px solid #dce3d0;margin:24px 0">
<p style="font-size:34px">化简：3x − (2x − 5)</p>
<p style="font-size:26px;color:#68796a">我的尝试：3x − 2x − 5 = x − 5</p>
</div></body>`;
let jpegBase64 = '';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 980, height: 420 } });
  await page.setContent(html);
  jpegBase64 = (await page.screenshot({ type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 980, height: 420 } })).toString('base64');
} finally { await browser.close(); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let report: Record<string, unknown> = { status: '失败' };
  try {
    const res = await fetch(config.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model, stream: false, max_tokens: 512,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
          { type: 'text', text: '看这张学习单图片，返回严格JSON：{"question":"题干原文","studentAttempt":"学生作答原文"}。看不清时返回空字符串，不要猜。' },
        ] }],
      }),
    });
    if (res.status === 401 || res.status === 403) report = { status: '失败', reason: 'provider_auth', http: res.status };
    else if (!res.ok) report = { status: '失败', reason: 'http_' + res.status };
    else {
      const data = await res.json().catch(() => null);
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) as { question?: unknown; studentAttempt?: unknown } : null;
      if (!parsed || typeof parsed.question !== 'string' || typeof parsed.studentAttempt !== 'string') report = { status: '失败', reason: 'bad_json' };
      else {
        const norm = (s: string) => s.replace(/[\s−–]/g, '').toLowerCase();
        const questionOk = norm(parsed.question).includes(norm('3x − (2x − 5)'));
        const attemptOk = norm(parsed.studentAttempt).includes(norm('x − 5'));
        report = { status: '完成', recognizedCorrect: questionOk && attemptOk, questionOk, attemptOk };
      }
    }
  } catch (e) {
    report = { status: '失败', reason: controller.signal.aborted ? 'timeout' : 'network', detail: String((e as Error).message ?? '').slice(0, 120) };
  } finally { clearTimeout(timer); }
  console.log(JSON.stringify({ ...report, model: config.model, ms: Date.now() - started }));
  process.exit(report.status === '完成' ? 0 : 1);