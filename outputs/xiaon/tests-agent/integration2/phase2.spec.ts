/** 三路生产插件集成走查；模型仅为可复现的合成台词，时钟由测试注入。 */
import { test,expect,type Page } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
const api='http://127.0.0.1:18954';
const shots=resolve(process.env.XIAON_INTEGRATION2_SHOTS??'../../任务书/2026-10-21-首页改版/交付/integration/evidence/phase2');
mkdirSync(shots,{recursive:true});
const shot=async(page:Page,name:string)=>{expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:join(shots,name+'.png'),fullPage:true});};
const view=(page:Page)=>page.evaluate(async()=>await(await fetch('/api/learning')).json());
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
const mode=(page:Page)=>page.getByRole('region',{name:'专业模式测评'});
const report=(page:Page)=>page.getByRole('region',{name:'专业评测报告'});
async function onboard(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');
 await page.getByRole('checkbox',{name:'我已了解基本服务所需信息与本机演示规则'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();
 await page.getByRole('radio',{name:'暂时不记住，照样可以聊'}).check();await page.getByRole('button',{name:'按我的选择，开始'}).click();
 await expect(page.getByRole('button',{name:'我考砸了，不想说话',exact:true})).toBeEnabled();
}
async function say(page:Page,text:string){const done=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await page.getByRole('textbox',{name:'对小N说'}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();expect((await done).ok()).toBe(true);await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');}
/** 地图为主：一站走完回到地图，点亮着的当前地点再进入对话。 */
async function enter(page:Page){await expect(mode(page)).toHaveAttribute('aria-busy','false');const box=mode(page).getByRole('textbox',{name:'我的回答'});if(!await box.isVisible())await mode(page).getByRole('group',{name:'五维地图'}).locator('[aria-current="step"]').click();await expect(box).toBeVisible();}
async function answer(page:Page,text:string){
 await enter(page);
 const done=page.waitForResponse(r=>r.url().endsWith('/interview/answer'));await mode(page).getByRole('textbox',{name:'我的回答'}).fill(text);await mode(page).getByRole('button',{name:'告诉小N',exact:true}).click();const res=await done;expect(res.ok(),await res.text()).toBe(true);await expect(mode(page)).toHaveAttribute('aria-busy','false');return res.json();
}
const RIGHT:Record<string,string>={understand:'2x-3',logic:'A','b-like-observation':'5x-4','b-like-transfer':'3a+7',bracket:'x+5',model:'3x+2',space:'B','b-language-transfer':'3a+6','b-logic-transfer':'C','b-cost-transfer':'5a+8','b-space-transfer':'A','b-language-delayed':'2x-8','b-logic-delayed':'B','b-like-delayed':'3x+5','b-cost-delayed':'2x+12','b-space-delayed':'C','b-neg-delayed':'12-3x',transfer:'4a+2'};
async function pass(page:Page,wrong=false){const v=await view(page),iv=v.interviews.find((i:{status:string})=>i.status==='in_progress'),tid=iv.pending.task.taskId;expect(RIGHT[tid],tid).toBeTruthy();await answer(page,wrong?'C':RIGHT[tid]);await expect(mode(page)).toContainText('再说说你的想法');return answer(page,'先检查题目的条件，再一步一步核对关系');}
async function clock(page:Page,at:string){expect((await page.request.post(api+'/__integration2/clock',{headers:{'X-Xiaon-Test':'synthetic-integration2-only'},data:{at}})).ok()).toBe(true);await page.reload();}
async function getReport(page:Page){const done=page.waitForResponse(r=>r.url().endsWith('/interview/report'));await mode(page).getByRole('button',{name:'看看本次报告'}).click();expect((await done).ok()).toBe(true);await expect(report(page)).toBeVisible();}
test.beforeEach(async({request})=>{expect((await request.post(api+'/__integration2/reset',{headers:{'X-Xiaon-Test':'synthetic-integration2-only'}})).ok()).toBe(true);});

test('390宽完整路线：小结→说明→追问与加问→计算暂停换天→报告→月周目标→今日→月底拒绝→次月复测成长',async({page})=>{
 await onboard(page);
 await say(page,'我考砸了');await say(page,'数学，好多题都错了');
 const done=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await page.getByRole('button',{name:'看看哪里没考好',exact:true}).click();expect((await done).ok()).toBe(true);await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
 await say(page,'应用题读着好绕，每本是什么意思');await say(page,'我想看看题目条件');await say(page,'题目里的每本指的是什么呢');await say(page,'每本就是一本练习本的价钱');
 expect((await view(page)).observations.length).toBeGreaterThan(0);
 const ended=page.waitForResponse(r=>r.url().endsWith('/conversation/end'));await page.getByRole('button',{name:'今天先聊到这'}).click();expect((await ended).ok()).toBe(true);
 const summary=page.getByRole('region',{name:'这次的对话小结'});await expect(summary.getByRole('button',{name:'去专业模式'})).toBeVisible();await shot(page,'01-summary');
 let starts=0;page.on('request',r=>{if(r.url().endsWith('/interview/start'))starts++;});await summary.getByRole('button',{name:'去专业模式'}).click();await expect(mode(page)).toBeVisible();expect(starts).toBe(0);await expect(page.locator('header')).toContainText('专业模式');await shot(page,'02-intro');
 await mode(page).getByRole('button',{name:'开始',exact:true}).click();await expect(mode(page).getByRole('textbox')).toBeVisible();await expect(page.getByRole('button',{name:'主动恢复本次学习'})).toHaveCount(0);
 await page.getByText('自由探索五维地图（测评结束后可选）',{exact:true}).click();await expect(page.locator('.exploration-map')).toHaveCount(0);await shot(page,'03-understanding');
 await answer(page,'2x-3');await shot(page,'04-follow-up');await answer(page,'先算两倍再减三，顺序不能反过来');
 await pass(page,true);let v=await view(page);expect(v.interviews[0].pending.kind).toBe('transfer');expect(v.interviews[0].currentModule).toBe('逻辑');await shot(page,'05-transfer');await pass(page);
 v=await view(page);expect(v.interviews[0].currentModule).toBe('计算');await expect(mode(page)).toContainText('逻辑小桥点亮啦！下一站：计算工坊');await shot(page,'05b-map-two-lit');await enter(page);const hintDone=page.waitForResponse(r=>r.url().endsWith('/learning/hint'));await mode(page).getByRole('button',{name:'给一点小提示'}).click();expect((await hintDone).ok()).toBe(true);await expect(mode(page)).toHaveAttribute('aria-busy','false');await answer(page,RIGHT[v.interviews[0].pending.task.taskId]);v=await view(page);expect(v.interviews[0].pending.kind).toBe('follow_up');const pending=v.interviews[0].pending,oldSession=v.interviews[0].learningSessionId;
 await mode(page).getByRole('button',{name:'先暂停',exact:true}).click();await expect(page).toHaveURL(/#home$/);await clock(page,'2026-10-22T01:00:00.000Z');await nav(page,'专业模式');await expect(mode(page)).toContainText('上次停在：计算');await shot(page,'06-next-day-paused');
 await mode(page).getByRole('button',{name:'继续测评'}).click();await expect(mode(page).getByRole('textbox')).toBeVisible();v=await view(page);expect(v.interviews[0].pending.task).toEqual(pending.task);expect(v.interviews[0].learningSessionId).not.toBe(oldSession);
 await page.setViewportSize({width:390,height:420});await mode(page).getByRole('textbox').fill('暂存想法');await mode(page).getByRole('textbox').focus();await expect(mode(page).getByRole('button',{name:'告诉小N'})).toBeInViewport();await shot(page,'07-composer-390x420');await page.setViewportSize({width:390,height:844});
 await answer(page,'先把x项合起来，再核对常数项');for(let i=0;i<2;i++)await pass(page);await expect(mode(page)).toContainText('这次五个模块都走过了');await getReport(page);
 await expect(report(page).locator('.professional-module')).toHaveCount(5);await expect(report(page)).toContainText('本次得到确认');await expect(report(page)).toContainText('可以试试');await expect(report(page).locator('.professional-module').filter({hasText:'理解'})).toContainText('掌握得不错');await expect(report(page).locator('.professional-module').filter({hasText:'计算'})).toContainText('部分掌握');
 await report(page).getByText('展开依据原话',{exact:false}).first().click();expect(await report(page).innerText()).not.toMatch(/\d+\s*(分|名)|总分[:：]|排名[:：]|百分位/);await expect(page.getByText('根据当前证据生成报告与计划草案',{exact:true})).toHaveCount(0);await shot(page,'08-report');
 v=await view(page);const first=v.professionalReports.at(-1);expect(first.modules[0].level).toBe('good');expect(v.optionalMemory).toBe(false);
 await report(page).getByRole('button',{name:'进入月阶段规划'}).click();await page.getByRole('button',{name:'根据最近的评测定一个本月目标'}).click();await expect(page.getByRole('textbox',{name:'本月目标',exact:true})).toBeVisible();v=await view(page);expect(v.monthStages.at(-1).sourceReportId).toBe(first.id);await shot(page,'09-month-draft');
 await page.getByRole('button',{name:'定下这个目标'}).click();await expect(page.getByRole('button',{name:'接受这份计划',exact:true})).toBeVisible();await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 1',{exact:true})).toBeVisible();
 v=await view(page);const monthStage=v.monthStages.at(-1);expect(monthStage.module).toBe('逻辑');
 expect(v.plans.at(-1).snapshot.items.every((i:{knowledgePointId:string;goal:string})=>i.knowledgePointId==='counterexample'&&i.goal.includes(monthStage.goal))).toBe(true);
 expect(monthStage.weeks.find((w:{weekStart:string})=>w.weekStart==='2026-10-19').planVersionId).toBe(v.plans.at(-1).snapshot.id);
 await shot(page,'10-month-week-confirmed');
 await nav(page,'今日');const weekly=page.getByRole('region',{name:'本月目标与本周任务'});await expect(weekly).toContainText('本周任务');await expect(weekly).toContainText('等待自主开始');await shot(page,'11-today');await nav(page,'成长');await expect(page.getByRole('region',{name:'成长档案'})).toHaveAttribute('aria-busy','false');await shot(page,'12-archive-october');
 await clock(page,'2026-10-26T01:00:00.000Z');await nav(page,'今日');
 await page.getByRole('button',{name:'生成这一周的任务',exact:true}).click();
 await expect(page.getByRole('button',{name:'接受这份计划',exact:true})).toBeVisible();v=await view(page);expect(v.plans).toHaveLength(1);
 expect(v.monthStages.at(-1).weeks.find((w:{weekStart:string})=>w.weekStart==='2026-10-26').planVersionId).toBeNull();
 await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 2',{exact:true})).toBeVisible();
 await nav(page,'今日');await expect(weekly).toContainText('反例');await shot(page,'20-week-two-confirmed');
 await clock(page,'2026-10-31T01:00:00.000Z');await nav(page,'今日');await expect(page.getByRole('status',{name:'复测提醒'})).toBeVisible();await shot(page,'13-month-end-reminder');const decline=page.waitForResponse(r=>r.url().endsWith('/stage/retest-decline'));await page.getByRole('button',{name:'本月先不做'}).click();expect((await decline).status()).toBe(200);await expect(page.getByRole('status',{name:'复测提醒'})).toHaveCount(0);await page.reload();await expect(page.getByRole('status',{name:'复测提醒'})).toHaveCount(0);await shot(page,'14-declined');
 await clock(page,'2026-11-01T01:00:00.000Z');await nav(page,'专业模式');await mode(page).getByRole('button',{name:'开始',exact:true}).click();await expect(mode(page).getByRole('textbox')).toBeVisible();
 for(let i=0;i<15;i++){v=await view(page);if(v.interviews.every((iv:{status:string})=>iv.status==='completed'))break;await pass(page);}
 await getReport(page);v=await view(page);expect(v.professionalReports.at(-1).comparedWithReportId).toBe(first.id);await expect(report(page)).toContainText('和上次比');await expect(report(page)).toContainText('对照');await shot(page,'15-retest-comparison');
 await nav(page,'成长');const archive=page.getByRole('region',{name:'成长档案'});await expect(archive).toHaveAttribute('aria-busy','false');await expect(archive).toContainText('2026 年 10 月');await expect(archive).toContainText('2026 年 11 月');await expect(archive.locator('.professional-trends')).toHaveCount(2);await shot(page,'16-archive-two-months');
 writeFileSync(join(shots,'walkthrough-facts.json'),JSON.stringify({firstReport:first,lastReport:v.professionalReports.at(-1),monthStage:v.monthStages,interviews:v.interviews,turns:v.interviewTurns.map((t:{module:string;kind:string;task:unknown})=>({module:t.module,kind:t.kind,task:t.task})),plans:v.plans},null,2));
});

test('仅理解与逻辑完成也能出报告，另三项还没测到；旧报告仅开发者可见，错误无原文',async({page})=>{
 await onboard(page);await nav(page,'专业模式');await mode(page).getByRole('button',{name:'开始',exact:true}).click();await expect(mode(page).getByRole('textbox')).toBeVisible();await pass(page);await pass(page,true);await pass(page);await getReport(page);
 await expect(report(page).getByText('还没测到',{exact:true})).toHaveCount(3);await shot(page,'17-partial-report');
 await page.evaluate(()=>{localStorage.setItem('xiaon-dev-mode','1');window.dispatchEvent(new Event('xiaon-dev-mode-change'));});
 await expect(page.getByText('详细证据（原学习观察报告）')).toBeVisible();await page.getByText('详细证据（原学习观察报告）').click();await expect(page.getByRole('button',{name:'根据当前证据生成报告与计划草案'})).toBeVisible();
 await page.evaluate(()=>{localStorage.removeItem('xiaon-dev-mode');window.dispatchEvent(new Event('xiaon-dev-mode-change'));});
 const old=(await view(page)).professionalReports.at(-1).id;
 await nav(page,'专业模式');await clock(page,'2026-10-21T01:01:00.000Z');await getReport(page);
 const newest=(await view(page)).professionalReports.at(-1).id;expect(newest).not.toBe(old);
 await report(page).getByLabel('专业评测历史').selectOption(old);
 await report(page).getByRole('button',{name:'进入月阶段规划'}).click();await page.getByRole('button',{name:'根据最近的评测定一个本月目标'}).click();await expect(page.getByRole('textbox',{name:'本月目标',exact:true})).toBeVisible();
 expect((await view(page)).monthStages.at(-1).sourceReportId).toBe(newest);await shot(page,'19-latest-report-stage');
 await page.route('**/api/learning/stage/confirm',route=>route.fulfill({status:500,json:{error:{code:'internal_error',message:'secret-internal-sqlite-engine-details'}}}));await page.getByRole('button',{name:'定下这个目标'}).click();await expect(page.getByRole('alert')).toContainText('这一步暂时没完成');await expect(page.getByRole('alert')).not.toContainText('secret-internal');await shot(page,'18-safe-error');
});
