import { defineConfig } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeWav } from './src/voice/wav';
// Pet / voice UI only. Results go to the OS temp dir: it must never write into any delivery evidence folder.
const port=Number(process.env.XIAON_F_UI_PORT??5199),api=Number(process.env.XIAON_F_API_PORT??18963);
const out=join(tmpdir(),'xiaon-f-browser');mkdirSync(out,{recursive:true});
// A fake microphone: 2.2 s of voice-like tone followed by 3.5 s of silence (the recognizer itself is faked server side).
const rate=16000,samples=new Float32Array(rate*6);for(let i=0;i<rate*2.2;i++)samples[i]=0.35*Math.sin(2*Math.PI*220*i/rate)*(0.6+0.4*Math.sin(2*Math.PI*3*i/rate));
const mic=join(out,'fake-mic.wav');writeFileSync(mic,encodeWav(samples,rate));
export default defineConfig({testDir:'tests-agent/d',testMatch:'pet-voice.spec.ts',workers:1,retries:0,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',permissions:['microphone'],trace:'retain-on-failure',launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${mic}`,'--autoplay-policy=no-user-gesture-required']}},
 outputDir:join(out,'artifacts'),reporter:[['list']],
 webServer:[{command:'node --import tsx scripts/agent/f-browser-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false,env:{XIAON_F_API_PORT:String(api),XIAON_F_UI_PORT:String(port)}},{command:`npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
