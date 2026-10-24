/** H2 developer UI checks using a scripted coordinator fixture, not a backend engine acceptance. */
import { test, expect, type Page } from '@playwright/test';
import { initial, PROGRESS_KEY } from '../../src/domain';
const api=Number(process.env.XIAON_H2_API_PORT??18952);
async function ready(page:Page){
 await page.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));},{key:PROGRESS_KEY,value:{...initial(),onboarded:true,age:'adult',necessary:true,page:'home'}});
 await page.goto('/');await expect(page.getByRole('textbox',{name:'对小N说'})).toBeVisible();
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'专业模式',exact:true}).click();
 await expect(page.getByRole('region',{name:'专业模式测评'})).toBeVisible();
}
const mode=(page:Page)=>page.getByRole('region',{name:'专业模式测评'});
/** 地图为主：一站走完回到地图，点亮着的当前地点直接进入对话。故事题点选作答，追问和文字题用输入框。 */
const composer=(page:Page)=>mode(page).locator('.professional-composer textarea, .professional-choices').first();
async function enter(page:Page){await expect(mode(page)).toHaveAttribute('aria-busy','false');if(!await composer(page).isVisible())await mode(page).getByRole('group',{name:'五维地图'}).locator('[aria-current="step"]').click();await expect(composer(page)).toBeVisible();}
async function reply(page:Page,text:string){const choices=mode(page).locator('.professional-choices');
 if(await choices.isVisible()){const label=/^[A-C]$/.test(text)?text:'A';await choices.locator('.professional-choice').filter({has:page.locator('b',{hasText:new RegExp('^'+label+'$')})}).click();await mode(page).getByRole('button',{name:'就选这个',exact:true}).click();}
 else{await mode(page).getByRole('textbox',{name:'我的回答'}).fill(text);await mode(page).getByRole('button',{name:'告诉小N',exact:true}).click();}}
async function answer(page:Page,text='每本是一本的价格'){
 await enter(page);
 const response=page.waitForResponse(r=>r.url().endsWith('/interview/answer'));
 await reply(page,text);
 const res=await response;if(!res.ok())console.log('H2 answer status',res.status(),await res.text());const body=await res.json();if(body.interview?.status==='paused')await expect(page).toHaveURL(/#home$/);else await expect(mode(page)).toHaveAttribute('aria-busy','false');return res;
}
test.beforeEach(async({request})=>{expect((await request.post(`http://127.0.0.1:${api}/__h2/reset`,{headers:{'X-Xiaon-Test':'synthetic-h2-only'}})).ok()).toBeTruthy();});
test('390宽：显式开始、五模块追问、暂停刷新续测、报告历史与月档案',async({page},info)=>{
 let starts=0;page.on('request',r=>{if(r.url().endsWith('/interview/start'))starts++;});await ready(page);expect(starts).toBe(0);
 const map=mode(page).getByRole('group',{name:'五维地图'});await expect(map.getByRole('button')).toHaveCount(5);
 // One map, two uses: a place card offers the assessment and free practice; the fixture's earlier assessment is finished, so practice is open.
 await map.getByRole('button',{name:/逻辑小桥/}).click();const first=mode(page).getByRole('region',{name:'逻辑小桥'});await expect(first).toContainText('已经点亮了');await expect(first.getByRole('button',{name:'从这里开始测评'})).toHaveCount(0);await expect(first.getByRole('button',{name:'在这里自由练习'})).toBeEnabled();expect(starts).toBe(0);await first.getByRole('button',{name:'收起'}).click();
 // All lit from the earlier assessment: 理解花园's card starts a retest (a deliberate tap, practice still offered); a lit current station is entered directly.
 await map.getByRole('button',{name:/理解花园/}).click();const garden=mode(page).getByRole('region',{name:'理解花园'});await expect(garden.getByRole('button',{name:'在这里自由练习'})).toBeEnabled();expect(starts).toBe(0);await garden.getByRole('button',{name:'从这里开始测评'}).click();await expect(mode(page).getByText('第 1 站 · 理解花园')).toBeVisible();await expect(composer(page)).toBeVisible();expect(starts).toBe(1);
 await mode(page).getByRole('button',{name:'← 回到地图'}).click();await expect(map.locator('[aria-current="step"]')).toContainText('理解花园点这里进入');await expect(map.locator('[data-state="waiting"]')).toHaveCount(4);await page.screenshot({path:info.outputPath('map-390.png'),fullPage:true});
 for(let i=0;i<2;i++)expect((await answer(page)).ok()).toBeTruthy();
 await expect(mode(page).getByRole('textbox')).toHaveCount(0);await expect(mode(page)).toContainText('理解花园点亮啦！下一站：逻辑小桥');await expect(map.locator('[data-state="done"]')).toContainText('理解花园');
 await map.getByRole('button',{name:/空间山丘/}).click();const later=mode(page).getByRole('region',{name:'空间山丘'});await expect(later).toContainText('先去逻辑小桥');await expect(later.getByRole('button',{name:'测评这一站'})).toHaveCount(0);
 await expect(later.getByRole('button',{name:'在这里自由练习'})).toBeDisabled();await expect(later).toContainText('测评做完就能在这里自由练习');await page.screenshot({path:info.outputPath('card-locked-390.png'),fullPage:true});await later.getByRole('button',{name:'收起'}).click();await expect(mode(page).getByRole('textbox')).toHaveCount(0);
 for(let i=0;i<2;i++)expect((await answer(page)).ok()).toBeTruthy();
 await expect(map.locator('[aria-current="step"]')).toContainText('计算');
 await mode(page).getByRole('button',{name:'先暂停',exact:true}).click();await expect(page).toHaveURL(/#home$/);await page.reload();
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'专业模式',exact:true}).click();await expect(mode(page).getByText('上次停在：计算')).toBeVisible();
 await mode(page).getByRole('group',{name:'五维地图'}).locator('[aria-current="step"]').click();await expect(mode(page).getByText('第 3 站 · 计算工坊')).toBeVisible();expect(starts).toBe(1);
 const hintResponse=page.waitForResponse(r=>r.url().endsWith('/learning/hint'));await mode(page).getByRole('button',{name:'给一点小提示'}).click();const hint=await(await hintResponse).json();expect(hint.ok).toBe(true);await expect(mode(page)).toContainText(hint.data.hint);await expect(mode(page)).not.toContainText('undefined');
 await page.setViewportSize({width:390,height:420});const textbox=mode(page).getByRole('textbox',{name:'我的回答'});await textbox.fill('先写草稿');await textbox.focus();await expect(mode(page).getByRole('button',{name:'告诉小N'})).toBeInViewport();await page.screenshot({path:info.outputPath('composer-390x420.png')});await page.setViewportSize({width:390,height:844});
 for(let i=0;i<6;i++)expect((await answer(page,'先看条件，再说明理由')).ok()).toBeTruthy();
 await expect(mode(page).getByText('这次五个模块都走过了，辛苦啦。')).toBeVisible();await mode(page).getByRole('button',{name:'看看本次报告'}).click();
 const report=page.getByRole('region',{name:'专业评测报告'});await expect(report).toBeVisible();await expect(report.locator('.professional-module')).toHaveCount(5);
 await report.getByText('展开依据原话').first().click();await expect(report.getByText('你说：「每本是一本的价格」').first()).toBeVisible();await expect(report).toContainText('本次得到确认');await expect(report).toContainText('这次说清了单位');
 expect(await report.innerText()).not.toMatch(/\d+\s*(分|名)|总分[:：]|排名[:：]|百分位/);
 await report.getByLabel('专业评测历史').selectOption('report-previous');await expect(report).toContainText('2026/9/30');await report.getByLabel('专业评测历史').selectOption({index:0});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:info.outputPath('report-390.png'),fullPage:true});
 await report.getByRole('button',{name:'进入月阶段规划'}).click();await expect(page).toHaveURL(/#plan$/);
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'成长',exact:true}).click();const archive=page.getByRole('region',{name:'成长档案'});await expect(archive).toHaveAttribute('aria-busy','false');await expect(archive).toContainText('2026 年 10 月');await expect(archive).toContainText('2026 年 09 月');await expect(archive.locator('.professional-trends')).toHaveCount(2);
 const october=archive.locator('.professional-month').filter({hasText:'2026 年 10 月'});await expect(october).toContainText('对话小结');await expect(october).toContainText('进步卡');await october.getByText('进步卡').click();await expect(october).toContainText('圈出单位');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:info.outputPath('archive-390.png'),fullPage:true});
});
test('两模块可出报告，余下标还没测到；安全回复阻止后续动作',async({page})=>{
 await ready(page);await mode(page).getByRole('button',{name:'开始',exact:true}).click();for(let i=0;i<4;i++)await answer(page);
 await mode(page).getByRole('button',{name:'看看本次报告'}).click();await expect(page.getByRole('region',{name:'专业评测报告'}).getByText('还没测到',{exact:true})).toHaveCount(3);
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'专业模式',exact:true}).click();
 const before=await page.evaluate(async()=>await(await fetch('/api/learning')).json());const res=await answer(page,'我不想活了');expect((await res.json()).safety).toBe(true);
 await expect(mode(page).getByRole('button',{name:'查看求助与安全支持'})).toBeVisible();await expect(mode(page).getByRole('button',{name:'看看本次报告'})).toHaveCount(0);await expect(mode(page).getByRole('textbox')).toHaveCount(0);
 const after=await page.evaluate(async()=>await(await fetch('/api/learning')).json());expect(after.interviewTurns.length).toBe(before.interviewTurns.length);expect(after.interviews).toEqual(before.interviews);
});
test('过期修订不丢草稿，失败不跳页；趋势断开仍能看小结',async({page})=>{
 await ready(page);let fail=true;await page.route('**/api/learning/interview/start',async route=>{if(fail){fail=false;await route.fulfill({status:501,json:{error:{message:'not_implemented'}}});}else await route.continue();});
 await mode(page).getByRole('button',{name:'开始',exact:true}).click();await expect(mode(page).getByRole('status')).toContainText('暂时没完成');await expect(page).toHaveURL(/#explore$/);await mode(page).getByRole('button',{name:'开始',exact:true}).click();
 let raw:Record<string,unknown>={};await page.route('**/api/learning/interview/answer',async route=>{raw=route.request().postDataJSON();await route.continue({postData:JSON.stringify({...raw,expectedRevision:999})});});
 const response=await answer(page,'这份草稿要保留');expect(response.status()).toBe(409);expect(raw.expectedRevision).toBe(1);expect(Object.keys(raw).sort()).toEqual(['expectedRevision','interviewId','operationId','text']);await expect(mode(page).getByRole('textbox')).toHaveValue('这份草稿要保留');
 await page.unroute('**/api/learning/interview/answer');await page.reload();await enter(page);await expect(mode(page).getByRole('textbox')).toHaveValue('这份草稿要保留');
 await page.route('**/api/learning/trend',route=>route.fulfill({status:501,json:{error:{message:'not_implemented'}}}));await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'成长',exact:true}).click();const archive=page.getByRole('region',{name:'成长档案'});await expect(archive).toContainText('等级趋势暂时还没接通');await expect(archive).toContainText('对话小结');await expect(archive).not.toContainText('not_implemented');
});
test('休息输入会暂停并回首页',async({page})=>{await ready(page);await mode(page).getByRole('button',{name:'开始',exact:true}).click();const res=await answer(page,'我想休息一下');expect((await res.json()).interview.status).toBe('paused');await expect(page).toHaveURL(/#home$/);});

test('等待回复时也可暂停，取消等待后保存暂停位置',async({page})=>{
 await ready(page);await mode(page).getByRole('button',{name:'开始',exact:true}).click();
 await page.route('**/api/learning/interview/answer',async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.abort().catch(()=>{});});
 await mode(page).getByRole('textbox',{name:'我的回答'}).fill('等待中的草稿');await mode(page).getByRole('button',{name:'告诉小N'}).click();
 await mode(page).getByRole('button',{name:'先暂停',exact:true}).click();await expect(page).toHaveURL(/#home$/);
 const view=await page.evaluate(async()=>await(await fetch('/api/learning')).json());expect(view.interviews.find((i:{status:string})=>i.status==='paused').currentModule).toBe('理解');
});
test('同一张地图：没有进行中的测评时，地点卡片里的自由练习能直接打开这里的小任务',async({page},info)=>{
 await ready(page);const map=mode(page).getByRole('group',{name:'五维地图'});
 await map.getByRole('button',{name:/理解花园/}).click();await page.screenshot({path:info.outputPath('card-open-390.png'),fullPage:true});
 await mode(page).getByRole('region',{name:'理解花园'}).getByRole('button',{name:'在这里自由练习'}).click();
 await expect(page.getByText('欢迎来到理解花园')).toBeVisible();await page.getByRole('button',{name:/我愿意，进入这个小任务/}).click();
 await expect(page).toHaveURL(/#task$/);
});
