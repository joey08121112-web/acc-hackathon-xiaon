/** 所有者：Claude。g 路浏览器用例（第一期演示路线走查）。只跑 g 的 spec；浏览器输出写系统临时目录。
 * 端口默认 5211/18951（g 路）；集成时用 XIAON_G_UI_PORT=5214 XIAON_G_API_PORT=18954。XIAON_G_SHOTS 指定时把走查截图存到该目录。 */
import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
const ui=Number(process.env.XIAON_G_UI_PORT??5211),api=Number(process.env.XIAON_G_API_PORT??18951);
const out=process.env.XIAON_G_BROWSER_OUT??mkdtempSync(join(tmpdir(),'xiaon-g-browser-'));
process.env.XIAON_G_BROWSER_OUT=out;process.env.XIAON_G_UI_PORT=String(ui);process.env.XIAON_G_API_PORT=String(api);
console.log('G browser output:',out);
const cwd=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({
 testDir:'.',testMatch:'walkthrough.spec.ts',workers:1,retries:0,timeout:120000,
 use:{baseURL:`http://127.0.0.1:${ui}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},
 outputDir:join(out,'artifacts'),reporter:[['list'],['json',{outputFile:join(out,'results.json')}]],
 webServer:[
  {cwd,command:'node --import tsx tests-agent/g/walkthrough-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false,env:{XIAON_G_API_PORT:String(api),XIAON_G_UI_PORT:String(ui)}},
  {cwd,command:`npm run dev -- --host 127.0.0.1 --port ${ui} --strictPort`,url:`http://127.0.0.1:${ui}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}},
 ],
});
