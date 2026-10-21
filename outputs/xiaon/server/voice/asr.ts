import { RuntimeError } from '../core/errors';

/**
 * Doubao recording-file recognition, "flash" edition: one request in, text out (resource volc.bigasr.auc_turbo).
 * Server side only. The account must have this product enabled in the Volcengine console; until then `available()`
 * is false and the client falls back to the browser's own speech recognition.
 */
export const ASR_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
export const ASR_MAX_WAV_BYTES = 1_600_000; // about 50 s of 16 kHz mono 16-bit
export interface AsrConfig { apiKey: string; resourceId: string; timeoutMs: number }
export interface AsrProvider { readonly configured: boolean; available(): Promise<boolean>; transcribe(wav: Buffer, signal: AbortSignal): Promise<string> }

export function readAsrConfig(env: Readonly<Record<string, string | undefined>> = process.env): AsrConfig | null {
 if ((env.XIAON_ASR_PROVIDER ?? 'doubao').trim() !== 'doubao') return null;
 // The new-console API key can be authorized for several speech products, so it may be shared with TTS.
 const apiKey = (env.XIAON_DOUBAO_ASR_API_KEY?.trim() || env.XIAON_DOUBAO_TTS_API_KEY?.trim()) ?? '';
 if (!apiKey) return null;
 const resourceId = env.XIAON_DOUBAO_ASR_RESOURCE_ID?.trim() || 'volc.bigasr.auc_turbo';
 if (!/^[A-Za-z0-9_.-]{1,64}$/.test(resourceId)) throw new RuntimeError('invalid_params', 'ASR 资源ID格式无效');
 return { apiKey, resourceId, timeoutMs: 20_000 };
}
/** A short block of silence, used only to ask the vendor whether this account may use the product. */
export function silentWav(seconds = 0.4, rate = 16000): Buffer {
 const samples = Math.round(seconds * rate), out = Buffer.alloc(44 + samples * 2);
 out.write('RIFF', 0); out.writeUInt32LE(36 + samples * 2, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
 out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(samples * 2, 40);
 return out;
}
export const isWav = (b: Buffer) => b.length > 44 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE';

export class DoubaoAsr implements AsrProvider {
 readonly configured = true;
 private granted: { value: boolean; until: number } | null = null;
 constructor(private config: AsrConfig, private request: typeof fetch = fetch, private now: () => number = Date.now) {}
 async transcribe(wav: Buffer, signal: AbortSignal): Promise<string> {
  if (!isWav(wav) || wav.length > ASR_MAX_WAV_BYTES) throw new RuntimeError('invalid_params', '需要不超过约50秒的 WAV 音频');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new RuntimeError('timeout', '语音识别超时')), this.config.timeoutMs);
  const merged = AbortSignal.any([signal, controller.signal]);
  try {
   let res: Response;
   try {
    res = await this.request(ASR_ENDPOINT, {
     method: 'POST', redirect: 'error', signal: merged,
     headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.config.apiKey, 'X-Api-Resource-Id': this.config.resourceId, 'X-Api-Request-Id': crypto.randomUUID(), 'X-Api-Sequence': '-1' },
     body: JSON.stringify({ user: { uid: 'xiaon' }, audio: { data: wav.toString('base64') }, request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true } }),
    });
   } catch { if (merged.aborted) throw merged.reason; throw new RuntimeError('provider_error', '语音识别网络请求失败'); }
   const code = res.headers.get('x-api-status-code') ?? '';
   const raw = await res.text();
   if (res.status === 401 || res.status === 403 || code === '45000030') { this.granted = { value: false, until: this.now() + 60_000 }; throw new RuntimeError('provider_auth', '语音识别尚未在火山控制台开通或授权'); }
   if (res.status === 429) throw new RuntimeError('provider_rate_limit', '语音识别请求太频繁');
   // 20000003 = the audio held no speech: an honest empty result, not an error.
   if (code === '20000003') { this.granted = { value: true, until: this.now() + 300_000 }; return ''; }
   if (!res.ok || (code && code !== '20000000')) throw new RuntimeError('provider_error', `语音识别返回 ${code || res.status}`);
   let data: { result?: { text?: unknown } };
   try { data = JSON.parse(raw); } catch { throw new RuntimeError('provider_error', '语音识别返回了无法解析的内容'); }
   this.granted = { value: true, until: this.now() + 300_000 };
   return typeof data.result?.text === 'string' ? data.result.text.trim() : '';
  } finally { clearTimeout(timer); }
 }
 /** True only once the vendor has actually accepted a request for this account (cached; a negative answer is re-checked after a minute). */
 async available(): Promise<boolean> {
  if (this.granted && this.granted.until > this.now()) return this.granted.value;
  try { await this.transcribe(silentWav(), AbortSignal.timeout(8000)); return true; }
  catch (e) {
   if ((e as RuntimeError).code === 'provider_auth') return false;
   this.granted = { value: false, until: this.now() + 15_000 }; return false;
  }
 }
}
export class NoAsr implements AsrProvider {
 readonly configured = false;
 async available() { return false; }
 async transcribe(): Promise<string> { throw new RuntimeError('unavailable', '尚未配置语音识别'); }
}
export const asrFromEnvironment = (): AsrProvider => { const c = readAsrConfig(); return c ? new DoubaoAsr(c) : new NoAsr(); };
