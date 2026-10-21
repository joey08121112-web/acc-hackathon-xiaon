/** 所有者：ChatGPT。只运行 H spec；所有浏览器输出写系统临时目录。 */
import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
const out=process.env.XIAON_H_BROWSER_OUT??mkdtempSync(join(tmpdir(),'xiaon-h-browser-'));
process.env.XIAON_H_BROWSER_OUT=out;
console.log('H browser output:',out);
const cwd=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({
 testDir:'.',testMatch:'browser.spec.ts',workers:1,retries:0,timeout:30000,
 use:{baseURL:'http://127.0.0.1:5212',viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},
 outputDir:join(out,'artifacts'),reporter:[['list'],['json',{outputFile:join(out,'results.json')}]],
 webServer:[
  {cwd,command:'node --import tsx tests-agent/h/browser-server.ts',url:'http://127.0.0.1:18952/api/health',reuseExistingServer:false},
  {cwd,command:'npm run dev -- --host 127.0.0.1 --port 5212 --strictPort',url:'http://127.0.0.1:5212',reuseExistingServer:false,env:{XIAON_API_TARGET:'http://127.0.0.1:18952'}},
 ],
});
