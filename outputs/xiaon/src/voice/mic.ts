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
let attempt: AbortController | null = null;
const speechApi = () => (typeof window === 'undefined' ? undefined : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) as (new () => any) | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
export function pickEngine(): MicEngine {
 if (getVoiceState().asr && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia) return 'server';
 return speechApi() ? 'browser' : 'none';
}
const fail = (message: string) => { emitLevel(0); session = null; set({ phase: 'idle', interim: '', error: message }); };
/** A manual stop sends the recording only if it lasted this long; a tap-tap is not an answer. */
const MANUAL_MIN_MS = 600;
const NO_PERMISSION = '没有麦克风权限。可以在浏览器地址栏旁允许，或者直接打字。';
function describe(e: unknown): string {
 const name = (e as { name?: string })?.name;
 if (name === 'NotAllowedError' || name === 'SecurityError') return NO_PERMISSION;
 if (name === 'NotFoundError' || name === 'OverconstrainedError') return '找不到麦克风。可以直接打字。';
 return (e as Error)?.message || '语音输入暂时不可用，可以打字。';
}
async function startServer(onText: (t: string) => void, onEmpty: () => void, signal: AbortSignal): Promise<Session> {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
 if (signal.aborted) { stream.getTracks().forEach(t => t.stop()); throw signal.reason; }
 const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
 const ctx = new AC();
 try { await ctx.resume(); } catch (e) { stream.getTracks().forEach(t => t.stop()); void ctx.close(); throw e; }
 if (signal.aborted) { stream.getTracks().forEach(t => t.stop()); void ctx.close(); throw signal.reason; }
 const analyser = ctx.createAnalyser(); analyser.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(analyser);
 const buf = new Float32Array(analyser.fftSize), chunks: Blob[] = [], recorder = new MediaRecorder(stream), detector = new EndpointDetector();
 recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
 let finished = false, timer = 0;
 const began = performance.now();
 // manual = the student pressed 说完了: they say they spoke, so a soft voice the detector missed is still sent (after a short minimum).
 const finish = async (send: boolean, note = '', manual = false) => {
  if (finished) return; finished = true; window.clearInterval(timer);
  if (recorder.state !== 'inactive') {
   const stopped = new Promise<void>(r => { recorder.onstop = () => r(); }); recorder.stop(); await stopped;
  }
  stream.getTracks().forEach(t => t.stop()); emitLevel(0);
  if (signal.aborted) { void ctx.close(); return; }
  if (!send || (!detector.hasSpeech && !(manual && performance.now() - began >= MANUAL_MIN_MS))) { void ctx.close(); session = null; set({ phase: 'idle', interim: '', error: note }); if (send) onEmpty(); return; }
  set({ phase: 'transcribing' });
  try {
   const wav = await toWav16k(new Blob(chunks, { type: recorder.mimeType }), ctx); void ctx.close();
   if (signal.aborted) return;
   const { text } = await apiRequest<{ text: string }>('voice/asr', { audio: bytesToBase64(wav) }, signal);
   if (signal.aborted) return;
   session = null; set({ phase: 'idle', interim: '' });
   if (text.trim()) onText(text.trim()); else onEmpty();
  } catch (e) { void ctx.close(); if (!signal.aborted) fail((e as Error).message || '识别失败，可以打字。'); }
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
 return { stop: () => void finish(true, '', true), cancel: () => void finish(false) };
}
function startBrowser(onText: (t: string) => void, onEmpty: () => void, signal: AbortSignal): Session {
 const Api = speechApi()!, rec = new Api();
 rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false;
 let text = '', finished = false;
 const pulse = window.setInterval(() => emitLevel(0.25 + 0.35 * Math.abs(Math.sin(performance.now() / 260))), 80);
 const cleanup = () => { window.clearInterval(pulse); window.clearTimeout(startTimer); window.clearTimeout(maxTimer); emitLevel(0); };
 const reject = (message: string) => {
  if (finished || signal.aborted) return;
  finished = true; cleanup(); try { rec.abort(); } catch { /* already stopped */ } fail(message);
 };
 // Safari can expose SpeechRecognition but never fire onstart/onend when its service is unavailable.
 const startTimer = window.setTimeout(() => reject('浏览器语音识别没有启动。请检查麦克风及系统听写权限，或切换打字。'), 8000);
 const maxTimer = window.setTimeout(() => reject('这次语音识别等待太久，请重新开始或打字。'), 35000);
 rec.onstart = () => { if (!signal.aborted && !finished) { window.clearTimeout(startTimer); set({ phase: 'listening' }); } };
 rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
  if (signal.aborted || finished) return;
  let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; text = t; set({ interim: t });
 };
 rec.onerror = (e: { error?: string }) => {
  if (signal.aborted || finished) return;
  reject(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? NO_PERMISSION : e.error === 'audio-capture' ? '找不到麦克风。可以直接打字。' : e.error === 'network' ? '浏览器的语音识别连不上服务，可以切换打字。' : e.error === 'no-speech' ? '没听清声音，请重新开始或打字。' : '语音输入暂时不可用，可以打字。');
 };
 rec.onend = () => {
  if (finished) return; finished = true; cleanup();
  if (signal.aborted) return;
  session = null; set({ phase: 'idle', interim: '' });
  if (text.trim()) onText(text.trim()); else onEmpty();
 };
 try { rec.start(); } catch (e) { cleanup(); throw e; }
 return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } }, cancel: () => { finished = true; cleanup(); try { rec.abort(); } catch { /* already stopped */ } } };
}
export const mic = {
 async start(onText: (text: string) => void, onEmpty: () => void = () => {}) {
  if (state.phase !== 'idle') return;
  voice.stop(); // the pet never talks over the student
  const engine = pickEngine();
  if (engine === 'none') { set({ error: '这个浏览器暂时不能语音输入，可以直接打字。' }); return; }
  const c = new AbortController(); attempt = c;
  set({ phase: 'requesting', error: '', interim: '' });
  try {
   const next = engine === 'server' ? await startServer(onText, onEmpty, c.signal) : startBrowser(onText, onEmpty, c.signal);
   if (c.signal.aborted) next.cancel(); else session = next;
  } catch (e) { if (!c.signal.aborted) fail(describe(e)); }
 },
 stop() { session?.stop(); },
 cancel() { attempt?.abort(); attempt = null; session?.cancel(); session = null; emitLevel(0); set({ phase: 'idle', interim: '' }); },
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useMic(): MicState & { engine: MicEngine; actions: typeof mic } {
 const s = useSyncExternalStore(subscribe, () => state);
 return { ...s, engine: pickEngine(), actions: mic };
}
