import { test,expect,type Page } from '@playwright/test';
import { writeFileSync,mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { candidate } from './provider';
const evidence=process.env.XIAON_E_EVIDENCE??'../../文档/交接/2026-10-21/交付/E/evidence/browser';
const api=()=>process.env.XIAON_E_API_PORT??'18938';
const control=async(page:Page,path:string)=>(await page.request.get(`http://127.0.0.1:${api()}/__test/${path}`,{headers:{'X-Xiaon-Test':'synthetic-e-only'}})).json();
const tab=async(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
async function onboard(page:Page){await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox',{name:'我看懂了'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验'}).click();await expect(page.getByText('模拟模型 · 真实工具 / SQLite',{exact:true})).toBeVisible();}
async function submit(page:Page,value:string){await page.getByLabel('我的作答与过程',{exact:true}).fill(value);await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeEnabled();}
async function learning(page:Page){return page.evaluate(async()=>(await fetch('/api/learning')).json());}
/** Map → 计算工坊 entry, doing the understand/logic stations first exactly as a student would. */
async function bracketTask(page:Page){
 await tab(page,'探索');await page.getByRole('button',{name:'列表入口',exact:true}).click();await page.locator('.dimension-list > button').filter({hasText:'计算工坊'}).click();
 const understand=page.getByRole('button',{name:'先去理解花园'}),logic=page.getByRole('button',{name:'先去逻辑小桥'});
 if(await understand.isVisible()||await logic.isVisible()){const first=await understand.isVisible();await(first?understand:logic).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,first?'2x-3\n先求x的2倍，再减去3。':'A\n两个负数的和为负数，满足前提但结论不成立。');return bracketTask(page);}
 await page.getByRole('button',{name:'我愿意，进入这个小任务'}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();
}
test.beforeEach(async({page})=>{await control(page,'reset');mkdirSync(evidence,{recursive:true});});
test('negative-bracket mainline: evidence → generated task → confirm → hint → grading → plan → next-day generated review advances',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await onboard(page);
 await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');
 await bracketTask(page);await submit(page,'x-5');await expect(page.getByText('先停在这一步，看看依据',{exact:true})).toBeVisible();
 // Generate from the task page. Published ≠ exposed.
 await control(page,'generator?reply='+encodeURIComponent(candidate()));
 await page.getByRole('button',{name:'根据这个环节出一道新题（约 2–4 分钟）'}).click();
 await expect(page.getByRole('heading',{name:'这道题针对：括号前是减号时，括号里的常数要变号'})).toBeVisible();
 await expect(page.getByText('依据：你在这个环节最近一次作答还有困难（参考 1 次作答记录）')).toBeVisible();
 await expect(page.getByText('9x − (4x − 7)')).toHaveCount(0);
 let v=await learning(page);const gen=v.generations[0];expect(gen.status).toBe('published');expect(gen.exposed).toBe(false);
 expect(v.exposures.some((e:{taskId:string})=>e.taskId===gen.taskId)).toBe(false);
 await page.screenshot({path:evidence+'/01-generated-before-confirm.png',fullPage:true});
 const axe=await new AxeBuilder({page}).include('.generation-panel').analyze();expect(axe.violations.map(x=>x.id)).toEqual([]);
 await page.getByRole('button',{name:'确认后开始这道新题'}).click();
 await expect(page.getByRole('heading',{name:'要从这一步开始吗？'})).toBeVisible();await expect(page.getByRole('heading',{name:'去括号负号处理 · 新出的同类题'})).toBeVisible();
 await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();
 await expect(page.getByText('化简：9x − (4x − 7)。可写一次式或以等号相连的完整等价步骤。')).toBeVisible();
 await page.getByLabel('我的作答与过程',{exact:true}).fill('5x+7 草稿');await page.reload();await expect(page.getByLabel('我的作答与过程',{exact:true})).toHaveValue('5x+7 草稿');
 await page.getByRole('button',{name:'看一级提示',exact:true}).click();await expect(page.getByText('提示：括号前是减号：−(4x − 7) = −4x + 7，括号里每一项都变号，再合并同类项。')).toBeVisible();
 await submit(page,'9x-4x+7\n=5x+7');await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();await expect(page.getByText('提示后完成',{exact:true}).first()).toBeVisible();
 v=await learning(page);const attempt=v.attempts.find((a:{taskId:string})=>a.taskId===gen.taskId);
 expect(attempt.hintSnapshot.length).toBe(1);expect(attempt.classification.kind).toBe('completed_with_help');
 expect(v.generations[0].exposed).toBe(true);expect(v.exposures.filter((e:{taskId:string;kind:string})=>e.taskId===gen.taskId&&e.kind==='hint').length).toBe(1);
 await page.screenshot({path:evidence+'/02-generated-graded.png',fullPage:true});
 // Report/plan through the existing path, then a real next-day review using a generated unseen task.
 await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();
 await page.getByRole('button',{name:'看看下一步计划',exact:true}).click();await page.getByRole('button',{name:'接受这份计划'}).click();await expect(page.getByText(/已确认版本 1/)).toBeVisible();
 await control(page,'advance?days=1');
 await control(page,'generator?reply='+encodeURIComponent(candidate({difficulty:'standard',params:{a:4,b:9,c:3},expression:'4x-(9x-3)',answer:'-5x+3',steps:['4x-9x+3','-5x+3'],focus:'bracket_sign_variable'})));
 await page.reload();await tab(page,'今日');
 const queue=page.locator('section.info-paper').filter({hasText:'去括号负号'}).filter({hasText:'已到期'});
 await expect(queue).toBeVisible();await queue.getByText('或者根据这个环节出一道新题').click();
 await queue.getByRole('button',{name:'根据这个环节出一道新题（约 2–4 分钟）'}).click();
 await expect(queue.getByRole('heading',{name:'这道题针对：括号前是减号时，括号里的字母项也要变号'})).toBeVisible();await expect(queue.getByText('依据：这个环节的复习已到期',{exact:false})).toBeVisible();
 await page.screenshot({path:evidence+'/03-review-generated.png',fullPage:true});
 await queue.getByRole('button',{name:'确认后开始这道新题'}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();
 await expect(page.getByText(/化简：4x − \(9x − 3\)。/)).toBeVisible();await submit(page,'-5x+3');await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();await expect(page.getByText('新题独立完成',{exact:true}).first()).toBeVisible();
 v=await learning(page);const review=v.reviews.find((i:{knowledgePointId:string})=>i.knowledgePointId==='negative-brackets');
 expect(review.stage).toBe(1);expect(v.attempts.at(-1).classification.novelty).toBe('unseen');
 await page.screenshot({path:evidence+'/04-review-advanced.png',fullPage:true});
 for(const width of [320,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 writeFileSync(evidence+'/mainline-chain.json',JSON.stringify({generations:v.generations,attempts:v.attempts.map((a:Record<string,unknown>)=>({id:a.id,taskId:a.taskId,value:a.value,hints:(a.hintSnapshot as unknown[]).length,classification:a.classification})),reviews:v.reviews,generatorRuns:v.runs.filter((r:{role:string})=>r.role==='generator')},null,2));
 expect(errors).toEqual([]);
});
test('cancel while generating: no task is published or opened',async({page})=>{
 await onboard(page);
 await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');
 await control(page,'generator?hang=1');
 await page.getByRole('button',{name:'根据这个环节出一道新题（约 2–4 分钟）'}).click();await expect(page.getByText(/小N正在出题/)).toBeVisible();
 await page.getByRole('status').filter({hasText:'小N正在出题'}).getByRole('button',{name:'取消'}).click();
 await expect(page.getByText('已取消出题；迟到的结果不会发布，也不会自动开题。')).toBeVisible();
 await expect.poll(async()=>(await learning(page)).generations.map((g:{status:string})=>g.status).join()).toBe('cancelled');
 const v=await learning(page);expect(v.tasks.some((t:{id:string})=>t.id.startsWith('gen-'))).toBe(false);
 await page.screenshot({path:evidence+'/05-cancelled.png',fullPage:true});
});
