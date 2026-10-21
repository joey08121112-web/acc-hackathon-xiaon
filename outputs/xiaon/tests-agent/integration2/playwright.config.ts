/** 第二期集成验收：生产插件、合成模型、独立 TestClock；不发现 D spec。 */
import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const out=process.env.XIAON_INTEGRATION2_OUT??mkdtempSync(join(tmpdir(),'xiaon-integration2-browser-'));
process.env.XIAON_INTEGRATION2_OUT=out;
console.log('Integration2 browser output:',out);
const cwd=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({testDir:'.',testMatch:'phase2.spec.ts',workers:1,retries:0,timeout:120000,
 use:{baseURL:'http://127.0.0.1:5214',viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',actionTimeout:10000,trace:'retain-on-failure'},
 outputDir:join(out,'artifacts'),reporter:[['list'],['json',{outputFile:join(out,'results.json')}]],
 webServer:[{cwd,command:'node --import tsx tests-agent/integration2/server.ts',url:'http://127.0.0.1:18954/api/health',reuseExistingServer:false},
 {cwd,command:'npm run dev -- --host 127.0.0.1 --port 5214 --strictPort',url:'http://127.0.0.1:5214',reuseExistingServer:false,env:{XIAON_API_TARGET:'http://127.0.0.1:18954'}}]});
