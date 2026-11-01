/**
 * EasyDocument 配置文件
 */

const config = {
  // 网站基本信息
  site: {
    name: "EasyDocument", // 网站名称
    title: "EasyDocument · 静态文档系统", // 网站标题，显示在浏览器标签页
    description: "内容与代码分离的静态文档系统：预渲染真实路径，网页端就地编辑并一键重建。", // 网站描述，用于SEO
    keywords: "文档,静态网站,Markdown,SSG", // 网站关键词，用于SEO
    base_url: "/" // 网站基础URL，如果部署在子目录则需要修改
  },

  // 外观设置
  appearance: {
    logo: "/assets/img/logo.svg", // 网站Logo路径
    favicon: "/assets/img/favicon.ico", // 网站图标路径
    theme_color: "#3b82f6", // 主题色(蓝色)
    default_dark_mode: "auto", // 默认是否启用暗黑模式
    font_family: "system-ui, -apple-system, sans-serif" // 字体设置
  },

  // 布局设置
  layout: {
    show_header: true, // 是否显示顶栏
    header_file: "/header.html", // 自定义顶栏文件路径
    show_footer: true, // 是否显示底栏
    footer_file: "/footer.html", // 自定义底栏文件路径
    sidebar_width: "250px", // 侧边栏宽度
    toc_width: "280px", // 目录宽度
    mobile_breakpoint: "1024px" // 移动设备断点
  },

  // 动画设置
  animation: {
    enable: true, // 动画总开关，设置为false时将禁用所有动画效果，优先级高于各子模块设置

    // 左侧边栏（文档导航）
    sidebar: {
      enable: true, // 是否启用左侧导航交错动画
      duration: 200, // 交错动画持续时间(毫秒)
      stagger_delay: 50, // 交错动画间隔时间(毫秒)
      enable_skeleton: true, // 是否启用骨架屏加载动画
      skeleton_duration: 1500 // 骨架屏shimmer动画周期(毫秒)
    },

    // 右侧边栏（文章目录）
    toc: {
      enable: true, // 是否启用右侧目录交错动画
      duration: 200, // 交错动画持续时间(毫秒)
      stagger_delay: 50, // 交错动画间隔时间(毫秒)
      enable_skeleton: true, // 是否启用骨架屏加载动画
      skeleton_duration: 1500 // 骨架屏shimmer动画周期(毫秒)
    },

    // 文章内容
    article: {
      enable_skeleton: true, // 是否启用文章加载骨架屏动画
      enable_render: true, // 是否启用文章内容渲染动画（淡入）
      render_duration: 600 // 渲染动画持续时间(毫秒)
    },

    // 通用设置
    general: {
      min_duration: 300 // 加载动画最小显示时长(毫秒) - 确保用户能看到加载过程
    }
  },

  // 导航设置
  navigation: {
    home_text: "首页", // 首页链接文本
    breadcrumb: true, // 是否显示面包屑导航
    auto_collapse: true, // 自动折叠非当前文档的目录
    back_to_top: true, // 显示返回顶部按钮
    prev_next_buttons: true, // 显示上一篇/下一篇导航
    folder_expand_mode: 5, // 文件夹默认展开方式：1-展开全部第一级文件夹，2-展开全部文件夹，3-展开第一个文件夹的第一级，4-展开第一个文件夹的全部文件夹，5-不默认展开任何文件夹
    nav_links: [ // 导航栏链接
      {
        text: "首页",
        url: "/",
      },
      {
        text: "文档",
        url: "main/",
      },
      {
        text: "教程",
        url: [
          {
            text: "快速开始",
            url: "main/#快速入门/",
            icon: "fas fa-rocket"
          },
          {
            text: "使用指南",
            url: "main/#使用指南/",
            icon: "fas fa-book"
          },
          {
            text: "编辑与发布",
            url: "main/#使用指南/基本使用流程",
            icon: "fas fa-cog"
          }
        ],
        icon: "fas fa-graduation-cap"
      },
      {
        text: "GitHub",
        url: "https://github.com/LoosePrince/EasyDocument",
        icon: "fab fa-github",
        external: true
      }
    ]
  },

  // 首页设置
  home: {
    use_file: false, // 是否使用外部HTML文件作为首页内容
    file_path: "/home.html", // 首页内容文件路径
    // 如果 use_file 为 false，则使用以下配置动态生成内容
    hero: {
      badge: "v2 · React + Vite · 静态预渲染", // Hero 上方胶囊标签，留空则不显示
      title: "EasyDocument",
      subtitle: "内容与代码分离的静态文档系统",
      description:
        "文档存在独立的 git 分支里，构建时预渲染成真实路径的静态页面。网页端即可编写、调整配置，一键重建上线。",
      logo: "/assets/img/logo.svg",
      search_placeholder: "搜索文档…", // 留空则不显示 Hero 搜索框
      button_text: "开始阅读",
      button_link: "/docs/main",
      secondary_text: "编辑指南",
      secondary_link: "/docs/main/使用指南"
    },

    // 首页各区块开关与标题
    sections: {
      features: { enable: true, title: "核心特性", description: "开箱即用，专注于内容本身" },
      docs: { enable: true, title: "文档", description: "按版本浏览，链接可分享、可被检索" },
      code_demo: {
        enable: true,
        title: "Markdown 驱动",
        description: "同一套渲染管线：所见即最终发布效果"
      },
      get_started: { enable: true, title: "快速开始", description: "三步开始写第一篇文档" }
    },

    // 首页亮点数字（可留空数组）
    stats: [
      { value: "SSG", label: "预渲染输出" },
      { value: "真实路径", label: "无 hash 路由" },
      { value: "就地编辑", label: "实时预览" },
      { value: "一键", label: "触发重建" }
    ],

    features: [
      {
        icon: "fas fa-feather",
        title: "内容与代码分离",
        description: "文档存放在独立分支，改内容不必碰代码仓库",
        color: "blue"
      },
      {
        icon: "fas fa-paint-brush",
        title: "真实路径预渲染",
        description: "每个文档都有独立 HTML，直链刷新与 SEO 都友好",
        color: "orange"
      },
      {
        icon: "fas fa-cog",
        title: "网页端编辑",
        description: "就地编辑、实时预览，提交后一键触发重建",
        color: "green"
      }
    ],

    // 首页代码演示区：左侧源码，右侧为同管线渲染结果
    code_demo: {
      filename: "README.md",
      content:
        "# 我的文档\n\n> [TIP] 支持提示框、数学公式与 Mermaid 图表。\n\n- 真实路径 + 预渲染，SEO 友好\n- 内容与代码分离，独立 git 分支托管\n- 网页端直接编辑并一键重建\n\n行内公式 $E = mc^2$，下面是代码高亮：\n\n```ts\nexport const hello = (name: string) => `Hello, ${name}`;\n```\n"
    },

    // 快速开始指南
    get_started: {
      enable: true,
      title: "快速开始使用",
      steps: [
        { title: "编写文档", description: "在内容分支对应版本目录下新建 .md 或 .html 文件" },
        { title: "在网页端编辑", description: "点击「编辑此页」就地书写，右侧实时预览最终效果" },
        { title: "提交并重建", description: "顶部工具条提交到内容分支，再点「重建站点」发布" }
      ],
      button_text: "立即开始",
      button_link: "/docs/main"
    }
  },

  // 文档设置
  document: {
    root_dir: "/", // 文档根目录（v2 中 data 分支的根即为文档根，留空或 "/" 均可）
    branch_support: true, // 是否启用版本分支（对应 data 分支下的子目录）
    default_branch: "main", // 默认版本名称
    available_branches: [ // 可用版本列表（与 data 分支下子目录一致，不存在的目录会被自动隐藏）
      { name: "main", label: "main" }
    ],
    default_page: "README.md", // 默认文档
    index_pages: ["README.md", "README.html", "index.md", "index.html"], // 索引页文件名
    supported_extensions: [".md", ".html"], // 支持的文档扩展名
    toc_depth: 3, // 目录深度，显示到几级（h1~hx）标题
    toc_numbering: true, // 目录是否显示编号（如1，2.3，5.1.3）
    toc_ignore_h1: true, // 生成目录编号时是否忽略h1标题，避免所有标题都以1开头
    toc_dynamic_expand: true, // 是否启用动态展开功能
    code_copy_button: true, // 代码块是否显示复制按钮
    code_block: {
      line_numbers: true, // 是否显示行号
      start_line: 1, // 起始行号
      theme: {
        light: "github", // 亮色主题
        dark: "github-dark" // 暗色主题
      }
    },
    // 外部文档挂载（仅在默认分支下生效，不参与版本分支切换）
    // mode: "path_json" | "github_tree"
    // - path_json: url 填写外部 path.json 的完整链接
    // - github_tree: url 填写 GitHub 目录链接，例如：
    //   https://github.com/LoosePrince/EasyDocument/tree/main/data/main
    external_docs: [
      // {
      //   mount_path: "外部文档",
      //   mode: "path_json",
      //   url: "https://example.com/docs/path.json",
      //   title: "外部文档"
      // },
      // {
      //   mount_path: "GitHub文档",
      //   mode: "github_tree",
      //   url: "https://github.com/owner/repo/tree/main/docs",
      //   title: "GitHub文档"
      // }
    ]
  },

  // 搜索功能
  search: {
    enable: true, // 已启用搜索
    min_chars: 2, // 最小搜索字符数
    max_results: 20, // 最大结果数
    placeholder: "搜索文档...", // 搜索框占位符文本
    search_cached: true, // 是否搜索缓存的文档内容
    search_on_type: true, // 是否在输入时自动搜索
    match_distance: 50 // 搜索结果中多个匹配项之间的最小字符距离
  },

  // 插件与扩展
  extensions: {
    math: true, // 数学公式支持(KaTeX)
    highlight: true, // 语法高亮
    mermaid: true, // Mermaid图表渲染
    github: {
      enable: true, // 是否启用GitHub相关功能
      repo_url: "https://github.com/LoosePrince/EasyDocument", // GitHub仓库地址
      edit_link: true, // 是否启用参与编辑链接（点击一键跳转github的编辑）
      branch: "main", // 默认分支名称
      show_avatar: true // 显示参与编辑者的github头像而不是名称
    },
    git: {
      enable: true, // 是否启用Git相关功能
      show_last_modified: true, // 启用文档最后编辑时间显示
      show_contributors: true // 启用参与者名称显示
    },

    // 进度条显示控制
    progress_bar: {
      enable: true // 是否显示文档顶部的阅读进度条，设置为false时隐藏进度指示器
    },

    // 缓存菜单显示控制
    cache_menu: {
      enable: true // 是否显示右下角的缓存菜单按钮，设置为false时隐藏缓存管理入口但不影响缓存功能本身
    }
  },

  // 页脚设置
  footer: {
    // 版权信息
    copyright: "© 2025 EasyDocument",

    // 技术支持信息配置
    // enable: 是否显示整块 powered by 行
    powered_by: {
      enable: true,
      text: "使用以下技术栈构建：",
      links: [
        {
          text: "React",
          url: "https://react.dev",
          external: true
        },
        {
          text: "Vite",
          url: "https://vite.dev",
          external: true
        },
        {
          text: "TailwindCSS",
          url: "https://tailwindcss.com",
          external: true
        }
      ]
    },

    // 页脚链接（资源区）
    links: [
      {
        text: "GitHub",
        url: "https://github.com/LoosePrince/EasyDocument"
      },
      {
        text: "报告问题",
        url: "https://github.com/LoosePrince/EasyDocument/issues"
      }
    ],

    // 备案信息配置
    // icp: 最多 1~3 条记录，每条记录为 { text: '备案号', url: '链接(可选)' }
    // position: "top" 显示在版权信息附近；"bottom" 显示在页脚最底部信息行
    beian: {
      enable: false,
      icp: [],
      position: "bottom"
    },

    // 列配置：控制页脚中部各列的展示与类型
    columns: [
      { key: "nav", title: "导航", type: "nav", enable: true },
      { key: "links", title: "资源", type: "links", enable: true },
      { key: "stack", title: "技术栈", type: "stack", enable: true }
    ]
  }
};

// 导出配置
export default config; 