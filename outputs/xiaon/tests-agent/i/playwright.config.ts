/** I 路：只发现本路走查，浏览器、数据库与截图默认写系统临时目录。 */
import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ui=Number(process.env.XIAON_I_UI_PORT??5214),api=Number(process.env.XIAON_I_API_PORT??18954);
const out=process.env.XIAON_I_BROWSER_OUT??mkdtempSync(join(tmpdir(),'xiaon-i-browser-'));
process.env.XIAON_I_BROWSER_OUT=out;process.env.XIAON_I_UI_PORT=String(ui);process.env.XIAON_I_API_PORT=String(api);
console.log('I browser output:',out);
const cwd=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({testDir:'.',testMatch:'fix-round.spec.ts',workers:1,retries:0,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${ui}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},
 outputDir:join(out,'artifacts'),reporter:[['list'],['json',{outputFile:join(out,'results.json')}]],
 webServer:[{cwd,command:'node --import tsx tests-agent/i/browser-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false},
 {cwd,command:`npm run dev -- --host 127.0.0.1 --port ${ui} --strictPort`,url:`http://127.0.0.1:${ui}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
