# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> 四个主页面的 WCAG A/AA 自动检查
- Location: tests/accessibility.spec.ts:3:1

# Error details

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
+   Element has insufficient color contrast of 2.93 (foreground color: #859771, background color: #f8f7ef, font size: 9.6pt (12.75px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "h3",
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
+   Element has insufficient color contrast of 4.45 (foreground color: #607153, background color: #e9eede, font size: 7.9pt (10.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "target": Array [
+           "nav > button:nth-child(2)",
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
  - main [ref=e25]:
    - generic [ref=e26]:
      - generic [ref=e27]: LITTLE STEPS, REAL CHANGES
      - heading "成长，藏在具体的一步里。" [level=1] [ref=e28]
      - paragraph [ref=e29]: 不用分数定义自己。每一次尝试，都有它自己的来处。
    - generic [ref=e30]:
      - generic [ref=e31]:
        - generic [ref=e32]: 我的学习手记
        - heading "看见过程， 也看见变化。" [level=2] [ref=e33]: 看见过程，也看见变化。
        - paragraph [ref=e34]: 还没有记录，也没关系。
        - button "打开学习观察" [ref=e35] [cursor=pointer]
      - img "原创学伴小N，绿色的小芽伙伴" [ref=e38]
    - generic [ref=e58]:
      - heading "五个方向，慢慢了解" [level=2] [ref=e59]
      - generic [ref=e60]: 不作能力排名
    - generic [ref=e61]:
      - button "理解 尚未观察" [ref=e62] [cursor=pointer]:
        - strong [ref=e69]: 理解
        - generic [ref=e70]: 尚未观察
      - button "逻辑 尚未观察" [ref=e73] [cursor=pointer]:
        - strong [ref=e77]: 逻辑
        - generic [ref=e78]: 尚未观察
      - button "计算 尚未观察" [ref=e81] [cursor=pointer]:
        - strong [ref=e84]: 计算
        - generic [ref=e85]: 尚未观察
      - button "建模 尚未观察" [ref=e88] [cursor=pointer]:
        - strong [ref=e92]: 建模
        - generic [ref=e93]: 尚未观察
      - button "空间想象 尚未观察" [ref=e96] [cursor=pointer]:
        - strong [ref=e101]: 空间想象
        - generic [ref=e102]: 尚未观察
    - generic [ref=e105]:
      - button "我的一周小计划 一个目标，少量任务" [ref=e106] [cursor=pointer]:
        - generic [ref=e111]:
          - text: 我的一周小计划
          - generic [ref=e112]: 一个目标，少量任务
      - button "阶段回顾 用一道新题，看看变化" [ref=e115] [cursor=pointer]:
        - generic [ref=e120]:
          - text: 阶段回顾
          - generic [ref=e121]: 用一道新题，看看变化
      - button "方法笔记与学习记忆 0 张固定方法笔记" [ref=e124] [cursor=pointer]:
        - generic [ref=e127]:
          - text: 方法笔记与学习记忆
          - generic [ref=e128]: 0 张固定方法笔记
  - navigation "主导航" [ref=e131]:
    - button [ref=e132] [cursor=pointer]
    - button [ref=e136] [cursor=pointer]
    - button [ref=e141] [cursor=pointer]
    - button [active] [ref=e145] [cursor=pointer]
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 | import AxeBuilder from '@axe-core/playwright';
> 3 | test('四个主页面的 WCAG A/AA 自动检查',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'认识一下小N',exact:true}).click();await page.getByRole('combobox',{name:'年龄段',exact:true}).selectOption('14-17');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'继续，选择可选功能',exact:true}).click();await page.getByRole('button',{name:'关闭可选功能，进入基本体验',exact:true}).click();for(const tab of ['小N','探索','今日','成长']){await page.getByRole('button',{name:tab,exact:true}).click();const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect.soft(report.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),tab).toEqual([]);}});
    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ^ Error: 今日
  4 | 
```