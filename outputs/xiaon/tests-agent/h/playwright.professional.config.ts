/** H2 only. Never discovers D specs or writes into committed evidence directories. */
import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
const ui=Number(process.env.XIAON_H2_UI_PORT??5212),api=Number(process.env.XIAON_H2_API_PORT??18952);
const out=process.env.XIAON_H2_BROWSER_OUT??mkdtempSync(join(tmpdir(),'xiaon-h2-browser-'));
process.env.XIAON_H2_BROWSER_OUT=out;
console.log('H2 browser output:',out);
const cwd=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({testDir:'.',testMatch:'professional.spec.ts',workers:1,retries:0,timeout:45000,
 use:{baseURL:`http://127.0.0.1:${ui}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},
 outputDir:join(out,'artifacts'),reporter:[['list'],['json',{outputFile:join(out,'results.json')}]],
 webServer:[{cwd,command:'node --import tsx tests-agent/h/professional-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false,env:{XIAON_H2_API_PORT:String(api),XIAON_H2_UI_PORT:String(ui)}},
 {cwd,command:`npm run dev -- --host 127.0.0.1 --port ${ui} --strictPort`,url:`http://127.0.0.1:${ui}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
