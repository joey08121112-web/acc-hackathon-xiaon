import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { CLIPS } from '../../src/voice/clips';
import { ttsFromEnvironment } from '../../server/voice/tts';
// Real Doubao TTS, fixed synthetic lines only. Re-run after changing src/voice/clips.ts or the speaker.
const tts = ttsFromEnvironment();
if (!tts.enabled) { console.log('TTS 未配置'); process.exit(2); }
mkdirSync('public/voice', { recursive: true });
const force = process.argv.includes('--force');
for (const clip of CLIPS) {
 if (!force && existsSync(`public/voice/${clip.id}.mp3`)) { console.log(clip.id, 'exists, skipped (use --force to regenerate)'); continue; }
 const audio = await tts.synthesize(clip.text, AbortSignal.timeout(30_000));
 writeFileSync(`public/voice/${clip.id}.mp3`, audio);
 console.log(clip.id, audio.length);
}
