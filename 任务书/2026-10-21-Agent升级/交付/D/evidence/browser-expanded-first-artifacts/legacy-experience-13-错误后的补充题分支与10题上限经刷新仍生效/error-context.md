# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: legacy-experience.spec.ts >> 13 错误后的补充题分支与10题上限经刷新仍生效
- Location: tests-agent/d/legacy-experience.spec.ts:453:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('status')
Expected substring: "10 题上限"
Error: strict mode violation: getByRole('status') resolved to 2 elements:
    1) <div role="status" class="learning-status">…</div> aka getByText('本地服务未连接 · 原规则离线模式重新连接')
    2) <div class="toast" role="status">…</div> aka getByText('本次计算探索已达到 10 题上限。可以回看已有记录。')

Call log:
  - Expect "toContainText" getByRole('status') with timeout 5000ms
  - waiting for getByRole('status')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - banner [ref=e5]:
    - button "返回" [ref=e6] [cursor=pointer]
    - heading "一起看题" [level=2] [ref=e9]
    - generic [ref=e10]:
      - button "帮助与支持" [ref=e11] [cursor=pointer]
      - button "我的与设置" [ref=e17] [cursor=pointer]
  - status [ref=e21]:
    - generic [ref=e25]: 本地服务未连接 · 原规则离线模式
    - button "重新连接" [ref=e26] [cursor=pointer]
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e29]: 计算 · 同类新题
      - button "先暂停" [ref=e30] [cursor=pointer]
    - generic [ref=e34]:
      - generic [ref=e35]: 只专注这一小步
      - heading "再观察一个小步骤" [level=1] [ref=e36]
      - paragraph [ref=e37]: 化简：12x − (9x − 8)
    - generic [ref=e39]:
      - generic [ref=e40]:
        - text: 写下你的答案或关键一步
        - textbox "你的解题步骤" [ref=e41]:
          - /placeholder: 写化简结果，也可用 = 连接等式步骤…
          - text: "0"
      - generic [ref=e42]:
        - button "−" [ref=e43] [cursor=pointer]
        - button "+" [ref=e44] [cursor=pointer]
        - button "(" [ref=e45] [cursor=pointer]
        - button ")" [ref=e46] [cursor=pointer]
        - button "x" [ref=e47] [cursor=pointer]
        - button "a" [ref=e48] [cursor=pointer]
        - button "=" [ref=e49] [cursor=pointer]
      - generic [ref=e50]:
        - button "给一点提示" [ref=e51] [cursor=pointer]
        - button "提交修改" [ref=e54] [cursor=pointer]
    - generic [ref=e57]:
      - generic [ref=e58]: 小N · AI · 基于这次作答
      - heading "先停在这一步，一起看看。" [level=3] [ref=e59]
      - paragraph [ref=e60]: 先观察去括号这一步，尤其是括号前的符号。你可以再试一次，或选择一级提示。
      - text: 上面的观察已提供线索；点击提示后会记录提示使用情况。
      - generic [ref=e61]:
        - paragraph [ref=e62]: 这次的新题还需要一点支持。可以先补一道题，专注同一个符号环节，不增加其他知识点。
        - button "换一题，先练这个小环节" [active] [ref=e63] [cursor=pointer]
    - group [ref=e64]:
      - generic "查看作答与提示记录 1 次尝试" [ref=e65] [cursor=pointer]:
        - text: 查看作答与提示记录
        - generic [ref=e66]: 1 次尝试
    - button "题目识别错了？重新核对" [ref=e67] [cursor=pointer]
    - paragraph [ref=e71]: 本次计算已打开 10/10 题 · 修改与重试不重复计题
  - navigation "主导航" [ref=e72]:
    - button [ref=e73] [cursor=pointer]
    - button [ref=e78] [cursor=pointer]
    - button [ref=e83] [cursor=pointer]
    - button [ref=e87] [cursor=pointer]
  - status [ref=e93]: 本次计算探索已达到 10 题上限。可以回看已有记录。
```

# Test source

```ts
  372 | });
  373 | test("10 聊天等待、暂停、恢复、断网失败、重试不重复消息", async ({ page }) => {
  374 |   await basic(page);
  375 |   await settings(page);
  376 |   await page
  377 |     .getByRole("switch", { name: "断网与失败演示", exact: true })
  378 |     .click();
  379 |   await page.getByRole("button", { name: "小N", exact: true }).click();
  380 |   await page.getByRole("button", { name: /先聊聊/ }).click();
  381 |   await page.getByLabel("对小N说").fill("这次考试让我有点难过。");
  382 |   await page.getByRole("button", { name: "发送", exact: true }).click();
  383 |   await expect(
  384 |     page.getByText("回复没有成功，上一条消息已保留。"),
  385 |   ).toBeVisible();
  386 |   await page.getByRole("button", { name: "恢复连接", exact: true }).click();
  387 |   await page.getByRole("button", { name: "重试回复", exact: true }).click();
  388 |   await page.getByRole("button", { name: "暂停回应", exact: false }).click();
  389 |   await expect(
  390 |     page.getByRole("button", { name: "恢复回应", exact: false }),
  391 |   ).toBeVisible();
  392 |   await page.getByRole("button", { name: "恢复回应", exact: false }).click();
  393 |   await expect(page.getByText(/听起来，这次考试让你有些难受/)).toBeVisible();
  394 |   expect(
  395 |     (await state(page)).chat.filter((m: { role: string }) => m.role === "user"),
  396 |   ).toHaveLength(1);
  397 |   await screenshot(page, "17-chat");
  398 | });
  399 | test("11 监护人信息申请范围、必要核验、处理中、结果", async ({ page }) => {
  400 |   await basic(page);
  401 |   await settings(page);
  402 |   await page.getByRole("button", { name: /监护人演示/ }).click();
  403 |   await page.getByLabel("申请范围").selectOption("涉及敏感内容的查阅请求");
  404 |   await page.getByRole("button", { name: "提交申请演示", exact: true }).click();
  405 |   await expect(page.getByText("等待必要核验", { exact: true })).toBeVisible();
  406 |   await page
  407 |     .getByRole("button", { name: "模拟完成必要核验", exact: true })
  408 |     .click();
  409 |   await expect(page.getByText("处理中", { exact: true })).toBeVisible();
  410 |   await expect(page.getByText("结果可查看", { exact: true })).toBeVisible();
  411 |   await expect(page.getByText(/没有直接展示敏感倾诉内容/)).toBeVisible();
  412 |   await screenshot(page, "18-guardian");
  413 | });
  414 | test("12 常见手机宽度、长文本、大字体与减少动效，无横向溢出", async ({
  415 |   page,
  416 | }) => {
  417 |   await basic(page);
  418 |   await settings(page);
  419 |   await page.getByRole("switch", { name: "大字体", exact: true }).click();
  420 |   await page.emulateMedia({ reducedMotion: "reduce" });
  421 |   for (const width of [320, 360, 390, 430]) {
  422 |     await page.setViewportSize({ width, height: 844 });
  423 |     for (const tab of ["小N", "探索", "今日", "成长"]) {
  424 |       await page.getByRole("button", { name: tab, exact: true }).click();
  425 |       expect(
  426 |         await page.evaluate(
  427 |           () => document.documentElement.scrollWidth <= innerWidth,
  428 |         ),
  429 |         `${width} ${tab}`,
  430 |       ).toBe(true);
  431 |     }
  432 |     await page.getByRole("button", { name: "小N", exact: true }).click();
  433 |     await page.getByRole("button", { name: /先聊聊/ }).click();
  434 |     await page
  435 |       .getByLabel("对小N说")
  436 |       .fill("这是用于检查换行的合成文本。".repeat(40));
  437 |     expect(
  438 |       await page.evaluate(
  439 |         () => document.documentElement.scrollWidth <= innerWidth,
  440 |       ),
  441 |       `${width} long`,
  442 |     ).toBe(true);
  443 |   }
  444 |   await page.setViewportSize({ width: 390, height: 844 });
  445 |   await page.getByRole("button", { name: "小N", exact: true }).click();
  446 |   expect(
  447 |     await page
  448 |       .locator(".floaty")
  449 |       .evaluate((e) => getComputedStyle(e).animationName),
  450 |   ).toBe("none");
  451 |   await screenshot(page, "19-large-reduced-motion");
  452 | });
  453 | test("13 错误后的补充题分支与10题上限经刷新仍生效", async ({ page }) => {
  454 |   await basic(page);
  455 |   await question(page);
  456 |   await page.getByRole("button", { name: "给一点提示", exact: true }).click();
  457 |   await page.getByLabel("你的解题步骤").fill("x+5");
  458 |   await page.getByRole("button", { name: "我先试试", exact: true }).click();
  459 |   await page
  460 |     .getByRole("button", { name: "用一道新题检验", exact: false })
  461 |     .click();
  462 |   for (let count = 2; count <= 10; count++) {
  463 |     await page.getByLabel("你的解题步骤").fill("0");
  464 |     await page.getByRole("button", { name: "我先试试", exact: true }).click();
  465 |     await expect(page.getByText("先停在这一步，一起看看。")).toBeVisible();
  466 |     await page
  467 |       .getByRole("button", { name: "换一题，先练这个小环节", exact: true })
  468 |       .click();
  469 |     if (count === 10) break;
  470 |   }
  471 |   expect((await state(page)).calcSeen).toHaveLength(10);
> 472 |   await expect(page.getByRole("status")).toContainText("10 题上限");
      |                                          ^ Error: expect(locator).toContainText(expected) failed
  473 |   await page.reload();
  474 |   expect((await state(page)).calcSeen).toHaveLength(10);
  475 |   await page
  476 |     .getByRole("button", { name: "换一题，先练这个小环节", exact: true })
  477 |     .click();
  478 |   expect((await state(page)).calcSeen).toHaveLength(10);
  479 | });
  480 | test("14 提交等待期间关闭长期记忆，迟到结果不追加长期条目", async ({
  481 |   page,
  482 | }) => {
  483 |   await basic(page);
  484 |   await settings(page);
  485 |   await page.getByRole("button", { name: /我的学习记忆/ }).click();
  486 |   await page
  487 |     .getByRole("switch", { name: "跨会话长期记忆", exact: true })
  488 |     .click();
  489 |   await page.getByRole("button", { name: "小N", exact: true }).click();
  490 |   await question(page);
  491 |   await page.getByLabel("你的解题步骤").fill("x+5");
  492 |   await page.getByRole("button", { name: "我先试试", exact: true }).click();
  493 |   await settings(page);
  494 |   await page.getByRole("button", { name: /我的学习记忆/ }).click();
  495 |   await page
  496 |     .getByRole("switch", { name: "跨会话长期记忆", exact: true })
  497 |     .click();
  498 |   await expect
  499 |     .poll(async () => (await state(page)).records.bracket.attempts.length)
  500 |     .toBe(1);
  501 |   expect((await state(page)).longMemory).toBe(false);
  502 |   expect(
  503 |     await page.evaluate(() =>
  504 |       JSON.parse(localStorage.getItem("xiaon-memory-v1") || "[]"),
  505 |     ),
  506 |   ).toHaveLength(0);
  507 | });
  508 | test("15 聊天中明确选择休息，后续回应和入口停止学习邀请", async ({ page }) => {
  509 |   await basic(page);
  510 |   await page.getByRole("button", { name: /先聊聊/ }).click();
  511 |   await page.getByLabel("对小N说").fill("今天先休息");
  512 |   await page.getByRole("button", { name: "发送", exact: true }).click();
  513 |   await expect(
  514 |     page.getByText("今天的任务提醒已暂停。你可以继续说说，不必开始任务。"),
  515 |   ).toBeVisible();
  516 |   await expect.poll(async () => (await state(page)).chatStatus).toBe("idle");
  517 |   await page.getByLabel("对小N说").fill("嗯，谢谢");
  518 |   await page.getByRole("button", { name: "发送", exact: true }).click();
  519 |   await expect(
  520 |     page.getByText("我在听。今天不用急着回到题目上。你还想说说什么？", {
  521 |       exact: true,
  522 |     }),
  523 |   ).toBeVisible();
  524 |   await expect(page.locator(".chat-invitation")).toHaveCount(0);
  525 | });
  526 | test("16 重新首次介绍保留进度，重置演示清空进度与图片", async ({ page }) => {
  527 |   await basic(page);
  528 |   await question(page);
  529 |   await page.getByLabel("你的解题步骤").fill("x+5");
  530 |   await page.getByRole("button", { name: "我先试试", exact: true }).click();
  531 |   await expect(page.getByText("这次，你独立完成了。")).toBeVisible();
  532 |   await settings(page);
  533 |   await page.getByRole("button", { name: /重新体验首次进入/ }).click();
  534 |   await expect(
  535 |     page.getByRole("heading", { name: "慢慢来， 也会到达。" }),
  536 |   ).toBeVisible();
  537 |   expect((await state(page)).calcSeen).toHaveLength(1);
  538 |   await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  539 |   await page
  540 |     .getByRole("button", { name: "继续，选择可选功能", exact: true })
  541 |     .click();
  542 |   await page
  543 |     .getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true })
  544 |     .click();
  545 |   await settings(page);
  546 |   await page.getByRole("button", { name: /重置整个演示/ }).click();
  547 |   await page
  548 |     .getByRole("button", { name: "确认清空本机演示", exact: true })
  549 |     .click();
  550 |   await expect(
  551 |     page.getByRole("heading", { name: "慢慢来， 也会到达。" }),
  552 |   ).toBeVisible();
  553 |   expect((await state(page)).calcSeen).toHaveLength(0);
  554 |   expect((await state(page)).records).toEqual({});
  555 |   expect(
  556 |     await page.evaluate(() => localStorage.getItem("xiaon-image-v1")),
  557 |   ).toBeNull();
  558 | });
  559 | 
```