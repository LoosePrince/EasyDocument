import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, resolveConfig } from "./schema";
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
