/**
 * 多语言文档识别（v2.0.2）
 *
 * 支持两种组织方式（可混用）：
 *
 *  1. 语言文件夹（folder）
 *     main/zh/使用指南/README.md
 *     main/en/使用指南/README.md
 *     → 语言 zh-CN / en，逻辑路径都是「使用指南/README.md」
 *
 *  2. 文件二级后缀（suffix）
 *     main/使用指南/README.zh.md
 *     main/使用指南/README.en.md
 *     → 语言 zh-CN / en，逻辑路径都是「使用指南/README.md」
 *
 * 语言标记作用在「版本目录内」的路径上；没有标记的文件属于默认语言。
 */
import type { ResolvedConfig } from "~/lib/config/types";

export type ResolvedI18n = ResolvedConfig["i18n"];
export type ResolvedLanguage = ResolvedI18n["languages"][number];

export interface DetectedLanguage {
  /** 语言代码 */
  language: string;
  /** 去掉语言标记后的逻辑路径（即侧栏与 URL 使用的路径） */
  logicalPath: string;
  /** 是否显式带了语言标记 */
  marked: boolean;
}

export interface LanguageRouteInfo {
  language: string;
  /** 去掉语言段后的剩余路径段 */
  rest: string[];
  /** 是否在 URL 里显式写了语言段（含默认语言） */
  explicit: boolean;
}

const DEFAULT_I18N: ResolvedI18n = {
  enable: false,
  ui: false,
  switcher: false,
  default_language: "zh-CN",
  site_languages: [{ code: "zh-CN", label: "中文" }],
  languages: [{ code: "zh-CN", label: "中文", dir: "zh", suffix: "zh" }],
  document_languages: [{ code: "zh-CN", label: "中文", dir: "zh", suffix: "zh" }],
  default_document_language: "zh-CN",
  document_mode: "off",
};

function normalizeSlashes(path: string): string {
  return String(path ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

/** 按 code / dir / suffix 查语言 */
export function findLanguage(i18n: ResolvedI18n | undefined, value: string): ResolvedLanguage | undefined {
  const config = i18n ?? DEFAULT_I18N;
  const needle = String(value ?? "").trim().toLowerCase();
  if (!needle) return undefined;
  return config.languages.find(
    (lang) =>
      lang.code.toLowerCase() === needle ||
      lang.dir.toLowerCase() === needle ||
      lang.suffix.toLowerCase() === needle,
  );
}

/** 按 code / dir 查「文件夹语言」 */
function findFolderLanguage(
  i18n: ResolvedI18n | undefined,
  value: string,
): ResolvedLanguage | undefined {
  const config = i18n ?? DEFAULT_I18N;
  const needle = String(value ?? "").trim().toLowerCase();
  if (!needle) return undefined;
  return config.languages.find(
    (lang) => lang.dir.toLowerCase() === needle || lang.code.toLowerCase() === needle,
  );
}

/**
 * 识别一个版本内相对路径的语言标记。
 * 返回的 logicalPath 已去掉语言文件夹 / 二级后缀。
 */
export function detectDocumentLanguage(
  path: string,
  i18n: ResolvedI18n | undefined,
): DetectedLanguage {
  const config = i18n ?? DEFAULT_I18N;
  const clean = normalizeSlashes(path);
  if (!config.enable || config.document_mode === "off" || !clean) {
    return { language: config.default_language, logicalPath: clean, marked: false };
  }

  const segments = clean.split("/").filter(Boolean);

  // 1. 语言文件夹：版本根下第一段
  if (config.document_mode === "folder" || config.document_mode === "auto") {
    if (segments.length > 1) {
      const folderLang = findFolderLanguage(config, segments[0]);
      if (folderLang) {
        return {
          language: folderLang.code,
          logicalPath: segments.slice(1).join("/"),
          marked: true,
        };
      }
    }
  }

  // 2. 文件二级后缀：README.en.md / README_en.md
  if (config.document_mode === "suffix" || config.document_mode === "auto") {
    const fileName = segments[segments.length - 1] ?? "";
    const match = fileName.match(/^(.*?)[._-]([A-Za-z0-9_-]+)(\.(?:md|markdown|html?))$/i);
    if (match) {
      const suffixLang = config.languages.find(
        (lang) =>
          lang.suffix.toLowerCase() === match[2].toLowerCase() ||
          lang.code.toLowerCase() === match[2].toLowerCase(),
      );
      if (suffixLang) {
        const nextSegments = [...segments.slice(0, -1), `${match[1]}${match[3]}`];
        return {
          language: suffixLang.code,
          logicalPath: nextSegments.join("/"),
          marked: true,
        };
      }
    }
  }

  return { language: config.default_language, logicalPath: clean, marked: false };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 从 URL 路径段解析语言。
 * 第一段命中语言 code / dir 时视为语言段（默认语言也允许显式书写）。
 */
export function parseLanguageSegments(
  segments: string[],
  i18n: ResolvedI18n | undefined,
): LanguageRouteInfo {
  const config = i18n ?? DEFAULT_I18N;
  if (!config.enable || config.document_mode === "off" || segments.length === 0) {
    return { language: config.default_language, rest: segments, explicit: false };
  }

  const first = safeDecode(segments[0]);
  const lang = findLanguage(config, first);
  if (lang) {
    return { language: lang.code, rest: segments.slice(1), explicit: true };
  }
  return { language: config.default_language, rest: segments, explicit: false };
}

/** URL 中是否应出现语言段（默认语言省略，保持旧链接不变） */
export function languageUrlSegment(
  language: string | undefined,
  i18n: ResolvedI18n | undefined,
): string {
  const config = i18n ?? DEFAULT_I18N;
  if (!config.enable || !language || language === config.default_language) return "";
  const match = config.languages.find((lang) => lang.code === language);
  return match?.code ?? language;
}

/**
 * 把逻辑路径转换为实际文件路径（用于新建 / 跨语言写入）。
 * 默认语言优先使用「无标记」路径，保持与旧内容兼容。
 */
export function toSourcePath(
  logicalPath: string,
  language: string,
  i18n: ResolvedI18n | undefined,
): string {
  const config = i18n ?? DEFAULT_I18N;
  const clean = normalizeSlashes(logicalPath);
  if (!config.enable || config.document_mode === "off" || !language) return clean;

  const lang = config.languages.find((item) => item.code === language);
  if (!lang || language === config.default_language) return clean;

  if (config.document_mode === "folder" || config.document_mode === "auto") {
    return [lang.dir || lang.code, clean].filter(Boolean).join("/");
  }

  if (config.document_mode === "suffix") {
    const match = clean.match(/^(.*?)(\.(?:md|markdown|html?))$/i);
    if (match) return `${match[1]}.${lang.suffix || lang.code}${match[2]}`;
  }
  return clean;
}

/** 语言展示名 */
export function languageLabel(
  language: string,
  i18n: ResolvedI18n | undefined,
): string {
  const config = i18n ?? DEFAULT_I18N;
  return config.languages.find((lang) => lang.code === language)?.label ?? language;
}
