/** 固定窗口限流：同一个键在窗口内最多放行 limit 次，超了就是 false。
 * 窗口是滚动的（按每次请求的时间戳），不是自然时间片——这样限流不会在整点被"对齐"绕过。
 * 用途：给会花钱的模型调用和认证接口兜底，避免一个账号或一个来源把额度刷爆。 */
export class RateLimiter{
 private hits=new Map<string,number[]>();
 constructor(readonly limit:number,readonly windowMs:number){}
 /** 记一次并判断是否放行。放行返回 true，超限返回 false（不记这次）。 */
 take(key:string,now=Date.now()):boolean{
  const list=this.hits.get(key)??[];
  while(list.length&&now-list[0]>=this.windowMs)list.shift();
  if(list.length>=this.limit)return false;
  list.push(now);this.hits.set(key,list);return true;
 }
 /** 丢掉很久没动静的键，避免这张表无限增长。 */
 prune(now=Date.now()){
  for(const[key,list]of this.hits){if(!list.length||now-list[list.length-1]>=this.windowMs)this.hits.delete(key);}
 }
 get size(){return this.hits.size;}
}
