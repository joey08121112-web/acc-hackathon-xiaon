import { useCallback, useEffect, useRef, useState } from 'react';
import type { PetMood, PetTouchKind, PetZone } from '../Art';
import { clipsOf, type ClipGroup } from './clips';
import { getVoiceKind, voice } from './voice';
/**
 * How the pet answers being touched. Everything here is local: no model call, nothing saved, no learning evidence.
 *  tap body -> giggle + a short line      tap belly -> ticklish       tap leaf -> leaf wiggles
 *  tap a hand -> waves back               hold or stroke -> happy, "head pat"
 *  5 quick taps -> dizzy, ignores taps for a moment (so poking can not spam sound)
 *  resting -> only a whisper, never wakes into learning       listening -> ignored (do not distract)
 *  thinking / speaking -> a small body reaction only, no extra line or sound over the real content
 */
export type PetBusy = 'listening' | 'thinking' | 'speaking' | null;
const BUSY_MOOD: Record<Exclude<PetBusy, null>, PetMood> = { listening: 'listening', thinking: 'thinking', speaking: 'speaking' };
export function usePetReactions({ busy, resting }: { busy: PetBusy; resting: boolean }) {
 const [reaction, setReaction] = useState<{ mood: PetMood; line: string } | null>(null);
 const timer = useRef(0), taps = useRef<number[]>([]), dizzyUntil = useRef(0), last = useRef<Partial<Record<ClipGroup, string>>>({});
 const busyRef = useRef(busy), restingRef = useRef(resting);
 busyRef.current = busy; restingRef.current = resting;
 // Audio that is only the pet's own short touch reaction does not count as "busy speaking", so the next poke is answered right away.
 const effectiveBusy = (): PetBusy => (busyRef.current === 'speaking' && getVoiceKind() === 'filler' ? null : busyRef.current);
 useEffect(() => () => window.clearTimeout(timer.current), []);
 const show = useCallback((mood: PetMood, group: ClipGroup | null, ms: number) => {
  let line = '';
  if (group && effectiveBusy() === null) {
   const pool = clipsOf(group), choices = pool.filter(c => c.id !== last.current[group]), pick = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
   if (pick) { last.current[group] = pick.id; line = pick.text; void voice.playClipIfEnabled(pick.id); }
  }
  window.clearTimeout(timer.current);
  setReaction({ mood, line });
  timer.current = window.setTimeout(() => setReaction(null), ms);
 }, []);
 const onTouch = useCallback((zone: PetZone, kind: PetTouchKind) => {
  const b = effectiveBusy(), now = Date.now();
  if (b === 'listening') return;
  if (restingRef.current) { show('idle', 'sleepy', 2600); return; }
  if (now < dizzyUntil.current) return;
  if (kind === 'tap') {
   taps.current = [...taps.current.filter(t => now - t < 2500), now];
   if (taps.current.length >= 5) { taps.current = []; dizzyUntil.current = now + 2600; show('dizzy', 'dizzy', 2400); return; }
  }
  if (b !== null) { show('giggle', null, 700); return; }
  if (kind !== 'tap') return show('happy', 'pat', 2800);
  if (zone === 'leaf') return show('leaf', 'leaf', 1900);
  if (zone === 'hand-l') return show('waveL', 'hand', 1900);
  if (zone === 'hand-r') return show('waveR', 'hand', 1900);
  if (zone === 'belly') return show('giggle', 'belly', 1900);
  show('giggle', 'poke', 1900);
 }, [show]);
 /** A facial reaction (no words, no sound) to something the student explicitly chose, e.g. a quick-reply button. */
 const feel = useCallback((mood: 'happy' | 'concerned', ms = 3000) => show(mood, null, ms), [show]);
 const mood: PetMood = reaction?.mood ?? (busy ? BUSY_MOOD[busy] : 'idle');
 /** The pet says one of its own pre-written lines (e.g. "I didn't catch that"). */
 const say = useCallback((mood: PetMood, group: ClipGroup, ms = 2400) => show(mood, group, ms), [show]);
 return { mood, line: reaction?.line ?? '', onTouch, feel, say };
}
