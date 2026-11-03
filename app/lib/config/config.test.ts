import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, resolveConfig, resolveConfigForLanguage } from "./schema";
import { evaluateConfigModule, stringifyConfigModule } from "./evaluate";

describe("resolveConfig", () => {
  it("空配置时补齐全部默认值", () => {
    const { config } = resolveConfig({});
    expect(config.site.name).toBe("EasyDocument");
    expect(config.document.default_branch).toBe("main");
    expect(config.document.index_pages).toContain("README.md");
    expect(config.navigation.folder_expand_mode).toBe(5);
    expect(config.animation.enable).toBe(true);
    expect(config.search.enable).toBe(true);
    expect(config.admin.enable).toBe(true);
  });

  it("保留用户配置并深度合并嵌套对象", () => {
    const { config } = resolveConfig({
      site: { name: "我的文档" },
      animation: { sidebar: { stagger_delay: 80 } },
    });
    expect(config.site.name).toBe("我的文档");
    expect(config.site.title).toBe("EasyDocument"); // 默认值仍在
    expect(config.animation.sidebar.stagger_delay).toBe(80);
    expect(config.animation.sidebar.duration).toBe(200);
  });

  it("folder_expand_mode 越界时回落并给出警告", () => {
    const { config, warnings } = resolveConfig({ navigation: { folder_expand_mode: 9 } });
    expect(config.navigation.folder_expand_mode).toBe(5);
    expect(warnings.some((warning) => warning.includes("folder_expand_mode"))).toBe(true);
  });

  it("toc_depth 非法时回落为 3", () => {
    const { config } = resolveConfig({ document: { toc_depth: 0 } });
    expect(config.document.toc_depth).toBe(3);
  });

  it("未知字段不报错（passthrough）", () => {
    const { warnings } = resolveConfig({ unknown_section: { foo: "bar" } });
    expect(warnings).toEqual([]);
  });

  it("locales 按站点语言覆盖配置，数组整体替换", () => {
    const raw = {
      site: { name: "中文站", title: "中文标题" },
      navigation: {
        nav_links: [{ text: "文档", url: "/docs-zh-CN/main" }],
      },
      home: { hero: { subtitle: "中文副标题", badge: "中文徽章" } },
      locales: {
        en: {
          site: { title: "English title" },
          navigation: {
            nav_links: [{ text: "Docs", url: "/docs-en/main" }],
          },
          home: { hero: { subtitle: "English subtitle" } },
        },
      },
    };

    const base = resolveConfig(raw).config;
    expect(base.site.name).toBe("中文站");
    expect(base.site.title).toBe("中文标题");
    expect(base.home.hero.badge).toBe("中文徽章");

    const en = resolveConfigForLanguage(raw, "en").config;
    expect(en.site.name).toBe("中文站"); // 未覆盖字段沿用基础配置
    expect(en.site.title).toBe("English title");
    expect(en.home.hero.subtitle).toBe("English subtitle");
    expect(en.home.hero.badge).toBe("中文徽章");
    expect(en.navigation.nav_links).toEqual([{ text: "Docs", url: "/docs-en/main" }]);
  });
});

describe("normalizeBaseUrl", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/docs", "/docs"],
    ["/docs/", "/docs"],
    ["docs", "/docs"],
    ["//sub//", "/sub"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });
});

describe("evaluateConfigModule", () => {
  it("解析 legacy 形态的 config.js", () => {
    const source = `
      const config = {
        site: { name: "Legacy" },
        document: { default_branch: "main" }
      };
      export default config;
    `;
    const result = evaluateConfigModule(source) as { site: { name: string } };
    expect(result.site.name).toBe("Legacy");
  });

  it("支持直接 export default 对象字面量", () => {
    const result = evaluateConfigModule(`export default { site: { name: "Inline" } };`) as {
      site: { name: string };
    };
    expect(result.site.name).toBe("Inline");
  });

  it("语法错误时回落到空对象而不抛错", () => {
    const result = evaluateConfigModule(`const config = { broken`, { fallback: { ok: true } });
    expect(result).toEqual({ ok: true });
  });

  it("忽略 import 语句", () => {
    const result = evaluateConfigModule(
      `import x from "y";\nconst config = { site: { name: "A" } };\nexport default config;`,
    ) as { site: { name: string } };
    expect(result.site.name).toBe("A");
  });
});

describe("stringifyConfigModule", () => {
  it("往返序列化后仍可求值", () => {
    const original = {
      site: { name: "往返", base_url: "/sub" },
      document: { index_pages: ["README.md"] },
    };
    const text = stringifyConfigModule(original);
    expect(text).toContain("export default config");
    const parsed = evaluateConfigModule(text);
    expect(parsed).toEqual(original);
  });

  it("输出合法 JS（无带引号的键名）", () => {
    const text = stringifyConfigModule({ site: { name: "x" } });
    expect(text).toContain("site:");
    expect(text).not.toContain('"site":');
  });
});
