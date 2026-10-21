import { defineConfig } from '@playwright/test';
const port=Number(process.env.XIAON_D_UI_PORT??5194),api=Number(process.env.XIAON_D_API_PORT??18931);
const evidence='../../任务书/2026-10-21-Agent升级/交付/D/evidence';
export default defineConfig({testDir:'tests-agent/d',testMatch:'*.spec.ts',workers:1,retries:0,timeout:45000,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},outputDir:evidence+'/browser-artifacts',reporter:[['list'],['json',{outputFile:evidence+'/browser-results.json'}]],
 webServer:[{command:'node --import tsx scripts/agent/d-browser-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false},{command:`npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
