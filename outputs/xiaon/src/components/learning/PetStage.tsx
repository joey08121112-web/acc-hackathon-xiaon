import { useEffect, useRef, useState } from 'react';
import { Mascot, type PetMood, type PetTouchKind, type PetZone } from '../../Art';
import { voice } from '../../voice/voice';
import { onMicLevel } from '../../voice/mic';
/** What the pet says while a real request is in flight. Each step is time-based, not a fake progress bar. */
const THINKING = ['让我想想…', '嗯，我在认真听你说的…', '这个有点难，再给我一点点时间…', '还在想，你可以先歇一会儿，也可以点「取消等待」。'];
export function useThinkingText(active: boolean): string {
 const [step, setStep] = useState(0);
 useEffect(() => {
  setStep(0);
  if (!active) return;
  const timers = [
   setTimeout(() => setStep(1), 2500), setTimeout(() => setStep(2), 6000), setTimeout(() => setStep(3), 11000),
   // Sound only if the student has it on; a reply that arrives sooner cancels these.
   setTimeout(() => void voice.playClipIfEnabled('think'), 1500), setTimeout(() => void voice.playClipIfEnabled('long'), 6500),
  ];
  return () => timers.forEach(clearTimeout);
 }, [active]);
 return THINKING[step];
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
