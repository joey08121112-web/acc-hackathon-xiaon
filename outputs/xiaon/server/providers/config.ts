import { RuntimeError } from '../core/errors';
/** Server-only configuration. Deliberately retains the existing XIAON_GLM_* namespace.
 *  命名沿用说明：XIAON_GLM_* 是历史前缀，现在读作「服务端模型供应商」。默认供应商已于 2026-11-21 从智谱 GLM
 *  切到 MiniMax M3.1-Flash（OpenAI 兼容端点）。保留前缀是为了不改线上部署已经填好的环境变量名。
 * hedgeMs: a request still unanswered after this long is sent once more and the first answer wins (0 turns it off).
 * thinking: 只有认 thinking.type 的协议才需要（智谱 GLM 用 disabled 省思考时间）。MiniMax-M3.1-Flash 收到
 *  thinking.type=disabled 直接 400（实测错误码 2013：requires adaptive thinking），所以默认不发。
 * reasoningEffort: MiniMax-M3.1-Flash 的思考深度档位（low/medium/high/xhigh/max）。留空=不发，由服务端决定
 *  （实测默认 max）；none 会被拒 400，不能用。 */
export type ThinkingMode=''|'disabled';
export type ReasoningEffort=''|'low'|'medium'|'high'|'xhigh'|'max';
export interface GlmConfig{apiKey:string;model:string;baseUrl:string;timeoutMs:number;maxTokens:number;hedgeMs:number;thinking:ThinkingMode;reasoningEffort:ReasoningEffort}
export const GLM_DEFAULTS=Object.freeze({model:'MiniMax-M3.1-Flash',baseUrl:'https://api.minimax.cn/v1',timeoutMs:120000,maxTokens:16384,hedgeMs:20000,thinking:'' as ThinkingMode,reasoningEffort:'' as ReasoningEffort});
export function readGlmConfig(env:Readonly<Record<string,string|undefined>>=process.env):GlmConfig {
 const model=env.XIAON_GLM_MODEL?.trim()||GLM_DEFAULTS.model;
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(model))throw new RuntimeError('invalid_params','XIAON_GLM_MODEL 无效');
 const baseUrl=(env.XIAON_GLM_BASE_URL?.trim()||GLM_DEFAULTS.baseUrl).replace(/\/+$/,'');
 let url:URL;try{url=new URL(baseUrl);}catch{throw new RuntimeError('invalid_params','XIAON_GLM_BASE_URL 无效');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new RuntimeError('invalid_params','XIAON_GLM_BASE_URL 需要不含凭据/查询参数的HTTPS基址');
 function integer(name:string,fallback:number,max:number){const raw=env[name]?.trim();const value=raw?Number(raw):fallback;if(!Number.isInteger(value)||value<1||value>max)throw new RuntimeError('invalid_params',name+' 必须是允许范围内的正整数');return value;}
 const hedgeRaw=env.XIAON_GLM_HEDGE_MS?.trim();const hedgeMs=hedgeRaw?Number(hedgeRaw):GLM_DEFAULTS.hedgeMs;
 if(!Number.isInteger(hedgeMs)||hedgeMs<0||hedgeMs>600000)throw new RuntimeError('invalid_params','XIAON_GLM_HEDGE_MS 必须是 0 到 600000 的整数');
 const thinking=(env.XIAON_GLM_THINKING?.trim()||GLM_DEFAULTS.thinking) as ThinkingMode;
 if(thinking!==''&&thinking!=='disabled')throw new RuntimeError('invalid_params','XIAON_GLM_THINKING 只能是空或 disabled');
 const reasoningEffort=(env.XIAON_GLM_REASONING_EFFORT?.trim()||GLM_DEFAULTS.reasoningEffort) as ReasoningEffort;
 if(reasoningEffort!==''&&!['low','medium','high','xhigh','max'].includes(reasoningEffort))throw new RuntimeError('invalid_params','XIAON_GLM_REASONING_EFFORT 只能是空或 low/medium/high/xhigh/max');
 return{apiKey:env.XIAON_GLM_API_KEY?.trim()??'',model,baseUrl,timeoutMs:integer('XIAON_GLM_TIMEOUT_MS',GLM_DEFAULTS.timeoutMs,900000),maxTokens:integer('XIAON_GLM_MAX_TOKENS',GLM_DEFAULTS.maxTokens,131072),hedgeMs,thinking,reasoningEffort};
}
