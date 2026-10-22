import { test,expect,type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const api=`http://127.0.0.1:${process.env.XIAON_I_API_PORT??18954}`;
const shots=process.env.XIAON_FIX_SHOTS??join(process.env.XIAON_I_BROWSER_OUT!,'shots');mkdirSync(shots,{recursive:true});
const control=async(page:Page,path:string,data={})=>expect((await page.request.post(api+'/__i/'+path,{headers:{'X-Xiaon-Test':'synthetic-i-only'},data})).ok()).toBe(true);
const state=(page:Page)=>page.evaluate(async()=>await(await fetch('/api/learning')).json());
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
const shot=async(page:Page,name:string,fullPage=true)=>{expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:join(shots,name+'.png'),fullPage});};
async function ready(page:Page,memory=true){
 await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox',{name:'我看懂了'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('radio',{name:memory?'愿意，让小N在我确认后记住':'暂时不记住，照样可以聊'}).check();await page.getByRole('button',{name:'按我的选择，开始'}).click();await expect(page.getByRole('textbox',{name:'对小N说'})).toBeVisible();
}
async function say(page:Page,text:string){const done=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await page.getByRole('textbox',{name:'对小N说'}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();expect((await done).ok()).toBe(true);await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');}
test.beforeEach(async({request})=>{expect((await request.post(api+'/__i/reset',{headers:{'X-Xiaon-Test':'synthetic-i-only'}})).ok()).toBe(true);});
test('口述错题确认后新回复无草稿，仍显示记下了且只保存一次',async({page})=>{
 await ready(page);await say(page,'你好');await say(page,'还行');await say(page,'这道题的条件我想看看');await say(page,'负号括号总错，第3题写成 x − 5');
 await expect(page.getByRole('region',{name:'错题记录确认'})).toBeVisible();
 const done=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await page.getByRole('button',{name:'记下',exact:true}).click();expect((await done).ok()).toBe(true);await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
 await expect(page.getByRole('region',{name:'已记下的错题'})).toContainText('记下了');expect((await state(page)).problems).toHaveLength(1);await page.getByRole('region',{name:'已记下的错题'}).evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await shot(page,'03-problem-recorded',false);
});
test('记忆提议确认和关闭提示：学生点击才写记忆，关闭后不再提议',async({page})=>{
 await ready(page);await say(page,'你好');await say(page,'还行');await say(page,'下周有班级篮球赛');expect((await state(page)).memories).toHaveLength(0);
 await page.getByRole('region',{name:'记忆确认'}).getByRole('button',{name:'记 7 天'}).click();await page.getByRole('button',{name:'记住',exact:true}).click();await expect(page.getByRole('region',{name:'已记住'})).toContainText('记住了');
 const v=await state(page);expect(v.memories).toHaveLength(1);expect(Date.parse(v.memories[0].expiresAt)-Date.parse(v.memories[0].createdAt)).toBe(7*86400000);
 await say(page,'还有篮球赛');await page.getByRole('region',{name:'记忆确认'}).getByRole('button',{name:'不用了'}).click();await expect(page.getByRole('region',{name:'记忆确认'})).toHaveCount(0);expect((await state(page)).memories).toHaveLength(1);
 await say(page,'再聊篮球赛');await expect(page.getByRole('region',{name:'记忆确认'})).toHaveCount(0);
});
test('记忆关闭有明确提示且不提议、不写入',async({page})=>{
 await ready(page,false);await say(page,'你好');await say(page,'还行');await say(page,'下周有班级篮球赛');await expect(page.getByText('记忆已关，小N不会记住这次的方法，下次也不会主动提起。')).toBeVisible();await expect(page.getByRole('region',{name:'记忆确认'})).toHaveCount(0);expect((await state(page)).memories).toHaveLength(0);
});
test('月阶段与本周任务相符，第二周从今日生成、第三周从计划生成，都须亲自确认',async({page})=>{
 await ready(page,false);await control(page,'report');await page.reload();await nav(page,'成长');await page.getByRole('button',{name:'查看我的计划',exact:true}).click();
 await page.getByRole('button',{name:'根据最近的评测定一个本月目标'}).click();await page.getByRole('button',{name:'定下这个目标'}).click();
 let v=await state(page);expect(v.monthStages[0].module).toBe('逻辑');expect(v.plans).toHaveLength(0);expect(v.proposal.items.every((i:any)=>i.knowledgePointId==='counterexample')).toBe(true);
 await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 1',{exact:true})).toBeVisible();await nav(page,'今日');await expect(page.getByRole('region',{name:'本月目标与本周任务'})).toContainText('反例');await shot(page,'01-month-and-week');
 for(const [date,weekStart,where] of [['2026-10-12','2026-10-12','今日'],['2026-10-19','2026-10-19','计划']]){
  await control(page,'clock',{at:date+'T01:00:00.000Z'});await page.reload();
  if(where==='计划'){await nav(page,'成长');await page.getByRole('button',{name:'查看我的计划',exact:true}).click();}
  const before=(await state(page)).plans.length;
  await page.getByRole('button',{name:'生成这一周的任务',exact:true}).click();v=await state(page);expect(v.plans).toHaveLength(before);expect(v.monthStages[0].weeks.find((w:any)=>w.weekStart===weekStart).planVersionId).toBeNull();
  await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 '+(before+1),{exact:true})).toBeVisible();
  v=await state(page);expect(v.monthStages[0].weeks.find((w:any)=>w.weekStart===weekStart).planVersionId).toBe(v.plans.at(-1).snapshot.id);
  await nav(page,'今日');await expect(page.getByRole('region',{name:'本月目标与本周任务'})).toContainText('等待自主开始');if(date==='2026-10-12')await shot(page,'02-week-two-confirmed');
 }
});
