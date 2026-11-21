import { z } from 'zod';
import type { ModelProvider,NativeToolCall } from '../../shared/learning-contracts';
import { RuntimeError } from '../core/errors';
import { GLM_DEFAULTS,type GlmConfig } from './config';
// OpenAI 兼容 Chat Completions（非流式）+ 原生 tools/tool_calls。当前默认供应商是 MiniMax M3.1-Flash，
// 智谱 GLM 仍可用同一套协议（BASE_URL 换回 + XIAON_GLM_THINKING=disabled）。不做通用兼容兜底：
// 供应商专有字段（thinking / reasoning_effort）按配置注入，不认识的字段可能被对方直接 400。
const replySchema=z.object({choices:z.array(z.object({finish_reason:z.string().optional(),message:z.object({content:z.string().nullable().optional(),reasoning_content:z.string().optional(),tool_calls:z.array(z.object({id:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/),type:z.literal('function'),function:z.object({name:z.string().max(128),arguments:z.string().max(32000)})})).max(12).optional()})})).min(1)});
export class GlmProvider implements ModelProvider {
 readonly kind='real_http' as const;readonly supportsTools=true;
 // Provider-private, in-flight protocol metadata; never returned through shared contracts, student text or traces.
 private assistantFields=new WeakMap<NativeToolCall[],{content:string|null;reasoning_content?:string}>();
 private settings:Pick<GlmConfig,'baseUrl'|'maxTokens'|'timeoutMs'|'thinking'|'reasoningEffort'>;
 constructor(private key:string,private model:string=GLM_DEFAULTS.model,private request:typeof fetch=fetch,settings:Partial<Pick<GlmConfig,'baseUrl'|'maxTokens'|'timeoutMs'|'thinking'|'reasoningEffort'>>={}){this.settings={...GLM_DEFAULTS,...settings};}
 async complete(input:Parameters<ModelProvider['complete']>[0]):ReturnType<ModelProvider['complete']>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new RuntimeError('timeout','模型请求超出服务端配置的超时预算')),this.settings.timeoutMs);const signal=AbortSignal.any([input.signal,controller.signal]);
  try{
   let res:Response;
   // 思考策略不再写死在请求里：MiniMax-M3.1-Flash 只接受 adaptive thinking，发 disabled 会 400；
   // 智谱 GLM 则相反，需要显式 disabled 才不慢（换回 GLM 时用 XIAON_GLM_THINKING=disabled 打开）。
   const body:Record<string,unknown>={model:this.model,stream:false,tool_choice:'auto',max_tokens:this.settings.maxTokens,messages:input.messages.map(m=>({role:m.role,content:m.content,...(m.toolCallId?{tool_call_id:m.toolCallId}:{}),...(m.toolCalls?{...this.assistantFields.get(m.toolCalls),tool_calls:m.toolCalls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:c.arguments}}))}:{})})),tools:input.tools.map(t=>({type:'function',function:t}))};
   if(this.settings.thinking)body.thinking={type:this.settings.thinking};
   if(this.settings.reasoningEffort)body.reasoning_effort=this.settings.reasoningEffort;
   try{res=await this.request(this.settings.baseUrl.replace(/\/+$/,'')+'/chat/completions',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},signal,body:JSON.stringify(body)});}catch{if(signal.aborted)throw signal.reason;throw new RuntimeError('provider_error','模型网络请求失败；没有把失败当作工具成功');}
   if(!res.ok)throw new RuntimeError(res.status===401||res.status===403?'provider_auth':res.status===429?'provider_rate_limit':'provider_error',`模型服务返回 HTTP ${res.status}，可检查服务端配置后重试`);
   let data:unknown;try{data=await res.json();}catch{if(signal.aborted)throw signal.reason;throw new RuntimeError('provider_error','模型返回非 JSON 响应');}
   if(signal.aborted)throw signal.reason;
   const parsed=replySchema.safeParse(data);if(!parsed.success)throw new RuntimeError('provider_error','模型响应不符合已实现的原生工具协议');
   const choice=parsed.data.choices[0];if(choice.finish_reason&&!['stop','tool_calls'].includes(choice.finish_reason))throw new RuntimeError('provider_error','模型响应截断或未正常结束；未执行其中工具，请调整服务端预算后重试');
   const message=choice.message;const toolCalls=(message.tool_calls??[]).map(c=>({id:c.id,name:c.function.name,arguments:c.function.arguments}));
   if(toolCalls.length)this.assistantFields.set(toolCalls,{content:message.content??null,...(message.reasoning_content?{reasoning_content:message.reasoning_content}:{})});
   return{content:message.content??'',toolCalls};
  }finally{clearTimeout(timer);}
 }
}
export class OfflineProvider implements ModelProvider {
 readonly kind='offline' as const;readonly supportsTools=false;
 async complete():ReturnType<ModelProvider['complete']>{throw new RuntimeError('unavailable');}
}
