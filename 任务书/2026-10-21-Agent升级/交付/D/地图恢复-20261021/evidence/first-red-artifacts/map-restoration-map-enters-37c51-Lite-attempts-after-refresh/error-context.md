# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map-restoration.spec.ts >> map enters the original confirmation, respects exploration order and reflects SQLite attempts after refresh
- Location: tests-agent/d/map-restoration.spec.ts:13:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.map-node').filter({ hasText: '计算工坊' })

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - banner [ref=e5]:
    - generic [ref=e12]:
      - text: 五维探索
      - generic [ref=e13]: 按自己的节奏，向前一点点
    - generic [ref=e14]:
      - button "帮助与支持" [ref=e15] [cursor=pointer]
      - button "我的与设置" [ref=e21] [cursor=pointer]
  - generic "服务模式" [ref=e25]:
    - generic [ref=e29]: 模拟模型 · 真实工具 / SQLite
    - button "重新连接" [ref=e30] [cursor=pointer]
  - main [ref=e31]:
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e34]: A SMALL WORLD TO EXPLORE
        - heading "每一种思考，都值得发现。" [level=1] [ref=e35]
        - paragraph [ref=e36]: 结果仅限已观察的子技能；待观察不代表能力弱。探索先尝试理解和逻辑，可以随时暂停。
      - button "开始本次探索" [ref=e37] [cursor=pointer]
      - generic [ref=e38]:
        - heading "理解" [level=2] [ref=e39]
        - generic [ref=e40]:
          - strong [ref=e41]: 数学语句与条件
          - generic [ref=e42]: 尚未观察
          - paragraph [ref=e43]: 数学语句与条件提取：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
          - group [ref=e44]:
            - generic "观察范围与待了解" [ref=e45] [cursor=pointer]
        - button "数学语句与条件提取 起点任务 · 4分钟" [ref=e46] [cursor=pointer]:
          - generic [ref=e47]:
            - strong [ref=e48]: 数学语句与条件提取
            - generic [ref=e49]: 起点任务 · 4分钟
      - generic [ref=e52]:
        - heading "逻辑" [level=2] [ref=e53]
        - generic [ref=e54]:
          - strong [ref=e55]: 反例与条件
          - generic [ref=e56]: 尚未观察
          - paragraph [ref=e57]: 反例与条件结论：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
          - group [ref=e58]:
            - generic "观察范围与待了解" [ref=e59] [cursor=pointer]
        - button "反例与条件结论 起点任务 · 4分钟" [ref=e60] [cursor=pointer]:
          - generic [ref=e61]:
            - strong [ref=e62]: 反例与条件结论
            - generic [ref=e63]: 起点任务 · 4分钟
      - generic [ref=e66]:
        - heading "计算" [level=2] [ref=e67]
        - generic [ref=e68]:
          - strong [ref=e69]: 去括号负号
          - generic [ref=e70]: 尚未观察
          - paragraph [ref=e71]: 去括号负号处理：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
          - group [ref=e72]:
            - generic "观察范围与待了解" [ref=e73] [cursor=pointer]
        - generic [ref=e74]:
          - strong [ref=e75]: 合并同类项
          - generic [ref=e76]: 尚未观察
          - paragraph [ref=e77]: 合并同类项：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
          - group [ref=e78]:
            - generic "观察范围与待了解" [ref=e79] [cursor=pointer]
        - button "去括号负号处理 起点任务 · 3分钟 · 请先尝试先修任务" [disabled] [ref=e80]:
          - generic [ref=e81]:
            - strong [ref=e82]: 去括号负号处理
            - generic [ref=e83]: 起点任务 · 3分钟 · 请先尝试先修任务
        - button "合并同类项 起点任务 · 3分钟" [ref=e86] [cursor=pointer]:
          - generic [ref=e87]:
            - strong [ref=e88]: 合并同类项
            - generic [ref=e89]: 起点任务 · 3分钟
      - generic [ref=e92]:
        - heading "建模" [level=2] [ref=e93]
        - generic [ref=e94]:
          - strong [ref=e95]: 一次费用与变化费用
          - generic [ref=e96]: 尚未观察
          - paragraph [ref=e97]: 一次费用与随数量变化费用：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
          - group [ref=e98]:
            - generic "观察范围与待了解" [ref=e99] [cursor=pointer]
        - button "一次费用与随数量变化费用 起点任务 · 4分钟" [ref=e100] [cursor=pointer]:
          - generic [ref=e101]:
            - strong [ref=e102]: 一次费用与随数量变化费用
            - generic [ref=e103]: 起点任务 · 4分钟
      - generic [ref=e106]:
        - heading "空间想象" [level=2] [ref=e107]
        - generic [ref=e108]:
          - strong [ref=e109]: 二维旋转
          - generic [ref=e110]: 尚未观察
          - paragraph [ref=e111]: 二维旋转与位置关系：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
          - group [ref=e112]:
            - generic "观察范围与待了解" [ref=e113] [cursor=pointer]
        - button "二维旋转与位置关系 起点任务 · 3分钟" [ref=e114] [cursor=pointer]:
          - generic [ref=e115]:
            - strong [ref=e116]: 二维旋转与位置关系
            - generic [ref=e117]: 起点任务 · 3分钟
      - generic [ref=e120]:
        - button "学习观察报告" [ref=e121] [cursor=pointer]
        - button "查看我的计划" [ref=e122] [cursor=pointer]
        - button "阶段回顾" [ref=e123] [cursor=pointer]
        - button "我的学习记忆" [ref=e124] [cursor=pointer]
      - paragraph [ref=e125]: 本场次已打开 0/10 道计算题，刷新不会重置。
  - navigation "主导航" [ref=e126]:
    - button [ref=e127] [cursor=pointer]
    - button [active] [ref=e131] [cursor=pointer]
    - button [ref=e137] [cursor=pointer]
    - button [ref=e141] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | const evidence='../../任务书/2026-10-21-Agent升级/交付/D/地图恢复-20261021/evidence';
  4  | const api=process.env.XIAON_D_API_PORT??'18936';
  5  | test.beforeEach(async({page})=>{await page.request.get(`http://127.0.0.1:${api}/__test/reset`,{headers:{'X-Xiaon-Test':'synthetic-d-only'}});});
  6  | async function start(page:import('@playwright/test').Page){await page.goto('/');await page.getByRole('button',{name:'认识一下小N',exact:true}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验'}).click();await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();}
  7  | test('connected exploration restores the original map, five places and list switch at phone widths',async({page})=>{
  8  |  await start(page);await expect(page.locator('.exploration-map .map-art')).toBeVisible();
  9  |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('.map-node')).toHaveCount(5);for(const place of ['理解花园','逻辑小桥','计算工坊','生活集市','空间山丘'])await expect(page.locator('.map-node').filter({hasText:place})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/map-${width}.png`,fullPage:true});}
  10 |  await page.getByRole('button',{name:'列表入口',exact:true}).click();await expect(page.locator('.dimension-list > button')).toHaveCount(5);await expect(page.locator('.exploration-map')).not.toBeVisible();await page.getByRole('button',{name:'地图入口',exact:true}).click();await expect(page.locator('.exploration-map')).toBeVisible();
  11 |  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  12 | });
  13 | test('map enters the original confirmation, respects exploration order and reflects SQLite attempts after refresh',async({page})=>{
> 14 |  await start(page);await page.locator('.map-node').filter({hasText:'计算工坊'}).click();await expect(page.getByRole('heading',{name:'欢迎来到计算工坊',exact:true})).toBeVisible();await expect(page.getByText(/这次探索先从理解与逻辑两站开始/)).toBeVisible();await page.getByRole('button',{name:'先去理解花园'}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await page.getByLabel('我的作答与过程',{exact:true}).fill('2x-3\n先求x的2倍，再减去3。');await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();
     |                                                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
  15 |  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();await expect(page.locator('.map-node').filter({hasText:'理解花园'})).toContainText('完成');await page.reload();await expect(page.locator('.map-node').filter({hasText:'理解花园'})).toContainText('完成');await page.locator('.map-node').filter({hasText:'计算工坊'}).click();await expect(page.getByRole('button',{name:'先去逻辑小桥'})).toBeVisible();await page.getByRole('button',{name:'先看看地图',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  16 |  await page.getByRole('button',{name:'我的与设置',exact:true}).click();await page.getByRole('switch',{name:'大字体'}).click();await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/map-320-large.png`,fullPage:true});
  17 | });
  18 | 
```