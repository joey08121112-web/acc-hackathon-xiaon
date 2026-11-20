import { createRuntime } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/bootstrap.ts';
import { SqliteRepository } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/storage/repository.ts';
import { installLearning } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/agents/learning.ts';
import { createHttpServer } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/http/server.ts';
import { SAFETY_PATTERN } from '/Users/ami/Documents/个人/ACC黑客松/outputs/xiaon/server/agents/stages.ts';
async function main(){
const repo=new SqliteRepository(':memory:');const seen:any[]=[];
const provider={kind:'synthetic' as const,supportsTools:true,async complete(input:any){seen.push(input.messages);return {content:JSON.stringify({message:'合成测试回复',taskIds:[]}),toolCalls:[]};}};
const r=createRuntime({repository:repo,provider}),d=installLearning(r);
const server=createHttpServer(r,{allowedOrigins:['http://127.0.0.1:19847'],host:'127.0.0.1:19847'});await new Promise<void>(resolve=>server.listen(19847,'127.0.0.1',resolve));
const base='http://127.0.0.1:19847';
async function login(){const res=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});const v=await res.json();return {Cookie:res.headers.get('set-cookie')!.split(';')[0],'X-Xiaon-CSRF':v.csrfToken};}
async function post(path:string,body:any,auth:any){const res=await fetch(base+path,{method:'POST',headers:{...auth,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};}
try{
const a=await login(),b=await login();
await post('/api/consent',{operationId:'consent-on',optionalMemory:true},a);
const m=await post('/api/memories',{operationId:'memory-a',text:'合成用户甲喜欢篮球',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null},a);
const bView=await (await fetch(base+'/api/learning',{headers:b})).json();
console.log(JSON.stringify({probe:'independent-browser-reads-other-memory',separateCookies:a.Cookie!==b.Cookie,writeStatus:m.status,bSeesAText:bView.memories.some((m:any)=>m.text==='合成用户甲喜欢篮球')}));
await post('/api/consent',{operationId:'consent-off',optionalMemory:false},a);
await post('/api/learning/chat',{operationId:'chat-a',flow:'home',history:[{role:'user',content:'合成聊天私密内容'}]},a);
const v1=await d.view();console.log(JSON.stringify({probe:'memory-off-chat-persisted',optionalMemory:v1.optionalMemory,rawChatSaved:v1.chatLog.some((m:any)=>m.content==='合成聊天私密内容')}));
const history=[{role:'user',content:'我真的不想活了'}];
const safety=await d.chat({operationId:'safety-a',flow:'home',history});
history.push({role:'assistant',content:safety.text},{role:'user',content:'现在换个话题吧'});
seen.length=0;
await d.chat({operationId:'after-safety-a',flow:'home',history});
console.log(JSON.stringify({probe:'prior-safety-text-in-next-model-context',firstBlocked:safety.safety,subsequentModelSawPriorSafety:JSON.stringify(seen).includes('我真的不想活了')}));
console.log(JSON.stringify({probe:'keyword-safety-limits',englishDetected:SAFETY_PATTERN.test('I want to end my life'),euphemismDetected:SAFETY_PATTERN.test('我准备吃掉整瓶药后不醒来了'),benignNegationFlagged:SAFETY_PATTERN.test('老师说遇到自残风险要找人帮忙')}));
const reset=await post('/api/learning/reset',{operationId:'reset-by-b',confirmation:'清除本机学习记录与偏好'},b);
console.log(JSON.stringify({probe:'independent-browser-resets-shared-db',status:reset.status,result:reset.data,remainingChat:repo.list('chatLog').length,remainingMemories:repo.list('memories').length}));
}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));repo.close();}
}
main();
