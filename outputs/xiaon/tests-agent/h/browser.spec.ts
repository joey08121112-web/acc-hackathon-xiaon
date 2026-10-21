/** 所有者：ChatGPT。只用合成材料；390 宽浏览器不代表真实手机验收。 */
import { test, expect, type Page } from '@playwright/test';
import { initial, PROGRESS_KEY } from '../../src/domain';
async function ready(page:Page){
 await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:PROGRESS_KEY,value:{...initial(),onboarded:true,age:'adult',necessary:true,page:'home'}});
 await page.goto('/');await expect(page.getByRole('heading',{name:'心事有人听，进步有人记。'})).toBeVisible();
 await expect(page.getByRole('button',{name:'我考砸了，不想说话',exact:true})).toBeEnabled();
}
async function say(page:Page,text:string){
 const response=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));
 await page.getByRole('textbox',{name:'对小N说'}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();
 expect((await response).ok()).toBeTruthy();await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
}
test.beforeEach(async({request})=>{const r=await request.post('http://127.0.0.1:18952/__h/reset',{headers:{'X-Xiaon-Test':'synthetic-h-only'}});expect(r.ok()).toBeTruthy();});

test('首次记忆选择无预选，告知清楚；开与关均能保存',async({page})=>{
 for(const enabled of [true,false]){
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');
  await page.getByRole('checkbox',{name:'我已了解基本服务所需信息与本机演示规则'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();
  await expect(page.getByText('聊天时小N会留意你怎么读题、怎么想，帮你找方法，不打分。')).toBeVisible();
  const radios=page.getByRole('radio');expect(await radios.count()).toBe(2);for(const radio of await radios.all())await expect(radio).not.toBeChecked();
  await expect(page.getByRole('button',{name:'按我的选择，开始'})).toBeDisabled();
  await page.getByRole('radio',{name:enabled?'愿意，让小N在我确认后记住':'暂时不记住，照样可以聊'}).check();await page.getByRole('button',{name:'按我的选择，开始'}).click();
  await expect(page.getByRole('heading',{name:'心事有人听，进步有人记。'})).toBeVisible();
  const state=await page.evaluate(async()=>await(await fetch('/api/learning')).json());expect(state.optionalMemory).toBe(enabled);
 }
});

test('首页主动开口、确定需求、错题挂载、小结与刷新问候；不自动切模式',async({page},info)=>{
 let starts=0;page.on('request',req=>{if(req.url().endsWith('/learning/start'))starts++;});await ready(page);
 await expect(page.locator('.pet-hero-bubble')).toContainText('今天过得怎么样');await expect(page.getByLabel('服务模式')).toHaveCount(0);
 const request=page.waitForRequest(r=>r.url().endsWith('/learning/chat'));await page.getByRole('button',{name:'我考砸了，不想说话',exact:true}).click();expect((await request).postDataJSON().flow).toBe('home');
 await expect(page.getByRole('button',{name:'我考砸了，不想说话',exact:true})).toBeEnabled();await say(page,'数学，今天好多了');
 await expect(page.getByRole('region',{name:'接下来想怎么聊'})).toBeVisible();
 const study=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await page.getByRole('button',{name:'看看哪里没考好',exact:true}).click();expect((await study).request().postDataJSON().intent).toBe('study');
 await expect(page.getByRole('region',{name:'接下来想怎么聊'})).toHaveCount(0);
 const problem=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await say(page,'这道题我做错了，每本是什么意思');expect((await problem).ok()).toBeTruthy();expect((await (await problem).json()).askProblem).toBe(true);await expect(page.locator('.home-slots')).toHaveCount(1);
 await page.getByRole('button',{name:'今天先聊到这',exact:true}).click();await expect(page.getByRole('region',{name:'这次的对话小结'})).toBeVisible();
 await expect(page.getByText('理解 · 待专业模式确认')).toBeVisible();await expect(page.getByText('你说：「每本是什么意思」')).toBeVisible();expect(starts).toBe(0);
 await page.getByRole('button',{name:'先不了',exact:true}).click();expect(starts).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:info.outputPath('summary-390.png'),fullPage:true});
 await page.reload();await expect(page.locator('.pet-hero-bubble')).toContainText('上次我们聊了应用题的条件');
});

test('正式测试需二次确认，启动失败留在首页并可重试',async({page})=>{
 await ready(page);await say(page,'你好');await say(page,'今天还行');
 let starts=0;await page.route('**/api/learning/start',async route=>{starts++;if(starts===1)await route.fulfill({status:503,json:{error:{message:'合成启动失败'}}});else await route.continue();});
 await page.getByRole('button',{name:'做个正式测试',exact:true}).click();await expect(page.getByRole('button',{name:'去专业模式',exact:true})).toBeVisible();expect(starts).toBe(0);
 await expect(page.getByRole('button',{name:'我考砸了，不想说话',exact:true})).toBeEnabled();await page.getByRole('button',{name:'去专业模式',exact:true}).click();
 await expect(page.getByText('还没能开始专业模式，请稍后重试。')).toBeVisible();await expect(page.getByRole('heading',{name:'心事有人听，进步有人记。'})).toBeVisible();
 await page.getByRole('button',{name:'去专业模式',exact:true}).click();await expect(page).toHaveURL(/#explore$/);expect(starts).toBe(2);
});

test('陪聊第六轮轻问；拒绝后不再问；安全输入不请求小结',async({page})=>{
 await ready(page);await say(page,'你好');await say(page,'还行');
 for(let i=0;i<6;i++)await say(page,'今天和朋友打球很开心');
 await expect(page.getByRole('button',{name:'今天先不了',exact:true})).toBeVisible();
 const declined=page.waitForRequest(r=>r.url().endsWith('/learning/chat'));await page.getByRole('button',{name:'今天先不了',exact:true}).click();expect((await declined).postDataJSON().intent).toBe('decline_study');
 await expect(page.getByRole('button',{name:'我考砸了，不想说话',exact:true})).toBeEnabled();for(let i=0;i<7;i++)await say(page,'聊聊今天的篮球比赛');
 await expect(page.getByRole('button',{name:'今天先不了',exact:true})).toHaveCount(0);
 let ends=0;page.on('request',r=>{if(r.url().endsWith('/conversation/end'))ends++;});
 const response=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await say(page,'我不想活了');const reply=await(await response).json();expect(reply.safety).toBe(true);
 await expect(page.getByRole('button',{name:'今天先聊到这',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'查看求助与安全支持'})).toBeVisible();expect(ends).toBe(0);
});

test('小结失败可重试，问候失败回退；输入框在缩小视口可达',async({page},info)=>{
 await page.route('**/api/learning/greeting',route=>route.fulfill({status:503,json:{error:{message:'合成问候失败'}}}));
 await ready(page);await expect(page.locator('.pet-hero-bubble')).toContainText('今天过得怎么样');await say(page,'你好');
 let ends=0;await page.route('**/api/learning/conversation/end',async route=>{ends++;if(ends===1)await route.fulfill({status:503,json:{error:{message:'合成小结失败'}}});else await route.continue();});
 await page.getByRole('button',{name:'今天先聊到这',exact:true}).click();await expect(page.getByText('这次的小结还没整理好，对话已保留，可以再试一次。')).toBeVisible();
 await page.getByRole('button',{name:'今天先聊到这',exact:true}).click();await expect(page.getByRole('region',{name:'这次的对话小结'})).toBeVisible();
 await page.setViewportSize({width:390,height:420});const textbox=page.getByRole('textbox',{name:'对小N说'});await textbox.focus();await textbox.fill('新的一句合成内容');await expect(page.getByRole('button',{name:'发送',exact:true})).toBeInViewport();
 const box=await textbox.boundingBox();expect(box&&box.y>=0&&box.y+box.height<=420).toBeTruthy();await page.screenshot({path:info.outputPath('composer-390x420.png')});
});

test('开发者开关默认关；隐私列出记录类型；旧 chat 导航回首页',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'我的与设置',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'评委 / 开发者模式'});await expect(toggle).toHaveAttribute('aria-checked','false');await toggle.click();await expect(page.getByLabel('服务模式')).toBeVisible();await toggle.click();await expect(page.getByLabel('服务模式')).toHaveCount(0);
 await page.getByRole('button',{name:/信息与授权 必要用途/}).click();for(const text of ['对话观察','对话小结','进步卡','错题记录','智谱'])await expect(page.getByText(new RegExp(text)).first()).toBeVisible();
 await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key)!);s.page='chat';localStorage.setItem(key,JSON.stringify(s));},PROGRESS_KEY);await page.reload();await expect(page).toHaveURL(/#home$/);await expect(page.getByRole('textbox',{name:'对小N说'})).toBeVisible();
});

test('没有本地服务时保留旧首页按钮',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:{message:'合成断线'}}}));
 await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:PROGRESS_KEY,value:{...initial(),onboarded:true,page:'home'}});await page.goto('/');
 await expect(page.getByRole('button',{name:'先聊聊 我想先说说现在的心情'})).toBeVisible();await expect(page.getByRole('button',{name:'一起看一道题'})).toBeVisible();
});


test('旧 support 场次未切换成功时，不假装进入专业模式',async({page})=>{
 await ready(page);await say(page,'你好');await say(page,'还行');
 await page.getByRole('button',{name:'做个正式测试',exact:true}).click();await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
 await page.getByRole('button',{name:'今天先休息',exact:true}).click();await expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
 await page.getByRole('button',{name:'去专业模式',exact:true}).click();
 await expect(page.getByText('上次的学习还没结束，暂时没能切到专业模式。可以先继续聊天。')).toBeVisible();await expect(page).not.toHaveURL(/#explore$/);
});
