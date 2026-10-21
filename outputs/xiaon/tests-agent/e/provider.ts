/** Explicit synthetic model for E tests. Never environment-selected; real GLM evidence is separate. */
import type { ModelProvider,ModelMessage } from '../../shared/learning-contracts';
import { ScenarioProvider } from '../d/provider';
export type Reply=string|{toolCall:true}|((data:Record<string,unknown>)=>string);
export const candidate=(over:Record<string,unknown>={})=>JSON.stringify({templateId:'nb-basic',difficulty:'introductory',variable:'x',params:{a:9,b:4,c:7},expression:'9x − (4x − 7)',answer:'5x+7',steps:['9x-4x+7','5x+7'],focus:'bracket_sign_constant',evidenceIds:[],...over});
export const likeCandidate=(over:Record<string,unknown>={})=>JSON.stringify({templateId:'lt-terms',difficulty:'introductory',variable:'a',params:{terms:[{k:4,variable:true},{k:6,variable:false},{k:3,variable:true}]},expression:'4a + 6 + 3a',answer:'7a+6',steps:['7a+6'],focus:'combine_coefficients',evidenceIds:[],...over});
export class GenerationProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;
 readonly base=new ScenarioProvider();
 generatorMessages:ModelMessage[][]=[];queue:Reply[]=[];delayMs=0;hang=false;
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const system=input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  if(!system.includes('generator-e1'))return this.base.complete(input);
  this.generatorMessages.push(structuredClone(input.messages));
  if(this.hang)return new Promise((_r,reject)=>{if(input.signal.aborted)reject(input.signal.reason);input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true});});
  if(this.delayMs)await new Promise(r=>setTimeout(r,this.delayMs));
  const reply=this.queue.shift()??candidate();
  if(typeof reply==='object')return{content:'',toolCalls:[{id:'gen-tool-1',name:'execute_sql',arguments:'{}'}]};
  const data=JSON.parse(input.messages.find(m=>m.role==='user')!.content);
  return{content:typeof reply==='function'?reply(data):reply,toolCalls:[]};
 }
}
