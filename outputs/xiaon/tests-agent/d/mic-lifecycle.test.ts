import test from 'node:test';
import assert from 'node:assert/strict';
import { mic } from '../../src/voice/mic';
import { voice } from '../../src/voice/voice';

test('cancel during microphone permission releases a late stream without starting a recorder',async()=>{
 let grant!:(value:unknown)=>void,stops=0,starts=0;
 const stream={getTracks:()=>[{stop(){stops++;}}]};
 const oldWindow=globalThis.window,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldRecorder=globalThis.MediaRecorder,oldFetch=globalThis.fetch;
 class Recorder {state='inactive';onstop:(()=>void)|null=null;start(){starts++;this.state='recording';}stop(){this.state='inactive';this.onstop?.();}}
 class Context {createAnalyser(){return {fftSize:1024,getFloatTimeDomainData(){}};}createMediaStreamSource(){return {connect(){}};}async resume(){}async close(){}}
 try{
  globalThis.fetch=(async()=>new Response(JSON.stringify({voice:{tts:true,asr:true}}))) as typeof fetch;
  globalThis.window={AudioContext:Context,setInterval,clearInterval,setTimeout,clearTimeout} as unknown as Window & typeof globalThis;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>{grant=r;})}}});
  globalThis.MediaRecorder=Recorder as unknown as typeof MediaRecorder;
  await voice.probe();
  const pending=mic.start(()=>assert.fail('cancelled recording must never send text'));
  mic.cancel();grant(stream);await pending;
  assert.equal(stops,1,'permission resolved after cancellation: microphone tracks must be stopped');
  assert.equal(starts,0,'a cancelled request must never start recording');
 }finally{
  mic.cancel();globalThis.window=oldWindow;globalThis.MediaRecorder=oldRecorder;globalThis.fetch=oldFetch;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else Reflect.deleteProperty(globalThis,'navigator');
 }
});

test('browser recognition that never starts times out; cancellation ignores late Safari results',async()=>{
 const oldWindow=globalThis.window,oldRecorder=globalThis.MediaRecorder;
 let next=0,aborts=0,received=0;
 const timers=new Map<number,()=>void>();
 class Recognition {
  static instances:Recognition[]=[];
  onstart?:()=>void;onresult?:(e:{results:{transcript:string}[][]})=>void;onend?:()=>void;
  constructor(){Recognition.instances.push(this);}
  start(){}abort(){aborts++;}stop(){}
 }
 try{
  globalThis.MediaRecorder=undefined as unknown as typeof MediaRecorder;
  globalThis.window={SpeechRecognition:Recognition,setInterval:()=>++next,clearInterval:()=>{},setTimeout:(fn:()=>void)=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:(id:number)=>timers.delete(id)} as unknown as Window & typeof globalThis;
  await mic.start(()=>received++);
  const startup=[...timers.values()][0];assert.ok(startup,'a startup watchdog must exist');startup();assert.equal(aborts,1);
  await mic.start(()=>received++);assert.equal(Recognition.instances.length,2,'a timed-out recognizer can be started again');
  const second=Recognition.instances[1];second.onstart?.();mic.cancel();
  second.onresult?.({results:[[{transcript:'迟到的文字'}]]});second.onend?.();
  assert.equal(received,0);assert.equal(timers.size,0,'all recognition watchdogs are cleared on cancel');
 }finally{mic.cancel();globalThis.window=oldWindow;globalThis.MediaRecorder=oldRecorder;}
});
