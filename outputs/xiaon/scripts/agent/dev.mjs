import { spawn } from 'node:child_process';
const api=process.env.XIAON_API_PORT??'18931',ui=process.env.XIAON_UI_PORT??'5194';
for(const port of [api,ui])if(!/^\d+$/.test(port)||Number(port)<1024||Number(port)>65535)throw new Error('Invalid local port');
const origin=`http://127.0.0.1:${ui}`;
const server=spawn(process.execPath,['--env-file-if-exists=.env.server','--import','tsx','server/index.ts'],{stdio:'inherit',env:{...process.env,XIAON_API_PORT:api,XIAON_ALLOWED_ORIGINS:origin}});
const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',ui,'--strictPort'],{stdio:'inherit',env:{...process.env,XIAON_API_TARGET:`http://127.0.0.1:${api}`}});
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;server.kill('SIGTERM');frontend.kill('SIGTERM');setTimeout(()=>process.exit(code),500).unref();}
server.on('exit',code=>stop(code??1));frontend.on('exit',code=>stop(code??1));process.once('SIGINT',()=>stop());process.once('SIGTERM',()=>stop());
console.log(`学伴小N：${origin}（API ${api}，仅监听本机）；Ctrl+C 只停止本命令启动的两个进程。`);
