import { RuntimeError } from '../core/errors';
/** Server-only configuration. Deliberately retains the existing XIAON_GLM_* namespace. */
export const GLM_DEFAULTS=Object.freeze({model:'glm-5.3-flash',baseUrl:'https://open.bigmodel.cn/api/paas/v4',timeoutMs:120000,maxTokens:8192});
export interface GlmConfig {apiKey:string;model:string;baseUrl:string;timeoutMs:number;maxTokens:number}
export function readGlmConfig(env:Readonly<Record<string,string|undefined>>=process.env):GlmConfig {
 const model=env.XIAON_GLM_MODEL?.trim()||GLM_DEFAULTS.model;
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(model))throw new RuntimeError('invalid_params','XIAON_GLM_MODEL 无效');
 const baseUrl=(env.XIAON_GLM_BASE_URL?.trim()||GLM_DEFAULTS.baseUrl).replace(/\/+$/,'');
 let url:URL;try{url=new URL(baseUrl);}catch{throw new RuntimeError('invalid_params','XIAON_GLM_BASE_URL 无效');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new RuntimeError('invalid_params','XIAON_GLM_BASE_URL 需要不含凭据/查询参数的HTTPS基址');
 function integer(name:string,fallback:number,max:number){const raw=env[name]?.trim();const value=raw?Number(raw):fallback;if(!Number.isInteger(value)||value<1||value>max)throw new RuntimeError('invalid_params',name+' 必须是允许范围内的正整数');return value;}
 return{apiKey:env.XIAON_GLM_API_KEY?.trim()??'',model,baseUrl,timeoutMs:integer('XIAON_GLM_TIMEOUT_MS',GLM_DEFAULTS.timeoutMs,900000),maxTokens:integer('XIAON_GLM_MAX_TOKENS',GLM_DEFAULTS.maxTokens,131072)};
}
