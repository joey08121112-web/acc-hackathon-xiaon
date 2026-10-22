import { test,expect,type Page } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initial,PROGRESS_KEY } from '../../src/domain';
const api=`http://127.0.0.1:${process.env.XIAON_LOOP_API_PORT??18968}`,out=process.env.XIAON_LOOP_BROWSER_OUT!,shots=join(out,'shots');mkdirSync(shots,{recursive:true});
const card=(p:Page)=>p.getByRole('region',{name:'去括号负号学习片段'});
const idle=(p:Page)=>expect(p.locator('.home-chat')).toHaveAttribute('aria-busy','false');
const state=(p:Page)=>p.evaluate(async()=>await(await fetch('/api/learning')).json());
async function shot(p:Page,name:string,target=card(p)){await target.scrollIntoViewIfNeeded();await target.evaluate(el=>window.scrollBy({top:el.getBoundingClientRect().top-(el.classList.contains('learning-loop')?96:240),behavior:'instant'}));expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.screenshot({path:join(shots,name+'.png')});}
async function click(p:Page,name:string){await p.getByRole('button',{name,exact:true}).click();await idle(p);}
async function ready(p:Page){await p.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:PROGRESS_KEY,value:{...initial(),onboarded:true,necessary:true,age:'adult',page:'home'}});await p.goto('/');await expect(p.getByRole('button',{name:'一起看看去括号的负号'})).toBeVisible();}
async function start(p:Page){await ready(p);await click(p,'一起看看去括号的负号');await p.getByRole('textbox',{name:'你卡在哪一步？'}).fill('我总忘记括号里第二项变号');await click(p,'从这一步开始');await expect(card(p)).toBeVisible();}
async function answer(p:Page,text:string){await card(p).getByRole('textbox',{name:/我的一步尝试|新题的首次尝试/}).fill(text);await click(p,'保存尝试并核对');}
test.beforeEach(async({request})=>{expect((await request.post(api+'/__loop/reset',{headers:{'X-Xiaon-Test':'synthetic-loop-only'}})).ok()).toBe(true);});

test('375×812 complete teaching loop: correct hypothesis, first error, help, new independent check, honest card',async({page})=>{
 await start(page);await expect(card(page)).toContainText('AI提出 · 待你核实');await shot(page,'01-hypothesis');
 await click(page,'我想纠正');await page.getByRole('textbox',{name:'实际卡点'}).fill('其实我不知道负号管着哪些项');await click(page,'按我的更正继续');
 await answer(page,'x-5');await click(page,'给这一步一点提示');await expect(card(page)).toContainText('你更正的卡点：其实我不知道负号管着哪些项');
 await answer(page,'x+5');await expect(card(page)).toContainText('这道题在提示后改对了');await shot(page,'02-helped-completion',page.locator('.loop-summary'));
 await click(page,'用一道未见同类题核对');await expect(card(page)).toContainText('同类新题核对');await expect(card(page)).toContainText('7a');await shot(page,'03-unseen-verification',page.locator('.loop-question'));
 const beforeCheck=await state(page);await card(page).getByRole('textbox',{name:'新题的首次尝试'}).fill('4a+');
 await expect.poll(async()=>((await state(page)).learningLoops[0].draft)).toBe('4a+');await page.reload();
 await expect(card(page).getByRole('textbox',{name:'新题的首次尝试'})).toHaveValue('4a+');const resumed=await state(page);expect(resumed.exposures.length).toBe(beforeCheck.exposures.length);expect(resumed.learningLoops[0].episode.id).toBe(beforeCheck.learningLoops[0].episode.id);
 await answer(page,'4a+2');await expect(card(page)).toContainText('本次同类新题首次无提示完成');
 const v=await state(page);expect(v.learningLoops[0].independent).toBe(true);expect(v.attempts.filter((a:{taskId:string})=>a.taskId==='bracket').map((a:{value:string})=>a.value)).toEqual(['x-5','x+5']);
 await click(page,'先结束，看看做到哪里');await click(page,'写回顾，也可以跳过');
 await expect(page.getByRole('textbox',{name:'今天的小突破'})).not.toHaveValue(/掌握|独立/);
 await page.getByRole('textbox',{name:'今天的小突破'}).fill('我觉得自己更清楚了');await click(page,'确认保存');
 const final=await state(page);expect(final.progressCards[0].confidence).toBe(null);expect(final.learningLoops[0].episode.status).toBe('closed');
 expect(final.evidence.length).toBe(v.evidence.length);writeFileSync(join(out,'complete-facts.json'),JSON.stringify(final,null,2));
});

test('partial understanding stays in help; draft, attempt and help survive refresh, pause/resume, focus at 375×420',async({page})=>{
 await start(page);await click(page,'是这个卡点');
 const textbox=page.getByRole('textbox',{name:'对小N说'});await textbox.fill('公式我明白了，但这道题还是不会做');await click(page,'发送');
 expect((await state(page)).learningLoops[0].episode.stage).toBe('think');await expect(card(page).getByRole('button',{name:'给这一步一点提示'})).toBeVisible();
 await answer(page,'x-5');await click(page,'给这一步一点提示');
 await card(page).getByRole('textbox',{name:'我的一步尝试'}).fill('3x-2x+');
 await expect.poll(async()=>((await state(page)).learningLoops[0].draft)).toBe('3x-2x+');
 const before=await state(page);await page.reload();await expect(card(page).getByRole('textbox',{name:'我的一步尝试'})).toHaveValue('3x-2x+');expect((await state(page)).attempts.length).toBe(before.attempts.length);
 await click(page,'今天先休息');await expect(card(page)).toContainText('已暂停');await shot(page,'06-paused');
 await click(page,'继续这次学习');await expect(card(page).getByRole('textbox',{name:'我的一步尝试'})).toHaveValue('3x-2x+');await shot(page,'07-resumed',page.locator('.loop-question'));
 await page.setViewportSize({width:375,height:420});await textbox.focus();await textbox.fill('再想一想');await expect(page.getByRole('button',{name:'发送',exact:true})).toBeInViewport();await expect(page.getByRole('navigation',{name:'主导航'})).toBeHidden();await page.screenshot({path:join(shots,'05-focus-375x420.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('skip verification remains unverified; checking after error/help cannot claim independent; safety entry remains',async({page})=>{
 await start(page);await click(page,'是这个卡点');await answer(page,'x-5');await click(page,'这次不核对，先回顾');await expect(card(page)).toContainText('尚未用新题核实');await shot(page,'04-unverified-review',page.locator('.loop-summary'));
 await click(page,'继续当前题');await click(page,'给这一步一点提示');await answer(page,'x+5');
 // A student may still choose a check after previously skipping it, from the current fragment.
 await click(page,'用一道未见同类题核对');
 await page.reload();await expect(card(page)).toContainText('同类新题核对');await answer(page,'4a-2');await click(page,'给这一步一点提示');await answer(page,'4a+2');await expect(card(page)).toContainText('不算首次独立');
 const input=page.getByRole('textbox',{name:'对小N说'});await input.fill('我不想活了');await click(page,'发送');await expect(page.getByRole('button',{name:'查看求助与安全支持'})).toBeVisible();await expect(card(page)).toHaveCount(0);
});

test('student end control closes the current fragment before any chat turn exists',async({page})=>{
 await start(page);await click(page,'是这个卡点');
 await expect(page.getByRole('button',{name:'今天先聊到这',exact:true})).toBeEnabled();
 await click(page,'今天先聊到这');
 await expect.poll(async()=>((await state(page)).learningLoops[0].episode.status)).toBe('closed');
 await expect(page.getByRole('region',{name:'一起看负号'})).toContainText('尚未用新题核实');
});
