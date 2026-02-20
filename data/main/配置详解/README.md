# 配置详解

本节详细介绍 EasyDocument 系统的配置选项。通过调整 `config.js` 文件，您可以自定义网站的外观、行为和功能，以满足您的特定需求。

## 配置文件路径

配置文件位于项目根目录下的 `config.js`。这是一个标准的 JavaScript 模块，导出一个包含所有配置选项的对象。


## 配置文件示例

以下是完整的 `config.js` 文件示例，包含所有可用选项及其默认值：

```javascript
/**
 * EasyDocument 配置文件
 */

const config = {
  // 网站基本信息
  site: {
    name: "EasyDocument", // 网站名称
    title: "简易静态文档系统", // 网站标题，显示在浏览器标签页
    description: "一个轻量级、免编译的纯静态前端文档系统", // 网站描述，用于SEO
    keywords: "文档,静态网站,Markdown,Alpine.js", // 网站关键词，用于SEO
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
    toc_width: "280px", // 右侧目录宽度
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
      { text: "首页", url: "/" },
      {
        text: "文档",
        url: "main/",
        icon: "fas fa-file-lines"
      },
      {
        text: "教程",
        url: [
          { text: "快速开始", url: "main/#/快速入门", icon: "fas fa-rocket" },
          { text: "使用指南", url: "main/#/使用指南", icon: "fas fa-book" },
          { text: "详细配置", url: "main/#/配置详解", icon: "fas fa-cog" }
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

  // 首页设置（详见 首页设置.md）
  home: {
    use_file: false, // 是否使用外部HTML文件作为首页内容
    file_path: "/home.html", // 首页内容文件路径（use_file 为 true 时生效）
    hero: { title: "EasyDocument", subtitle: "简易静态文档系统", description: "...", logo: "/assets/img/logo.svg", button_text: "查看文档", button_link: "/main/" },
    features: [ /* 特性卡片：icon, title, description, color */ ],
    get_started: { enable: true, title: "快速开始使用", steps: [ /* { title, description } */ ], button_text: "立即开始", button_link: "/main/" }
  },

  // 文档设置
  document: {
    root_dir: "/data", // 文档根目录
    branch_support: true, // 是否启用分支支持
    default_branch: "main", // 默认分支名称
    available_branches: [ { name: "main", label: "main" } ], // 可用分支列表（与 data/ 下目录一致）
    default_page: "README.md", // 默认文档
    index_pages: ["README.md", "README.html", "index.md", "index.html"], // 索引页文件名
    supported_extensions: [".md", ".html"], // 支持的文档扩展名
    toc_depth: 3, // 目录深度，显示到几级（h1~hx）标题
    toc_numbering: true, // 目录是否显示编号（如1，2.3，5.1.3）
    toc_ignore_h1: true, // 生成目录编号时是否忽略h1标题
    toc_dynamic_expand: true, // 是否启用目录动态展开功能
    code_copy_button: true, // 代码块是否显示复制按钮
    code_block: { line_numbers: true, start_line: 1, theme: { light: "github", dark: "github-dark" } } // 代码块行号与亮/暗色主题
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

  // 页脚设置（详见 站点与页脚.md）
  footer: {
    copyright: "© 2025 EasyDocument", // 版权信息
    powered_by: { enable: true, text: "使用以下技术栈构建：", links: [ /* ... */ ] }, // 技术支持信息
    links: [ { text: "GitHub", url: "..." }, { text: "报告问题", url: "..." } ], // 页脚「资源」区链接
    beian: { enable: false, icp: [], position: "bottom" }, // 备案信息（position: "top"|"bottom"）
    columns: [ { key: "nav", title: "导航", type: "nav", enable: true }, { key: "links", title: "资源", type: "links", enable: true }, { key: "stack", title: "技术栈", type: "stack", enable: true } ] // 页脚中部各列展示与开关
  }
};

// 导出配置
export default config; 
```

## 配置修改方法

要修改配置，请按照以下步骤操作：

1. 打开项目根目录下的 `config.js` 文件
2. 找到需要修改的配置项
3. 更改其值为您需要的设置
4. 保存文件
5. 刷新浏览器查看更改效果

## 配置注意事项

- 修改配置后无需重新构建，系统会在页面加载时读取最新配置
- 保持 JavaScript 语法的正确性，包括逗号、引号等
- 路径配置（如 logo、favicon 等）可以使用相对路径或绝对路径
- 某些设置可能与其他设置有关联，请阅读每个配置项的详细说明

## 配置实例

以下是一些常见的配置修改场景：

### 修改网站标题和描述

```javascript
site: {
  name: "我的项目文档",
  title: "项目技术文档中心",
  description: "提供项目的架构、API和使用说明",
  keywords: "项目文档,技术文档,API文档",
  base_url: "/"
}
```

### 更改主题颜色

```javascript
appearance: {
  // ... 其他设置
  theme_color: "#10b981", // 绿色主题
  // ... 其他设置
}
```

### 调整侧边栏宽度

```javascript
layout: {
  // ... 其他设置
  sidebar_width: "300px", // 更宽的侧边栏
  // ... 其他设置
}
```

## 下一步

查看各分类的详细配置说明，了解每个配置项的功能和可选值：

- [首页设置](配置详解/首页设置.md)
- [站点与页脚配置](配置详解/站点与页脚.md)
- [外观设置](配置详解/外观设置.md)
- [布局与导航配置](配置详解/layout与导航.md)
- [动画参数配置](配置详解/动画参数.md)
- [文档与插件配置](配置详解/文档与插件.md)
- [搜索功能配置](配置详解/搜索功能.md)
- [path.json 结构与手动编写](配置详解/path-json结构.md)
- [GitHub与Git功能](配置详解/GitHub与Git功能.md)
- [配置验证和默认值处理](配置详解/配置验证.md) 