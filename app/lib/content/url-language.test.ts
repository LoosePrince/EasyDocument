import { describe, expect, it } from "vitest";
import { docUrlPath, parseDocsUrl } from "./routes";
import type { ResolvedConfig } from "~/lib/config/types";

const I18N = {
  enable: true,
  ui: true,
  switcher: true,
  default_language: "zh-CN",
  site_languages: [
    { code: "zh-CN", label: "中文" },
    { code: "en", label: "English" },
  ],
  languages: [
    { code: "zh-CN", label: "中文", dir: "zh", suffix: "zh" },
    { code: "en", label: "English", dir: "en", suffix: "en" },
  ],
  document_languages: [
    { code: "zh-CN", label: "中文", dir: "zh", suffix: "zh" },
    { code: "en", label: "English", dir: "en", suffix: "en" },
  ],
  default_document_language: "zh-CN",
  document_mode: "auto" as const,
};

const CONFIG = {
  site: { base_url: "/" },
  i18n: I18N,
} as unknown as Pick<ResolvedConfig, "site" | "i18n">;

describe("v2.0.2 文档 URL", () => {
  it("语言段是文档语言：/docs-{documentLanguage}/", () => {
    expect(docUrlPath({ branch: "main", path: "使用指南", documentLanguage: "zh-CN" })).toBe(
      "/docs-zh-CN/main/使用指南",
    );
    expect(docUrlPath({ branch: "main", path: "", documentLanguage: "en" })).toBe("/docs-en/main");
  });

  it("站点语言不进入 URL", () => {
    expect(docUrlPath({ branch: "main", path: "使用指南", documentLanguage: "en" })).toBe(
      "/docs-en/main/使用指南",
    );
    expect(docUrlPath({ branch: "main", path: "使用指南" })).toBe("/docs/main/使用指南");
  });

  it("解析新地址的文档语言", () => {
    expect(parseDocsUrl("/docs-zh-CN/main/使用指南", CONFIG)).toMatchObject({
      branch: "main",
      documentLanguage: "zh-CN",
      explicitDocumentLanguage: true,
      path: "使用指南",
      legacy: false,
    });
    expect(parseDocsUrl("/docs-en/main/使用指南", CONFIG)).toMatchObject({
      documentLanguage: "en",
      path: "使用指南",
    });
  });

  it("旧地址回落到默认文档语言", () => {
    expect(parseDocsUrl("/docs/main/使用指南", CONFIG)).toMatchObject({
      branch: "main",
      documentLanguage: "zh-CN",
      legacy: true,
      path: "使用指南",
    });
  });
});
