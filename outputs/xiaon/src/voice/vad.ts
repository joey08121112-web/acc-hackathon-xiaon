/** Decides when the student has finished speaking. Pure and clock-injected so it can be unit tested. */
export type EndpointResult = 'continue' | 'end' | 'no-speech' | 'max';
export class EndpointDetector {
 private noise = 0; private start = 0; private speechStart = 0; private lastVoice = 0; private heard = false;
 constructor(private opts = { silenceMs: 1400, noSpeechMs: 7000, maxMs: 30000, minSpeechMs: 250, calibrateMs: 350 }) {}
 get hasSpeech() { return this.heard; }
 push(rms: number, t: number): EndpointResult {
  if (!this.start) this.start = t;
  // The first moments measure ambient noise. The estimate is capped low: a student who starts talking at once must not have their own voice taken for background noise.
  if (t - this.start < this.opts.calibrateMs) { this.noise = Math.max(this.noise, Math.min(rms, 0.02)); return 'continue'; }
  const threshold = Math.max(0.015, this.noise * 2.5);
  if (rms > threshold) {
   if (!this.speechStart) this.speechStart = t;
   if (t - this.speechStart >= this.opts.minSpeechMs) this.heard = true;
   this.lastVoice = t;
  } else if (!this.heard) this.speechStart = 0; // a short click or cough does not count as speech
  if (t - this.start >= this.opts.maxMs) return 'max';
  if (!this.heard && t - this.start >= this.opts.noSpeechMs) return 'no-speech';
  if (this.heard && t - this.lastVoice >= this.opts.silenceMs) return 'end';
  return 'continue';
 }
}
