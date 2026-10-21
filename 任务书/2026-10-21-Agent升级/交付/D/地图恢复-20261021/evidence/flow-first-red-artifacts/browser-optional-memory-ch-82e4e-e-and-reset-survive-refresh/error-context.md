# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> optional memory changes are checked in the next actual synthetic-provider outbound context; pause and reset survive refresh
- Location: tests-agent/d/browser.spec.ts:37:1

# Error details

```
TypeError: messages.at is not a function
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - banner [ref=e5]:
    - button "返回" [ref=e6] [cursor=pointer]
    - heading "和小N聊聊" [level=2] [ref=e9]
    - generic [ref=e10]:
      - button "帮助与支持" [ref=e11] [cursor=pointer]
      - button "我的与设置" [ref=e17] [cursor=pointer]
  - generic "服务模式" [ref=e21]:
    - generic [ref=e25]: 模拟模型 · 真实工具 / SQLite
    - button "重新连接" [ref=e26] [cursor=pointer]
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]: TUTOR · 先听你说
        - heading "小N在这里" [level=1] [ref=e31]
        - paragraph [ref=e32]: 最近一条消息、当前学习内容及获准偏好会用于回应。模型失败会明确显示；不会自动开题。
      - generic [ref=e33]:
        - generic [ref=e34]: 你好
        - generic [ref=e36]: 我在这里。我们只做你愿意的一步。
      - generic [ref=e38]:
        - generic [ref=e39]:
          - text: 对小N说
          - textbox "对小N说" [ref=e40]:
            - /placeholder: 想说什么，慢慢说…
        - button "发送" [disabled] [ref=e41]
      - button "我想选择一道题" [ref=e45] [cursor=pointer]
      - button "今天先休息" [ref=e46] [cursor=pointer]
      - group [ref=e47]:
        - generic "查看 Agent 与工具轨迹" [ref=e48] [cursor=pointer]
  - navigation "主导航" [ref=e49]:
    - button [ref=e50] [cursor=pointer]
    - button [ref=e55] [cursor=pointer]
    - button [ref=e60] [cursor=pointer]
    - button [ref=e64] [cursor=pointer]
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
  10 | async function select(page:Page,title:string){
  11 |  const places:Record<string,string>={'去括号负号处理':'计算工坊','一次费用与随数量变化费用':'生活集市','合并同类项':'计算工坊'};
  12 |  await tab(page,'探索');await page.getByRole('button',{name:'列表入口',exact:true}).click();await page.locator('.dimension-list > button').filter({hasText:places[title]}).click();
  13 |  const understand=page.getByRole('button',{name:'先去理解花园'}),logic=page.getByRole('button',{name:'先去逻辑小桥'});
  14 |  if(await understand.isVisible()||await logic.isVisible()){
  15 |   const first=await understand.isVisible();await(first?understand:logic).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,first?'2x-3\n先求x的2倍，再减去3。':'A\n两个负数的和为负数，满足前提但结论不成立。');await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();return select(page,title);
  16 |  }
  17 |  await page.getByRole('button',{name:'我愿意，进入这个小任务'}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeVisible();
  18 | }
  19 | async function submit(page:Page,value:string){await page.getByLabel('我的作答与过程',{exact:true}).fill(value);await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByRole('button',{name:'保存尝试并核对'})).toBeEnabled();}
  20 | async function learning(page:Page){return page.evaluate(async()=>{const r=await fetch('/api/learning');return r.json();});}
  21 | async function memory(page:Page){await tab(page,'成长');await page.getByRole('button',{name:'我的学习记忆',exact:true}).click();}
  22 | async function chat(page:Page,text:string){await tab(page,'小N');await page.getByRole('button',{name:/先聊聊/}).first().click();await page.getByLabel('对小N说',{exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('button',{name:'发送',exact:true})).toBeDisabled();await expect.poll(async()=>(await learning(page)).runs.filter((r:{role:string})=>r.role==='tutor').length).toBeGreaterThan(0);await expect(page.getByText('我在这里。我们只做你愿意的一步。',{exact:true}).last()).toBeVisible();}
  23 | test.beforeEach(async({page})=>{await control(page,'reset');});
  24 | test('student choice → attempts → evidence → report/plan → later reviews → state/history, refresh and screenshots',async({page})=>{
  25 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await onboard(page);
  26 |  await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');await select(page,'去括号负号处理');await submit(page,'x-5');await expect(page.getByText('先停在这一步，看看依据',{exact:true})).toBeVisible();
  27 |  await page.getByRole('button',{name:'看一级提示',exact:true}).click();await expect(page.getByText(/提示：减去括号内每一项/)).toBeVisible();await submit(page,'x+5');await expect(page.getByText('提示后完成',{exact:true})).toBeVisible();
  28 |  await page.getByLabel('我的作答与过程',{exact:true}).fill('保留的合成草稿');await page.reload();await expect(page.getByLabel('我的作答与过程',{exact:true})).toHaveValue('保留的合成草稿');
  29 |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/mobile-${width}-task.png`,fullPage:true});}await page.setViewportSize({width:390,height:844});await page.screenshot({path:evidence+'/01-task.png',fullPage:true});await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();await page.getByText(/展开 .* 条原始依据/).first().click();await page.screenshot({path:evidence+'/02-report.png',fullPage:true});
  30 |  await page.getByRole('button',{name:'看看下一步计划',exact:true}).click();await expect(page.getByRole('heading',{name:/去括号负号：从提示帮助/})).toBeVisible();await page.getByRole('button',{name:'接受这份计划',exact:true}).click();await expect(page.getByText('已确认版本 1',{exact:true})).toBeVisible();await page.screenshot({path:evidence+'/03-plan.png',fullPage:true});
  31 |  const first=await learning(page);expect(first.attempts).toHaveLength(5);expect(first.optionalMemory).toBe(false);
  32 |  for(const [days,answer] of [[1,'4*a+2'],[3,'12-3x']] as const){await control(page,`advance?days=${days}`);await tab(page,'今日');await page.reload();await page.getByRole('button',{name:'由我确认一道未见复习题',exact:true}).first().click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await expect(page.getByLabel('我的作答与过程',{exact:true})).toBeVisible();await page.reload();await submit(page,answer);await expect(page.getByText('新题独立完成',{exact:true})).toBeVisible();}
  33 |  const final=await learning(page);expect(final.assessment.skills.find((s:{knowledgePointId:string})=>s.knowledgePointId==='negative-brackets').status).toBe('cross_session_independent');expect(final.reviews.find((r:{knowledgePointId:string})=>r.knowledgePointId==='negative-brackets').stage).toBe(2);expect(final.attempts).toHaveLength(7);
  34 |  await page.getByRole('button',{name:'查看作答证据',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect.poll(async()=>(await learning(page)).reports.length).toBe(2);await page.getByLabel('报告历史').selectOption(first.reports[0].snapshot.id);await page.screenshot({path:evidence+'/04-history.png',fullPage:true});
  35 |  writeFileSync(evidence+'/browser-chain.json',JSON.stringify({first,final},null,2));writeFileSync(evidence+'/agent-tool-traces.json',JSON.stringify({runs:final.runs,tools:final.toolCalls},null,2));expect(errors).toEqual([]);
  36 | });
  37 | test('optional memory changes are checked in the next actual synthetic-provider outbound context; pause and reset survive refresh',async({page})=>{
  38 |  await onboard(page);await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).toBeChecked();await page.getByLabel('我主动保留的偏好').fill('合成偏好：一次只讲一步');await page.getByRole('button',{name:'确认保留这条偏好'}).click();await expect(page.getByText('合成偏好：一次只讲一步',{exact:true})).toBeVisible();await chat(page,'你好');
> 39 |  let messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).toContain('合成偏好：一次只讲一步');
     |                                                                             ^ TypeError: messages.at is not a function
  40 |  await memory(page);await page.getByRole('button',{name:'更正',exact:true}).click();await page.getByLabel('更正这条偏好').fill('合成偏好：给我图示');await page.getByRole('button',{name:'保存更正并停止旧条目'}).click();await expect(page.getByText('合成偏好：给我图示',{exact:true})).toBeVisible();await chat(page,'现在呢');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).toContain('合成偏好：给我图示');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好：一次只讲一步');
  41 |  await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).not.toBeChecked();await chat(page,'继续聊');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  42 |  await memory(page);await page.getByRole('checkbox',{name:'允许可选长期辅导偏好'}).click();await expect(page.getByRole('checkbox',{name:'允许可选长期辅导偏好'})).toBeChecked();await page.locator('section.info-paper').filter({hasText:'合成偏好：给我图示'}).getByRole('button',{name:'停止使用'}).click();await chat(page,'再聊');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  43 |  await memory(page);await page.locator('section.info-paper').filter({hasText:'合成偏好：给我图示'}).getByRole('button',{name:'删除偏好',exact:true}).click();await page.screenshot({path:evidence+'/05-memory.png',fullPage:true});await chat(page,'再核对');messages=await control(page,'messages');expect(JSON.stringify(messages.at(-1))).not.toContain('合成偏好');
  44 |  await page.getByRole('button',{name:'今天先休息',exact:true}).click();await page.reload();await expect(page.getByText(/先聊聊，暂不邀请看题/)).toBeVisible();expect((await learning(page)).paused).toBe(true);
  45 |  await page.getByRole('button',{name:'我的与设置',exact:true}).click();await page.getByRole('button',{name:/重置整个演示/}).click();await page.getByRole('button',{name:'确认清空本机演示',exact:true}).click();await expect(page.getByRole('button',{name:'认识一下小N'})).toBeVisible();await page.reload();expect((await learning(page)).attempts).toHaveLength(0);expect((await learning(page)).memories).toHaveLength(0);expect((await learning(page)).plans).toHaveLength(0);
  46 |  writeFileSync(evidence+'/memory-context-check.json',JSON.stringify({mode:'synthetic outbound actual messages',afterDeletionContainsOptionalText:JSON.stringify(messages.at(-1)).includes('合成偏好'),reset:'verified'},null,2));
  47 | });
  48 | test('browser legacy import backs up, previews, deduplicates and keeps unknown dates; 320/390/430 pages fit',async({page})=>{
  49 |  await onboard(page);const old={...initial(),onboarded:true,records:{bracket:{id:'bracket',draft:'',hint:false,paused:false,attempts:[{id:'legacy-attempt',value:'x+5',correct:true,hinted:false,time:'10月20日 12:00'}]}}};await page.evaluate(old=>localStorage.setItem('xiaon-progress-v1',JSON.stringify(old)),old);await page.reload();
  50 |  await memory(page);await page.getByText('导入旧浏览器作答（先备份与预览）',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载旧记录备份并预览'}).click();await(await download).saveAs(evidence+'/legacy-browser-backup.json');await expect(page.getByText('预览：1次尝试',{exact:true})).toBeVisible();await page.getByRole('button',{name:'确认只导入这些尝试'}).click();await expect(page.getByRole('alert')).toContainText('新增 1 次尝试');await page.getByRole('button',{name:'确认只导入这些尝试'}).click();await expect(page.getByRole('alert')).toContainText('新增 0 次尝试');const v=await learning(page);expect(v.attempts[0].sourceTime.occurredAt).toBe(null);expect(v.attempts[0].sessionId).toBe(null);expect(v.attempts[0].classification.independent).toBe(false);
  51 |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await memory(page);await page.screenshot({path:`${evidence}/mobile-${width}-memory.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await tab(page,'成长');await page.getByRole('button',{name:'学习观察报告',exact:true}).click();await page.getByRole('button',{name:'根据当前证据生成报告与计划草案'}).click();await expect(page.getByText(/观察快照 · 证据版本/)).toBeVisible();await page.screenshot({path:`${evidence}/mobile-${width}-report.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'看看下一步计划'}).click();await page.screenshot({path:`${evidence}/mobile-${width}-plan.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  52 |  writeFileSync(evidence+'/migration-result.json',JSON.stringify(v.attempts,null,2));
  53 | });
  54 | test('network retry, model timeout, explicit reanalysis and cancelled late response preserve one saved attempt and draft',async({page})=>{
  55 |  await onboard(page);await page.getByRole('button',{name:'一起看一道题',exact:true}).click();await page.getByRole('button',{name:'我愿意，从示例题开始',exact:true}).click();await page.getByRole('button',{name:'先尝试合并同类项',exact:true}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await submit(page,'5x-4');await select(page,'一次费用与随数量变化费用');
  56 |  await page.getByLabel('我的作答与过程',{exact:true}).fill('3x+2\n3x是x本的费用；2是只收一次的纸袋费');
  57 |  await page.route('**/api/learning/submit',route=>route.abort('failed'));await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByRole('button',{name:'重试上次请求'})).toBeVisible();await page.unroute('**/api/learning/submit');await page.reload();await expect(page.getByLabel('我的作答与过程',{exact:true})).toHaveValue(/3x\+2/);
  58 |  await control(page,'provider?mode=timeout');await page.getByRole('button',{name:'重试上次请求'}).click();await expect(page.getByRole('button',{name:'重试分析已保存作答'})).toBeVisible();expect((await learning(page)).attempts.filter((a:{taskId:string})=>a.taskId==='model')).toHaveLength(1);
  59 |  await control(page,'provider?mode=normal');await page.getByRole('button',{name:'重试分析已保存作答'}).click();await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();expect((await learning(page)).attempts.filter((a:{taskId:string})=>a.taskId==='model')).toHaveLength(1);
  60 |  await tab(page,'小N');await page.getByRole('button',{name:/先聊聊/}).first().click();await control(page,'provider?mode=timeout');await page.getByLabel('对小N说',{exact:true}).fill('合成取消测试');await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('button',{name:'取消等待',exact:true}).click();await expect(page.getByRole('alert')).toContainText('已取消等待');await page.reload();await expect(page.getByText('合成取消测试',{exact:true})).toBeVisible();await control(page,'provider?mode=normal');await page.getByRole('button',{name:'重试上次请求'}).click();await expect(page.getByRole('button',{name:'重试上次请求'})).not.toBeVisible();
  61 |  await control(page,'provider?mode=timeout');await page.getByLabel('对小N说',{exact:true}).fill('慢慢说，我等你');await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('button',{name:'今天先休息',exact:true}).click();await expect(page.getByText(/先聊聊，暂不邀请看题/)).toBeVisible();expect((await learning(page)).paused).toBe(true);await control(page,'provider?mode=normal');
  62 |  writeFileSync(evidence+'/failure-retry-result.json',JSON.stringify({mode:'synthetic',view:await learning(page)},null,2));
  63 | });
  64 | 
  65 | test('connected main pages retain automated accessibility and reduced-motion support',async({page})=>{
  66 |  await page.emulateMedia({reducedMotion:'reduce'});await onboard(page);
  67 |  for(const name of ['小N','探索','今日','成长']){await tab(page,name);const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(report.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),name).toEqual([]);}
  68 |  await memory(page);const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(report.violations).toEqual([]);
  69 | });
  70 | 
```