import { describe, expect, it } from "vitest";
import {
  mergePathConfigs,
  normalizeConfigPath,
  parsePathConfig,
  reorderSiblings,
  serializePathConfig,
} from "./path-config";
import { buildDocsTree } from "./tree";

const INDEX_PAGES = ["README.md", "index.md"];
const EXTS = [".md", ".html"];

const FILES = [
  { path: "README.md", title: "首页" },
  { path: "快速入门/README.md", title: "快速入门" },
  { path: "使用指南/README.md", title: "使用指南" },
  { path: "使用指南/目录结构.md", title: "目录结构" },
  { path: "参考/README.md", title: "参考" },
];

describe("normalizeConfigPath", () => {
  it("去掉扩展名与首尾斜杠", () => {
    expect(normalizeConfigPath("/使用指南/README.md/")).toBe("使用指南/README");
    expect(normalizeConfigPath("./参考")).toBe("参考");
    expect(normalizeConfigPath("")).toBe("");
  });

  it("保留目录名里的点", () => {
    expect(normalizeConfigPath("v1.2.3/说明")).toBe("v1.2.3/说明");
  });
});

describe("parsePathConfig", () => {
  it("读取显示名与数组顺序", () => {
    const config = parsePathConfig({
      title: "首页",
      children: [
        { path: "使用指南", title: "使用手册" },
        { path: "快速入门" },
      ],
    });

    expect(config.rootTitle).toBe("首页");
    expect(config.overrides.get("使用指南")?.title).toBe("使用手册");
    expect(config.overrides.get("使用指南")?.order).toBe(0);
    expect(config.overrides.get("快速入门")?.order).toBe(1);
  });

  it("兼容嵌套 path.json（legacy 结构）", () => {
    const config = parsePathConfig({
      children: [
        {
          path: "使用指南",
          children: [{ path: "使用指南/目录结构.md", title: "结构" }],
        },
      ],
    });

    expect(config.overrides.get("使用指南/目录结构")?.title).toBe("结构");
    expect(config.overrides.get("使用指南")?.order).toBe(0);
  });

  it("索引页的显示名同时作用于目录", () => {
    const config = parsePathConfig({
      children: [{ path: "参考", index: { path: "参考/README.md" }, title: "参考手册" }],
    });
    expect(config.overrides.get("参考/README")?.title).toBe("参考手册");
    expect(config.overrides.get("参考")?.title).toBe("参考手册");
  });

  it("识别外部挂载", () => {
    const config = parsePathConfig({
      children: [
        {
          path: "外部",
          title: "外部文档",
          external: { mode: "github_tree", url: "https://github.com/o/r/tree/main/docs" },
        },
      ],
    });
    expect(config.mounts).toEqual([
      {
        path: "外部",
        mode: "github_tree",
        url: "https://github.com/o/r/tree/main/docs",
        title: "外部文档",
      },
    ]);
  });

  it("忽略非法的挂载声明", () => {
    const config = parsePathConfig({
      children: [{ path: "x", external: { mode: "ftp", url: "x" } }],
    });
    expect(config.mounts).toHaveLength(0);
  });

  it("版本目录下的 path.json 不把顶层当根", () => {
    const config = parsePathConfig({ title: "版本首页", children: [] }, "main");
    expect(config.rootTitle).toBeUndefined();
  });

  it("translations 按文档语言覆盖显示名与图标", () => {
    const raw = {
      title: "首页",
      translations: { en: { title: "Home" } },
      children: [
        {
          path: "使用指南",
          title: "使用指南",
          icon: "book",
          translations: { en: { title: "User Guide", icon: "book-open" } },
        },
      ],
    };

    const zh = parsePathConfig(raw, undefined, "zh-CN", "zh-CN");
    expect(zh.rootTitle).toBe("首页");
    expect(zh.overrides.get("使用指南")?.title).toBe("使用指南");

    const en = parsePathConfig(raw, undefined, "en", "zh-CN");
    expect(en.rootTitle).toBe("Home");
    expect(en.overrides.get("使用指南")?.title).toBe("User Guide");
    expect(en.overrides.get("使用指南")?.icon).toBe("book-open");
  });
});

describe("mergePathConfigs", () => {
  it("后者覆盖显示名但保留先出现的顺序", () => {
    const a = parsePathConfig({ children: [{ path: "a", title: "A" }, { path: "b" }] });
    const b = parsePathConfig({ children: [{ path: "a", title: "A2" }] });
    const merged = mergePathConfigs([a, b]);

    expect(merged.overrides.get("a")?.title).toBe("A2");
    expect(merged.overrides.get("a")?.order).toBe(0);
    expect(merged.overrides.get("b")?.order).toBe(1);
  });

  it("挂载按路径去重", () => {
    const a = parsePathConfig({
      children: [{ path: "x", external: { mode: "path_json", url: "https://a/path.json" } }],
    });
    const b = parsePathConfig({
      children: [{ path: "x", external: { mode: "path_json", url: "https://b/path.json" } }],
    });
    const merged = mergePathConfigs([a, b]);
    expect(merged.mounts).toHaveLength(1);
    expect(merged.mounts[0].url).toBe("https://b/path.json");
  });
});

describe("buildDocsTree + 目录配置", () => {
  it("按配置顺序排列并使用显示名", () => {
    const config = parsePathConfig({
      children: [
        { path: "参考", title: "参考手册" },
        { path: "快速入门", title: "开始" },
        { path: "使用指南", title: "指南" },
      ],
    });

    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });

    // 配置数组顺序即展示顺序：参考 → 快速入门 → 使用指南
    expect(tree.children.map((node) => node.title)).toEqual(["参考手册", "开始", "指南"]);
    expect(tree.children.map((node) => node.path)).toEqual(["参考", "快速入门", "使用指南"]);
  });

  it("未在配置中出现的条目排在后面", () => {
    const config = parsePathConfig({ children: [{ path: "参考" }] });
    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });
    expect(tree.children[0].path).toBe("参考");
  });

  it("hidden 标记到节点上", () => {
    const config = parsePathConfig({ children: [{ path: "参考", hidden: true }] });
    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });
    expect(tree.children.find((node) => node.path === "参考")?.hidden).toBe(true);
  });

  it("文件也可以有显示名", () => {
    const config = parsePathConfig({
      children: [{ path: "使用指南/目录结构.md", title: "结构说明" }],
    });
    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });
    const guide = tree.children.find((node) => node.path === "使用指南");
    expect(guide?.children[0].title).toBe("结构说明");
  });

  it("未声明的挂载路径会创建占位目录", () => {
    const config = parsePathConfig({
      children: [{ path: "外部", external: { mode: "github_tree", url: "https://x" } }],
    });
    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });
    const external = tree.children.find((node) => node.path === "外部");
    expect(external?.mount).toEqual({ mode: "github_tree", url: "https://x" });
  });
});

describe("serializePathConfig", () => {
  it("保留顺序、显示名与外部挂载", () => {
    const config = parsePathConfig({
      children: [
        { path: "参考", title: "参考手册" },
        { path: "外部", external: { mode: "github_tree", url: "https://x" } },
      ],
    });
    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });

    const json = serializePathConfig(tree) as {
      title: string;
      children: Array<Record<string, unknown>>;
    };
    expect(json.title).toBe("首页");
    expect(json.children[0]).toMatchObject({ path: "参考", title: "参考手册" });
    const external = json.children.find((item) => item.path === "外部") as {
      external?: unknown;
    };
    expect(external.external).toEqual({ mode: "github_tree", url: "https://x" });
  });

  it("隐藏节点不写回", () => {
    const config = parsePathConfig({ children: [{ path: "参考", hidden: true }] });
    const tree = buildDocsTree(FILES, {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
      pathConfig: config,
    });
    const json = serializePathConfig(tree) as { children: Array<{ path: string }> };
    expect(json.children.some((item) => item.path === "参考")).toBe(false);
  });
});

describe("reorderSiblings", () => {
  const siblings = [{ path: "a" }, { path: "b" }, { path: "c" }];

  it("移到目标之前", () => {
    expect(reorderSiblings(siblings, "c", "a", "before").map((item) => item.path)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("移到目标之后", () => {
    expect(reorderSiblings(siblings, "a", "b", "after").map((item) => item.path)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("同一个节点或不存在时原样返回", () => {
    expect(reorderSiblings(siblings, "a", "a", "before")).toBe(siblings);
    expect(reorderSiblings(siblings, "x", "a", "before")).toBe(siblings);
  });
});
