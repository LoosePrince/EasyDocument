/**
 * EasyDocument 2.0.2 配置文件
 *
 * 本文件位于内容分支（默认 `data`）的根目录，由 `main` 分支的
 * `easydocument.json`（{ "data": "data:/config.js" }）指向。
 *
 * 所有字段都可省略，缺失时使用内置默认值；类型不符会回退默认值并在控制台提示。
 * 完整字段说明见文档：/docs-zh-CN/main/配置详解
 */

const config = {
  // ============ 网站基本信息 ============
  site: {
    name: "EasyDocument", // 网站名称（顶栏 Logo 旁）
    title: "EasyDocument · 静态文档系统", // 浏览器标签页标题
    description: "内容与代码分离的静态文档系统：预渲染真实路径，网页端就地编辑，一键提交并重建。",
    keywords: "文档,静态网站,Markdown,SSG,React,Vite",
    base_url: "/" // 部署在子目录时改成 "/子目录"
  },

  // ============ 外观 ============
  appearance: {
    logo: "/assets/img/logo.svg", // 顶栏与首页 Logo
    favicon: "/assets/img/favicon.ico", // 站点图标
    theme_color: "#3b82f6", // 主题色，生成 --ed-primary 等 CSS 变量
    default_dark_mode: "auto", // "auto" 跟随系统 | "light" | "dark"
    font_family: "" // 留空使用内置 Outfit；可填 "Inter, sans-serif" 之类
  },

  // ============ 布局 ============
  layout: {
    show_header: true,
    header_file: "", // 自定义顶栏 HTML 路径（相对内容根）；留空使用内置顶栏
    show_footer: true,
    footer_file: "", // 自定义页脚 HTML 路径；留空使用内置页脚
    sidebar_width: "260px", // 左侧文档树宽度
    toc_width: "260px", // 右侧目录宽度
    mobile_breakpoint: "1024px" // 移动端抽屉断点
  },

  // ============ 动画 ============
  animation: {
    enable: true, // 总开关，false 时所有动画降到 1ms
    sidebar: {
      enable: true,
      duration: 200, // 交错动画单条时长(ms)
      stagger_delay: 50, // 交错间隔(ms)
      enable_skeleton: true,
      skeleton_duration: 1500 // 骨架屏 shimmer 周期(ms)
    },
    toc: {
      enable: true,
      duration: 200,
      stagger_delay: 50,
      enable_skeleton: true,
      skeleton_duration: 1500
    },
    article: {
      enable_skeleton: true,
      enable_render: true,
      render_duration: 600
    },
    general: {
      min_duration: 300 // 加载动画最短展示时长(ms)
    }
  },

  // ============ 导航 ============
  navigation: {
    home_text: "首页",
    breadcrumb: true, // 面包屑（目录无索引页时该项不可点）
    auto_collapse: true, // 切换文档时折叠非当前目录
    back_to_top: true, // 右下角返回顶部
    prev_next_buttons: true, // 底部上一篇/下一篇
    folder_expand_mode: 5, // 1 全部一级 | 2 全部 | 3 首个一级 | 4 首个全部 | 5 不展开
    nav_links: [
      {
        text: "首页",
        url: "/"
      },
      {
        text: "文档",
        url: "/docs-zh-CN/main"
      },
      {
        text: "教程",
        url: [
          { text: "快速入门", url: "/docs-zh-CN/main/快速入门", icon: "rocket" },
          { text: "使用指南", url: "/docs-zh-CN/main/使用指南", icon: "book" },
          { text: "编辑与发布", url: "/docs-zh-CN/main/编辑与发布", icon: "edit" },
          { text: "配置详解", url: "/docs-zh-CN/main/配置详解", icon: "settings" }
        ],
        icon: "graduation"
      },
      {
        text: "参考",
        url: "/docs-zh-CN/main/参考"
      },
      {
        text: "GitHub",
        url: "https://github.com/LoosePrince/EasyDocument",
        icon: "github",
        external: true
      }
    ]
  },

  // ============ 首页 ============
  home: {
    use_file: false, // true 时读取 file_path 指向的 HTML（经消毒）作为首页正文
    file_path: "/home.html",

    // 首屏
    hero: {
      badge: "v2.0.2 · 多语言 · 图标 · 目录排序",
      title: "EasyDocument",
      subtitle: "内容与代码分离的静态文档系统",
      description:
        "文档存在独立的 git 分支里，构建时预渲染为真实路径的静态页面。网页端就地编辑、实时预览，一键提交后再手动重建上线。",
      logo: "/assets/img/logo.svg",
      search_placeholder: "搜索文档…", // 留空则隐藏首屏搜索框
      button_text: "开始阅读",
      button_link: "/docs-zh-CN/main",
      secondary_text: "编辑与发布",
      secondary_link: "/docs-zh-CN/main/编辑与发布"
    },

    // 区块开关与标题
    sections: {
      features: { enable: true, title: "核心特性", description: "文档系统的地基，都在这几件事上" },
      docs: { enable: true, title: "文档", description: "按版本浏览，每条入口都指向真实内容" },
      code_demo: {
        enable: true,
        title: "同一套渲染管线",
        description: "左边是 Markdown 源码，右边是构建期与编辑预览共用的渲染结果"
      },
      get_started: { enable: true, title: "三步开始", description: "从空白到上线只需要三步" }
    },

    // 首屏亮点
    stats: [
      { value: "SSG", label: "预渲染输出" },
      { value: "真实路径", label: "无 hash 路由" },
      { value: "就地编辑", label: "实时预览" },
      { value: "三模式", label: "所见即所得 / 分栏 / 预览" }
    ],

    // 特性卡片
    features: [
      {
        icon: "feather",
        title: "内容与代码分离",
        description: "文档放在独立 git 分支，改内容不碰代码仓库，版本历史互不干扰",
        color: "blue"
      },
      {
        icon: "palette",
        title: "真实路径预渲染",
        description: "每个文档都有独立 HTML，直链刷新可用、可被搜索引擎收录",
        color: "orange"
      },
      {
        icon: "settings",
        title: "配置即站点",
        description: "一份 config.js 控制导航、首页、布局、搜索与页脚，旧配置原样兼容",
        color: "green"
      },
      {
        icon: "edit",
        title: "网页端编辑",
        description: "就地编辑、实时预览，保存为本地草稿，确认后一键提交",
        color: "purple"
      },
      {
        icon: "layers",
        title: "多版本文档",
        description: "内容分支下每个目录是一个版本，切换版本保留文档结构",
        color: "cyan"
      },
      {
        icon: "search",
        title: "全文搜索",
        description: "构建期生成索引，中文二元组分词，支持前缀与模糊匹配",
        color: "rose"
      }
    ],

    // 首页代码对照区
    code_demo: {
      filename: "README.md",
      content:
        "# 我的文档\n\n> [TIP] 支持提示框、数学公式、Mermaid 与代码高亮。\n\n- 真实路径 + 预渲染，SEO 友好\n- 内容与代码分离，独立 git 分支托管\n- 网页端就地编辑，保存草稿后一键提交\n\n行内公式 $E = mc^2$，下面是带行号的代码块：\n\n```ts\nexport const hello = (name: string) => `Hello, ${name}`;\n```\n\n| 模式 | 用途 |\n| --- | --- |\n| 预览 | 查看最终效果 |\n| 分栏 | 源码与效果对照 |\n"
    },

    // 快速开始步骤
    get_started: {
      enable: true,
      title: "三步开始使用",
      steps: [
        {
          title: "把文档放进内容分支",
          description: "在 data 分支的版本目录下新建 .md 或 .html 文件，目录可选放 README.md 作为索引"
        },
        {
          title: "在网页端编辑",
          description: "打开任意文档点「编辑此页」，预览或分栏书写；点「保存修改」写入本地草稿"
        },
        {
          title: "一键提交并重建",
          description: "顶部工具条「一键提交」推到内容分支，再到控制台「构建部署」触发重建"
        }
      ],
      button_text: "阅读快速入门",
      button_link: "/docs-zh-CN/main/快速入门"
    },

    // 首页快捷入口（每条都必须指向真实页面）
    quick_links: [
      {
        title: "快速入门",
        description: "安装、第一篇文档、部署",
        url: "/docs-zh-CN/main/快速入门",
        icon: "rocket"
      },
      {
        title: "编辑与发布",
        description: "就地编辑、草稿、提交与重建",
        url: "/docs-zh-CN/main/编辑与发布",
        icon: "edit"
      },
      {
        title: "配置详解",
        description: "站点、布局、首页、搜索、页脚",
        url: "/docs-zh-CN/main/配置详解",
        icon: "settings"
      },
      {
        title: "参考",
        description: "Markdown 语法与故障排查",
        url: "/docs-zh-CN/main/参考",
        icon: "help"
      }
    ]
  },

  // ============ 文档 ============
  document: {
    root_dir: "/", // 内容分支根即文档根，留空或 "/" 均可
    branch_support: true, // 是否启用版本（内容分支下的一级目录）
    default_branch: "main", // 默认版本目录名
    available_branches: [
      // 目录不存在时自动隐藏；顺序即展示顺序
      { name: "main", label: "v2.0.2" }
    ],
    default_page: "README.md",
    index_pages: ["README.md", "README.html", "index.md", "index.html"],
    supported_extensions: [".md", ".html"],
    toc_depth: 3, // 右侧目录显示到几级标题
    toc_numbering: true, // 目录显示 1 / 1.2 / 1.2.3 编号
    toc_ignore_h1: true, // 编号时忽略 h1，避免全部从 1 开始
    toc_dynamic_expand: true, // 超出深度的标题在激活时展开
    code_copy_button: true,
    code_block: {
      line_numbers: true,
      start_line: 1,
      theme: {
        light: "github", // 别名，内部归一为 github-light
        dark: "github-dark"
      }
    },
    // 目录配置（显示名 / 排序 / 隐藏 / 外部挂载），放在内容根或版本目录下
    path_config: "path.json",
    // 前端实时拉取外部文档（关闭后只用构建期结果）
    runtime_fetch: true
  },

  // ============ 国际化与多语言文档 ============
  i18n: {
    enable: true, // 总开关：关闭后不显示语言切换器，也不识别多语言文档
    ui: true, // 翻译界面文案（内置中文 / English，英文文案在 lang/en.json）
    switcher: true, // 顶栏显示语言切换器（站点语言 + 文档语言两个列表）
    default_language: "zh-CN", // 默认站点语言：只影响界面文案，保存在 localStorage
    site_languages: [
      { code: "zh-CN", label: "中文" },
      { code: "en", label: "English" }
    ],
    // 文档语言可以自由扩展，甚至只保留一个语言（此时不显示文档语言列表）
    document_languages: [
      { code: "zh-CN", label: "中文", dir: "zh", suffix: "zh" },
      { code: "en", label: "English", dir: "en", suffix: "en" }
    ],
    default_document_language: "zh-CN", // 文档语言决定 /docs-{语言}/ 前缀
    // auto：同时识别语言文件夹与文件二级后缀；folder / suffix / off 可强制单一方式
    document_mode: "auto"
  },

  // ============ 搜索 ============
  search: {
    enable: true,
    min_chars: 2, // 触发搜索的最小字符数
    max_results: 20,
    placeholder: "搜索文档…",
    search_drafts: true, // 同时搜索浏览器内的本地草稿
    search_on_type: true, // 输入即搜
    match_distance: 50 // 结果片段中多次命中的最小间隔
  },

  // ============ 扩展 ============
  extensions: {
    math: true, // KaTeX（$…$、$$…$$）
    highlight: true, // 代码高亮（shiki，双主题）
    mermaid: true, // Mermaid 图表
    html_scripts: true, // HTML 文档允许执行脚本（不再为「安全」限制）
    github: {
      enable: true,
      repo_url: "https://github.com/LoosePrince/EasyDocument", // 仓库地址（也可省略，自动推断）
      edit_link: true, // 文档底部「在 GitHub 上编辑」
      branch: "main", // 代码分支
      show_avatar: true // 贡献者显示 GitHub 头像
    },
    git: {
      enable: true,
      show_last_modified: true, // 显示最后编辑时间
      show_contributors: true // 显示贡献者
    },
    progress_bar: {
      enable: true // 顶部阅读进度条
    }
  },

  // ============ 编辑台 ============
  admin: {
    enable: true // 是否显示「编辑此页」「新建 / 管理」与控制台入口
  },

  // ============ 页脚 ============
  footer: {
    copyright: "© 2026 EasyDocument · MIT License",

    powered_by: {
      enable: true,
      text: "技术栈：",
      links: [
        { text: "React", url: "https://react.dev", external: true },
        { text: "Vite", url: "https://vite.dev", external: true },
        { text: "TailwindCSS", url: "https://tailwindcss.com", external: true },
        { text: "React Router", url: "https://reactrouter.com", external: true }
      ]
    },

    links: [
      { text: "GitHub", url: "https://github.com/LoosePrince/EasyDocument" },
      { text: "报告问题", url: "https://github.com/LoosePrince/EasyDocument/issues" }
    ],

    // 最多 1~3 条；position: "top" 紧跟版权，"bottom" 在页脚最底部
    beian: {
      enable: false,
      icp: [],
      position: "bottom"
    },

    columns: [
      { key: "nav", title: "导航", type: "nav", enable: true },
      { key: "links", title: "资源", type: "links", enable: true },
      { key: "stack", title: "技术栈", type: "stack", enable: true }
    ]
  },

  // ============ 英文站点配置 ============
  // 站点语言只保存在浏览器 localStorage；这里覆盖界面可见的站点文案。
  // 数组字段（nav_links / features / quick_links 等）会整体替换基础配置。
  locales: {
    en: {
      site: {
        name: "EasyDocument",
        title: "EasyDocument · Static Documentation",
        description:
          "A static documentation system that keeps content in a separate git branch, prerenders real paths, and lets you edit in the browser.",
        keywords: "documentation,static site,markdown,SSG,React,Vite"
      },

      navigation: {
        home_text: "Home",
        nav_links: [
          { text: "Home", url: "/" },
          { text: "Docs", url: "/docs-en/main" },
          {
            text: "Guides",
            url: [
              { text: "Quick Start", url: "/docs-en/main/快速入门", icon: "rocket" },
              { text: "User Guide", url: "/docs-en/main/使用指南", icon: "book" },
              { text: "Editing & Publishing", url: "/docs-en/main/编辑与发布", icon: "edit" },
              { text: "Configuration", url: "/docs-en/main/配置详解", icon: "settings" }
            ],
            icon: "graduation"
          },
          { text: "Reference", url: "/docs-en/main/参考" },
          {
            text: "GitHub",
            url: "https://github.com/LoosePrince/EasyDocument",
            icon: "github",
            external: true
          }
        ]
      },

      home: {
        hero: {
          badge: "v2.0.2 · i18n · Icons · Catalog ordering",
          title: "EasyDocument",
          subtitle: "Documentation separated from code",
          description:
            "Docs live on their own git branch and are prerendered into real-path static pages. Edit in place, preview instantly, commit once, then rebuild.",
          search_placeholder: "Search docs…",
          button_text: "Start reading",
          button_link: "/docs-en/main",
          secondary_text: "Editing & publishing",
          secondary_link: "/docs-en/main/编辑与发布"
        },

        sections: {
          features: {
            title: "Core features",
            description: "The foundations of a documentation system that stays out of your way"
          },
          docs: {
            title: "Documentation",
            description: "Browse by version; every entry points to real content"
          },
          code_demo: {
            title: "One rendering pipeline",
            description: "Markdown on the left, the same build-time renderer on the right"
          },
          get_started: {
            title: "Three steps to launch",
            description: "From empty folder to published site"
          }
        },

        stats: [
          { value: "SSG", label: "Prerendered output" },
          { value: "Real paths", label: "No hash routing" },
          { value: "In-place editing", label: "Live preview" },
          { value: "Three modes", label: "WYSIWYG / Split / Preview" }
        ],

        features: [
          {
            icon: "feather",
            title: "Content separate from code",
            description:
              "Docs live on their own git branch, so content changes never touch the code repository",
            color: "blue"
          },
          {
            icon: "palette",
            title: "Real-path prerendering",
            description:
              "Every document gets its own HTML file: direct links work and search engines can index them",
            color: "orange"
          },
          {
            icon: "settings",
            title: "Config-driven site",
            description:
              "A single config.js controls navigation, home page, layout, search and footer",
            color: "green"
          },
          {
            icon: "edit",
            title: "Edit in the browser",
            description:
              "Edit in place, preview live, save a local draft, then commit everything at once",
            color: "purple"
          },
          {
            icon: "layers",
            title: "Multiple versions",
            description:
              "Each top-level folder on the content branch is a version with its own structure",
            color: "cyan"
          },
          {
            icon: "search",
            title: "Full-text search",
            description:
              "A build-time index with CJK bigram tokenization, prefix and fuzzy matching",
            color: "rose"
          }
        ],

        code_demo: {
          filename: "README.md",
          content:
            "# My docs\n\n> [TIP] Callouts, math, Mermaid and syntax highlighting are built in.\n\n- Real paths + prerendering, SEO friendly\n- Content separated into its own git branch\n- Edit in the browser, save drafts, commit once\n\nInline math $E = mc^2$, and a code block with line numbers:\n\n```ts\nexport const hello = (name: string) => `Hello, ${name}`;\n```\n\n| Mode | Purpose |\n| --- | --- |\n| Preview | See the final result |\n| Split | Compare source and result |\n"
        },

        get_started: {
          enable: true,
          title: "Get started in three steps",
          steps: [
            {
              title: "Put docs on the content branch",
              description:
                "Create .md or .html files under a version folder on the data branch; optionally add README.md as the folder index"
            },
            {
              title: "Edit in the browser",
              description:
                "Open any document, click “Edit this page”, write in preview or split mode, then “Save changes” to store a local draft"
            },
            {
              title: "Commit and rebuild",
              description:
                "Use “Commit all” in the top toolbar, then trigger a rebuild from “Build & deploy” in the console"
            }
          ],
          button_text: "Read the quick start",
          button_link: "/docs-en/main/快速入门"
        },

        quick_links: [
          {
            title: "Quick Start",
            description: "Install, first document, deploy",
            url: "/docs-en/main/快速入门",
            icon: "rocket"
          },
          {
            title: "Editing & Publishing",
            description: "In-place editing, drafts, commits and rebuilds",
            url: "/docs-en/main/编辑与发布",
            icon: "edit"
          },
          {
            title: "Configuration",
            description: "Site, layout, home page, search and footer",
            url: "/docs-en/main/配置详解",
            icon: "settings"
          },
          {
            title: "Reference",
            description: "Markdown syntax and troubleshooting",
            url: "/docs-en/main/参考",
            icon: "help"
          }
        ]
      },

      search: {
        placeholder: "Search docs…"
      },

      footer: {
        copyright: "© 2026 EasyDocument · MIT License",
        powered_by: { text: "Built with:" },
        links: [
          { text: "GitHub", url: "https://github.com/LoosePrince/EasyDocument" },
          { text: "Report an issue", url: "https://github.com/LoosePrince/EasyDocument/issues" }
        ],
        columns: [
          { key: "nav", title: "Navigation", type: "nav", enable: true },
          { key: "links", title: "Resources", type: "links", enable: true },
          { key: "stack", title: "Tech stack", type: "stack", enable: true }
        ]
      }
    }
  }
};

export default config;
