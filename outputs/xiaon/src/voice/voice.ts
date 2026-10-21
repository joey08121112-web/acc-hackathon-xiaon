import { useEffect, useSyncExternalStore } from 'react';
import { apiBlob } from '../agent-client';
import { CLIPS, clipsOf, clipUrl, type ClipGroup } from './clips';
/**
 * One shared audio player for the whole app. `phase` reflects the real <audio> element, so the pet only
 * "speaks" while sound is actually playing. Text is always shown; sound is an optional extra.
 */
export type VoiceState = { available: boolean; asr: boolean; enabled: boolean; phase: 'idle' | 'loading' | 'playing'; error: string };
const KEY = 'xiaon-voice-on';
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
// A talking pet is the product's main interaction, so sound starts on; the student can switch it off and that choice is kept.
const readEnabled = () => { try { return localStorage.getItem(KEY) !== 'false'; } catch { return true; } };
let state: VoiceState = { available: false, asr: false, enabled: readEnabled(), phase: 'idle', error: '' };
const listeners = new Set<() => void>();
const set = (patch: Partial<VoiceState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
let audio: HTMLAudioElement | null = null, generation = 0, controller: AbortController | null = null, objectUrl = '', kind: 'filler' | 'speech' | null = null, unlocked = false, probed = false;
const lastClip: Partial<Record<ClipGroup, string>> = {};
// Short reactions can be cut off by the next touch; only real replies (and the greeting/error lines) are never talked over.
const INTERRUPTIBLE = new Set<ClipGroup>(['think', 'long', 'poke', 'belly', 'leaf', 'hand', 'pat', 'dizzy', 'sleepy', 'retry']);

function player() {
 if (audio) return audio;
 audio = new Audio();
 audio.preload = 'auto';
 audio.addEventListener('playing', () => { if (audio && audio.src.startsWith('data:')) return; set({ phase: 'playing', error: '' }); });
 const idle = () => { if (audio && audio.src.startsWith('data:')) return; kind = null; set({ phase: 'idle' }); };
 audio.addEventListener('ended', idle); audio.addEventListener('pause', idle);
 audio.addEventListener('error', () => { if (audio && audio.src.startsWith('data:')) return; kind = null; set({ phase: 'idle', error: '声音没能播放，文字还在。' }); });
 return audio;
}
const release = () => { if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ''; } };
async function waitForFiller() {
 const a = player();
 if (kind !== 'filler' || a.paused) return;
 await new Promise<void>(resolve => { const done = () => { clearTimeout(t); a.removeEventListener('ended', done); a.removeEventListener('pause', done); resolve(); }; const t = setTimeout(done, 3000); a.addEventListener('ended', done); a.addEventListener('pause', done); });
}
async function play(url: string, gen: number, as: 'filler' | 'speech') {
 const a = player();
 if (gen !== generation) return;
 a.src = url; kind = as;
 try { await a.play(); } catch { kind = null; set({ phase: 'idle', error: '浏览器没有允许自动发声，点一下「朗读」或小N即可。文字都在。' }); }
}
export const voice = {
 /** Call inside a click handler so later automatic playback is allowed by the browser. */
 unlock() {
  if (unlocked) return; unlocked = true;
  const a = player();
  if (a.paused && !a.src) { a.src = SILENT; a.play().then(() => { if (a.src === SILENT) a.pause(); }).catch(() => { unlocked = false; }); }
 },
 stop() { generation++; controller?.abort(); controller = null; kind = null; if (audio) audio.pause(); release(); set({ phase: 'idle' }); },
 setEnabled(on: boolean) { try { localStorage.setItem(KEY, String(on)); } catch { /* storage unavailable */ } set({ enabled: on }); if (!on) voice.stop(); },
 /** A fixed pre-recorded line, instant (no network synthesis). */
 playClip(target: ClipGroup | string) {
  if (!state.available) return;
  const byId = CLIPS.find(c => c.id === target);
  const group = (byId?.group ?? target) as ClipGroup;
  const pool = clipsOf(group), choices = pool.filter(c => c.id !== lastClip[group]), pick = byId ?? (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
  if (!pick) return; lastClip[group] = pick.id;
  voice.unlock();
  if (kind === 'speech') return; // never talk over a reply
  const gen = ++generation; controller?.abort(); controller = null; release();
  return play(clipUrl(pick.id), gen, INTERRUPTIBLE.has(group) ? 'filler' : 'speech');
 },
 playClipIfEnabled(group: ClipGroup | string) { if (state.enabled) return voice.playClip(group); },
 /** Synthesize and play reply text. A pre-recorded "let me think" line that is already playing finishes first. */
 async speak(text: string) {
  if (!state.available || !text.trim()) return;
  voice.unlock();
  if (kind === 'speech') { audio?.pause(); }
  const gen = ++generation; controller?.abort(); const c = new AbortController(); controller = c;
  set({ phase: state.phase === 'playing' ? 'playing' : 'loading', error: '' });
  try {
   const blob = await apiBlob('voice/tts', { text: text.slice(0, 300) }, c.signal);
   if (gen !== generation) return;
   await waitForFiller();
   if (gen !== generation) return;
   release(); objectUrl = URL.createObjectURL(blob);
   await play(objectUrl, gen, 'speech');
  } catch (e) {
   if (gen !== generation || c.signal.aborted) return;
   kind = null; set({ phase: 'idle', error: (e as Error).message || '声音暂时不可用，文字还在。' });
  }
 },
 async probe() {
  if (probed) return; probed = true;
  try { const res = await fetch('/api/health'); const data = await res.json(); set({ available: !!data?.voice?.tts, asr: !!data?.voice?.asr }); } catch { set({ available: false }); }
 },
};
export const getVoiceState = () => state;
/** 'filler' = a short pre-recorded reaction that a new touch may interrupt; 'speech' = a real reply or greeting. */
export const getVoiceKind = () => kind;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useVoice(): VoiceState & { actions: typeof voice } {
 const s = useSyncExternalStore(subscribe, () => state);
 useEffect(() => { void voice.probe(); }, []);
 return { ...s, actions: voice };
}
