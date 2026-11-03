import { describe, expect, it } from "vitest";
import {
  detectDocumentLanguage,
  languageUrlSegment,
  parseLanguageSegments,
  toSourcePath,
} from "./language";
import type { ResolvedI18n } from "./language";

const I18N: ResolvedI18n = {
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
  document_mode: "auto",
};

describe("多语言文档识别", () => {
  it("语言文件夹", () => {
    expect(detectDocumentLanguage("en/使用指南/README.md", I18N)).toEqual({
      language: "en",
      logicalPath: "使用指南/README.md",
      marked: true,
    });
    expect(detectDocumentLanguage("zh/README.md", I18N)).toEqual({
      language: "zh-CN",
      logicalPath: "README.md",
      marked: true,
    });
  });

  it("文件二级后缀", () => {
    expect(detectDocumentLanguage("使用指南/README.en.md", I18N)).toEqual({
      language: "en",
      logicalPath: "使用指南/README.md",
      marked: true,
    });
    expect(detectDocumentLanguage("index.zh.html", I18N)).toEqual({
      language: "zh-CN",
      logicalPath: "index.html",
      marked: true,
    });
  });

  it("无标记文件属于默认语言", () => {
    expect(detectDocumentLanguage("使用指南/README.md", I18N)).toEqual({
      language: "zh-CN",
      logicalPath: "使用指南/README.md",
      marked: false,
    });
  });

  it("关闭多语言文档时不识别标记", () => {
    expect(
      detectDocumentLanguage("en/README.md", { ...I18N, document_mode: "off" }),
    ).toEqual({ language: "zh-CN", logicalPath: "en/README.md", marked: false });
  });

  it("解析 URL 语言段，默认语言省略", () => {
    expect(parseLanguageSegments(["en", "使用指南"], I18N)).toEqual({
      language: "en",
      rest: ["使用指南"],
      explicit: true,
    });
    expect(parseLanguageSegments(["使用指南"], I18N)).toEqual({
      language: "zh-CN",
      rest: ["使用指南"],
      explicit: false,
    });
    expect(languageUrlSegment("zh-CN", I18N)).toBe("");
    expect(languageUrlSegment("en", I18N)).toBe("en");
  });

  it("生成实际文件路径：非默认语言加文件夹或后缀", () => {
    expect(toSourcePath("使用指南/README.md", "en", I18N)).toBe("en/使用指南/README.md");
    expect(
      toSourcePath("使用指南/README.md", "en", { ...I18N, document_mode: "suffix" }),
    ).toBe("使用指南/README.en.md");
    expect(toSourcePath("使用指南/README.md", "zh-CN", I18N)).toBe("使用指南/README.md");
  });
});
