import { defineConfig } from '@playwright/test';
// E regression of the D integration spec on separate ports; evidence goes to E so D history is not overwritten.
const ui=5198,api=18939,evidence='../../文档/交接/2026-10-21/交付/E/evidence/d-regression';
process.env.XIAON_D_EVIDENCE=evidence;process.env.XIAON_D_API_PORT=String(api);
export default defineConfig({testDir:'tests-agent/d',testMatch:'browser.spec.ts',workers:1,retries:0,timeout:45000,use:{baseURL:`http://127.0.0.1:${ui}`,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',trace:'retain-on-failure'},outputDir:evidence+'/artifacts',reporter:[['list'],['json',{outputFile:evidence+'/browser-results.json'}]],
 webServer:[{command:'node --import tsx scripts/agent/d-browser-server.ts',url:`http://127.0.0.1:${api}/api/health`,reuseExistingServer:false,env:{XIAON_D_API_PORT:String(api),XIAON_D_UI_PORT:String(ui)}},{command:`npm run dev -- --host 127.0.0.1 --port ${ui} --strictPort`,url:`http://127.0.0.1:${ui}`,reuseExistingServer:false,env:{XIAON_API_TARGET:`http://127.0.0.1:${api}`}}]});
