import { describe, expect, it } from "vitest";
import { buildLegacyHashScript, parseLegacyHash, resolveLegacyHash } from "./legacy-hash";

const VERSIONS = ["main", "1.3.4"];

describe("parseLegacyHash", () => {
  it("解析纯路径", () => {
    expect(parseLegacyHash("/使用指南/目录结构")).toEqual({
      version: undefined,
      path: "使用指南/目录结构",
      anchor: undefined,
    });
  });

  it("解析 版本/#/路径", () => {
    expect(parseLegacyHash("1.3.4/#/指南/安装")).toEqual({
      version: "1.3.4",
      path: "指南/安装",
      anchor: undefined,
    });
  });

  it("解析 版本/#路径（无斜杠）", () => {
    expect(parseLegacyHash("main/#快速入门")).toEqual({
      version: "main",
      path: "快速入门",
      anchor: undefined,
    });
  });

  it("路径里的锚点", () => {
    expect(parseLegacyHash("/使用指南#常见问题")).toEqual({
      version: undefined,
      path: "使用指南",
      anchor: "常见问题",
    });
  });

  it("空 hash 返回 null", () => {
    expect(parseLegacyHash("")).toBeNull();
    expect(parseLegacyHash("#")).toBeNull();
  });
});

describe("resolveLegacyHash", () => {
  it("pathname 带版本 + hash 路径", () => {
    expect(resolveLegacyHash("/main/", "#/使用指南/目录结构", VERSIONS)).toEqual({
      target: "/docs/main/使用指南/目录结构",
      replace: true,
    });
  });

  it("pathname 带版本 + 无斜杠 hash", () => {
    expect(resolveLegacyHash("/main/", "#快速入门/", VERSIONS)).toEqual({
      target: "/docs/main/快速入门",
      replace: true,
    });
  });

  it("pathname 版本 + hash 内版本（后者优先）", () => {
    expect(resolveLegacyHash("/main/", "#1.3.4/#/指南", VERSIONS)).toEqual({
      target: "/docs/1.3.4/指南",
      replace: true,
    });
  });

  it("pathname 版本 + 空 hash 回退到 pathname 路径", () => {
    // `/main/使用指南/` 本身就是「版本 + 路径」的旧写法
    expect(resolveLegacyHash("/main/使用指南/", "#/", VERSIONS)).toMatchObject({
      target: "/docs/main/使用指南",
    });
  });

  it("首页 hash 带版本", () => {
    expect(resolveLegacyHash("/", "#/main/使用指南", VERSIONS)).toEqual({
      target: "/docs/main/使用指南",
      replace: true,
    });
  });

  it("去掉扩展名", () => {
    expect(resolveLegacyHash("/main/", "#/使用指南/README.md", VERSIONS)).toEqual({
      target: "/docs/main/使用指南/README",
      replace: true,
    });
  });

  it("保留锚点", () => {
    expect(resolveLegacyHash("/main/", "#/使用指南#常见问题", VERSIONS)).toEqual({
      target: "/docs/main/使用指南#常见问题",
      replace: true,
    });
  });

  it("新路径不动", () => {
    expect(resolveLegacyHash("/docs/main/使用指南", "#/x", VERSIONS)).toBeNull();
  });

  it("未知版本不动", () => {
    expect(resolveLegacyHash("/other/", "#/使用指南", VERSIONS)).toBeNull();
  });

  it("没有 hash 不动", () => {
    expect(resolveLegacyHash("/main/", "", VERSIONS)).toBeNull();
  });

  it("百分号编码的路径", () => {
    expect(
      resolveLegacyHash("/main/", `#${encodeURIComponent("/使用指南")}`, VERSIONS),
    ).toEqual({ target: "/docs/main/使用指南", replace: true });
  });
});

describe("buildLegacyHashScript", () => {
  it("内嵌版本列表与 base", () => {
    const script = buildLegacyHashScript(VERSIONS, "/sub");
    expect(script).toContain('["main","1.3.4"]');
    expect(script).toContain('"/sub"');
  });

  it("脚本语法有效", () => {
    const script = buildLegacyHashScript(VERSIONS);
    expect(() => new Function(script)).not.toThrow();
  });
});
