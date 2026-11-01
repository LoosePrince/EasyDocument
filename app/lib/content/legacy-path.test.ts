import { describe, expect, it } from "vitest";
import { upgradeLegacyPath } from "./routes";

const VERSIONS = ["main", "1.3.4"];

describe("upgradeLegacyPath", () => {
  it("v1 的 main/ 导航链接 → 版本首页", () => {
    expect(upgradeLegacyPath("main/", VERSIONS)).toBe("/docs/main");
    expect(upgradeLegacyPath("/main/", VERSIONS)).toBe("/docs/main");
  });

  it("v1 的 main/#路径/ → 真实文档路径", () => {
    expect(upgradeLegacyPath("main/#快速入门/", VERSIONS)).toBe("/docs/main/快速入门");
    expect(upgradeLegacyPath("main/#/使用指南/README", VERSIONS)).toBe(
      "/docs/main/使用指南/README",
    );
    expect(upgradeLegacyPath("/main/#配置详解/", VERSIONS)).toBe("/docs/main/配置详解");
  });

  it("保留扩展名剥离", () => {
    expect(upgradeLegacyPath("main/#使用指南/README.md", VERSIONS)).toBe(
      "/docs/main/使用指南/README",
    );
  });

  it("其他版本同样改写", () => {
    expect(upgradeLegacyPath("1.3.4/#配置详解/", VERSIONS)).toBe("/docs/1.3.4/配置详解");
  });

  it("已是 v2 结构时原样返回", () => {
    expect(upgradeLegacyPath("/docs/main/x", VERSIONS)).toBe("/docs/main/x");
    expect(upgradeLegacyPath("docs/main", VERSIONS)).toBe("docs/main");
  });

  it("未知首段不改写（避免误伤）", () => {
    expect(upgradeLegacyPath("/about/", VERSIONS)).toBe("/about/");
    expect(upgradeLegacyPath("blog/post", VERSIONS)).toBe("blog/post");
  });

  it("外链与 mailto 原样返回", () => {
    expect(upgradeLegacyPath("https://example.com/main/", VERSIONS)).toBe(
      "https://example.com/main/",
    );
    expect(upgradeLegacyPath("//cdn.example.com/x", VERSIONS)).toBe("//cdn.example.com/x");
    expect(upgradeLegacyPath("mailto:a@b.c", VERSIONS)).toBe("mailto:a@b.c");
  });

  it("兼容 /data/ 前缀", () => {
    expect(upgradeLegacyPath("/data/main/#指南/", VERSIONS)).toBe("/docs/main/指南");
  });

  it("保留查询串", () => {
    expect(upgradeLegacyPath("main/?x=1", VERSIONS)).toBe("/docs/main?x=1");
  });

  it("空路径与版本列表为空时安全返回", () => {
    expect(upgradeLegacyPath("", VERSIONS)).toBe("");
    expect(upgradeLegacyPath("main/", [])).toBe("main/");
  });
});
