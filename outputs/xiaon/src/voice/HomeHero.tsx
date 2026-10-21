import { HeroArt } from '../Art';
import { useVoice } from './voice';
import { usePetReactions } from './pet';
/** Home pet: poke, pat, wave. Reactions are local; sound plays only when the server really has speech synthesis. */
export function HomeHero({ sleeping }: { sleeping: boolean }) {
 const v = useVoice();
 const pet = usePetReactions({ busy: v.phase === 'playing' ? 'speaking' : null, resting: sleeping });
 return <>
  <HeroArt sleeping={sleeping} mood={pet.mood} line={pet.line} onTouch={pet.onTouch} />
  <button className="sr-only" onClick={() => pet.onTouch('body', 'tap')}>摸摸小N</button>
 </>;
}
