import { expect, type Page } from "@playwright/test";

/**
 * 走完首次进入的引导。
 *
 * 2026-11-21 修复（重要）：
 * 旧 spec 走的是三步流程「认识一下小N → 选年龄段 → 勾选同意 → 继续，选择可选功能 →
 * 关闭可选功能，进入基本体验」，但 c88970d「精简登录与首次权限引导流程」已经把引导改成单屏
 * （昵称 + 年级 chip + 两个记忆开关 + 一个「开始和小N聊」按钮）。
 * spec 没跟着改 → 每条用例第一步就找不到按钮 → 45 秒超时 → **整条 Playwright 套件全红**。
 * 这里只改「怎么进得去」，不动每条用例要断言的行为。
 *
 * addInitScript 故意关掉 crypto.randomUUID —— 它模拟「局域网 http:// 访问」这个**非安全上下文**
 * （该场景下 randomUUID 根本不存在）。
 * 2026-11-21 实测：改版之前这个模拟会让引导直接失败（app 侧 newOperationId() 没有兜底，
 * 已修，见 src/agent-client/index.ts 的 localId）。**保留这个模拟是有意的** ——
 * 局域网访问是真实交付场景，得一直有人盯着，不能等改版把它冲掉。
 */
export async function passOnboarding(p: Page) {
  // Exercise the same local-ID fallback needed by plain HTTP LAN previews.
  await p.addInitScript(() => { Object.defineProperty(crypto, "randomUUID", { value: undefined }); });
  await p.goto("/");
  await p.getByRole("button", { name: "开始和小N聊", exact: true }).click();
  // 引导完成的信号：底部导航的「我的与设置」出现（引导页没有它）。
  await expect(p.getByRole("button", { name: "我的与设置", exact: true })).toBeVisible();
}

/**
 * 切到底部导航的某一页。
 *
 * 首页改成语音聊天式之后，底部导航收进了「下拉或点此查看聊天记录」抽屉里 ——
 * 页签按钮不再常驻可见（2026-11-21 实测）。旧 spec 直接点「探索/今日/成长」，
 * 现在这些按钮要先展开抽屉才拿得到。
 *
 * 页签名也跟着改了：「探索」→「专业模式」。
 */
export async function gotoTab(p: Page, tab: string) {
  const target = p.getByRole("button", { name: tab, exact: true }).first();
  if (!(await target.isVisible())) {
    await p.getByRole("button", { name: /下拉或点此查看聊天记录/ }).click();
    await expect(target).toBeVisible();
  }
  await target.click();
}
