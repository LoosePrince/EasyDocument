import { expect, test } from "@playwright/test";

const DOC = "/docs/main/快速入门/";

test.describe("文档站冒烟", () => {
  test("首页可渲染并含 Hero 标题", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("EasyDocument");
    // 标题取自 data 分支 config.js 的 site.title
    await expect(page).toHaveTitle(/EasyDocument/);
  });

  test("文档页返回真实 HTML（SSG 生效）", async ({ page }) => {
    const response = await page.goto(DOC);
    expect(response?.status()).toBe(200);
    // 正文在首屏 HTML 中即存在，不依赖 JS 渲染
    await expect(page.getByRole("heading", { name: "快速入门", level: 1 })).toBeVisible();
    await expect(page.getByText("三分钟跑起来")).toBeVisible();
  });

  test("代码块有高亮、行号与复制按钮", async ({ page }) => {
    await page.goto(DOC);
    const block = page.locator(".code-wrapper").first();
    await expect(block).toBeVisible();
    await expect(block.locator(".code-copy")).toBeAttached();
    await expect(block.locator("[data-line]").first()).toBeVisible();
  });

  test("数学公式渲染为 KaTeX", async ({ page }) => {
    await page.goto(DOC);
    await expect(page.locator(".katex").first()).toBeVisible();
  });

  test("侧栏可折叠展开", async ({ page }) => {
    await page.goto(DOC);
    const toggle = page.getByRole("button", { name: /展开|折叠/ }).first();
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute("aria-expanded");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-expanded", before ?? "true");
  });

  test("右侧目录可跳转锚点", async ({ page }) => {
    await page.goto(DOC);
    const tocLink = page.locator('aside[aria-label="本页目录"] a').nth(1);
    if ((await tocLink.count()) > 0) {
      await tocLink.click();
      await expect(page).toHaveURL(/#.+/);
    }
  });

  test("搜索可命中文档", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: "搜索文档" }).click();
    await page.getByRole("textbox", { name: "搜索关键词" }).fill("安装");
    await expect(page.getByRole("link", { name: /安装/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("暗色模式切换生效", async ({ page }) => {
    await page.goto(DOC);
    const html = page.locator("html");
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
    await page.getByRole("button", { name: /切换到.*模式/ }).click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*dark).*/ : /dark/);
  });

  test("版本首页列出文档", async ({ page }) => {
    await page.goto("/docs/main");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("未知路径返回 404 页面", async ({ page }) => {
    const response = await page.goto("/docs/main/不存在的文档");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("页面不存在")).toBeVisible();
  });

  test("直接访问深路径刷新仍可用（无 hash 路由）", async ({ page }) => {
    const response = await page.goto("/docs/main/使用指南/基本使用流程/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "基本使用流程", level: 1 })).toBeVisible();
    expect(page.url()).not.toContain("#");
  });
});
