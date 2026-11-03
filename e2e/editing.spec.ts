import { expect, test } from "@playwright/test";

const DOC = "/docs-zh-CN/main/快速入门/";

test.describe("就地编辑与控制台", () => {
  test("编辑此页在正文区内就地展开（不弹窗）", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: /编辑此页/ }).click();

    // 编辑工具条出现，且没有 modal dialog
    await expect(page.getByText("编辑模式")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 预览区仍是 .doc-content（与正式页面同一渲染）
    await expect(page.locator(".doc-content").first()).toBeVisible();
  });

  test("分栏模式显示源码与预览", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: /编辑此页/ }).click();
    await page.getByRole("button", { name: "分栏" }).click();
    await expect(page.getByRole("textbox", { name: "Markdown 源码" })).toBeVisible();
  });

  test("源码修改实时反映到预览", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: /编辑此页/ }).click();
    await page.getByRole("button", { name: "分栏" }).click();

    const textarea = page.getByRole("textbox", { name: "Markdown 源码" });
    await textarea.fill("# 实时预览测试\n\n这是一段新内容。");
    await expect(page.locator(".doc-content").first()).toContainText("这是一段新内容", {
      timeout: 10_000,
    });
  });

  test("侧栏右键出现管理菜单", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: /编辑此页/ }).click();

    const folder = page.locator("aside[aria-label='文档侧栏'] a").first();
    await folder.click({ button: "right" });
    const menu = page.locator("[data-context-menu]");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "复制链接" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "在此新建文档" })).toBeVisible();
  });

  test("正文右键可复制链接与编辑", async ({ page }) => {
    await page.goto(DOC);
    // 标题内的锚点 <a>，右键应给出标题链接菜单
    await page.locator(".doc-content h2").first().click({ button: "right" });
    const menu = page.locator("[data-context-menu]");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /复制此标题的链接|复制本页链接/ }),
    ).toBeVisible();
  });

  test("控制台未登录时展示连接入口", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "控制台" })).toBeVisible();
    await expect(page.getByLabel("GitHub Personal Access Token")).toBeVisible();
  });

  test("首页包含 Hero、文档入口与代码演示", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("EasyDocument");
    await expect(page.getByRole("heading", { name: "文档", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "同一套渲染管线" })).toBeVisible();
  });

  test("首页代码演示区渲染出 KaTeX 与提示框", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".doc-content .katex").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".doc-content .callout").first()).toBeVisible();
  });
});
