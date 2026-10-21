import { writeFileSync } from 'node:fs';
import { ttsFromEnvironment } from '../../server/voice/tts';
// Real Doubao TTS smoke: synthetic sentence only. Never prints credentials.
const tts = ttsFromEnvironment();
if (!tts.enabled) { console.log('TTS 未配置（需要 XIAON_TTS_PROVIDER=doubao、KEY、SPEAKER）'); process.exit(2); }
const started = Date.now();
const audio = await tts.synthesize(process.argv[3] ?? '你好，我是小N，我们慢慢来。', AbortSignal.timeout(30_000));
const out = process.argv[2] ?? 'tts-smoke.mp3';
writeFileSync(out, audio);
const head = audio.subarray(0, 3);
console.log(JSON.stringify({ bytes: audio.length, ms: Date.now() - started, mp3Header: head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0), out }));
