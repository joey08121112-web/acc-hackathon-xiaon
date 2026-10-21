# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> optional memory changes are checked in the next actual synthetic-provider outbound context; pause and reset survive refresh
- Location: tests-agent/d/browser.spec.ts:28:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '重置整个演示', exact: true })

```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - banner [ref=f1e5]:
    - button "返回" [ref=f1e6] [cursor=pointer]
    - heading "我的与设置" [level=2] [ref=f1e9]
    - generic [ref=f1e10]:
      - button "帮助与支持" [ref=f1e11] [cursor=pointer]
      - button "我的与设置" [active] [ref=f1e17] [cursor=pointer]
  - status [ref=f1e21]:
    - generic [ref=f1e25]: 模拟模型 · 真实工具 / SQLite
    - button "重新连接" [ref=f1e26] [cursor=pointer]
  - generic [ref=f1e27]: 新版学习记录、评分、报告、计划保存在本机SQLite；草稿是浏览器恢复缓存。真实模型模式会向智谱发送当前消息、必要题目/作答/评分依据和获准偏好。以下旧授权、身份与通知仍为演示；上传仍无OCR。学习记忆请以新版记忆页为准。
  - main [ref=f1e28]:
    - generic [ref=f1e29]:
      - generic [ref=f1e34]:
        - heading "我的小小空间" [level=1] [ref=f1e35]
        - paragraph [ref=f1e36]: 虚构体验者 · 七年级 · 人教版
      - generic [ref=f1e37]: 本地演示
    - generic [ref=f1e38]:
      - button "我的学习记忆 查看来源、更正、删除与停止使用" [ref=f1e39] [cursor=pointer]:
        - generic [ref=f1e42]:
          - strong [ref=f1e43]: 我的学习记忆
          - generic [ref=f1e44]: 查看来源、更正、删除与停止使用
      - button "信息与授权 必要用途、可选功能和保存规则" [ref=f1e47] [cursor=pointer]:
        - generic [ref=f1e51]:
          - strong [ref=f1e52]: 信息与授权
          - generic [ref=f1e53]: 必要用途、可选功能和保存规则
      - button "求助与安全支持 找到现实中值得信任的人" [ref=f1e56] [cursor=pointer]:
        - generic [ref=f1e62]:
          - strong [ref=f1e63]: 求助与安全支持
          - generic [ref=f1e64]: 找到现实中值得信任的人
      - button "监护人演示 授权、学习概览与信息权利" [ref=f1e67] [cursor=pointer]:
        - generic [ref=f1e71]:
          - strong [ref=f1e72]: 监护人演示
          - generic [ref=f1e73]: 授权、学习概览与信息权利
    - generic [ref=f1e76]:
      - generic [ref=f1e77]:
        - generic [ref=f1e78]:
          - strong [ref=f1e79]: 大字体
          - paragraph [ref=f1e80]: 让正文更容易阅读，保留系统缩放能力。
        - switch "大字体" [ref=f1e81] [cursor=pointer]
      - generic [ref=f1e83]:
        - generic [ref=f1e84]:
          - strong [ref=f1e85]: 断网与失败演示
          - paragraph [ref=f1e86]: 开启后，聊天回复、任务提交和通知演示会失败；草稿保留。本次页面有效，刷新后关闭。
        - switch "断网与失败演示" [ref=f1e87] [cursor=pointer]
      - button "关于小N与服务说明 AI 身份、模拟范围与帮助" [ref=f1e89] [cursor=pointer]:
        - generic [ref=f1e93]:
          - strong [ref=f1e94]: 关于小N与服务说明
          - generic [ref=f1e95]: AI 身份、模拟范围与帮助
    - generic [ref=f1e98]:
      - button "重新体验首次进入 保留原有学习进度与选择" [ref=f1e99] [cursor=pointer]:
        - generic [ref=f1e103]:
          - strong [ref=f1e104]: 重新体验首次进入
          - generic [ref=f1e105]: 保留原有学习进度与选择
      - button "重置整个演示 清空这台设备上的进度、图片与记忆" [ref=f1e108] [cursor=pointer]:
        - generic [ref=f1e112]:
          - strong [ref=f1e113]: 重置整个演示
          - generic [ref=f1e114]: 清空这台设备上的进度、图片与记忆
    - paragraph [ref=f1e117]: 学伴小N · 交互原型 1.0本地预设内容，未接入真实 AI 模型或外部消息服务。
  - navigation "主导航" [ref=f1e118]:
    - button [ref=f1e119] [cursor=pointer]
    - button [ref=f1e124] [cursor=pointer]
    - button [ref=f1e129] [cursor=pointer]
    - button [ref=f1e133] [cursor=pointer]
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
  23 |  for(const [days,answer] of [[1,'4*a+2'],[3,'12-3x']] as const){await control(page,`advance?days=${days}`);await tab(page,'今日');await page.reload();await page.getByRole('button',{name:'由我确认一道未见复习题',exact:true}).first().click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await page.reload();await submit(page,answer);await expect(page.getByText('新题独立完成',{exact:true})).toBeVisible();}
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
> 36 |  await page.getByRole('button',{name:'我的与设置',exact:true}).click();await page.getByRole('button',{name:'重置整个演示',exact:true}).click();await page.getByRole('button',{name:'确认清空所有演示数据',exact:true}).click();await expect(page.getByRole('button',{name:'认识一下小N'})).toBeVisible();await page.reload();expect((await learning(page)).attempts).toHaveLength(0);expect((await learning(page)).memories).toHaveLength(0);expect((await learning(page)).plans).toHaveLength(0);
     |                                                                                                                             ^ Error: locator.click: Test timeout of 45000ms exceeded.
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