/** 档案页的写操作：校验后交给本人的 FreeChatStore，返回改完后的整份档案。不认识的路径返回 undefined。 */
import { profileRequests,type Profile } from '../../shared/free-chat';
import { RuntimeError } from '../core/errors';
import type { FreeChatStore } from './store';
export function profilePost(store:FreeChatStore,path:string,raw:unknown):Profile|undefined{
 const parse=<T>(schema:{safeParse(v:unknown):{success:true;data:T}|{success:false}})=>{const p=schema.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params','档案请求格式不对');return p.data;};
 switch(path){
  case '/api/free-chat/profile/item':store.studentEdit(parse(profileRequests.item));break;
  case '/api/free-chat/profile/basic':{const b=parse(profileRequests.basic);store.setBasic(b.nickname,b.grade);break;}
  case '/api/free-chat/settings':store.setAutoRemember(parse(profileRequests.settings).autoRemember);break;
  default:return undefined;
 }
 return store.profile();
}
