import { randomUUID } from 'node:crypto';
import { RuntimeError } from '../core/errors';

/** Doubao (Volcengine) speech synthesis 2.0, HTTP unidirectional streaming. Server-side only; the key never reaches the browser. */
export const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
export const TTS_MAX_CHARS = 300;
export interface TtsConfig { apiKey: string; resourceId: string; speaker: string; timeoutMs: number }
export interface TtsProvider { readonly enabled: boolean; synthesize(text: string, signal: AbortSignal): Promise<Buffer> }

export function readTtsConfig(env: Readonly<Record<string, string | undefined>> = process.env): TtsConfig | null {
 if ((env.XIAON_TTS_PROVIDER ?? '').trim() !== 'doubao') return null;
 const apiKey = env.XIAON_DOUBAO_TTS_API_KEY?.trim() ?? '', speaker = env.XIAON_DOUBAO_TTS_SPEAKER?.trim() ?? '';
 if (!apiKey || !speaker) return null;
 const resourceId = env.XIAON_DOUBAO_TTS_RESOURCE_ID?.trim() || 'seed-tts-2.0';
 if (!/^[A-Za-z0-9_.-]{1,64}$/.test(resourceId) || !/^[A-Za-z0-9_.-]{1,128}$/.test(speaker)) throw new RuntimeError('invalid_params', 'TTS 资源ID或音色ID格式无效');
 return { apiKey, resourceId, speaker, timeoutMs: 20_000 };
}

/** The vendor streams JSON objects; split by brace depth (string-aware) so any chunk boundary is safe. */
export function* jsonObjects(buffer: string): Generator<{ value: unknown; rest: string }> {
 let depth = 0, inString = false, escaped = false, start = -1;
 for (let i = 0; i < buffer.length; i++) {
  const ch = buffer[i];
  if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue; }
  if (ch === '"') inString = true;
  else if (ch === '{') { if (depth++ === 0) start = i; }
  else if (ch === '}' && --depth === 0 && start >= 0) { yield { value: JSON.parse(buffer.slice(start, i + 1)), rest: buffer.slice(i + 1) }; start = -1; }
 }
}

export class DoubaoTts implements TtsProvider {
 readonly enabled = true;
 private cache = new Map<string, Buffer>();
 constructor(private config: TtsConfig, private request: typeof fetch = fetch) {}
 async synthesize(text: string, signal: AbortSignal): Promise<Buffer> {
  const clean = text.trim();
  if (!clean || clean.length > TTS_MAX_CHARS) throw new RuntimeError('invalid_params', `朗读文字需为 1–${TTS_MAX_CHARS} 个字`);
  const hit = this.cache.get(clean);
  if (hit) { this.cache.delete(clean); this.cache.set(clean, hit); return hit; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new RuntimeError('timeout', '语音合成超时')), this.config.timeoutMs);
  const merged = AbortSignal.any([signal, controller.signal]);
  try {
   let res: Response;
   try {
    res = await this.request(TTS_ENDPOINT, {
     method: 'POST', redirect: 'error', signal: merged,
     headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.config.apiKey, 'X-Api-Resource-Id': this.config.resourceId, 'X-Api-Request-Id': randomUUID() },
     body: JSON.stringify({ req_params: { text: clean, speaker: this.config.speaker, audio_params: { format: 'mp3', sample_rate: 24000 } } }),
    });
   } catch { if (merged.aborted) throw merged.reason; throw new RuntimeError('provider_error', '语音服务网络请求失败'); }
   if (!res.ok || !res.body) throw new RuntimeError(res.status === 401 || res.status === 403 ? 'provider_auth' : res.status === 429 ? 'provider_rate_limit' : 'provider_error', `语音服务返回 HTTP ${res.status}`);
   const parts: Buffer[] = [];let pending = '', finished = false;
   const decoder = new TextDecoder();
   for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    pending += decoder.decode(chunk, { stream: true });
    let consumed = pending;
    for (const { value, rest } of jsonObjects(pending)) {
     consumed = rest;
     const o = value as { code?: number; message?: string; data?: string | null };
     // 0 = audio chunk; 20000000 = end of stream. Anything else is a vendor error.
     if (o.code !== undefined && o.code !== 0 && o.code !== 20000000) throw new RuntimeError('provider_error', `语音服务错误码 ${o.code}`);
     if (o.code === 20000000) finished = true;
     if (o.data) parts.push(Buffer.from(o.data, 'base64'));
    }
    pending = consumed;
   }
   const audio = Buffer.concat(parts);
   if (!audio.length) throw new RuntimeError('provider_error', finished ? '语音服务未返回音频' : '语音服务响应不完整');
   this.cache.set(clean, audio);
   if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value as string);
   return audio;
  } finally { clearTimeout(timer); }
 }
}

export class NoTts implements TtsProvider {
 readonly enabled = false;
 async synthesize(): Promise<Buffer> { throw new RuntimeError('unavailable', '尚未配置语音合成'); }
}
export const ttsFromEnvironment = (): TtsProvider => { const c = readTtsConfig(); return c ? new DoubaoTts(c) : new NoTts(); };
