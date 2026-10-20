import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("四个主页面的 WCAG A/AA 自动检查", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "认识一下小N", exact: true }).click();
  await page
    .getByRole("combobox", { name: "年龄段", exact: true })
    .selectOption("14-17");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "继续，选择可选功能", exact: true })
    .click();
  await page
    .getByRole("button", { name: "关闭可选功能，进入基本体验", exact: true })
    .click();
  for (const tab of ["小N", "探索", "今日", "成长"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
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
