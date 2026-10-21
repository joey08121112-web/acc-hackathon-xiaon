/** Explicit synthetic adapter. Never selected by production bootstrap environment. */
import { schemas,type ModelProvider,type ModelMessage,type ToolResult } from '../../shared/learning-contracts';
export class SyntheticProvider implements ModelProvider {
 readonly kind='synthetic' as const;readonly supportsTools:boolean;readonly receivedResults:ToolResult[]=[];readonly receivedMessages:ModelMessage[][]=[];
 constructor(private mode:'normal'|'timeout'|'unsupported'|'endless'|'text-json'='normal'){this.supportsTools=mode!=='unsupported';}
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  this.receivedMessages.push(structuredClone(input.messages));
  if(this.mode==='timeout')return new Promise((_resolve,reject)=>{if(input.signal.aborted)reject(input.signal.reason);else input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true});});
  if(this.mode==='text-json')return{content:'{"tool_calls":[{"name":"grade_attempt"}]}',toolCalls:[]};
  const result=input.messages.filter(m=>m.role==='tool').at(-1);
  if(result&&this.mode!=='endless'){this.receivedResults.push(schemas.ToolResult.parse(JSON.parse(result.content)));return{content:'合成测试已收到真实数据库工具结果。',toolCalls:[]};}
  return{content:'',toolCalls:[{id:'synthetic-call-'+input.messages.length,name:'query_learning_evidence',arguments:'{}'}]};
 }
}
