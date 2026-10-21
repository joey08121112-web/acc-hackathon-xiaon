import { useSyncExternalStore } from 'react';
import { apiRequest } from '../agent-client';
import { getVoiceState, voice } from './voice';
import { EndpointDetector } from './vad';
import { bytesToBase64, toWav16k } from './wav';
/**
 * Voice input. Two engines behind one interface:
 *  - server: records here, converts to a 16 kHz WAV, the server asks Doubao ASR (preferred once the account has it).
 *  - browser: the browser's own SpeechRecognition (works in Safari/Edge; Chrome in mainland China often cannot reach it).
 * Recording only starts from a click, never on load, and stops by itself after a pause.
 */
export type MicPhase = 'idle' | 'requesting' | 'listening' | 'transcribing';
export type MicEngine = 'server' | 'browser' | 'none';
export type MicState = { phase: MicPhase; interim: string; error: string };
let state: MicState = { phase: 'idle', interim: '', error: '' };
const listeners = new Set<() => void>();
const set = (patch: Partial<MicState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
const levelFns = new Set<(v: number) => void>();
export const onMicLevel = (fn: (v: number) => void) => { levelFns.add(fn); return () => { levelFns.delete(fn); }; };
const emitLevel = (v: number) => levelFns.forEach(f => f(v));
type Session = { stop(): void; cancel(): void };
let session: Session | null = null;
const speechApi = () => (typeof window === 'undefined' ? undefined : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) as (new () => any) | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
export function pickEngine(): MicEngine {
 if (getVoiceState().asr && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia) return 'server';
 return speechApi() ? 'browser' : 'none';
}
const fail = (message: string) => { emitLevel(0); session = null; set({ phase: 'idle', interim: '', error: message }); };
const NO_PERMISSION = '没有麦克风权限。可以在浏览器地址栏旁允许，或者直接打字。';
function describe(e: unknown): string {
 const name = (e as { name?: string })?.name;
 if (name === 'NotAllowedError' || name === 'SecurityError') return NO_PERMISSION;
 if (name === 'NotFoundError' || name === 'OverconstrainedError') return '找不到麦克风。可以直接打字。';
 return (e as Error)?.message || '语音输入暂时不可用，可以打字。';
}
async function startServer(onText: (t: string) => void, onEmpty: () => void): Promise<Session> {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
 const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
 const ctx = new AC();
 await ctx.resume().catch(() => {});
 const analyser = ctx.createAnalyser(); analyser.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(analyser);
 const buf = new Float32Array(analyser.fftSize), chunks: Blob[] = [], recorder = new MediaRecorder(stream), detector = new EndpointDetector();
 recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
 let finished = false, timer = 0;
 const finish = async (send: boolean, note = '') => {
  if (finished) return; finished = true; window.clearInterval(timer);
  const stopped = new Promise<void>(r => { recorder.onstop = () => r(); });
  if (recorder.state !== 'inactive') recorder.stop();
  await stopped; stream.getTracks().forEach(t => t.stop()); emitLevel(0);
  if (!send || !detector.hasSpeech) { void ctx.close(); session = null; set({ phase: 'idle', interim: '', error: note }); if (send) onEmpty(); return; }
  set({ phase: 'transcribing' });
  try {
   const wav = await toWav16k(new Blob(chunks, { type: recorder.mimeType }), ctx); void ctx.close();
   const { text } = await apiRequest<{ text: string }>('voice/asr', { audio: bytesToBase64(wav) });
   session = null; set({ phase: 'idle', interim: '' });
   if (text.trim()) onText(text.trim()); else onEmpty();
  } catch (e) { void ctx.close(); fail((e as Error).message || '识别失败，可以打字。'); }
 };
 recorder.start(250); set({ phase: 'listening' });
 timer = window.setInterval(() => {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0; for (const v of buf) sum += v * v;
  const rms = Math.sqrt(sum / buf.length); emitLevel(Math.min(1, rms * 9));
  const r = detector.push(rms, performance.now());
  if (r === 'end' || r === 'max') void finish(true);
  else if (r === 'no-speech') void finish(false, '没听到声音，再点一下话筒试试。');
 }, 50);
 return { stop: () => void finish(true), cancel: () => void finish(false) };
}
function startBrowser(onText: (t: string) => void, onEmpty: () => void): Session {
 const Api = speechApi()!, rec = new Api();
 rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false;
 let text = '', failed = false, cancelled = false;
 const pulse = window.setInterval(() => emitLevel(0.25 + 0.35 * Math.abs(Math.sin(performance.now() / 260))), 80);
 rec.onstart = () => set({ phase: 'listening' });
 rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; text = t; set({ interim: t }); };
 rec.onerror = (e: { error?: string }) => {
  if (e.error === 'no-speech' || e.error === 'aborted') return;
  failed = true;
  fail(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? NO_PERMISSION : e.error === 'audio-capture' ? '找不到麦克风。可以直接打字。' : e.error === 'network' ? '这个浏览器的语音识别连不上服务（国内的 Chrome 常见）。可以打字，或换 Safari / Edge。' : '语音输入暂时不可用，可以打字。');
 };
 rec.onend = () => {
  window.clearInterval(pulse); emitLevel(0);
  if (failed) return;
  session = null; set({ phase: 'idle', interim: '' });
  if (cancelled) return;
  if (text.trim()) onText(text.trim()); else onEmpty();
 };
 rec.start();
 return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } }, cancel: () => { cancelled = true; try { rec.abort(); } catch { /* already stopped */ } } };
}
export const mic = {
 async start(onText: (text: string) => void, onEmpty: () => void = () => {}) {
  if (state.phase !== 'idle') return;
  voice.stop(); // the pet never talks over the student
  const engine = pickEngine();
  if (engine === 'none') { set({ error: '这个浏览器暂时不能语音输入，可以直接打字。' }); return; }
  set({ phase: 'requesting', error: '', interim: '' });
  try { session = engine === 'server' ? await startServer(onText, onEmpty) : startBrowser(onText, onEmpty); }
  catch (e) { fail(describe(e)); }
 },
 stop() { session?.stop(); },
 cancel() { session?.cancel(); },
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useMic(): MicState & { engine: MicEngine; actions: typeof mic } {
 const s = useSyncExternalStore(subscribe, () => state);
 return { ...s, engine: pickEngine(), actions: mic };
}
