import { defineConfig } from '@playwright/test';
const ui=Number(process.env.XIAON_E_UI_PORT??5197),api=Number(process.env.XIAON_E_API_PORT??18938);
const evidence='../../文档/交接/2026-10-21/交付/E/evidence/browser';
process.env.XIAON_E_EVIDENCE=evidence;
export default defineConfig({testDir:'tests-agent/e',testMatch:'*.spec.ts',workers:1,retries:0,timeout:60000,
 use:{baseURL:`http://127.0.0.1:${ui}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},outputDir:evidence+'/artifacts',reporter:[['list'],['json',{outputFile:evidence+'/browser-results.json'}]],
 webServer:[{command:'node --import tsx scripts/agent/e-browser-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false,env:{XIAON_E_API_PORT:String(api),XIAON_E_UI_PORT:String(ui)}},{command:`npm run dev -- --host 127.0.0.1 --port ${ui} --strictPort`,url:`http://127.0.0.1:${ui}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
