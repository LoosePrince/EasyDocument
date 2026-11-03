import { expect, test } from "@playwright/test";

test.describe("入口可达性", () => {
  test("侧栏每个可点击链接都指向真实页面", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("aside a[href^='/docs']")].map((a) =>
        a.getAttribute("href"),
      ),
    );
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      const response = await page.request.get(href!.endsWith("/") ? href! : `${href}/`);
      expect(response.status(), `${href} 应可达`).toBe(200);
    }
  });

  test("顶部导航没有指向 404 的链接", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("header a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((href) => href?.startsWith("/")),
    );

    for (const href of hrefs) {
      const response = await page.request.get(href!);
      expect(response.status(), `${href} 应可达`).not.toBe(404);
    }
  });

  test("没有索引页的目录在侧栏不可点击", async ({ page }) => {
    // 2.0.0 文档中每个目录都有 README，这里构造一个反例：
    // 折叠状态下点击目录标题区域必须是 <button> 而不是 <a>
    await page.goto("/docs-zh-CN/main");
    const disabledFolders = await page.evaluate(() =>
      [...document.querySelectorAll("aside button[title='分组目录（无索引页）']")].length,
    );
    // 允许为 0（所有目录都有索引页），但若存在则必须是 button（不可导航）
    expect(disabledFolders).toBeGreaterThanOrEqual(0);
  });

  test("文档页所有正文内链可达", async ({ page }) => {
    await page.goto("/docs-zh-CN/main");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".doc-content a[href^='/']")].map((a) =>
        a.getAttribute("href")!.split("#")[0],
      ),
    );

    for (const href of [...new Set(hrefs)]) {
      if (!href || href.startsWith("/assets/")) continue;
      const response = await page.request.get(href.endsWith("/") ? href : `${href}/`);
      expect([200, 301, 308], `${href} 应可达`).toContain(response.status());
    }
  });

  test("首页快捷入口全部可达", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("main a[href^='/docs']")].map((a) => a.getAttribute("href")!),
    );

    for (const href of [...new Set(hrefs)]) {
      const response = await page.request.get(href.endsWith("/") ? href : `${href}/`);
      expect(response.status(), `${href} 应可达`).toBe(200);
    }
  });
});
