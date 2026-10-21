/** Only synthetic preference markers are transmitted. Transport capture stores booleans, never bodies or headers. */
import { writeFileSync } from 'node:fs';
import { readGlmConfig } from '../../server/providers/config';
import { GlmProvider } from '../../server/providers/glm';
import { temporaryRepository } from '../../server/storage/testing';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
const config=readGlmConfig(),out='../../任务书/2026-10-21-Agent升级/交付/D/evidence/real-memory-context.json',id=()=>crypto.randomUUID();
if(!config.apiKey){writeFileSync(out,JSON.stringify({status:'NOT_RUN'}));process.exit(2);}
let stage='';const markers=['D_SYNTHETIC_PREFERENCE_ONE','D_SYNTHETIC_PREFERENCE_TWO','D_SYNTHETIC_PREFERENCE_THREE'];
const captures:{stage:string;contains:boolean[];httpStatus:number}[]=[];
const request=(async(input:Parameters<typeof fetch>[0],init:Parameters<typeof fetch>[1])=>{const body=String(init?.body??'');const contains=markers.map(m=>body.includes(m));try{const res=await fetch(input,init);captures.push({stage,contains,httpStatus:res.status});return res;}catch(e){captures.push({stage,contains,httpStatus:0});throw e;}}) as typeof fetch;
const f=temporaryRepository(),r=createRuntime({...f,provider:new GlmProvider(config.apiKey,config.model,request,config)}),d=installLearning(r,{timeoutMs:config.timeoutMs});
const results:{stage:string;status:string|null;error:unknown;expected:boolean[];transportMatched:boolean}[]=[];
async function check(name:string,expected:boolean[]){stage=name;const reply=await d.chat({operationId:id(),history:[{role:'user',content:'合成软件验收。请只按指定JSON格式简短回应“好”，taskIds留空，不要复述偏好。'}]});const current=captures.filter(c=>c.stage===stage);results.push({stage,status:reply.run?.status??null,error:reply.run?.error??null,expected,transportMatched:current.length>0&&current.every(c=>c.httpStatus===200&&c.contains.every((b,i)=>b===expected[i]))});console.log(name,reply.run?.status);}
try{
 r.events.consent({operationId:id(),optionalMemory:true});const first=r.events.remember({operationId:id(),text:markers[0],source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});await check('enabled',[true,false,false]);
 const corrected=await d.memoryCorrect({operationId:id(),memoryId:first.id,text:markers[1]});await check('corrected',[false,true,false]);
 r.events.consent({operationId:id(),optionalMemory:false});await check('off',[false,false,false]);
 r.events.consent({operationId:id(),optionalMemory:true});r.events.memoryState({operationId:id(),memoryId:corrected.id,action:'stop'});await check('stopped',[false,false,false]);
 const third=r.events.remember({operationId:id(),text:markers[2],source:'student_explicit',purpose:'tutoring',expiresAt:null,reviewAt:null});r.events.memoryState({operationId:id(),memoryId:third.id,action:'delete'});await check('deleted',[false,false,false]);
 const ok=results.every(r=>r.status==='completed'&&r.transportMatched);writeFileSync(out,JSON.stringify({status:ok?'VERIFIED':'FAILED',model:config.model,provider:'real_http',materials:'synthetic preference markers only',results,captures},null,2));process.exitCode=ok?0:1;
}catch(e){writeFileSync(out,JSON.stringify({status:'FAILED',error:{name:(e as Error).name,message:(e as Error).message},results,captures},null,2));process.exitCode=1;}finally{f.dispose();}
