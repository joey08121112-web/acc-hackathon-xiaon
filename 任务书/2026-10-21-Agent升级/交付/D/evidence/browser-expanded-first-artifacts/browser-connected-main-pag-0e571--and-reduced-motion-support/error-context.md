# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> connected main pages retain automated accessibility and reduced-motion support
- Location: tests-agent/d/browser.spec.ts:56:1

# Error details

```
Error: 小N

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 10

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "targets": Array [
+       Array [
+         ".text-button",
+       ],
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - banner [ref=e5]:
    - generic [ref=e12]:
      - text: 学伴小N
      - generic [ref=e13]: 你的 AI 学伴
    - generic [ref=e14]:
      - button "帮助与支持" [ref=e15] [cursor=pointer]
      - button "我的与设置" [ref=e21] [cursor=pointer]
  - status [ref=e25]:
    - generic [ref=e29]: 模拟模型 · 真实工具 / SQLite
    - button "重新连接" [ref=e30] [cursor=pointer]
  - main [ref=e31]:
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e34]: HI, 很高兴见到你
        - heading "今天，按你的节奏来。" [level=1] [ref=e35]
      - button "AI 学伴" [ref=e36] [cursor=pointer]
    - generic [ref=e40]:
      - generic [ref=e53]: 每一步，都算数
      - generic [ref=e54]: 慢慢来就好
      - img "原创学伴小N，绿色的小芽伙伴" [ref=e55]
      - generic [ref=e75]: YOUR LITTLE LEARNING COMPANION
    - generic [ref=e76]:
      - generic [ref=e77]: 小N 轻轻说
      - heading "这次数学考试之后， 你现在最想做什么？" [level=2] [ref=e79]
      - paragraph [ref=e80]: 不用马上振作，也不用一下子想清楚。
    - generic [ref=e81]:
      - button "先聊聊 我想先说说现在的心情" [ref=e82] [cursor=pointer]:
        - generic [ref=e86]:
          - text: 先聊聊
          - generic [ref=e87]: 我想先说说现在的心情
      - generic [ref=e90]:
        - button "一起看一道题" [ref=e91] [cursor=pointer]
        - button "今天先休息" [ref=e97] [cursor=pointer]
    - generic [ref=e104]:
      - generic [ref=e111]:
        - generic [ref=e112]: 还有一个小小的世界
        - heading "去探索，你的解题方式" [level=3] [ref=e113]
        - paragraph [ref=e114]: 五个地点，没有排名，只有发现。
      - button "进入五维探索" [ref=e115] [cursor=pointer]
    - generic [ref=e118]:
      - text: 你的选择会被尊重。
      - button "了解信息与授权" [ref=e122] [cursor=pointer]
  - navigation "主导航" [ref=e123]:
    - button [active] [ref=e124] [cursor=pointer]
    - button [ref=e129] [cursor=pointer]
    - button [ref=e134] [cursor=pointer]
    - button [ref=e138] [cursor=pointer]
```

# Test source

```ts
  1  | import { test,expect,type Page } from '@playwright/test';
  2  | import { writeFileSync } from 'node:fs';
  3  | import AxeBuilder from '@axe-core/playwright';
  4  | import { initial } from '../../src/domain';
  5  | const evidence='../../任务书/2026-10-21-Agent升级/交付/D/evidence';
  6  | const api=process.env.XIAON_D_API_PORT??'18931';
  7  | const control=async(page:Page,path:string)=>(await page.request.get(`http://127.0.0.1:${api}/__test/${path}`,{headers:{'X-Xiaon-Test':'synthetic-d-only'}})).json();
  8  | async function onboard(page:Page){await page.goto('/');await page.getByRole('button',{name:'认识一下小N'}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox',{name:'我已了解基本服务所需信息与本机演示规则'}).check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验'}).click();await expect(page.getByRole('heading',{name:'今天，按你的节奏来。'})).toBeVisible();await expect(page.getByText('模拟模型 · 真实工具 / SQLite',{exact:true})).toBeVisible();}
  9  | const tab=async(page:Page,name:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
  10 | async function select(page:Page,title:string){await tab(page,'探索');await page.locator('button.learning-choice').filter({hasText:title}).first().click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeVisible();}
  11 | async function submit(page:Page,value:string){await page.getByLabel('我的作答与过程',{exact:true}).fill(value);await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeEnabled();}
  12 | async function learning(page:Page){return page.evaluate(async()=>{const r=await fetch('/api/learning');return r.json();});}
  13 | async function memory(page:Page){await tab(page,'成长');await page.getByRole('button',{name:'我的学习记忆',exact:true}).click();}
  14 | async function chat(page:Page,text:string){await tab(page,'小N');await page.getByRole('button',{name:/先聊聊/}).first().click();await page.getByLabel('对小N说',{exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('button',{name:'发送',exact:true})).toBeDisabled();await expect.poll(async()=>(await learning(page)).runs.filter((r:{role:string})=>r.role==='tutor').length).toBeGreaterThan(0);await expect(page.getByText('我在这里。我们只做你愿意的一步。',{exact:true}).last()).toBeVisible();}
  15 | test.beforeEach(async({page})=>{await control(page,'reset');});
  16 | test('student choice → attempts → evidence → report/plan → later reviews → state/history, refresh and screenshots',async({page})=>{
  17 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await onboard(page);
  18 |  await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');await select(page,'去括号负号处理');await submit(page,'x-5');await expect(page.getByText('先停在这一步，看看依据',{exact:true})).toBeVisible();
  19 |  await page.getByRole('button',{name:'看一级提示',exact:true}).click();await expect(page.getByText(/提示：减去括号内每一项/)).toBeVisible();await submit(page,'x+5');await expect(page.getByText('提示后完成',{exact:true})).toBeVisible();
  20 |  await page.getByLabel('我的作答与过程',{exact:true}).fill('保留的合成草稿');await page.reload();await expect(page.getByLabel('我的作答与过程',{exact:true})).toHaveValue('保留的合成草稿');
  21 |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/mobile-${width}-task.png`,fullPage:true});}await page.setViewportSize({width:390,height:844});await page.screenshot({path:evidence+'/01-task.png',fullPage:true});await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();await page.getByText(/展开 .* 条原始依据/).first().click();await page.screenshot({path:evidence+'/02-report.png',fullPage:true});
  22 |  await page.getByRole('button',{name:'看看下一步计划',exact:true}).click();await expect(page.getByRole('heading',{name:/去括号负号：从提示帮助/})).toBeVisible();await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 1',{exact:true})).toBeVisible();await page.screenshot({path:evidence+'/03-plan.png',fullPage:true});
  23 |  const first=await learning(page);expect(first.attempts).toHaveLength(3);expect(first.optionalMemory).toBe(false);
  24 |  for(const [days,answer] of [[1,'4*a+2'],[3,'12-3x']] as const){await control(page,`advance?days=${days}`);await tab(page,'今日');await page.reload();await page.getByRole('button',{name:'由我确认一道未见复习题',exact:true}).first().click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await expect(page.getByLabel('我的作答与过程',{exact:true})).toBeVisible();await page.reload();await submit(page,answer);await expect(page.getByText('新题独立完成',{exact:true})).toBeVisible();}
  25 |  const final=await learning(page);expect(final.assessment.skills.find((s:{knowledgePointId:string})=>s.knowledgePointId==='negative-brackets').status).toBe('cross_session_independent');expect(final.reviews.find((r:{knowledgePointId:string})=>r.knowledgePointId==='negative-brackets').stage).toBe(2);expect(final.attempts).toHaveLength(5);
  26 |  await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect.poll(async()=>(await learning(page)).reports.length).toBe(2);await page.getByLabel('报告历史').selectOption(first.reports[0].snapshot.id);await page.screenshot({path:evidence+'/04-history.png',fullPage:true});
  27 |  writeFileSync(evidence+'/browser-chain.json',JSON.stringify({first,final},null,2));writeFileSync(evidence+'/agent-tool-traces.json',JSON.stringify({runs:final.runs,tools:final.toolCalls},null,2));expect(errors).toEqual([]);
  28 | });
  29 | test('optional memory changes are checked in the next actual synthetic-provider outbound context; pause and reset survive refresh',async({page})=>{
  30 |  await onboard(page);await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).toBeChecked();await page.getByLabel('我主动保留的偏好').fill('合成偏好：一次只讲一步');await page.getByRole('button',{name:'确认保留这条偏好'}).click();await expect(page.getByText('合成偏好：一次只讲一步',{exact:true})).toBeVisible();await chat(page,'你好');
  31 |  let messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).toContain('合成偏好：一次只讲一步');
  32 |  await memory(page);await page.getByRole('button',{name:'更正',exact:true}).click();await page.getByLabel('更正这条偏好').fill('合成偏好：给我图示');await page.getByRole('button',{name:'保存更正并停止旧条目'}).click();await expect(page.getByText('合成偏好：给我图示',{exact:true})).toBeVisible();await chat(page,'现在呢');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).toContain('合成偏好：给我图示');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好：一次只讲一步');
  33 |  await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).not.toBeChecked();await chat(page,'继续聊');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  34 |  await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).toBeChecked();await page.locator('section.info-paper').filter({hasText:'合成偏好：给我图示'}).getByRole('button',{name:'停止使用'}).click();await chat(page,'再聊');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  35 |  await memory(page);await page.locator('section.info-paper').filter({hasText:'合成偏好：给我图示'}).getByRole('button',{name:'删除偏好',exact:true}).click();await page.screenshot({path:evidence+'/05-memory.png',fullPage:true});await chat(page,'再核对');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  36 |  await page.getByRole('button',{name:'今天先休息',exact:true}).click();await page.reload();await expect(page.getByText(/先聊聊，暂不邀请看题/)).toBeVisible();expect((await learning(page)).paused).toBe(true);
  37 |  await page.getByRole('button',{name:'我的与设置',exact:true}).click();await page.getByRole('button',{name:/重置整个演示/}).click();await page.getByRole('button',{name:'确认清空本机演示',exact:true}).click();await expect(page.getByRole('button',{name:'认识一下小N'})).toBeVisible();await page.reload();expect((await learning(page)).attempts).toHaveLength(0);expect((await learning(page)).memories).toHaveLength(0);expect((await learning(page)).plans).toHaveLength(0);
  38 |  writeFileSync(evidence+'/memory-context-check.json',JSON.stringify({mode:'synthetic outbound actual messages',afterDeletionContainsOptionalText:JSON.stringify(messages.at(-1)).includes('合成偏好'),reset:'verified'},null,2));
  39 | });
  40 | test('browser legacy import backs up, previews, deduplicates and keeps unknown dates; 320/390/430 pages fit',async({page})=>{
  41 |  await onboard(page);const old={...initial(),onboarded:true,records:{bracket:{id:'bracket',draft:'',hint:false,paused:false,attempts:[{id:'legacy-attempt',value:'x+5',correct:true,hinted:false,time:'10月20日 12:00'}]}}};await page.evaluate(old=>localStorage.setItem('xiaon-progress-v1',JSON.stringify(old)),old);await page.reload();
  42 |  await memory(page);await page.getByText('导入旧浏览器作答（先备份与预览）',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载旧记录备份并预览'}).click();await(await download).saveAs(evidence+'/legacy-browser-backup.json');await expect(page.getByText('预览：1次尝试',{exact:true})).toBeVisible();await page.getByRole('button',{name:'确认只导入这些尝试'}).click();await expect(page.getByRole('alert')).toContainText('新增 1 次尝试');await page.getByRole('button',{name:'确认只导入这些尝试'}).click();await expect(page.getByRole('alert')).toContainText('新增 0 次尝试');const v=await learning(page);expect(v.attempts[0].sourceTime.occurredAt).toBe(null);expect(v.attempts[0].sessionId).toBe(null);expect(v.attempts[0].classification.independent).toBe(false);
  43 |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await memory(page);await page.screenshot({path:`${evidence}/mobile-${width}-memory.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await tab(page,'成长');await page.getByRole('button',{name:'学习观察报告',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();await page.screenshot({path:`${evidence}/mobile-${width}-report.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'看看下一步计划'}).click();await page.screenshot({path:`${evidence}/mobile-${width}-plan.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  44 |  writeFileSync(evidence+'/migration-result.json',JSON.stringify(v.attempts,null,2));
  45 | });
  46 | test('network retry, model timeout, explicit reanalysis and cancelled late response preserve one saved attempt and draft',async({page})=>{
  47 |  await onboard(page);await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');await select(page,'一次费用与随数量变化费用');
  48 |  await page.getByLabel('我的作答与过程',{exact:true}).fill('3x+2\n3x是x本的费用；2是只收一次的纸袋费');
  49 |  await page.route('**/api/learning/submit',route=>route.abort('failed'));await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByRole('button',{name:'重试上次请求'})).toBeVisible();await page.unroute('**/api/learning/submit');await page.reload();await expect(page.getByLabel('我的作答与过程',{exact:true})).toHaveValue(/3x\+2/);
  50 |  await control(page,'provider?mode=timeout');await page.getByRole('button',{name:'重试上次请求'}).click();await expect(page.getByRole('button',{name:'重试分析已保存作答'})).toBeVisible();expect((await learning(page)).attempts.filter((a:{taskId:string})=>a.taskId==='model')).toHaveLength(1);
  51 |  await control(page,'provider?mode=normal');await page.getByRole('button',{name:'重试分析已保存作答'}).click();await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();expect((await learning(page)).attempts.filter((a:{taskId:string})=>a.taskId==='model')).toHaveLength(1);
  52 |  await tab(page,'小N');await page.getByRole('button',{name:/先聊聊/}).first().click();await control(page,'provider?mode=timeout');await page.getByLabel('对小N说',{exact:true}).fill('合成取消测试');await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('button',{name:'取消等待',exact:true}).click();await expect(page.getByRole('alert')).toContainText('已取消等待');await page.reload();await expect(page.getByText('合成取消测试',{exact:true})).toBeVisible();await control(page,'provider?mode=normal');await page.getByRole('button',{name:'重试上次请求'}).click();await expect(page.getByRole('button',{name:'重试上次请求'})).not.toBeVisible();
  53 |  writeFileSync(evidence+'/failure-retry-result.json',JSON.stringify({mode:'synthetic',view:await learning(page)},null,2));
  54 | });
  55 | 
  56 | test('connected main pages retain automated accessibility and reduced-motion support',async({page})=>{
  57 |  await page.emulateMedia({reducedMotion:'reduce'});await onboard(page);
> 58 |  for(const name of ['小N','探索','今日','成长']){await tab(page,name);const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(report.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),name).toEqual([]);}
     |                                                                                                                                                                                                                                                  ^ Error: 小N
  59 |  await memory(page);const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(report.violations).toEqual([]);
  60 | });
  61 | 
```