import { expect, test } from "@playwright/test";

test.describe("v2.0.2 能力", () => {
  test("语言切换同时切换界面与文档语言", async ({ page }) => {
    await page.goto("/docs-zh-CN/main/使用指南");
    await page.getByRole("button", { name: "切换语言" }).click();
    await page.getByRole("option", { name: "English" }).first().click();

    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/\/docs-en\/main\/使用指南$/);
    await expect(page.getByRole("heading", { name: "User Guide", level: 1 })).toBeVisible();
    // 界面文案也已切换
    await expect(page.getByRole("button", { name: /Edit this page/ })).toBeVisible();
  });

  test("站点语言切换使用 locales 中的英文配置且不改变 URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "切换语言" }).click();
    await page.getByRole("option", { name: "English" }).first().click();

    await expect(page.getByText("Documentation separated from code")).toBeVisible();
    await expect(page.getByRole("link", { name: "Home", exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("旧 /docs 地址自动跳转到 /docs-语言/", async ({ page }) => {
    await page.goto("/docs/main/快速入门");
    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/\/docs-zh-CN\/main\/快速入门$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("从英文切回中文不会 404", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("easydocument:language", "en"));
    await page.goto("/docs-en/main/使用指南");
    await page.getByRole("button", { name: "Switch language" }).click();
    await page.getByRole("option", { name: "中文" }).first().click();

    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/\/docs-zh-CN\/main\/使用指南$/);
    await expect(page.getByRole("heading", { name: "使用指南", level: 1 })).toBeVisible();
  });

  test("可以单独选择文档语言，不改变站点语言", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    await page.getByRole("button", { name: "切换语言" }).click();
    // 第二个列表是文档语言
    await page.getByRole("option", { name: "English" }).nth(1).click();

    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/\/docs-en\/main$/);
    // 站点语言仍是中文
    await expect(page.getByRole("button", { name: /编辑此页/ })).toBeVisible();
  });

  test("未翻译的页面回落到默认语言并给出提示", async ({ page }) => {
    await page.goto("/docs-en/main/参考");
    await expect(page.getByRole("heading", { name: "参考", level: 1 })).toBeVisible();
    await expect(
      page.getByText("当前语言尚无对应译文，暂时显示默认语言内容。"),
    ).toBeVisible();
  });

  test("path.json translations 按文档语言显示目录名", async ({ page }) => {
    await page.goto("/docs-en/main");
    const nav = page.getByRole("navigation", { name: "文档导航" });
    await expect(nav.getByRole("link", { name: "Quick Start" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "User Guide" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reference" })).toBeVisible();
  });

  test("文档底部渲染 git 信息", async ({ page }) => {
    await page.goto("/docs-zh-CN/main/使用指南/目录结构");
    await expect(page.getByText("最后编辑于")).toBeVisible();
    await expect(page.getByText("贡献者")).toBeVisible();
    await expect(page.getByRole("link", { name: "在 GitHub 上编辑" })).toBeVisible();
  });

  test("只有 README 的目录不显示展开/折叠按钮", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    await expect(
      page.getByRole("button", { name: /展开 快速开始|折叠 快速开始/ }),
    ).toHaveCount(0);
    // 目录本身仍然可点击进入
    await expect(page.getByRole("link", { name: "快速开始", exact: true })).toBeVisible();
  });

  test("侧栏右键可以打开图标库弹窗", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    await page
      .getByRole("navigation", { name: "文档导航" })
      .getByRole("link", { name: "使用指南" })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "设置图标" }).click();
    await expect(page.getByRole("dialog", { name: "设置图标" })).toBeVisible();
    const search = page.getByPlaceholder("搜索图标…");
    await expect(search).toBeVisible();
    await search.fill("rocket");
    await page.getByRole("button", { name: "rocket" }).click();
    await expect(page.getByText("图标已更新（提交后生效）")).toBeVisible();

    const raw = await page.evaluate(() => localStorage.getItem("easydocument:path-config"));
    const draft = JSON.parse(raw ?? "{}") as Record<string, { content: string }>;
    const configJson = JSON.parse(draft.main.content) as {
      children: Array<{ path: string; icon?: string }>;
    };
    expect(configJson.children.find((item) => item.path === "使用指南")?.icon).toBe("rocket");
  });

  test("非点击跳转后侧栏当前项会被展开并滚入视野", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    await page.getByRole("button", { name: "搜索文档" }).click();
    await page.getByRole("textbox", { name: "搜索关键词" }).fill("目录结构");
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /目录与文件规则/ })
      .first()
      .click();

    await expect
      .poll(() => decodeURIComponent(page.url()))
      .toMatch(/\/docs-zh-CN\/main\/使用指南\/目录结构$/);

    const active = page
      .getByRole("navigation", { name: "文档导航" })
      .locator('[aria-current="page"]');
    await expect(active).toBeVisible();
    await expect(active).toHaveAttribute("href", /目录结构/);
  });

  test("搜索可以命中英文文档", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    await page.getByRole("button", { name: "搜索文档" }).click();
    const input = page.getByRole("textbox", { name: "搜索关键词" });
    await input.fill("User Guide");
    await expect(page.getByText("User Guide", { exact: true })).toBeVisible();
    await expect(page.getByText("English").first()).toBeVisible();
  });
});
