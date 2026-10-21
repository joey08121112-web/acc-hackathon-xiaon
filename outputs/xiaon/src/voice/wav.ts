/** 16 kHz mono 16-bit PCM WAV: the smallest format every recognizer accepts. Browser-safe, no Node APIs. */
export const WAV_RATE = 16000;
export function encodeWav(samples: Float32Array, rate = WAV_RATE): Uint8Array {
 const out = new Uint8Array(44 + samples.length * 2), view = new DataView(out.buffer);
 const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
 text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
 view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
 view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
 for (let i = 0; i < samples.length; i++) { const v = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
 return out;
}
export function bytesToBase64(bytes: Uint8Array): string {
 let binary = '';
 for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
 return btoa(binary);
}
/** Decode whatever MediaRecorder produced (webm/opus, mp4/aac) and resample to 16 kHz mono. */
export async function toWav16k(blob: Blob, ctx: BaseAudioContext): Promise<Uint8Array> {
 const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
 const frames = Math.max(1, Math.ceil(decoded.duration * WAV_RATE));
 const offline = new OfflineAudioContext(1, frames, WAV_RATE);
 const source = offline.createBufferSource();
 source.buffer = decoded; source.connect(offline.destination); source.start();
 const rendered = await offline.startRendering();
 return encodeWav(rendered.getChannelData(0));
}
