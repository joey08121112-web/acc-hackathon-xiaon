import { defineConfig } from '@playwright/test';
const port=Number(process.env.XIAON_A_BROWSER_PORT??5191);const api=Number(process.env.XIAON_A_BROWSER_API_PORT??18923);
const delivery='../../任务书/2026-10-21-Agent升级/交付/A/evidence';
export default defineConfig({testDir:'tests-agent/a',testMatch:'browser.spec.ts',workers:1,fullyParallel:false,retries:0,timeout:30000,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},
 outputDir:delivery+'/browser-results',reporter:[['list'],['json',{outputFile:delivery+'/browser-results.json'}]],
 webServer:[
 {command:'node --import tsx scripts/agent/browser-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false},
 {command:`npm run dev -- --host 127.0.0.1 --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}},
 ]});
