/**
 * EasyDocument 2.0.0 配置文件
 *
 * 本文件位于内容分支（默认 `data`）的根目录，由 `main` 分支的
 * `easydocument.json`（{ "data": "data:/config.js" }）指向。
 *
 * 所有字段都可省略，缺失时使用内置默认值；类型不符会回退默认值并在控制台提示。
 * 完整字段说明见文档：/docs/main/配置详解
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
        url: "/docs/main"
      },
      {
        text: "教程",
        url: [
          { text: "快速入门", url: "/docs/main/快速入门", icon: "fas fa-rocket" },
          { text: "使用指南", url: "/docs/main/使用指南", icon: "fas fa-book" },
          { text: "编辑与发布", url: "/docs/main/编辑与发布", icon: "fas fa-pen-to-square" },
          { text: "配置详解", url: "/docs/main/配置详解", icon: "fas fa-cog" }
        ],
        icon: "fas fa-graduation-cap"
      },
      {
        text: "参考",
        url: "/docs/main/参考"
      },
      {
        text: "GitHub",
        url: "https://github.com/LoosePrince/EasyDocument",
        icon: "fab fa-github",
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
      badge: "v2.0.0 · React + Vite · 预渲染",
      title: "EasyDocument",
      subtitle: "内容与代码分离的静态文档系统",
      description:
        "文档存在独立的 git 分支里，构建时预渲染为真实路径的静态页面。网页端就地编辑、实时预览，一键提交后再手动重建上线。",
      logo: "/assets/img/logo.svg",
      search_placeholder: "搜索文档…", // 留空则隐藏首屏搜索框
      button_text: "开始阅读",
      button_link: "/docs/main",
      secondary_text: "编辑与发布",
      secondary_link: "/docs/main/编辑与发布"
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
      { value: "双模式", label: "预览 / 分栏" }
    ],

    // 特性卡片
    features: [
      {
        icon: "fas fa-feather",
        title: "内容与代码分离",
        description: "文档放在独立 git 分支，改内容不碰代码仓库，版本历史互不干扰",
        color: "blue"
      },
      {
        icon: "fas fa-paint-brush",
        title: "真实路径预渲染",
        description: "每个文档都有独立 HTML，直链刷新可用、可被搜索引擎收录",
        color: "orange"
      },
      {
        icon: "fas fa-cog",
        title: "配置即站点",
        description: "一份 config.js 控制导航、首页、布局、搜索与页脚，旧配置原样兼容",
        color: "green"
      },
      {
        icon: "fas fa-pen-to-square",
        title: "网页端编辑",
        description: "就地编辑、实时预览，保存为本地草稿，确认后一键提交",
        color: "purple"
      },
      {
        icon: "fas fa-layer-group",
        title: "多版本文档",
        description: "内容分支下每个目录是一个版本，切换版本保留文档结构",
        color: "cyan"
      },
      {
        icon: "fas fa-magnifying-glass",
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
      button_link: "/docs/main/快速入门"
    },

    // 首页快捷入口（每条都必须指向真实页面）
    quick_links: [
      {
        title: "快速入门",
        description: "安装、第一篇文档、部署",
        url: "/docs/main/快速入门",
        icon: "fas fa-rocket"
      },
      {
        title: "编辑与发布",
        description: "就地编辑、草稿、提交与重建",
        url: "/docs/main/编辑与发布",
        icon: "fas fa-pen-to-square"
      },
      {
        title: "配置详解",
        description: "站点、布局、首页、搜索、页脚",
        url: "/docs/main/配置详解",
        icon: "fas fa-cog"
      },
      {
        title: "参考",
        description: "Markdown 语法与故障排查",
        url: "/docs/main/参考",
        icon: "fas fa-book-open"
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
      { name: "main", label: "v2.0.0" }
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
    // 外部文档挂载（仅在默认版本下生效）
    // mode: "path_json" 填外部 path.json 链接；"github_tree" 填 GitHub 目录链接
    external_docs: []
  },

  // ============ 搜索 ============
  search: {
    enable: true,
    min_chars: 2, // 触发搜索的最小字符数
    max_results: 20,
    placeholder: "搜索文档…",
    search_cached: true, // 同时搜索浏览器内缓存的正文
    search_on_type: true, // 输入即搜
    match_distance: 50 // 结果片段中多次命中的最小间隔
  },

  // ============ 扩展 ============
  extensions: {
    math: true, // KaTeX（$…$、$$…$$）
    highlight: true, // 代码高亮（shiki，双主题）
    mermaid: true, // Mermaid 图表
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
    },
    cache_menu: {
      enable: true // 预留：缓存菜单入口
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
  }
};

export default config;
