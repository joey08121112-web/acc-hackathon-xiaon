import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences } from '../../src/voice/sentences';

// ---- sentence-by-sentence TTS: the pure splitter (each part must stay under the server's 300-char cap) ----
test('sentence enders keep their mark, blank and punctuation-only pieces vanish',()=>{
 assert.deepEqual(splitSentences('你好。我是小N！今天学什么？\n\n走吧；好呀'),['你好。','我是小N！','今天学什么？','走吧；','好呀']);
 assert.deepEqual(splitSentences('等等…让我想想……好啦！'),['等等…','让我想想……','好啦！']);
 assert.deepEqual(splitSentences('真的吗？？我不信。'),['真的吗？？','我不信。'],'repeated marks stay with their sentence');
 assert.deepEqual(splitSentences('半角也行? yes!'),['半角也行?','yes!']);
 assert.deepEqual(splitSentences('   \n \t  '),[]);
 assert.deepEqual(splitSentences('。。。！'),[],'marks alone are silence, not a request');
});
test('short text is one sentence; a punctuation-less long text is hard-cut at the limit',()=>{
 assert.deepEqual(splitSentences('这道题先看已知条件'),['这道题先看已知条件']);
 assert.deepEqual(splitSentences('数'.repeat(600)),['数'.repeat(280),'数'.repeat(280),'数'.repeat(40)]);
 assert.deepEqual(splitSentences('😀'.repeat(300)),['😀'.repeat(140),'😀'.repeat(140),'😀'.repeat(20)],'a surrogate pair is never cut in half');
 assert.deepEqual(splitSentences('abcdefghij',4),['abcd','efgh','ij']);
});
test('an over-long sentence falls back to commas, packs greedily up to the limit and loses no characters',()=>{
 const text='一二三四五六七八九十，'.repeat(9)+'一二三四五六七八九十。',parts=splitSentences(text,25); // 10 comma pieces of 11 chars
 assert.equal(parts.join(''),text);
 assert.equal(parts.length,5);assert.deepEqual(parts.map(p=>p.length),[22,22,22,22,22]);
 assert.equal(parts.every(p=>p.length<=25),true);
 const hard='x'.repeat(60);assert.deepEqual(splitSentences(hard,25),['x'.repeat(25),'x'.repeat(25),'x'.repeat(10)],'no commas: hard cut');
 const all=splitSentences(['这句很长很长。','第二句。','第三句！'].join('')+('无标点'.repeat(120)));
 assert.equal(all.every(p=>p.length<=280),true);assert.equal(all.join(''),'这句很长很长。第二句。第三句！'+'无标点'.repeat(120));
});
