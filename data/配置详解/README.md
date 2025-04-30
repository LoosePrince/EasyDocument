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
    logo: "assets/img/logo.svg", // 网站Logo路径
    favicon: "assets/img/favicon.ico", // 网站图标路径
    theme_color: "#3b82f6", // 主题色(蓝色)
    default_dark_mode: "auto", // 默认是否启用暗黑模式
    font_family: "system-ui, -apple-system, sans-serif" // 字体设置
  },

  // 布局设置
  layout: {
    show_header: true, // 是否显示顶栏
    use_custom_header: false, // 是否使用自定义的header.html文件
    header_file: "header.html", // 自定义顶栏文件路径
    show_footer: true, // 是否显示底栏
    use_custom_footer: true, // 是否使用自定义的footer.html文件
    footer_file: "footer.html", // 自定义底栏文件路径
    sidebar_width: "250px", // 侧边栏宽度
    toc_width: "220px", // 目录宽度
    mobile_breakpoint: "768px" // 移动设备断点
  },

  // 导航设置
  navigation: {
    home_text: "首页", // 首页链接文本
    breadcrumb: true, // 是否显示面包屑导航
    auto_collapse: true, // 自动折叠非当前文档的目录
    back_to_top: true, // 显示返回顶部按钮
    prev_next_buttons: true, // 显示上一篇/下一篇导航
    nav_links: [ // 导航栏链接
      {
        text: "首页",
        url: "index.html"
      },
      {
        text: "文档",
        url: "main.html"
      },
      {
        text: "GitHub",
        url: "https://github.com/LoosePrince/EasyDocument",
        icon: "github",
        external: true
      }
    ]
  },

  // 文档设置
  document: {
    root_dir: "data", // 文档根目录
    default_page: "README.md", // 默认文档
    index_pages: ["README.md", "README.html", "index.md", "index.html"], // 索引页文件名
    supported_extensions: [".md", ".html"], // 支持的文档扩展名
    toc_depth: 3, // 目录深度，显示到几级（h1~hx）标题
    toc_numbering: true, // 目录是否显示编号（如1，2.3，5.1.3）
    code_copy_button: true, // 代码块是否显示复制按钮
  },

  // 搜索功能
  search: {
    enable: false, // 是否启用搜索
    min_chars: 2, // 最小搜索字符数
    max_results: 20, // 最大结果数
    placeholder: "搜索文档..." // 搜索框占位符文本
  },

  // 插件与扩展
  extensions: {
    math: true, // 数学公式支持(KaTeX)
    highlight: true, // 语法高亮
  },

  // 页脚设置
  footer: {
    copyright: "© 2025 EasyDocument", // 版权信息
    show_powered_by: true, // 显示技术支持信息
    links: [ // 页脚链接
      {
        text: "GitHub",
        url: "https://github.com/LoosePrince/EasyDocument"
      },
      {
        text: "报告问题",
        url: "https://github.com/LoosePrince/EasyDocument/issues"
      }
    ]
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

- [外观设置](?path=配置详解/外观设置.md)
- [path.json 结构与手动编写](?path=配置详解/path-json结构.md)
- [GitHub与Git功能](?path=配置详解/GitHub与Git功能.md) 