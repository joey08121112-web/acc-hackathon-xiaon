import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoTab, passOnboarding } from "./onboarding";
test("四个主页面的 WCAG A/AA 自动检查", async ({ page }) => {
  await passOnboarding(page);
  // 底部导航现在是：小N / 专业模式 / 今日 / 成长。
  // （旧 spec 写的是「探索」，首页改版后那一站改名叫「专业模式」了。）
  for (const tab of ["小N", "专业模式", "今日", "成长"]) {
    await gotoTab(page, tab);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect
      .soft(
        report.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        tab,
      )
      .toEqual([]);
  }
});
