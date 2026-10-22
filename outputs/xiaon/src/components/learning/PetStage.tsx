import { useEffect, useRef, useState } from 'react';
import { Mascot, type PetMood, type PetTouchKind, type PetZone } from '../../Art';
import { voice } from '../../voice/voice';
import { onMicLevel } from '../../voice/mic';
/** What the pet says while a real request is in flight. Each step is time-based, not a fake progress bar;
 * every step has a few lines so a slow reply does not repeat the same sentence each time. */
export const THINKING: readonly (readonly string[])[] = [
 ['让我想想…', '嗯，我在听…', '收到，我想一想…'],
 ['嗯，我在认真想你说的…', '我在把你的话理一理…', '这个值得好好想想…'],
 ['我想换个好懂的说法…', '快想好了，再等我一下下…', '这个有点难，再给我一点点时间…'],
 ['还在想，你不用着急…', '谢谢你等我，马上就好…', '网络有点慢，我还在努力…'],
 ['比平时慢了一些，可能是网络在排队…', '还没好的话，过一会儿再发一次也行，你的话不会丢。'],
];
const THINKING_AT = [2500, 6000, 11000, 20000];
export function useThinkingText(active: boolean): string {
 const [step, setStep] = useState(0), [pick, setPick] = useState(0);
 useEffect(() => {
  setStep(0);setPick(Math.floor(Math.random()*THINKING[0].length));
  if (!active) return;
  const timers = [
   ...THINKING_AT.map((ms, i) => setTimeout(() => { setStep(i + 1); setPick(Math.floor(Math.random()*THINKING[i + 1].length)); }, ms)),
   // Sound only if the student has it on; a reply that arrives sooner cancels these.
   setTimeout(() => void voice.playClipIfEnabled('think'), 1500), setTimeout(() => void voice.playClipIfEnabled('long'), 6500),
  ];
  return () => timers.forEach(clearTimeout);
 }, [active]);
 return THINKING[step][pick % THINKING[step].length];
}
/** The big main pet: a speech bubble (the pet's own words as subtitles) above a touchable, eye-following Mascot. */
export function PetHero({ mood, bubble, thinking, onTouch }: { mood: PetMood; bubble: string; thinking: boolean; onTouch: (zone: PetZone, kind: PetTouchKind) => void }) {
 const ref = useRef<SVGSVGElement | null>(null);
 // Microphone loudness drives the listening ring through a CSS variable, so it never re-renders React.
 useEffect(() => onMicLevel(v => ref.current?.style.setProperty('--mic', v.toFixed(2))), []);
 return <section className="pet-hero" aria-label="和小N说话">
  <div className={'pet-hero-bubble' + (thinking ? ' thinking' : '')} role="status" aria-live="polite">{bubble}</div>
  <Mascot mood={mood} onTouch={onTouch} look svgRef={ref} />
  <button className="sr-only" onClick={() => onTouch('body', 'tap')}>摸摸小N</button>
 </section>;
}
