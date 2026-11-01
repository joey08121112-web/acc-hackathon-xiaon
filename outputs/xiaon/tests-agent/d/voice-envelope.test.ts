import test from 'node:test';
import assert from 'node:assert/strict';
import { audioEnvelope } from '../../src/voice/envelope';
test('TTS motion follows silent, quiet and loud PCM windows',()=>{
 const samples=new Float32Array(300);samples.fill(.1,100,200);samples.fill(.5,200);
 const envelope=audioEnvelope(samples,4000);
 assert.equal(envelope.length,3);assert.equal(envelope[0],0);assert.ok(Math.abs(envelope[1]-.3)<.00001);assert.equal(envelope[2],1);
});
test('short last audio window is measured without padding silence into the amplitude',()=>{
 const envelope=audioEnvelope(new Float32Array([.2,.2,.2]),80);
 assert.equal(envelope.length,2);assert.ok([...envelope].every(v=>Math.abs(v-.6)<.00001));
 assert.equal(audioEnvelope(new Float32Array(),24000).length,0);
});
