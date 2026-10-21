import type { Failure } from '../../shared/learning-contracts';
export class RuntimeError extends Error {
  constructor(readonly code:Failure['code'], message:string=code, readonly recoverable=true){super(message);}
}
export function failure(error:unknown):Failure {
  return error instanceof RuntimeError?{code:error.code,message:error.message,recoverable:error.recoverable}:{code:'internal_error',message:'本地服务未完成请求；可重试并检查本地配置。',recoverable:true};
}
