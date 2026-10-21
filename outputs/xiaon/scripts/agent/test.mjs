import { readdirSync,existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const batch=process.argv[2];const dirs=batch==='all'?['a','b','c','d','e','g','h','i']:[batch];let files=[];let missing=false;
function collect(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?collect(dir+'/'+e.name):/\.test\.(ts|tsx)$/.test(e.name)?[dir+'/'+e.name]:[]);}
for(const d of dirs){const path='tests-agent/'+d;const found=existsSync(path)?collect(path):[];if(found.length===0){missing=true;console.error(`NOT_COVERED: ${d.toUpperCase()} has no tests yet`);if(batch!=='all')process.exit(2);}files.push(...found);}
if(!files.length)process.exit(2);
const result=spawnSync(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit',env:process.env});process.exit(result.status?result.status:missing?2:0);
