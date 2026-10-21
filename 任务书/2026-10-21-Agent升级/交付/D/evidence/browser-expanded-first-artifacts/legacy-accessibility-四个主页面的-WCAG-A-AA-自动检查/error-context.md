# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: legacy-accessibility.spec.ts >> 四个主页面的 WCAG A/AA 自动检查
- Location: tests-agent/d/legacy-accessibility.spec.ts:4:1

# Error details

```
Error: 小N

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 15

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.8 (foreground color: #69815f, background color: #eff3e9, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".text-button",
+         ],
+       },
+     ],
+   },
+ ]
```

```
Error: 探索

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 15

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.8 (foreground color: #69815f, background color: #eff3e9, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".text-button",
+         ],
+       },
+     ],
+   },
+ ]
```

```
Error: 今日

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 15

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.8 (foreground color: #69815f, background color: #eff3e9, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".text-button",
+         ],
+       },
+     ],
+   },
+ ]
```

```
Error: 成长

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 15

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.8 (foreground color: #69815f, background color: #eff3e9, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".text-button",
+         ],
+       },
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - banner [ref=e5]:
    - generic [ref=e12]:
      - text: 我的成长
      - generic [ref=e13]: 按自己的节奏，向前一点点
    - generic [ref=e14]:
      - button "帮助与支持" [ref=e15] [cursor=pointer]
      - button "我的与设置" [ref=e21] [cursor=pointer]
  - status [ref=e25]:
    - generic [ref=e29]: 本地服务未连接 · 原规则离线模式
    - button "重新连接" [ref=e30] [cursor=pointer]
  - main [ref=e31]:
    - generic [ref=e32]:
      - generic [ref=e33]: LITTLE STEPS, REAL CHANGES
      - heading "成长，藏在具体的一步里。" [level=1] [ref=e34]
      - paragraph [ref=e35]: 不用分数定义自己。每一次尝试，都有它自己的来处。
    - generic [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]: 我的学习手记
        - heading "看见过程， 也看见变化。" [level=2] [ref=e39]: 看见过程，也看见变化。
        - paragraph [ref=e40]: 还没有记录，也没关系。
        - button "打开学习观察" [ref=e41] [cursor=pointer]
      - img "原创学伴小N，绿色的小芽伙伴" [ref=e44]
    - generic [ref=e64]:
      - heading "五个方向，慢慢了解" [level=2] [ref=e65]
      - generic [ref=e66]: 不作能力排名
    - generic [ref=e67]:
      - button "理解 尚未观察" [ref=e68] [cursor=pointer]:
        - strong [ref=e75]: 理解
        - generic [ref=e76]: 尚未观察
      - button "逻辑 尚未观察" [ref=e79] [cursor=pointer]:
        - strong [ref=e83]: 逻辑
        - generic [ref=e84]: 尚未观察
      - button "计算 尚未观察" [ref=e87] [cursor=pointer]:
        - strong [ref=e90]: 计算
        - generic [ref=e91]: 尚未观察
      - button "建模 尚未观察" [ref=e94] [cursor=pointer]:
        - strong [ref=e98]: 建模
        - generic [ref=e99]: 尚未观察
      - button "空间想象 尚未观察" [ref=e102] [cursor=pointer]:
        - strong [ref=e107]: 空间想象
        - generic [ref=e108]: 尚未观察
    - generic [ref=e111]:
      - button "我的一周小计划 一个目标，少量任务" [ref=e112] [cursor=pointer]:
        - generic [ref=e117]:
          - text: 我的一周小计划
          - generic [ref=e118]: 一个目标，少量任务
      - button "阶段回顾 用一道新题，看看变化" [ref=e121] [cursor=pointer]:
        - generic [ref=e126]:
          - text: 阶段回顾
          - generic [ref=e127]: 用一道新题，看看变化
      - button "方法笔记与学习记忆 0 张固定方法笔记" [ref=e130] [cursor=pointer]:
        - generic [ref=e133]:
          - text: 方法笔记与学习记忆
          - generic [ref=e134]: 0 张固定方法笔记
  - navigation "主导航" [ref=e137]:
    - button [ref=e138] [cursor=pointer]
    - button [ref=e142] [cursor=pointer]
    - button [ref=e147] [cursor=pointer]
    - button [active] [ref=e151] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | test.beforeEach(async({page})=>{await page.route("**/api/**",route=>route.abort());});
  4  | test("四个主页面的 WCAG A/AA 自动检查", async ({ page }) => {
  5  |   await page.goto("/");
  6  |   await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  7  |   await page
  8  |     .getByRole("combobox", { name: "年龄段", exact: true })
  9  |     .selectOption("14-17");
  10 |   await page.getByRole("checkbox").check();
  11 |   await page
  12 |     .getByRole("button", { name: "继续，选择可选功能", exact: true })
  13 |     .click();
  14 |   await page
  15 |     .getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true })
  16 |     .click();
  17 |   for (const tab of ["小N", "探索", "今日", "成长"]) {
  18 |     await page.getByRole("button", { name: tab, exact: true }).click();
  19 |     const report = await new AxeBuilder({ page })
  20 |       .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
  21 |       .analyze();
  22 |     expect
  23 |       .soft(
  24 |         report.violations.map((v) => ({
  25 |           id: v.id,
  26 |           impact: v.impact,
  27 |           nodes: v.nodes.map((n) => ({
  28 |             target: n.target,
  29 |             summary: n.failureSummary,
  30 |           })),
  31 |         })),
  32 |         tab,
  33 |       )
> 34 |       .toEqual([]);
     |        ^ Error: 成长
  35 |   }
  36 | });
  37 | 
```