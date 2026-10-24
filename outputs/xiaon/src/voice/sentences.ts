/**
 * Split reply text into TTS-sized sentences so the first clip can be synthesized and played right away.
 * Pure and dependency-free on purpose: unit tested in tests-agent/d/tts-sentences.test.ts.
 * The server accepts at most 300 chars per request, so every part stays under `max` (280 by default).
 */
const END = '。！？；…!?;\n', SOFT = '，、,';
const punctOnly = (s: string) => !!s && [...s].every(ch => END.includes(ch) || SOFT.includes(ch));
/**
 * Sentence enders come first (their mark stays with the sentence); an over-long sentence falls back to
 * commas, then to a hard cut at `max`; blank or punctuation-only pieces are dropped — they are silence.
 */
export function splitSentences(text: string, max = 280): string[] {
 const rough: string[] = []; let buf = '';
 for (const ch of text) {
  buf += ch;
  if (END.includes(ch)) { if (buf.length === 1 && rough.length) rough[rough.length - 1] += buf; else rough.push(buf); buf = ''; } // ？？ / …… stay together
 }
 if (buf.trim()) rough.push(buf);
 const out: string[] = [];
 for (const piece of rough) {
  if (!piece.trim()) continue;
  const bits: string[] = []; let cur = '';
  if (piece.length <= max) bits.push(piece);
  else for (const ch of piece) { cur += ch; if (cur.length >= max || SOFT.includes(ch)) { bits.push(cur); cur = ''; } }
  if (cur) bits.push(cur);
  let carry = '';
  for (const bit of bits) { // comma pieces are packed back together, greedily, up to `max`
   if (carry && carry.length + bit.length > max) { out.push(carry); carry = ''; }
   carry += bit;
   if (carry.length >= max) { out.push(carry); carry = ''; }
  }
  if (carry) out.push(carry);
 }
 return out.map(s => s.trim()).filter(s => s && !punctOnly(s));
}
