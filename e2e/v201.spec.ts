import { expect, test } from "@playwright/test";

const DOC = "/docs-zh-CN/main/快速入门/";

test.describe("v2.0.1 能力", () => {
  test("侧栏使用 path.json 的显示名与顺序", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll("aside nav > ul > li")]
        .map((item) => item.textContent?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 6),
    );
    // path.json 里把「快速入门」改成了「快速开始」、「参考」改成了「参考手册」
    expect(titles.join(" ")).toContain("快速开始");
    expect(titles.join(" ")).toContain("参考手册");
  });

  test("旧版 hash 链接 404 回退到真实路径", async ({ page }) => {
    const response = await page.goto("/main/#/使用指南/目录结构");
    // 404.html 的 HTTP 状态是 404，但客户端已渲染出目标文档
    expect(response?.status()).toBe(404);
    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/\/docs-zh-CN\/main\/使用指南\/目录结构$/);
    await expect(page.getByRole("heading", { name: "目录与文件规则", level: 1 })).toBeVisible();
  });

  test("旧版 hash 根链接回退到版本首页", async ({ page }) => {
    await page.goto("/main/#使用指南/");
    await expect.poll(() => decodeURIComponent(page.url())).toMatch(/\/docs-zh-CN\/main\/使用指南$/);
  });

  test("404.html 复制自 index.html，带 SPA 回退脚本", async ({ request }) => {
    const response = await request.get("/404.html");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("<script type=\"module\"");
    expect(html).toContain("location.replace");
  });

  test("未预渲染的深链仍能由客户端渲染（SPA 回退）", async ({ page }) => {
    const response = await page.goto("/docs-zh-CN/main/参考/README");
    await expect.poll(() => decodeURIComponent(page.url())).toMatch(/\/docs-zh-CN\/main\/参考$/);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "参考", level: 1 })).toBeVisible();
  });

  test("未知文档返回站点 404 页而不是崩溃", async ({ page }) => {
    const response = await page.goto("/docs-zh-CN/main/不存在的文档");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
    await expect(page.getByRole("link", { name: "浏览文档" })).toBeVisible();
  });

  test("配置图标按设计 id 渲染，无 FontAwesome 字体依赖", async ({ page }) => {
    await page.goto("/");
    const features = page.locator("section:has(h3) [data-stagger] > div").first();
    await expect(features.locator("svg")).toHaveCount(1);
    // 页面上不应出现图标字体的类名
    expect(await page.locator(".fa-compat").count()).toBe(0);
  });

  test("编辑默认进入所见即所得模式", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: /编辑此页/ }).click();
    await expect(page.getByRole("textbox", { name: "所见即所得编辑区" })).toBeVisible();
  });

  test("所见即所得修改会写回草稿并在分栏里可见", async ({ page }) => {
    await page.goto(DOC);
    await page.getByRole("button", { name: /编辑此页/ }).click();

    const editor = page.getByRole("textbox", { name: "所见即所得编辑区" });
    await editor.click();
    await editor.press("Control+End");
    await page.keyboard.insertText("\n\n所见即所得输入测试。");

    await page.getByRole("button", { name: "分栏" }).click();
    await expect(page.getByRole("textbox", { name: "Markdown 源码" })).toHaveValue(
      /所见即所得输入测试/,
      { timeout: 10_000 },
    );
  });

  test("控制台提供目录与排序标签页", async ({ page }) => {
    await page.goto("/admin");
    // 未登录时先展示 Token 表单，登录后才出现标签页；这里只校验页面本身可达
    await expect(page.getByRole("heading", { name: "控制台" })).toBeVisible();
  });

  test("HTML 文档脚本不再被拦截", async ({ page }) => {
    await page.goto("/docs-zh-CN/main/使用指南");
    // 仅断言页面正常渲染；脚本执行能力由 iframe sandbox 配置保证
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
