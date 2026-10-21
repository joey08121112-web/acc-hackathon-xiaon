import { test,expect,type Page } from '@playwright/test';
async function enter(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'认识一下小N',exact:true}).click();await page.getByRole('combobox',{name:'年龄段',exact:true}).selectOption('14-17');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'继续，选择可选功能',exact:true}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验',exact:true}).click();
}
test('synthetic model browser chat reaches local handler; student API keeps trusted answers server-side',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page);await page.getByRole('button',{name:/先聊聊/}).click();
 const input=page.getByRole('textbox');await input.fill('合成测试：我这次考砸了');
 await page.getByRole('button',{name:/发送/}).click();
 await expect(page.getByText('合成测试已收到真实数据库工具结果。')).toBeVisible();
 const result=await page.evaluate(async()=>{
  const auth=await fetch('/api/local-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const token=(await auth.json()).csrfToken;
  const headers={'Content-Type':'application/json','X-Xiaon-CSRF':token};
  const post=async(path:string,data:unknown)=>{const res=await fetch('/api/'+path,{method:'POST',headers,body:JSON.stringify(data)});if(!res.ok)throw new Error('HTTP '+res.status);return res.json();};
  const s=await post('sessions',{operationId:'browser-s',mode:'support'});
  await post('exposures',{operationId:'browser-e',sessionId:s.id,taskId:'bracket',taskVersion:1,kind:'task',hintId:null});
  const submission={operationId:'browser-a',sessionId:s.id,taskId:'bracket',taskVersion:1,value:'x+5'};
  const a=await post('attempts',submission);const retry=await post('attempts',submission);const task=await(await fetch('/api/tasks/bracket/1')).json();
  return{sameAttempt:a.id===retry.id,taskLeaksKey:'answer'in task||'rubric'in task,context:await(await fetch('/api/context')).json()};
 });
 expect(result.sameAttempt).toBe(true);expect(result.taskLeaksKey).toBe(false);expect(result.context.attemptCount).toBe(1);expect(errors).toEqual([]);expect(requests.every(url=>url.startsWith('http://127.0.0.1:'))).toBe(true);
 await page.screenshot({path:'../../任务书/2026-10-21-Agent升级/交付/A/evidence/browser-synthetic-chat.png'});
});
test('local_rules health preserves existing chat and rest behavior in a fresh browser context',async({page})=>{
 await page.route('**/api/health',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'local_rules',providerKind:'offline'})}));
 await enter(page);await page.getByRole('button',{name:/先聊聊/}).click();await page.getByRole('textbox').fill('这次考砸了');await page.getByRole('button',{name:/发送/}).click();await expect(page.getByText(/听起来，这次考试让你有些难受/)).toBeVisible();
});
