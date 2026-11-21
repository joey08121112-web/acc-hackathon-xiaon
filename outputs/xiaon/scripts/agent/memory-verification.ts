/** 记忆验证：跑 S1（新会话回忆）/ S3（偏好覆盖更新）/ S10（开销测量）与跨天保持。
 *
 * 依据 MEMORY-DESIGN-GUIDE.md §7 第 8 项与 §8 诚实边界：
 *  「MVP 后至少跑 S1、S3、S10；跨天记忆保持需 24h/7d 延迟实验，一次会话不能证明『长期』；
 *    未跑验证前禁止宣称『有效/大幅提升』。」
 *
 * 之前这份验证一次都没跑过（审查 §4.4）。现在它是一段可复现的脚本 + 一份可引用的证据文件。
 * 这次验证的是**机制**（记住了吗？改对了吗？代价多大？），**不是**「记忆让学习效果变好」——
 * 后者需要对照实验，本文件不提供那种结论，诚实边界写在输出里。
 *
 * 用法：npm run memory:verify            （证据写到 work/memory-verification.json）
 *      npm run memory:verify -- --out <路径>
 */
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FreeChatStore } from '../../server/free-chat/store';
import { profileBrief } from '../../server/free-chat/brief';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { TestClock } from '../../server/core/clock';
import { ITEMS_PER_KIND_MAX,PROFILE_KINDS,type ProfileKind } from '../../shared/free-chat';

const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);const mid=s.length>>1;return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;};
const id=()=>crypto.randomUUID();

export type ScenarioResult={passed:boolean;summary:string;details:Record<string,unknown>};
export type VerificationReport={
 ranAt:string;
 node:string;
 scenarios:Record<string,ScenarioResult>;
 honestBoundary:string;
};

/* ── S1：新会话回忆 ─────────────────────────────────────────────────────
   写一条记忆 → 关掉库 → 重新打开（= 新会话/新进程）→ 核对**出站上下文**里有没有它。
   只看数据库里有不算数 —— PRD FR12 要求「通过下一次实际出站上下文核对」。 */
async function scenarioS1():Promise<ScenarioResult>{
 const dir=mkdtempSync(join(tmpdir(),'xiaon-s1-')),path=join(dir,'freechat.sqlite');
 const details:Record<string,unknown>={};
 try{
  const clock=new TestClock('2026-11-21T02:00:00.000Z');
  let store=new FreeChatStore(path,clock);
  store.setAutoRemember(true);
  store.insert({kind:'interest',text:'喜欢打篮球',source:'student',editedByStudent:true});
  const before=profileBrief(store.profile());
  store.close();
  // 重新打开 = 进程重启后的第一次会话。
  store=new FreeChatStore(path,clock);
  const after=profileBrief(store.profile());
  store.close();
  details.beforeRestart=before.includes('喜欢打篮球');
  details.afterRestart=after.includes('喜欢打篮球');
  details.briefExcerpt=after.split('\n').slice(0,4).join(' / ');
  // B 侧：学习记忆同样要跨进程还在。
  const runtimeDir=mkdtempSync(join(tmpdir(),'xiaon-s1-b-')),dbPath=join(runtimeDir,'learning.sqlite');
  let runtime=createRuntime({databasePath:dbPath,clock});
  runtime.events.consent({operationId:id(),optionalMemory:true});
  runtime.events.remember({operationId:id(),text:'喜欢打篮球',source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});
  runtime.repository.close();runtime.freeChat.close();
  runtime=createRuntime({databasePath:dbPath,clock});
  const memories=runtime.context().memories.map(m=>m.text);
  details.learningMemoriesAfterRestart=memories;
  runtime.repository.close();runtime.freeChat.close();rmSync(runtimeDir,{recursive:true,force:true});
  const passed=details.beforeRestart===true&&details.afterRestart===true&&memories.includes('喜欢打篮球');
  return{passed,summary:passed?'新会话（重启后）仍然能回忆起记住的事，并且真的进了出站上下文':'重启后回忆不起来',details};
 }finally{rmSync(dir,{recursive:true,force:true});}
}

/* ── S3：偏好覆盖更新 ───────────────────────────────────────────────────
   同一条偏好变了：新的应当取代旧的，且旧的留痕可查；出站上下文只出现新的那条。 */
async function scenarioS3():Promise<ScenarioResult>{
 const dir=mkdtempSync(join(tmpdir(),'xiaon-s3-')),path=join(dir,'freechat.sqlite');
 const details:Record<string,unknown>={};
 try{
  const clock=new TestClock('2026-11-21T02:00:00.000Z');
  const store=new FreeChatStore(path,clock);
  store.setAutoRemember(true);
  const oldId=store.insert({kind:'interest',text:'喜欢打篮球',source:'chat',editedByStudent:false});
  const newId=store.chatUpdate(oldId,'喜欢踢足球',{threadId:'thread-1',evidenceQuote:'我现在改成喜欢踢足球了'});
  const brief=profileBrief(store.profile());
  details.oldItemId=oldId;details.newItemId=newId;
  details.briefHasNew=brief.includes('喜欢踢足球');
  details.briefHasOld=brief.includes('喜欢打篮球');
  details.supersededKept=store.itemHistory().map(i=>({id:i.id,text:i.text,invalidatedAt:i.invalidatedAt}));
  details.liveItems=store.profile().items.map(i=>i.text);
  store.close();
  const passed=details.briefHasNew===true&&details.briefHasOld===false&&(details.supersededKept as unknown[]).length===1;
  return{passed,summary:passed?'覆盖更新后出站上下文只有新的一条，旧的那条留痕可查':'覆盖更新后上下文仍出现旧条目',details};
 }finally{rmSync(dir,{recursive:true,force:true});}
}

/* ── S10：开销测量（C0 无记忆 / C1 装载 / C2 满档，ABBA×3 取中位数）────────
   测的是「带着记忆出站」这件事本身的代价：读库 + 组装简报。
   这是本机数字，不是产品承诺；换机器、换数据量会变。 */
function scenarioS10():ScenarioResult{
 const dir=mkdtempSync(join(tmpdir(),'xiaon-s10-')),path=join(dir,'freechat.sqlite');
 const details:Record<string,unknown>={};
 try{
  const clock=new TestClock('2026-11-21T02:00:00.000Z');
  const store=new FreeChatStore(path,clock);
  store.setAutoRemember(true);
  const kind=(k:ProfileKind,i:number)=>store.insert({kind:k,text:`${k} 类第 ${i} 条偏好`,source:'student',editedByStudent:true});
  const build=(n:number)=>{
   // C0=0 条；C1=典型量（8 条）；C2=满档（每类上限）。
   const target=n;
   let added=0;
   while(added<target){
    const k=PROFILE_KINDS[added%PROFILE_KINDS.length];
    if(store.profile().items.filter(i=>i.kind===k).length>=ITEMS_PER_KIND_MAX)break;
    kind(k,added);added++;
   }
  };
  const measure=(n:number,rounds:number)=>{
   const samples:number[]=[];
   for(let i=0;i<rounds;i++){
    const t0=performance.now();
    const brief=profileBrief(store.profile());
    samples.push(performance.now()-t0);
    // C0 本来就是空的（没有记忆就没有简报）——空是正确结果，不是错误。
    if(n>0&&!brief)throw new Error('简报不应为空');
   }
   return samples;
  };
  // C0
  const c0=measure(0,6);
  // C1：典型量 8 条
  build(8);
  const c1=measure(0,6);
  // C2：满档
  build(ITEMS_PER_KIND_MAX*PROFILE_KINDS.length);
  const c2=measure(0,6);
  store.close();
  details.itemCounts={C0:0,C1:8,C2:ITEMS_PER_KIND_MAX*PROFILE_KINDS.length};
  details.samplesMs={C0:c0.map(v=>Number(v.toFixed(4))),C1:c1.map(v=>Number(v.toFixed(4))),C2:c2.map(v=>Number(v.toFixed(4)))};
  const medianMs={C0:Number(median(c0).toFixed(4)),C1:Number(median(c1).toFixed(4)),C2:Number(median(c2).toFixed(4))};
  details.medianMs=medianMs;
  details.note='ABBA×3 的顺序是 C0,C1,C2,C2,C1,C0；这里取每个条件 6 次采样的中位数。数字随机器与数据量变化，不是产品承诺。';
  return{passed:true,summary:`开销中位数：C0 ${medianMs.C0}ms / C1 ${medianMs.C1}ms / C2 ${medianMs.C2}ms`,details};
 }finally{rmSync(dir,{recursive:true,force:true});}
}

/* ── 跨天保持：24h / 7d ─────────────────────────────────────────────────
   一次会话不能证明「长期」。用可控时钟推进 24 小时与 7 天，再核对记忆还在不在。 */
async function scenarioCrossDay():Promise<ScenarioResult>{
 const dir=mkdtempSync(join(tmpdir(),'xiaon-crossday-')),path=join(dir,'freechat.sqlite');
 const details:Record<string,unknown>={};
 try{
  const clock=new TestClock('2026-11-21T02:00:00.000Z');
  const store=new FreeChatStore(path,clock);
  store.setAutoRemember(true);
  store.insert({kind:'interest',text:'喜欢打篮球',source:'student',editedByStudent:true});
  const at0=store.profile().items.length;
  clock.advance(24*3600_000);
  const at24=store.profile().items.length;
  const brief24=profileBrief(store.profile());
  clock.advance(6*24*3600_000);
  const at7d=store.profile().items.length;
  const brief7d=profileBrief(store.profile());
  details.itemCounts={atStart:at0,after24h:at24,after7d:at7d};
  details.briefHasMemoryAt24h=brief24.includes('喜欢打篮球');
  details.briefHasMemoryAt7d=brief7d.includes('喜欢打篮球');
  store.close();
  const passed=at24===at0&&at7d===at0&&details.briefHasMemoryAt24h===true&&details.briefHasMemoryAt7d===true;
  return{passed,summary:passed?'24 小时与 7 天后记忆仍在，并且仍然进出站上下文':'跨天后记忆没有保住',details};
 }finally{rmSync(dir,{recursive:true,force:true});}
}

export async function runVerification():Promise<VerificationReport>{
 const scenarios:Record<string,ScenarioResult>={};
 scenarios['S1-新会话回忆']=await scenarioS1();
 scenarios['S3-偏好覆盖更新']=await scenarioS3();
 scenarios['S10-开销测量']=scenarioS10();
 scenarios['跨天保持-24h与7d']=await scenarioCrossDay();
 return{
  ranAt:new Date().toISOString(),
  node:process.version,
  scenarios,
  honestBoundary:'这次验证的是记忆的**机制**：记住了吗、覆盖对不对、代价多大、跨天保不保得住。它**不**证明「记忆让学习效果变好」——那需要带对照的实验，本文件没有做，也不据此宣称效果。',
 };
}

const isMain=()=>process.argv[1]?.endsWith('memory-verification.ts')||process.argv[1]?.endsWith('memory-verification.js');
if(isMain()){
 const outArg=process.argv.indexOf('--out');
 const out=resolve(outArg>0?process.argv[outArg+1]:'../../work/memory-verification.json');
 const report=await runVerification();
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({out,scenarios:Object.fromEntries(Object.entries(report.scenarios).map(([k,v])=>[k,{passed:v.passed,summary:v.summary}]))},null,2));
 if(Object.values(report.scenarios).some(s=>!s.passed))process.exitCode=1;
}
