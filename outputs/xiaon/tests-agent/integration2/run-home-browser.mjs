/** H 首页原配置与用例的临时端口适配；只重定位源码 import 和 18952/5212，不改断言。 */
import { mkdtempSync,readFileSync,writeFileSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const app=fileURLToPath(new URL('../..',import.meta.url)),out=mkdtempSync(join(tmpdir(),'xiaon-integration2-h-home-'));
const relocate=s=>s.replace(/from '(\.\.\/\.\.\/[^']+)'/g,(_,p)=>`from '${resolve(app,'tests-agent/h',p)}'`);
const server=relocate(readFileSync(join(app,'tests-agent/h/browser-server.ts'),'utf8')).replace('const port=18952,ui=5212;','const port=18954,ui=5214;');
const spec=relocate(readFileSync(join(app,'tests-agent/h/browser.spec.ts'),'utf8')).replaceAll('127.0.0.1:18952','127.0.0.1:18954');
writeFileSync(join(out,'server.ts'),server);writeFileSync(join(out,'home.spec.ts'),spec);symlinkSync(join(app,'node_modules'),join(out,'node_modules'),'dir');
const config=`import base from ${JSON.stringify(join(app,'tests-agent/h/playwright.config.ts'))};
export default {...base,testDir:${JSON.stringify(out)},testMatch:'home.spec.ts',use:{...base.use,baseURL:'http://127.0.0.1:5214'},webServer:[
{cwd:${JSON.stringify(app)},command:${JSON.stringify('node --import tsx '+join(out,'server.ts'))},url:'http://127.0.0.1:18954/api/health',reuseExistingServer:false},
{cwd:${JSON.stringify(app)},command:'npm run dev -- --host 127.0.0.1 --port 5214 --strictPort',url:'http://127.0.0.1:5214',reuseExistingServer:false,env:{XIAON_API_TARGET:'http://127.0.0.1:18954'}}]};`;
writeFileSync(join(out,'playwright.config.mts'),config);console.log('H home port adapter:',out);
const run=spawnSync('npx',['playwright','test','-c',join(out,'playwright.config.mts')],{cwd:app,env:{...process.env,XIAON_H_BROWSER_OUT:out},stdio:'inherit'});process.exitCode=run.status??1;
