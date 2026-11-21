/** 统一的错误呈现：把技术错误翻译成孩子看得懂的一句话。
 *
 * 三条规矩（这个应用是给中小学生用的）：
 *  ① 一句话讲清发生了什么，不甩堆栈；
 *  ② 说清「已经保存的东西还在不在」—— 孩子最怕的是弄丢；
 *  ③ 说清能不能重试 —— 不能重试就别给一个没用的重试按钮。
 *
 * 技术细节（状态码、错误码、堆栈）只在开发者模式里露出来。
 */
import { ApiError, TimeoutError } from './agent-client/http';

export type ErrorView={
 /** 给孩子看的一句话。 */
 message:string;
 /** 能不能重试。false 时界面不该给「再试一次」。 */
 retryable:boolean;
 /** 开发者模式下的技术细节。 */
 detail?:string;
};

function isAbort(error:unknown):boolean{
 return error instanceof DOMException&&error.name==='AbortError'
  ||(error instanceof Error&&error.name==='AbortError');
}

/** 网络层失败在浏览器里表现为 TypeError（fetch 抛的），不是业务错误。 */
function isNetworkFailure(error:unknown):boolean{
 return error instanceof TypeError;
}

export function describeError(error:unknown,options:{dev?:boolean}={}):ErrorView{
 const dev=options.dev===true;
 const detail=dev
  ?error instanceof Error?`${error.name}: ${error.message}`:String(error)
  :undefined;

 if(isAbort(error))return {message:'这一步已经取消了。刚才保存的内容还在。',retryable:false,detail};
 if(error instanceof TimeoutError)return {message:'服务这次没在规定时间内回应，可以再试一次。刚才保存的内容还在。',retryable:true,detail};
 if(error instanceof ApiError){
  // 服务端给的文案本身就是给孩子写的（例：「手机号或密码不对」），优先用它。
  if(error.status>=400&&error.status<500&&error.status!==429&&error.status!==408)return {message:error.message,retryable:false,detail};
  if(error.status===429)return {message:'等一小会儿再试就好。刚才保存的内容还在。',retryable:true,detail};
  return {message:`${error.message}（可以再试一次，刚才保存的内容还在。）`,retryable:true,detail};
 }
 if(isNetworkFailure(error))return {message:'连不上服务。检查一下网络，或者稍后再试。刚才保存的内容还在。',retryable:true,detail};
 if(error instanceof Error&&error.message)return {message:'出了点小状况，可以再试一次。刚才保存的内容还在。',retryable:true,detail};
 return {message:'出了点小状况，可以再试一次。刚才保存的内容还在。',retryable:true,detail};
}
