import { RuntimeError } from '../../core/errors';
/** Non-secret limits. Model, key and base URL stay in the existing XIAON_GLM_* configuration. */
export type GenerationConfig={
 /** Model rounds per student operation: one candidate plus at most one repair. Never more than 2. */
 maxRounds:1|2;
 /** Whole generation run, including the repair round. */
 timeoutMs:number;
 /** Model-invoking generation operations per Asia/Shanghai date (cost ceiling). */
 dailyLimit:number;
 /** Published generated tasks per learning session; the 10-calculation exposure cap still applies. */
 sessionLimit:number;
 /** Evidence rows sent to the model. */
 evidenceLimit:number;
};
export const GENERATION_DEFAULTS:GenerationConfig=Object.freeze({maxRounds:2,timeoutMs:60000,dailyLimit:12,sessionLimit:5,evidenceLimit:6});
export function readGenerationConfig(env:Readonly<Record<string,string|undefined>>=process.env):GenerationConfig{
 const integer=(name:string,fallback:number,min:number,max:number)=>{const raw=env[name]?.trim();const value=raw?Number(raw):fallback;if(!Number.isInteger(value)||value<min||value>max)throw new RuntimeError('invalid_params',`${name} 必须是 ${min}–${max} 的整数`);return value;};
 return{maxRounds:integer('XIAON_GENERATION_MAX_ROUNDS',2,1,2) as 1|2,timeoutMs:integer('XIAON_GENERATION_TIMEOUT_MS',GENERATION_DEFAULTS.timeoutMs,1000,120000),dailyLimit:integer('XIAON_GENERATION_DAILY_LIMIT',GENERATION_DEFAULTS.dailyLimit,1,100),sessionLimit:integer('XIAON_GENERATION_SESSION_LIMIT',GENERATION_DEFAULTS.sessionLimit,1,10),evidenceLimit:GENERATION_DEFAULTS.evidenceLimit};
}
