/**
 * 配置 schema 与默认值
 *
 * 目标：legacy 的 `config.js` 可以**原样**使用。因此这里：
 *  - 所有字段可选，缺省时回落默认值（对齐 legacy `config-validator.js` 的 VALIDATION_RULES）
 *  - 类型不符时给出警告并回落默认值（而非抛错），行为与 legacy 一致
 *  - 保留 legacy 已废弃/未实现的字段（如 `layout.header_file`）而不报错
 */
import { z } from "zod";
import type { ResolvedConfig, SiteConfigFile } from "./types";

const navLinkSchema: z.ZodType<import("./types").NavLinkConfig> = z.lazy(() =>
  z.object({
    text: z.string(),
    url: z.union([z.string(), z.array(navLinkSchema)]),
    icon: z.string().optional(),
    external: z.boolean().optional(),
  }),
);

const sectionSchema = z.object({
  enable: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

const languageSchema = z.object({
  code: z.string(),
  label: z.string().optional(),
  dir: z.string().optional(),
  suffix: z.string().optional(),
});

const siteLanguageSchema = z.object({
  code: z.string(),
  label: z.string().optional(),
});

export const siteConfigSchema = z
  .object({
    site: z
      .object({
        name: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        keywords: z.string().optional(),
        base_url: z.string().optional(),
      })
      .optional(),
    appearance: z
      .object({
        logo: z.string().optional(),
        favicon: z.string().optional(),
        theme_color: z.string().optional(),
        default_dark_mode: z.enum(["auto", "light", "dark"]).optional(),
        font_family: z.string().optional(),
      })
      .optional(),
    layout: z
      .object({
        show_header: z.boolean().optional(),
        header_file: z.string().optional(),
        show_footer: z.boolean().optional(),
        footer_file: z.string().optional(),
        sidebar_width: z.string().optional(),
        toc_width: z.string().optional(),
        mobile_breakpoint: z.string().optional(),
      })
      .optional(),
    animation: z
      .object({
        enable: z.boolean().optional(),
        sidebar: z
          .object({
            enable: z.boolean().optional(),
            duration: z.number().optional(),
            stagger_delay: z.number().optional(),
            enable_skeleton: z.boolean().optional(),
            skeleton_duration: z.number().optional(),
          })
          .optional(),
        toc: z
          .object({
            enable: z.boolean().optional(),
            duration: z.number().optional(),
            stagger_delay: z.number().optional(),
            enable_skeleton: z.boolean().optional(),
            skeleton_duration: z.number().optional(),
          })
          .optional(),
        article: z
          .object({
            enable_skeleton: z.boolean().optional(),
            enable_render: z.boolean().optional(),
            render_duration: z.number().optional(),
          })
          .optional(),
        general: z.object({ min_duration: z.number().optional() }).optional(),
      })
      .optional(),
    navigation: z
      .object({
        home_text: z.string().optional(),
        breadcrumb: z.boolean().optional(),
        auto_collapse: z.boolean().optional(),
        back_to_top: z.boolean().optional(),
        prev_next_buttons: z.boolean().optional(),
        folder_expand_mode: z.number().optional(),
        nav_links: z.array(navLinkSchema).optional(),
      })
      .optional(),
    home: z
      .object({
        use_file: z.boolean().optional(),
        file_path: z.string().optional(),
        hero: z
          .object({
            title: z.string().optional(),
            subtitle: z.string().optional(),
            description: z.string().optional(),
            logo: z.string().optional(),
            button_text: z.string().optional(),
            button_link: z.string().optional(),
            secondary_text: z.string().optional(),
            secondary_link: z.string().optional(),
            badge: z.string().optional(),
            search_placeholder: z.string().optional(),
          })
          .optional(),
        features: z
          .array(
            z.object({
              icon: z.string().optional(),
              title: z.string().optional(),
              description: z.string().optional(),
              color: z.string().optional(),
            }),
          )
          .optional(),
        get_started: z
          .object({
            enable: z.boolean().optional(),
            title: z.string().optional(),
            steps: z
              .array(z.object({ title: z.string().optional(), description: z.string().optional() }))
              .optional(),
            button_text: z.string().optional(),
            button_link: z.string().optional(),
          })
          .optional(),
        sections: z
          .object({
            features: sectionSchema.optional(),
            docs: sectionSchema.optional(),
            get_started: sectionSchema.optional(),
            code_demo: sectionSchema.optional(),
          })
          .optional(),
        stats: z
          .array(z.object({ value: z.string().optional(), label: z.string().optional() }))
          .optional(),
        quick_links: z
          .array(
            z.object({
              title: z.string().optional(),
              description: z.string().optional(),
              url: z.string().optional(),
              icon: z.string().optional(),
            }),
          )
          .optional(),
        code_demo: z
          .object({ filename: z.string().optional(), content: z.string().optional() })
          .optional(),
      })
      .optional(),
    document: z
      .object({
        root_dir: z.string().optional(),
        branch_support: z.boolean().optional(),
        default_branch: z.string().optional(),
        available_branches: z
          .array(z.object({ name: z.string(), label: z.string().optional() }))
          .optional(),
        default_page: z.string().optional(),
        index_pages: z.array(z.string()).optional(),
        supported_extensions: z.array(z.string()).optional(),
        toc_depth: z.number().optional(),
        toc_numbering: z.boolean().optional(),
        toc_ignore_h1: z.boolean().optional(),
        toc_dynamic_expand: z.boolean().optional(),
        code_copy_button: z.boolean().optional(),
        code_block: z
          .object({
            line_numbers: z.boolean().optional(),
            start_line: z.number().optional(),
            theme: z.object({ light: z.string().optional(), dark: z.string().optional() }).optional(),
          })
          .optional(),
        path_config: z.string().optional(),
        runtime_fetch: z.boolean().optional(),
      })
      .optional(),
    i18n: z
      .object({
        enable: z.boolean().optional(),
        ui: z.boolean().optional(),
        switcher: z.boolean().optional(),
        default_language: z.string().optional(),
        site_languages: z.array(siteLanguageSchema).optional(),
        document_languages: z.array(languageSchema).optional(),
        default_document_language: z.string().optional(),
        languages: z.array(languageSchema).optional(),
        document_mode: z.enum(["auto", "folder", "suffix", "off"]).optional(),
      })
      .optional(),
    search: z
      .object({
        enable: z.boolean().optional(),
        min_chars: z.number().optional(),
        max_results: z.number().optional(),
        placeholder: z.string().optional(),
        search_drafts: z.boolean().optional(),
        search_on_type: z.boolean().optional(),
        match_distance: z.number().optional(),
      })
      .optional(),
    extensions: z
      .object({
        math: z.boolean().optional(),
        highlight: z.boolean().optional(),
        mermaid: z.boolean().optional(),
        html_scripts: z.boolean().optional(),
        github: z
          .object({
            enable: z.boolean().optional(),
            repo_url: z.string().optional(),
            edit_link: z.boolean().optional(),
            branch: z.string().optional(),
            show_avatar: z.boolean().optional(),
          })
          .optional(),
        git: z
          .object({
            enable: z.boolean().optional(),
            show_last_modified: z.boolean().optional(),
            show_contributors: z.boolean().optional(),
          })
          .optional(),
        progress_bar: z.object({ enable: z.boolean().optional() }).optional(),
      })
      .optional(),
    footer: z
      .object({
        copyright: z.string().optional(),
        powered_by: z
          .object({
            enable: z.boolean().optional(),
            text: z.string().optional(),
            links: z
              .array(
                z.object({
                  text: z.string(),
                  url: z.string(),
                  external: z.boolean().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        links: z
          .array(
            z.object({ text: z.string(), url: z.string(), external: z.boolean().optional() }),
          )
          .optional(),
        beian: z
          .object({
            enable: z.boolean().optional(),
            icp: z
              .array(z.object({ text: z.string(), url: z.string().optional() }))
              .optional(),
            position: z.enum(["top", "bottom"]).optional(),
          })
          .optional(),
        columns: z
          .array(
            z.object({
              key: z.string().optional(),
              title: z.string().optional(),
              type: z.string().optional(),
              enable: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    admin: z.object({ enable: z.boolean().optional() }).optional(),
    // 站点语言覆盖（结构同根配置，避免递归校验，解析时再套用 schema）
    locales: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const DEFAULT_CONFIG: ResolvedConfig = {
  site: {
    name: "EasyDocument",
    title: "EasyDocument",
    description: "一个基于 React + Vite 的静态文档系统",
    keywords: "文档,静态网站,Markdown",
    base_url: "/",
  },
  appearance: {
    logo: "/logo.svg",
    favicon: "/favicon.ico",
    theme_color: "#3b82f6",
    default_dark_mode: "auto",
    font_family: "",
  },
  layout: {
    show_header: true,
    header_file: "",
    show_footer: true,
    footer_file: "",
    sidebar_width: "250px",
    toc_width: "280px",
    mobile_breakpoint: "1024px",
  },
  animation: {
    enable: true,
    sidebar: {
      enable: true,
      duration: 200,
      stagger_delay: 50,
      enable_skeleton: true,
      skeleton_duration: 1500,
    },
    toc: {
      enable: true,
      duration: 200,
      stagger_delay: 50,
      enable_skeleton: true,
      skeleton_duration: 1500,
    },
    article: { enable_skeleton: true, enable_render: true, render_duration: 600 },
    general: { min_duration: 300 },
  },
  navigation: {
    home_text: "首页",
    breadcrumb: true,
    auto_collapse: true,
    back_to_top: true,
    prev_next_buttons: true,
    folder_expand_mode: 5,
    nav_links: [],
  },
  home: {
    use_file: false,
    file_path: "/home.html",
    hero: {
      title: "EasyDocument",
      subtitle: "",
      description: "",
      logo: "",
      button_text: "开始阅读",
      button_link: "/docs",
      secondary_text: "",
      secondary_link: "",
      badge: "",
      search_placeholder: "搜索文档…",
    },
    features: [],
    get_started: { enable: false, title: "快速开始", steps: [], button_text: "", button_link: "" },
    sections: {
      features: { enable: true, title: "核心特性", description: "" },
      docs: { enable: true, title: "文档", description: "" },
      get_started: { enable: true, title: "快速开始", description: "" },
      code_demo: { enable: true, title: "Markdown 驱动", description: "" },
    },
    stats: [],
    quick_links: [],
    code_demo: {
      filename: "README.md",
      content: [
        "# 我的文档",
        "",
        "> [TIP] 支持提示框、数学公式与 Mermaid 图表。",
        "",
        "- 真实路径 + 预渲染，SEO 友好",
        "- 内容与代码分离，独立 git 分支托管",
        "- 网页端直接编辑并一键重建",
        "",
        "行内公式 $E = mc^2$，代码高亮：",
        "",
        "```ts",
        'export const hello = (name: string) => `Hello, ${name}`;',
        "```",
      ].join("\n"),
    },
  },
  document: {
    root_dir: "/",
    branch_support: true,
    default_branch: "main",
    available_branches: [{ name: "main", label: "main" }],
    default_page: "README.md",
    index_pages: ["README.md", "README.html", "index.md", "index.html"],
    supported_extensions: [".md", ".html"],
    toc_depth: 3,
    toc_numbering: true,
    toc_ignore_h1: true,
    toc_dynamic_expand: true,
    code_copy_button: true,
    code_block: { line_numbers: true, start_line: 1, theme: { light: "github-light", dark: "github-dark" } },
    path_config: "path.json",
    runtime_fetch: true,
  },
  i18n: {
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
  },
  search: {
    enable: true,
    min_chars: 2,
    max_results: 20,
    placeholder: "搜索文档...",
    search_drafts: true,
    search_on_type: true,
    match_distance: 50,
  },
  extensions: {
    math: true,
    highlight: true,
    mermaid: true,
    html_scripts: true,
    github: {
      enable: true,
      repo_url: "",
      edit_link: true,
      branch: "main",
      show_avatar: true,
    },
    git: { enable: true, show_last_modified: true, show_contributors: true },
    progress_bar: { enable: true },
  },
  footer: {
    copyright: "",
    powered_by: { enable: true, text: "使用以下技术栈构建：", links: [] },
    links: [],
    beian: { enable: false, icp: [], position: "bottom" },
    columns: [],
  },
  admin: { enable: true },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 深合并：仅当右侧为 undefined 时使用左侧默认值 */
function deepMerge<T>(defaults: T, input: unknown): T {
  if (input === undefined || input === null) return defaults;
  if (Array.isArray(defaults)) {
    return (Array.isArray(input) ? input : defaults) as T;
  }
  if (isPlainObject(defaults) && isPlainObject(input)) {
    const out: Record<string, unknown> = { ...defaults };
    for (const [key, value] of Object.entries(input)) {
      out[key] = key in (defaults as Record<string, unknown>)
        ? deepMerge((defaults as Record<string, unknown>)[key], value)
        : value;
    }
    return out as T;
  }
  return input as T;
}

export interface ConfigLoadResult {
  config: ResolvedConfig;
  warnings: string[];
  /** 原始（未补默认值）配置，用于编辑台回写 */
  raw: SiteConfigFile;
}

/**
 * 解析并补齐默认值。
 * 与 legacy 的差异：类型错误不再静默回退，而是记录 warning 供 UI 提示。
 */
export function resolveConfig(raw: unknown): ConfigLoadResult {
  const warnings: string[] = [];

  const parsed = siteConfigSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      warnings.push(`配置项 ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }

  const merged = deepMerge(DEFAULT_CONFIG, parsed.success ? parsed.data : raw);

  // folder_expand_mode 取值收敛（legacy: 1–5）
  if (![1, 2, 3, 4, 5].includes(merged.navigation.folder_expand_mode)) {
    warnings.push(
      `配置项 navigation.folder_expand_mode 应为 1–5，实际为 ${merged.navigation.folder_expand_mode}，已回退为 5`,
    );
    merged.navigation.folder_expand_mode = 5;
  }

  // toc_depth 至少为 1
  if (!Number.isFinite(merged.document.toc_depth) || merged.document.toc_depth < 1) {
    warnings.push(`配置项 document.toc_depth 无效，已回退为 3`);
    merged.document.toc_depth = 3;
  }

  // base_url 归一：保证以 / 开头、不以 / 结尾（根为 "/"）
  merged.site.base_url = normalizeBaseUrl(merged.site.base_url);

  // i18n：站点语言与文档语言分开，保留 languages 作为文档语言兼容别名
  const rawI18n =
    (parsed.success ? (parsed.data as SiteConfigFile).i18n : (raw as SiteConfigFile)?.i18n) ?? {};
  const siteInput = rawI18n.site_languages ?? rawI18n.languages;
  const documentInput =
    rawI18n.document_languages ?? rawI18n.languages ?? rawI18n.site_languages;

  merged.i18n.site_languages = normalizeSiteLanguages(
    siteInput ?? merged.i18n.site_languages,
    merged.i18n.default_language,
  );
  if (!merged.i18n.site_languages.some((lang) => lang.code === merged.i18n.default_language)) {
    merged.i18n.default_language = merged.i18n.site_languages[0].code;
  }

  const documentDefault =
    rawI18n.default_document_language?.trim() ||
    merged.i18n.default_document_language ||
    merged.i18n.default_language;
  merged.i18n.document_languages = normalizeLanguages(
    documentInput ?? merged.i18n.document_languages,
    documentDefault,
  );
  merged.i18n.languages = merged.i18n.document_languages;
  if (!merged.i18n.document_languages.some((lang) => lang.code === documentDefault)) {
    merged.i18n.default_document_language = merged.i18n.document_languages[0].code;
  } else {
    merged.i18n.default_document_language = documentDefault;
  }

  return {
    config: merged,
    warnings,
    raw: (parsed.success ? (parsed.data as SiteConfigFile) : (raw as SiteConfigFile)) ?? {},
  };
}

/** 站点语言：只保留 code/label */
function normalizeSiteLanguages(
  input: Array<{ code: string; label?: string }> | undefined,
  defaultLanguage: string,
): Array<{ code: string; label: string }> {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: Array<{ code: string; label: string }> = [];

  for (const lang of list) {
    const code = String(lang.code ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, label: lang.label?.trim() || code });
  }

  if (!out.some((lang) => lang.code === defaultLanguage)) {
    out.unshift({ code: defaultLanguage, label: defaultLanguage });
  }
  return out;
}

/** 补齐 dir/suffix/label，去重并保证默认语言可用 */
function normalizeLanguages(
  input: Array<{ code: string; label?: string; dir?: string; suffix?: string }> | undefined,
  defaultLanguage: string,
): Array<{ code: string; label: string; dir: string; suffix: string }> {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: Array<{ code: string; label: string; dir: string; suffix: string }> = [];

  for (const lang of list) {
    const code = String(lang.code ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      label: lang.label?.trim() || code,
      dir: lang.dir?.trim() || code,
      suffix: lang.suffix?.trim() || code,
    });
  }

  if (!out.some((lang) => lang.code === defaultLanguage)) {
    out.unshift({ code: defaultLanguage, label: defaultLanguage, dir: defaultLanguage, suffix: defaultLanguage });
  }
  return out;
}

export function normalizeBaseUrl(input: string): string {
  let value = (input || "/").trim();
  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return value === "" ? "/" : value;
}

/**
 * 解析某一站点语言的配置：基础配置 + `locales[language]` 覆盖。
 *
 * 数组字段（nav_links / home.features / footer.links 等）会整体替换，
 * 对象字段做深合并；未提供该语言时返回基础配置。
 */
export function resolveConfigForLanguage(raw: unknown, language: string): ConfigLoadResult {
  const base = resolveConfig(raw);
  if (!raw || typeof raw !== "object") return base;
  if (language === base.config.i18n.default_language) return base;

  const configRaw = raw as SiteConfigFile;
  const localized = configRaw.locales?.[language];
  if (!localized) return base;

  const { locales: _locales, ...root } = configRaw;
  void _locales;
  const merged = deepMerge(root as unknown, localized as unknown) as Record<string, unknown>;
  const result = resolveConfig(merged);
  return { ...result, raw: base.raw };
}

export { DEFAULT_CONFIG };
