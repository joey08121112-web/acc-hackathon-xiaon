import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
const out=process.env.XIAON_LOOP_BROWSER_OUT??mkdtempSync(join(tmpdir(),'xiaon-loop-browser-'));
const ui=Number(process.env.XIAON_LOOP_UI_PORT??5318),api=Number(process.env.XIAON_LOOP_API_PORT??18968);
process.env.XIAON_LOOP_BROWSER_OUT=out;process.env.XIAON_LOOP_UI_PORT=String(ui);process.env.XIAON_LOOP_API_PORT=String(api);
const cwd=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({testDir:'.',testMatch:'learning-loop.spec.ts',workers:1,retries:0,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${ui}`,viewport:{width:375,height:812},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},outputDir:join(out,'artifacts'),reporter:[['list'],['json',{outputFile:join(out,'results.json')}]],
 webServer:[{cwd,command:'node --import tsx tests-agent/h/learning-loop-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false},
 {cwd,command:`npm run dev -- --host 127.0.0.1 --port ${ui} --strictPort`,url:`http://127.0.0.1:${ui}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
