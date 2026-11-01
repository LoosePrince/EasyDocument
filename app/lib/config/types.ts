/**
 * 站点配置类型定义
 *
 * 与 legacy 的 `config.js`（v1.3.x）保持字段兼容：所有字段均为可选，
 * 缺失时由 `config-schema.ts` 中的默认值补齐。
 */

export type DarkModeSetting = "auto" | "light" | "dark";

export interface NavLinkConfig {
  text: string;
  url: string | NavLinkConfig[];
  icon?: string;
  external?: boolean;
}

export interface SiteConfig {
  name?: string;
  title?: string;
  description?: string;
  keywords?: string;
  base_url?: string;
}

export interface AppearanceConfig {
  logo?: string;
  favicon?: string;
  theme_color?: string;
  default_dark_mode?: DarkModeSetting;
  font_family?: string;
}

export interface LayoutConfig {
  show_header?: boolean;
  header_file?: string;
  show_footer?: boolean;
  footer_file?: string;
  sidebar_width?: string;
  toc_width?: string;
  mobile_breakpoint?: string;
}

export interface StaggerAnimationConfig {
  enable?: boolean;
  duration?: number;
  stagger_delay?: number;
  enable_skeleton?: boolean;
  skeleton_duration?: number;
}

export interface ArticleAnimationConfig {
  enable_skeleton?: boolean;
  enable_render?: boolean;
  render_duration?: number;
}

export interface AnimationConfig {
  enable?: boolean;
  sidebar?: StaggerAnimationConfig;
  toc?: StaggerAnimationConfig;
  article?: ArticleAnimationConfig;
  general?: { min_duration?: number };
}

export interface NavigationConfig {
  home_text?: string;
  breadcrumb?: boolean;
  auto_collapse?: boolean;
  back_to_top?: boolean;
  prev_next_buttons?: boolean;
  /** 1–5，语义见 legacy 配置注释 */
  folder_expand_mode?: number;
  nav_links?: NavLinkConfig[];
}

export interface HomeFeature {
  icon?: string;
  title?: string;
  description?: string;
  color?: string;
}

export interface GetStartedStep {
  title?: string;
  description?: string;
}

export interface HomeConfig {
  use_file?: boolean;
  file_path?: string;
  hero?: {
    title?: string;
    subtitle?: string;
    description?: string;
    logo?: string;
    button_text?: string;
    button_link?: string;
    /** v2 新增：主按钮下方的次要链接 */
    secondary_text?: string;
    secondary_link?: string;
    /** v2 新增：Hero 上方的胶囊标签，如「v2.0 · SSG」 */
    badge?: string;
    /** v2 新增：Hero 搜索框占位文案；设为空字符串可隐藏 */
    search_placeholder?: string;
  };
  features?: HomeFeature[];
  get_started?: {
    enable?: boolean;
    title?: string;
    steps?: GetStartedStep[];
    button_text?: string;
    button_link?: string;
  };
  /** v2 新增：首页各区块的开关与标题 */
  sections?: {
    features?: { enable?: boolean; title?: string; description?: string };
    docs?: { enable?: boolean; title?: string; description?: string };
    get_started?: { enable?: boolean; title?: string; description?: string };
    /** 代码演示区块 */
    code_demo?: { enable?: boolean; title?: string; description?: string };
  };
  /** v2 新增：首页统计/亮点数字 */
  stats?: Array<{ value?: string; label?: string }>;
  /** v2 新增：快捷入口卡片 */
  quick_links?: Array<{ title?: string; description?: string; url?: string; icon?: string }>;
  /** v2 新增：首页展示的代码片段（Markdown 语法示例） */
  code_demo?: {
    filename?: string;
    content?: string;
  };
}

export interface AvailableBranch {
  name: string;
  label?: string;
}

export interface ExternalDocMount {
  mount_path: string;
  mode: "path_json" | "github_tree";
  url: string;
  title?: string;
}

export interface CodeBlockConfig {
  line_numbers?: boolean;
  start_line?: number;
  theme?: { light?: string; dark?: string };
}

export interface DocumentConfig {
  root_dir?: string;
  branch_support?: boolean;
  default_branch?: string;
  available_branches?: AvailableBranch[];
  default_page?: string;
  index_pages?: string[];
  supported_extensions?: string[];
  toc_depth?: number;
  toc_numbering?: boolean;
  toc_ignore_h1?: boolean;
  toc_dynamic_expand?: boolean;
  code_copy_button?: boolean;
  code_block?: CodeBlockConfig;
  external_docs?: ExternalDocMount[];
}

export interface SearchConfig {
  enable?: boolean;
  min_chars?: number;
  max_results?: number;
  placeholder?: string;
  search_cached?: boolean;
  search_on_type?: boolean;
  match_distance?: number;
}

export interface ExtensionsConfig {
  math?: boolean;
  highlight?: boolean;
  mermaid?: boolean;
  github?: {
    enable?: boolean;
    repo_url?: string;
    edit_link?: boolean;
    branch?: string;
    show_avatar?: boolean;
  };
  git?: {
    enable?: boolean;
    show_last_modified?: boolean;
    show_contributors?: boolean;
  };
  progress_bar?: { enable?: boolean };
  cache_menu?: { enable?: boolean };
}

export interface FooterLink {
  text: string;
  url: string;
  external?: boolean;
}

export interface FooterColumn {
  key?: string;
  title?: string;
  type?: string;
  enable?: boolean;
}

export interface BeianRecord {
  text: string;
  url?: string;
}

export interface FooterConfig {
  copyright?: string;
  powered_by?: {
    enable?: boolean;
    text?: string;
    links?: FooterLink[];
  };
  links?: FooterLink[];
  beian?: {
    enable?: boolean;
    icp?: BeianRecord[];
    position?: "top" | "bottom";
  };
  columns?: FooterColumn[];
}

/** 网页端编辑台的配置项（可选，v2 新增） */
export interface AdminConfig {
  /** 是否在文档页显示编辑入口 */
  enable?: boolean;
}

export interface SiteConfigFile {
  site?: SiteConfig;
  appearance?: AppearanceConfig;
  layout?: LayoutConfig;
  animation?: AnimationConfig;
  navigation?: NavigationConfig;
  home?: HomeConfig;
  document?: DocumentConfig;
  search?: SearchConfig;
  extensions?: ExtensionsConfig;
  footer?: FooterConfig;
  admin?: AdminConfig;
}

/** 校验后（默认值已补齐）的配置 */
export interface ResolvedConfig {
  site: Required<SiteConfig>;
  appearance: Required<AppearanceConfig>;
  layout: Required<LayoutConfig>;
  animation: {
    enable: boolean;
    sidebar: Required<StaggerAnimationConfig>;
    toc: Required<StaggerAnimationConfig>;
    article: Required<ArticleAnimationConfig>;
    general: { min_duration: number };
  };
  navigation: {
    home_text: string;
    breadcrumb: boolean;
    auto_collapse: boolean;
    back_to_top: boolean;
    prev_next_buttons: boolean;
    folder_expand_mode: number;
    nav_links: NavLinkConfig[];
  };
  home: {
    use_file: boolean;
    file_path: string;
    hero: {
      title: string;
      subtitle: string;
      description: string;
      logo: string;
      button_text: string;
      button_link: string;
      secondary_text: string;
      secondary_link: string;
      badge: string;
      search_placeholder: string;
    };
    features: HomeFeature[];
    get_started: {
      enable: boolean;
      title: string;
      steps: GetStartedStep[];
      button_text: string;
      button_link: string;
    };
    sections: {
      features: { enable: boolean; title: string; description: string };
      docs: { enable: boolean; title: string; description: string };
      get_started: { enable: boolean; title: string; description: string };
      code_demo: { enable: boolean; title: string; description: string };
    };
    stats: Array<{ value: string; label: string }>;
    quick_links: Array<{ title: string; description: string; url: string; icon: string }>;
    code_demo: { filename: string; content: string };
  };
  document: {
    root_dir: string;
    branch_support: boolean;
    default_branch: string;
    available_branches: AvailableBranch[];
    default_page: string;
    index_pages: string[];
    supported_extensions: string[];
    toc_depth: number;
    toc_numbering: boolean;
    toc_ignore_h1: boolean;
    toc_dynamic_expand: boolean;
    code_copy_button: boolean;
    code_block: Required<CodeBlockConfig>;
    external_docs: ExternalDocMount[];
  };
  search: {
    enable: boolean;
    min_chars: number;
    max_results: number;
    placeholder: string;
    search_cached: boolean;
    search_on_type: boolean;
    match_distance: number;
  };
  extensions: {
    math: boolean;
    highlight: boolean;
    mermaid: boolean;
    github: {
      enable: boolean;
      repo_url: string;
      edit_link: boolean;
      branch: string;
      show_avatar: boolean;
    };
    git: {
      enable: boolean;
      show_last_modified: boolean;
      show_contributors: boolean;
    };
    progress_bar: { enable: boolean };
    cache_menu: { enable: boolean };
  };
  footer: {
    copyright: string;
    powered_by: {
      enable: boolean;
      text: string;
      links: FooterLink[];
    };
    links: FooterLink[];
    beian: {
      enable: boolean;
      icp: BeianRecord[];
      position: "top" | "bottom";
    };
    columns: FooterColumn[];
  };
  admin: { enable: boolean };
}
