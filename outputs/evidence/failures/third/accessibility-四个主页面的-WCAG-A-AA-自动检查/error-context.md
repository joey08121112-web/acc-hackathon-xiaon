# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> 四个主页面的 WCAG A/AA 自动检查
- Location: tests/accessibility.spec.ts:3:1

# Error details

```
Error: 小N

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 92

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 7.1pt (9.45px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "div > small",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 7.0pt (9.3px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".home-heading > div > .eyebrow",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 3.18 (foreground color: #80906e, background color: #f8f7ef, font size: 7.1pt (9.45px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".ai-pill",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 7.6pt (10.2px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".little-label",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 8.6pt (11.4px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".home-dialogue > p",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 6.4pt (8.55px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "div:nth-child(2) > .eyebrow",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 7.3pt (9.75px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".home-explore > div:nth-child(2) > p",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 6.6pt (8.85px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".home-foot",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #68775e, background color: #f8f7ef, font size: 6.6pt (8.85px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           ".home-foot > button",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 2.98 (foreground color: #8b9582, background color: #fbfaf3, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "nav > button:nth-child(2)",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 2.98 (foreground color: #8b9582, background color: #fbfaf3, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "nav > button:nth-child(3)",
+         ],
+       },
+       Object {
+         "summary": "Fix any of the following:
+   Element has insufficient color contrast of 2.98 (foreground color: #8b9582, background color: #fbfaf3, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "button:nth-child(4)",
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
      - text: 学伴小N
      - generic [ref=e13]: 你的 AI 学伴
    - generic [ref=e14]:
      - button "帮助与支持" [ref=e15] [cursor=pointer]
      - button "我的与设置" [ref=e21] [cursor=pointer]
  - main [ref=e25]:
    - generic [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]: HI, 很高兴见到你
        - heading "今天，按你的节奏来。" [level=1] [ref=e29]
      - button "AI 学伴" [ref=e30] [cursor=pointer]
    - generic [ref=e34]:
      - generic [ref=e47]: 每一步，都算数
      - generic [ref=e48]: 慢慢来就好
      - img "原创学伴小N，绿色的小芽伙伴" [ref=e49]
      - generic [ref=e69]: YOUR LITTLE LEARNING COMPANION
    - generic [ref=e70]:
      - generic [ref=e71]: 小N 轻轻说
      - heading "这次数学考试之后， 你现在最想做什么？" [level=2] [ref=e73]
      - paragraph [ref=e74]: 不用马上振作，也不用一下子想清楚。
    - generic [ref=e75]:
      - button "先聊聊 我想先说说现在的心情" [ref=e76] [cursor=pointer]:
        - generic [ref=e80]:
          - text: 先聊聊
          - generic [ref=e81]: 我想先说说现在的心情
      - generic [ref=e84]:
        - button "一起看一道题" [ref=e85] [cursor=pointer]
        - button "今天先休息" [ref=e91] [cursor=pointer]
    - generic [ref=e98]:
      - generic [ref=e105]:
        - generic [ref=e106]: 还有一个小小的世界
        - heading "去探索，你的解题方式" [level=3] [ref=e107]
        - paragraph [ref=e108]: 五个地点，没有排名，只有发现。
      - button "进入五维探索" [ref=e109] [cursor=pointer]
    - generic [ref=e112]:
      - text: 你的选择会被尊重。
      - button "了解信息与授权" [ref=e116] [cursor=pointer]
  - navigation "主导航" [ref=e117]:
    - button [active] [ref=e118] [cursor=pointer]
    - button [ref=e123] [cursor=pointer]
    - button [ref=e128] [cursor=pointer]
    - button [ref=e132] [cursor=pointer]
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 | import AxeBuilder from '@axe-core/playwright';
> 3 | test('四个主页面的 WCAG A/AA 自动检查',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'认识一下小N',exact:true}).click();await page.getByRole('combobox',{name:'年龄段',exact:true}).selectOption('14-17');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'继续，选择可选功能',exact:true}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验',exact:true}).click();for(const tab of ['小N','探索','今日','成长']){await page.getByRole('button',{name:tab,exact:true}).click();const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(report.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),tab).toEqual([]);}});
    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ^ Error: 小N
  4 | 
```