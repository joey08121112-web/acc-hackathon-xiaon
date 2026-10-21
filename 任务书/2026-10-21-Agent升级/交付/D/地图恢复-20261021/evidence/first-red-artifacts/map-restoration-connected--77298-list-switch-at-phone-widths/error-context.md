# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map-restoration.spec.ts >> connected exploration restores the original map, five places and list switch at phone widths
- Location: tests-agent/d/map-restoration.spec.ts:7:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.exploration-map .map-art')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.exploration-map .map-art') with timeout 5000ms
  - waiting for locator('.exploration-map .map-art')

```

```yaml
- banner:
  - img
  - text: 五维探索 按自己的节奏，向前一点点
  - button "帮助与支持":
    - img
  - button "我的与设置":
    - img
- img
- text: 模拟模型 · 真实工具 / SQLite
- button "重新连接"
- main:
  - text: A SMALL WORLD TO EXPLORE
  - heading "每一种思考，都值得发现。" [level=1]
  - paragraph: 结果仅限已观察的子技能；待观察不代表能力弱。探索先尝试理解和逻辑，可以随时暂停。
  - button "开始本次探索"
  - heading "理解" [level=2]
  - strong: 数学语句与条件
  - text: 尚未观察
  - paragraph: 数学语句与条件提取：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
  - group: 观察范围与待了解
  - button "数学语句与条件提取 起点任务 · 4分钟":
    - strong: 数学语句与条件提取
    - text: 起点任务 · 4分钟
    - img
  - heading "逻辑" [level=2]
  - strong: 反例与条件
  - text: 尚未观察
  - paragraph: 反例与条件结论：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
  - group: 观察范围与待了解
  - button "反例与条件结论 起点任务 · 4分钟":
    - strong: 反例与条件结论
    - text: 起点任务 · 4分钟
    - img
  - heading "计算" [level=2]
  - strong: 去括号负号
  - text: 尚未观察
  - paragraph: 去括号负号处理：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
  - group: 观察范围与待了解
  - strong: 合并同类项
  - text: 尚未观察
  - paragraph: 合并同类项：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
  - group: 观察范围与待了解
  - button "去括号负号处理 起点任务 · 3分钟 · 请先尝试先修任务" [disabled]:
    - strong: 去括号负号处理
    - text: 起点任务 · 3分钟 · 请先尝试先修任务
    - img
  - button "合并同类项 起点任务 · 3分钟":
    - strong: 合并同类项
    - text: 起点任务 · 3分钟
    - img
  - heading "建模" [level=2]
  - strong: 一次费用与变化费用
  - text: 尚未观察
  - paragraph: 一次费用与随数量变化费用：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
  - group: 观察范围与待了解
  - button "一次费用与随数量变化费用 起点任务 · 4分钟":
    - strong: 一次费用与随数量变化费用
    - text: 起点任务 · 4分钟
    - img
  - heading "空间想象" [level=2]
  - strong: 二维旋转
  - text: 尚未观察
  - paragraph: 二维旋转与位置关系：0次有效尝试，0道未见题独立完成，0次提示后完成，0次原题重做；同题族简单换数覆盖有限
  - group: 观察范围与待了解
  - button "二维旋转与位置关系 起点任务 · 3分钟":
    - strong: 二维旋转与位置关系
    - text: 起点任务 · 3分钟
    - img
  - button "学习观察报告"
  - button "查看我的计划"
  - button "阶段回顾"
  - button "我的学习记忆"
  - paragraph: 本场次已打开 0/10 道计算题，刷新不会重置。
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
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | const evidence='../../任务书/2026-10-21-Agent升级/交付/D/地图恢复-20261021/evidence';
  4  | const api=process.env.XIAON_D_API_PORT??'18936';
  5  | test.beforeEach(async({page})=>{await page.request.get(`http://127.0.0.1:${api}/__test/reset`,{headers:{'X-Xiaon-Test':'synthetic-d-only'}});});
  6  | async function start(page:import('@playwright/test').Page){await page.goto('/');await page.getByRole('button',{name:'认识一下小N',exact:true}).click();await page.getByLabel('年龄段').selectOption('adult');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'继续，选择可选功能'}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验'}).click();await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();}
  7  | test('connected exploration restores the original map, five places and list switch at phone widths',async({page})=>{
> 8  |  await start(page);await expect(page.locator('.exploration-map .map-art')).toBeVisible();
     |                                                                            ^ Error: expect(locator).toBeVisible() failed
  9  |  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('.map-node')).toHaveCount(5);for(const place of ['理解花园','逻辑小桥','计算工坊','生活集市','空间山丘'])await expect(page.locator('.map-node').filter({hasText:place})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/map-${width}.png`,fullPage:true});}
  10 |  await page.getByRole('button',{name:'列表入口',exact:true}).click();await expect(page.locator('.dimension-list > button')).toHaveCount(5);await expect(page.locator('.exploration-map')).not.toBeVisible();await page.getByRole('button',{name:'地图入口',exact:true}).click();await expect(page.locator('.exploration-map')).toBeVisible();
  11 |  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  12 | });
  13 | test('map enters the original confirmation, respects exploration order and reflects SQLite attempts after refresh',async({page})=>{
  14 |  await start(page);await page.locator('.map-node').filter({hasText:'计算工坊'}).click();await expect(page.getByRole('heading',{name:'欢迎来到计算工坊',exact:true})).toBeVisible();await expect(page.getByText(/这次探索先从理解与逻辑两站开始/)).toBeVisible();await page.getByRole('button',{name:'先去理解花园'}).click();await page.getByRole('button',{name:'确认开始这道题',exact:true}).click();await page.getByLabel('我的作答与过程',{exact:true}).fill('2x-3\n先求x的2倍，再减去3。');await page.getByRole('button',{name:'保存尝试并核对'}).click();await expect(page.getByText('这次核对正确',{exact:true})).toBeVisible();
  15 |  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();await expect(page.locator('.map-node').filter({hasText:'理解花园'})).toContainText('完成');await page.reload();await expect(page.locator('.map-node').filter({hasText:'理解花园'})).toContainText('完成');await page.locator('.map-node').filter({hasText:'计算工坊'}).click();await expect(page.getByRole('button',{name:'先去逻辑小桥'})).toBeVisible();await page.getByRole('button',{name:'先看看地图',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  16 |  await page.getByRole('button',{name:'我的与设置',exact:true}).click();await page.getByRole('switch',{name:'大字体'}).click();await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'探索',exact:true}).click();await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/map-320-large.png`,fullPage:true});
  17 | });
  18 | 
```