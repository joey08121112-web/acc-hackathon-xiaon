/** 与服务端说话的唯一出口。
 *
 * 以前每个地方各写一遍 fetch：URL 怎么拼、错误消息怎么从 {error:{code,message}} 里掏出来、
 * 要不要带 cookie、超时怎么办 —— 散在 src/agent-client/index.ts、src/auth/session.ts、
 * src/voice/voice.ts 和游戏组件里。同一件事两套写法，早晚会有一处漏掉错误处理。
 *
 * 这一层只做三件事：拼请求、发请求、把失败翻译成一个带状态码与错误码的 ApiError。
 * 业务含义（学伴小N今天怎么样、这道题要不要重判）留给调用方自己说。
 */

/** 服务端返回的错误。带 HTTP 状态与业务错误码，界面可以据此决定要不要给「重试」。 */
export class ApiError extends Error {
  constructor(readonly status:number,readonly code:string,message:string){
    super(message);this.name='ApiError';
  }
}

/** 超时和「用户主动取消」是两回事：前者可以重试，后者重试没意义。 */
export class TimeoutError extends Error {
  constructor(readonly timeoutMs:number){super(`请求超过 ${timeoutMs} 毫秒没有回应`);this.name='TimeoutError';}
}

export interface FetchOptions{
  method?:'GET'|'POST';
  body?:unknown;
  signal?:AbortSignal;
  /** 毫秒。不填就是「等到服务回应为止」—— 学习对话可能要等模型，不能一刀切。 */
  timeoutMs?:number;
  credentials?:RequestCredentials;
  headers?:Record<string,string>;
  /** 缓存策略。检查静态资源是否更新时要 'no-store'。 */
  cache?:RequestCache;
  /** 服务端没给错误文案时用这句。别让原始响应体糊到界面上。 */
  fallbackMessage?:string;
}

/** 服务端的错误信封是 {error:{code,message}}。取不出 message 时用调用方给的通用话。 */
async function errorFrom(res:Response,fallback:string):Promise<ApiError>{
 const data=await res.json().catch(()=>null) as {error?:{code?:string;message?:string}}|null;
 return new ApiError(res.status,data?.error?.code??`http_${res.status}`,data?.error?.message??fallback);
}

async function rawFetch(url:string,options:FetchOptions):Promise<Response>{
 const {method='GET',body,signal,timeoutMs,credentials='same-origin',headers={},cache}=options;
 const controller=timeoutMs?new AbortController():undefined;
 const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):undefined;
 const forward=()=>controller?.abort();
 signal?.addEventListener('abort',forward,{once:true});
 try{
  return await fetch(url,{
   method,credentials,cache,
   headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),
   signal:controller?.signal??signal,
  });
 }catch(e){
  // 自己的超时先到（外部 signal 没被取消）→ 是「服务没回」；否则是调用方主动取消。
  if(timeoutMs&&controller?.signal.aborted&&!signal?.aborted)throw new TimeoutError(timeoutMs);
  throw e;
 }finally{
  if(timer)clearTimeout(timer);
  signal?.removeEventListener('abort',forward);
 }
}

/** 发一个 JSON 请求并读回 JSON。失败一律抛 ApiError。 */
export async function fetchJson<T>(url:string,options:FetchOptions={}):Promise<T>{
 const res=await rawFetch(url,options);
 if(!res.ok)throw await errorFrom(res,options.fallbackMessage??`服务返回 ${res.status}`);
 return res.json() as Promise<T>;
}

/** 取一段文本（静态资源、健康检查的原始体）。失败一律抛 ApiError。 */
export async function fetchText(url:string,options:FetchOptions={}):Promise<string>{
 const res=await rawFetch(url,options);
 if(!res.ok)throw await errorFrom(res,options.fallbackMessage??`服务返回 ${res.status}`);
 return res.text();
}

/** 取二进制（语音）。失败一律抛 ApiError。 */
export async function fetchBlob(url:string,options:FetchOptions={}):Promise<Blob>{
 const res=await rawFetch(url,options);
 if(!res.ok)throw await errorFrom(res,options.fallbackMessage??`服务返回 ${res.status}`);
 return res.blob();
}
