/** Explicit synthetic model used only by D tests. Never environment-selected. */
import type { ModelProvider,ModelMessage } from '../../shared/learning-contracts';
export class ScenarioProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools=true;
 messages:ModelMessage[][]=[];mode:'normal'|'timeout'|'endless'|'injection'='normal';
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.messages.push(structuredClone(input.messages));
  if(this.mode==='timeout')return new Promise((_resolve,reject)=>{if(input.signal.aborted)reject(input.signal.reason);else input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true});});
  const system=input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  if(system.includes('assessor-d1')){
   const data=JSON.parse(input.messages.find(m=>m.role==='user')!.content);const value=data.value as string;const newline=value.indexOf('\n');
   return {content:JSON.stringify({points:data.task.rubric.map((p:{id:string;requiresExplanation:boolean;expected:string})=>{const start=p.requiresExplanation?newline+1:0,end=p.requiresExplanation?value.length:newline>=0?newline:value.length;return {pointId:p.id,status:p.requiresExplanation?(newline<0?'uncertain':value.slice(newline+1).includes('乘本数')?'unsupported':'supported'):(value.slice(0,newline>=0?newline:undefined).replace(/[\s−]/g,'')===p.expected.replace(/[\s−]/g,'')?'supported':'unsupported'),quote:value.slice(start,end),location:{start,end},explanation:'合成分析：只引用当前作答原文，不代表真实模型效果'};})}),toolCalls:[]};
  }
  const previous=input.messages.filter(m=>m.role==='tool').at(-1);
  if(this.mode==='endless'||!previous){return{content:'',toolCalls:[{id:'s-'+input.messages.length,name:this.mode==='injection'?'execute_sql':system.includes('planner-reporter-d1')?'get_skill_state':'get_learning_context',arguments:this.mode==='injection'?'{}':'{}'}]};}
  return {content:JSON.stringify(system.includes('planner-reporter-d1')?{statementIndexes:[0]}:{message:'我在这里。我们只做你愿意的一步。',taskIds:[]}),toolCalls:[]};
 }
}
