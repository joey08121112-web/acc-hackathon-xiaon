/** 所有者：Claude。第一期演示路线（04-集成与验收.md）在 390 宽下的走查：真 HTTP / SQLite / 三路插件 + 按阶段写台词的合成模型。只用合成材料。
 * 390 宽的浏览器不等于真实手机验收。 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const api=`http://127.0.0.1:${process.env.XIAON_G_API_PORT??18951}`;
const shots=process.env.XIAON_G_SHOTS??join(process.env.XIAON_G_BROWSER_OUT??'.','shots');mkdirSync(shots,{recursive:true});
const shot=(page:Page,name:string)=>page.screenshot({path:join(shots,name+'.png'),fullPage:true});
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name}).click();
const idle=(page:Page)=>expect(page.locator('.home-chat')).toHaveAttribute('aria-busy','false');
async function chatAfter(page:Page,act:()=>Promise<unknown>){
 const response=page.waitForResponse(r=>r.url().endsWith('/learning/chat'));await act();expect((await response).ok()).toBeTruthy();await idle(page);
}
const say=(page:Page,text:string)=>chatAfter(page,async()=>{await page.getByRole('textbox',{name:'对小N说'}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();});
async function onboard(page:Page,memory:boolean){
 await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');
 await page.getByRole('checkbox',{name:'我已了解基本服务所需信息与本机演示规则'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();
 await page.getByRole('radio',{name:memory?'愿意，让小N在我确认后记住':'暂时不记住，照样可以聊'}).check();await page.getByRole('button',{name:'按我的选择，开始'}).click();
 await expect(page.getByRole('heading',{name:'心事有人听，进步有人记。'})).toBeVisible();
}
/** listen ×2 → 确定需求 → probe（第 6 轮试探记一条理解观察）→ 口述错题并确认 → 一起想（中途一次提示）→ 说出答案 → 说收获。 */
async function throughReflect(page:Page,prefix:string|null){
 await chatAfter(page,()=>page.getByRole('button',{name:'我考砸了，不想说话',exact:true}).click());
 await say(page,'数学，好多题都错了');
 await expect(page.getByRole('heading',{name:'接下来，你想怎么聊？'})).toBeVisible();if(prefix)await shot(page,prefix+'-02-needs-check');
 await chatAfter(page,()=>page.getByRole('button',{name:'看看哪里没考好',exact:true}).click());
 await say(page,'应用题读着好绕，每本是什么意思我搞不清');await say(page,'嗯');
 await say(page,'就是不知道题目里的每本指什么');
 await expect(page.locator('.pet-hero-bubble')).toContainText('每本');
 await say(page,'还有负号括号总错，第3题我写成了 x − 5');
 await expect(page.getByRole('heading',{name:'我记下的是这些，对吗？'})).toBeVisible();if(prefix)await shot(page,prefix+'-03-problem-card');
 await chatAfter(page,()=>page.getByRole('button',{name:'记下',exact:true}).click());
 await expect(page.locator('.pet-hero-bubble')).toContainText('负号会影响');if(prefix)await shot(page,prefix+'-04-think');
 await say(page,'给我一点提示');await expect(page.locator('.pet-hero-bubble')).toContainText('用自己的话');
 await say(page,'x+5');await expect(page.locator('.pet-hero-bubble')).toContainText('这次你发现了什么');
 await say(page,'拆开来看就清楚了');
 await expect(page.getByRole('heading',{name:'这次的进步卡'})).toBeVisible();
 await expect(page.getByLabel('今天的小突破')).toHaveValue(/提示后/);await expect(page.getByLabel('今天的小突破')).not.toHaveValue(/完全靠自己/);
 await expect(page.getByLabel('这次有用的方法')).toHaveValue(/拆开来看就清楚了/);
}
test.beforeEach(async({request})=>{const r=await request.post(api+'/__g/reset',{headers:{'X-Xiaon-Test':'synthetic-g-only'}});expect(r.ok()).toBeTruthy();});

test('第一期演示路线：倾诉 → 确定需求 → 观察 → 错题 → 一起想 → 进步卡 → 记住方法 → 小结 → 专业模式 → 刷新接话；第二次对话和上次比',async({page})=>{
 await onboard(page,true);await shot(page,'p1-01-home-opener');
 await throughReflect(page,'p1');
 await expect(page.getByRole('heading',{name:'要我记住这件小事吗？'})).toBeVisible();await expect(page.getByLabel('记成这样').or(page.locator('.memory-prompt'))).toContainText('拆开来看');
 await page.getByRole('button',{name:'一直记得'}).click();await shot(page,'p1-05-progress-card-and-memory');
 await page.getByRole('button',{name:'记住',exact:true}).click();await expect(page.getByText('记住了：拆开来看就清楚了')).toBeVisible();
 await page.getByRole('button',{name:'确认保存'}).click();await expect(page.getByText('进步卡已保存')).toBeVisible();await shot(page,'p1-06-saved');
 const ended=page.waitForResponse(r=>r.url().endsWith('/learning/conversation/end'));await page.getByRole('button',{name:'今天先聊到这'}).click();expect((await ended).ok()).toBeTruthy();
 const summary=page.getByRole('region',{name:'这次的对话小结'});
 await expect(summary).toContainText('理解 · 待专业模式确认');await expect(summary).toContainText('每本');await expect(summary).toContainText('计划建议');
 await expect(summary.getByText('在第1级提示后算出了结果')).toBeVisible();
 await expect(summary.getByRole('button',{name:'去专业模式'})).toBeVisible();await shot(page,'p1-07-summary');
 await summary.getByRole('button',{name:'去专业模式'}).click();await expect(page).toHaveURL(/#explore$/);await shot(page,'p1-08-explore');
 const state=await page.evaluate(async()=>await(await fetch('/api/learning')).json());expect(state.session.mode).toBe('exploration');
 await nav(page,'小N');await page.reload();await expect(page.locator('.pet-hero-bubble')).toContainText('上次我们聊到应用题的条件');await shot(page,'p1-09-refresh-greeting');
 // 第二次对话：和上次比只写两边都有原话的同维变化。
 await say(page,'我又来了');await say(page,'还好');
 await chatAfter(page,()=>page.getByRole('button',{name:'看看哪里没考好',exact:true}).click());
 await say(page,'那道应用题我好像想明白了');await say(page,'嗯');await say(page,'每本就是一本练习本的价钱');
 const ended2=page.waitForResponse(r=>r.url().endsWith('/learning/conversation/end'));await page.getByRole('button',{name:'今天先聊到这'}).click();expect((await ended2).ok()).toBeTruthy();
 const second=page.getByRole('region',{name:'这次的对话小结'});
 await expect(second).toContainText('上次说「就是不知道题目里的每本指什么」，这次说「每本就是一本练习本的价钱」');await shot(page,'p1-10-second-compare');
 const view=await page.evaluate(async()=>await(await fetch('/api/learning')).json());
 expect(view.summaries).toHaveLength(2);expect(view.summaries[1].changes).toHaveLength(1);expect(view.progressCards[0].skipped).toEqual([]);
 expect(JSON.stringify(view)).not.toContain('problemSecrets');
 await nav(page,'成长');await expect(page.getByRole('heading',{name:'对话小结'})).toBeVisible();await expect(page.getByRole('heading',{name:'进步卡'})).toBeVisible();await shot(page,'p1-11-growth');
});

test('记忆关闭再走一遍：不提议、不提起，首页和进步卡处都有提示',async({page})=>{
 await onboard(page,false);
 await expect(page.getByText('记忆已关，小N不会记住这次的方法，下次也不会主动提起。')).toBeVisible();await shot(page,'m0-01-home-memory-off');
 await throughReflect(page,null);
 await expect(page.getByRole('heading',{name:'要我记住这件小事吗？'})).toHaveCount(0);
 await expect(page.getByText('记忆已关，小N不会记住这次的方法，下次也不会主动提起。')).toHaveCount(2);await shot(page,'m0-02-progress-card-memory-off');
 await page.getByRole('button',{name:'确认保存'}).click();await expect(page.getByText('进步卡已保存')).toBeVisible();
 const ended=page.waitForResponse(r=>r.url().endsWith('/learning/conversation/end'));await page.getByRole('button',{name:'今天先聊到这'}).click();expect((await ended).ok()).toBeTruthy();
 await expect(page.getByRole('region',{name:'这次的对话小结'})).toContainText('理解 · 待专业模式确认');
 const view=await page.evaluate(async()=>await(await fetch('/api/learning')).json());
 expect(view.optionalMemory).toBe(false);expect(view.memories).toHaveLength(0);expect(view.summaries).toHaveLength(1);
 await page.reload();await expect(page.locator('.pet-hero-bubble')).not.toContainText('拆开来看');await shot(page,'m0-03-refresh');
});

test('安全拦截、休息与暂停照旧优先',async({page})=>{
 await onboard(page,false);
 await say(page,'我想休息一下');await expect(page.getByText('今天先歇一歇，不急着看题。')).toBeVisible();await shot(page,'s-01-rest');
 await say(page,'我真的不想活了');await expect(page.getByText('学习先暂停。')).toBeVisible();await expect(page.locator('.pet-hero-bubble')).toContainText('110');await shot(page,'s-02-safety');
 const view=await page.evaluate(async()=>await(await fetch('/api/learning')).json());
 expect(view.chatTurns.every((t:{stage:string})=>t.stage!=='safety')).toBeTruthy();expect(view.observations).toHaveLength(0);
});
