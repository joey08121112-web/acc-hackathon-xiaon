# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> student choice → attempts → evidence → report/plan → later reviews → state/history, refresh and screenshots
- Location: tests-agent/d/browser.spec.ts:15:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('新题独立完成', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('新题独立完成', { exact: true }) with timeout 5000ms
  - waiting for getByText('新题独立完成', { exact: true })

```

```yaml
- banner:
  - button "返回":
    - img
  - heading "一起看题" [level=2]
  - button "帮助与支持":
    - img
  - button "我的与设置":
    - img
- status:
  - img
  - text: 模拟模型 · 真实工具 / SQLite
  - button "重新连接"
- main:
  - alert: 作答前必须有本场次题目打开事件
  - text: 保留了上次请求，重试不会重复记录。
  - button "重试上次请求"
  - button "结束重试，保留已有记录"
  - text: 计算
  - heading "去括号负号处理" [level=1]
  - paragraph: 先写下自己的尝试。需要提示也没关系，会与独立完成分别记录。
  - paragraph: 化简：3x − (2x − 5)。可写一次式或以等号相连的完整等价步骤。
  - text: 我的作答与过程
  - textbox "我的作答与过程":
    - /placeholder: 可以写结果，另起一行说明理由
    - text: 4*a+2
  - button "保存尝试并核对"
  - button "看一级提示"
  - button "先暂停":
    - img
    - text: 先暂停
  - paragraph: 提示：减去括号内每一项：−(2x−5)=−2x+5。
  - text: 本次结果未通过
  - heading "先停在这一步，看看依据" [level=3]
  - text: x-5
  - paragraph: 这次作答的评分点未通过；保留具体证据，不推断人格或智力
  - text: 2026/10/21 08:00:00 提示后完成
  - heading "这次核对正确" [level=3]
  - text: x+5
  - paragraph: 作答之前存在提示、答案或聊天关键帮助
  - text: 2026/10/21 08:00:00
  - button "查看作答证据"
  - button "整理下一步计划"
  - button "由我再选一道"
  - group: 查看 Agent 与工具轨迹
- navigation "主导航":
  - button "小N":
    - img
    - text: 小N
  - button "探索":
    - img
    - text: 探索
  - button "今日":
    - img
    - text: 今日
  - button "成长":
    - img
    - text: 成长
```

# Test source

```ts
  1  | import { test,expect,type Page } from '@playwright/test';
  2  | import { writeFileSync } from 'node:fs';
  3  | import { initial } from '../../src/domain';
  4  | const evidence='../../任务书/2026-10-21-Agent升级/交付/D/evidence';
  5  | const api=process.env.XIAON_D_API_PORT??'18931';
  6  | const control=async(page:Page,path:string)=>(await page.request.get(`http://127.0.0.1:${api}/__test/${path}`,{headers:{'X-Xiaon-Test':'synthetic-d-only'}})).json();
  7  | async function onboard(page:Page){await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox',{name:'我已了解基本服务所需信息与本机演示规则'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验'}).click();await expect(page.getByRole('heading',{name:'今天，按你的节奏来。'})).toBeVisible();await expect(page.getByText('模拟模型 · 真实工具 / SQLite',{exact:true})).toBeVisible();}
  8  | const tab=async(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
  9  | async function select(page:Page,title:string){await tab(page,'探索');await page.locator('button.learning-choice').filter({hasText:title}).first().click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeVisible();}
  10 | async function submit(page:Page,value:string){await page.getByLabel('我的作答与过程',{exact:true}).fill(value);await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeEnabled();}
  11 | async function learning(page:Page){return page.evaluate(async()=>{const r=await fetch('/api/learning');return r.json();});}
  12 | async function memory(page:Page){await tab(page,'成长');await page.getByRole('button',{name:'我的学习记忆',exact:true}).click();}
  13 | async function chat(page:Page,text:string){await tab(page,'小N');await page.getByRole('button',{name:/先聊聊/}).first().click();await page.getByLabel('对小N说',{exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('button',{name:'发送',exact:true})).toBeDisabled();await expect.poll(async()=>(await learning(page)).runs.filter((r:{role:string})=>r.role==='tutor').length).toBeGreaterThan(0);await expect(page.getByText('我在这里。我们只做你愿意的一步。',{exact:true}).last()).toBeVisible();}
  14 | test.beforeEach(async({page})=>{await control(page,'reset');});
  15 | test('student choice → attempts → evidence → report/plan → later reviews → state/history, refresh and screenshots',async({page})=>{
  16 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await onboard(page);
  17 |  await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');await select(page,'去括号负号处理');await submit(page,'x-5');await expect(page.getByText('先停在这一步，看看依据',{exact:true})).toBeVisible();
  18 |  await page.getByRole('button',{name:'看一级提示',exact:true}).click();await expect(page.getByText(/提示：减去括号内每一项/)).toBeVisible();await submit(page,'x+5');await expect(page.getByText('提示后完成',{exact:true})).toBeVisible();
  19 |  await page.getByLabel('我的作答与过程',{exact:true}).fill('保留的合成草稿');await page.reload();await expect(page.getByLabel('我的作答与过程',{exact:true})).toHaveValue('保留的合成草稿');
  20 |  await page.screenshot({path:evidence+'/01-task.png',fullPage:true});await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();await page.getByText(/展开 .* 条原始依据/).first().click();await page.screenshot({path:evidence+'/02-report.png',fullPage:true});
  21 |  await page.getByRole('button',{name:'看看下一步计划',exact:true}).click();await expect(page.getByRole('heading',{name:/去括号负号：从提示帮助/})).toBeVisible();await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 1',{exact:true})).toBeVisible();await page.screenshot({path:evidence+'/03-plan.png',fullPage:true});
  22 |  const first=await learning(page);expect(first.attempts).toHaveLength(3);expect(first.optionalMemory).toBe(false);
> 23 |  for(const [days,answer] of [[1,'4*a+2'],[3,'12-3x']] as const){await control(page,`advance?days=${days}`);await tab(page,'今日');await page.reload();await page.getByRole('button',{name:'由我确认一道未见复习题',exact:true}).first().click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await page.reload();await submit(page,answer);await expect(page.getByText('新题独立完成',{exact:true})).toBeVisible();}
     |                                                                                                                                                                                                                                                                                                                                                                                                         ^ Error: expect(locator).toBeVisible() failed
  24 |  const final=await learning(page);expect(final.assessment.skills.find((s:{knowledgePointId:string})=>s.knowledgePointId==='negative-brackets').status).toBe('cross_session_independent');expect(final.reviews.find((r:{knowledgePointId:string})=>r.knowledgePointId==='negative-brackets').stage).toBe(2);expect(final.attempts).toHaveLength(5);
  25 |  await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect.poll(async()=>(await learning(page)).reports.length).toBe(2);await page.getByLabel('报告历史').selectOption(first.reports[0].snapshot.id);await page.screenshot({path:evidence+'/04-history.png',fullPage:true});
  26 |  writeFileSync(evidence+'/browser-chain.json',JSON.stringify({first,final},null,2));writeFileSync(evidence+'/agent-tool-traces.json',JSON.stringify({runs:final.runs,tools:final.toolCalls},null,2));expect(errors).toEqual([]);
  27 | });
  28 | test('optional memory changes are checked in the next actual synthetic-provider outbound context; pause and reset survive refresh',async({page})=>{
  29 |  await onboard(page);await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).toBeChecked();await page.getByLabel('我主动保留的偏好').fill('合成偏好：一次只讲一步');await page.getByRole('button',{name:'确认保留这条偏好'}).click();await expect(page.getByText('合成偏好：一次只讲一步',{exact:true})).toBeVisible();await chat(page,'你好');
  30 |  let messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).toContain('合成偏好：一次只讲一步');
  31 |  await memory(page);await page.getByRole('button',{name:'更正',exact:true}).click();await page.getByLabel('更正这条偏好').fill('合成偏好：给我图示');await page.getByRole('button',{name:'保存更正并停止旧条目'}).click();await expect(page.getByText('合成偏好：给我图示',{exact:true})).toBeVisible();await chat(page,'现在呢');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).toContain('合成偏好：给我图示');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好：一次只讲一步');
  32 |  await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).not.toBeChecked();await chat(page,'继续聊');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  33 |  await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).toBeChecked();await page.locator('section.info-paper').filter({hasText:'合成偏好：给我图示'}).getByRole('button',{name:'停止使用'}).click();await chat(page,'再聊');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  34 |  await memory(page);await page.locator('section.info-paper').filter({hasText:'合成偏好：给我图示'}).getByRole('button',{name:'删除偏好',exact:true}).click();await page.screenshot({path:evidence+'/05-memory.png',fullPage:true});await chat(page,'再核对');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  35 |  await page.getByRole('button',{name:'今天先休息',exact:true}).click();await page.reload();await expect(page.getByText(/先聊聊，暂不邀请看题/)).toBeVisible();expect((await learning(page)).paused).toBe(true);
  36 |  await page.getByRole('button',{name:'我的与设置',exact:true}).click();await page.getByRole('button',{name:'重置整个演示',exact:true}).click();await page.getByRole('button',{name:'确认清空所有演示数据',exact:true}).click();await expect(page.getByRole('button',{name:'认识一下小N'})).toBeVisible();await page.reload();expect((await learning(page)).attempts).toHaveLength(0);expect((await learning(page)).memories).toHaveLength(0);expect((await learning(page)).plans).toHaveLength(0);
  37 |  writeFileSync(evidence+'/memory-context-check.json',JSON.stringify({mode:'synthetic outbound actual messages',afterDeletionContainsOptionalText:JSON.stringify(messages.at(-1)).includes('合成偏好'),reset:'verified'},null,2));
  38 | });
  39 | test('browser legacy import backs up, previews, deduplicates and keeps unknown dates; 320/390/430 pages fit',async({page})=>{
  40 |  await onboard(page);const old={...initial(),onboarded:true,records:{bracket:{id:'bracket',draft:'',hint:false,paused:false,attempts:[{id:'legacy-attempt',value:'x+5',correct:true,hinted:false,time:'10月20日 12:00'}]}}};await page.evaluate(old=>localStorage.setItem('xiaon-progress-v1',JSON.stringify(old)),old);await page.reload();
  41 |  await memory(page);await page.getByText('导入旧浏览器作答（先备份与预览）',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载旧记录备份并预览'}).click();await(await download).saveAs(evidence+'/legacy-browser-backup.json');await expect(page.getByText('预览：1次尝试',{exact:true})).toBeVisible();await page.getByRole('button',{name:'确认只导入这些尝试'}).click();await expect(page.getByRole('alert')).toContainText('新增 1 次尝试');await page.getByRole('button',{name:'确认只导入这些尝试'}).click();await expect(page.getByRole('alert')).toContainText('新增 0 次尝试');const v=await learning(page);expect(v.attempts[0].sourceTime.occurredAt).toBe(null);expect(v.attempts[0].sessionId).toBe(null);expect(v.attempts[0].classification.independent).toBe(false);
  42 |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await memory(page);await page.screenshot({path:`${evidence}/mobile-${width}-memory.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await tab(page,'成长');await page.getByRole('button',{name:'学习观察报告',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();await page.screenshot({path:`${evidence}/mobile-${width}-report.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'看看下一步计划'}).click();await page.screenshot({path:`${evidence}/mobile-${width}-plan.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  43 |  writeFileSync(evidence+'/migration-result.json',JSON.stringify(v.attempts,null,2));
  44 | });
  45 | 
```