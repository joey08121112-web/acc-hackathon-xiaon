/** 手机号当账号、学生自己设密码（暂不发短信验证码）。前后端共用同一套格式规则。 */
export const PHONE=/^1[3-9]\d{9}$/;
export const PASSWORD_MIN=6,PASSWORD_MAX=32;
export function phoneProblem(phone:string):string|null{return PHONE.test(phone)?null:'请填 11 位手机号';}
export function passwordProblem(password:string):string|null{
 if(password.length<PASSWORD_MIN)return `密码至少 ${PASSWORD_MIN} 位`;
 if(password.length>PASSWORD_MAX)return `密码最多 ${PASSWORD_MAX} 位`;
 if(/\s/.test(password))return '密码里不能有空格';
 return null;
}
export const maskPhone=(phone:string)=>phone.slice(0,3)+'****'+phone.slice(7);
/** required：这台服务器要不要先登录；phone：已登录时打码后的手机号。 */
export type AuthStatus={required:boolean;phone:string|null};
