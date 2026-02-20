# 布局与导航配置

本文档详细介绍 EasyDocument 系统中布局（`layout`）和导航（`navigation`）相关的配置选项，这些选项控制文档系统的整体界面结构和导航体验。

## 布局设置

布局设置决定了文档页面的基本结构，包括顶栏、底栏、侧边栏和内容区域的显示方式。

### 可用配置项

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|-------|------|
| `show_header` | 布尔值 | `true` | 是否显示顶栏 |
| `header_file` | 字符串 | `"/header.html"` | 顶栏 HTML 文件路径 |
| `show_footer` | 布尔值 | `true` | 是否显示底栏 |
| `footer_file` | 字符串 | `"/footer.html"` | 底栏 HTML 文件路径 |
| `sidebar_width` | 字符串 | `"250px"` | 侧边栏宽度 |
| `toc_width` | 字符串 | `"280px"` | 右侧目录宽度 |
| `mobile_breakpoint` | 字符串 | `"1024px"` | 移动设备断点 |

### 详细说明

#### show_header 和 show_footer

控制页面顶部和底部栏是否显示。设为 `false` 时，对应的栏将被完全隐藏。

```javascript
layout: {
  show_header: false, // 隐藏顶栏
  show_footer: true   // 显示底栏
}
```

#### header_file 和 footer_file

顶栏、底栏显示时使用的 HTML 文件路径，通常为项目根目录下的自定义文件。

```javascript
layout: {
  header_file: "/header.html",
  footer_file: "/footer.html"
}
```

可在这些文件中插入自定义导航、品牌或版权信息。

#### sidebar_width 和 toc_width

控制左侧导航栏和右侧目录的宽度。可以使用任何有效的CSS宽度值（如`px`、`em`、`rem`、`%`等）。

*右侧目录支持宽度拖动调整，双击拖动条可恢复为默认宽度（由`toc_width`配置项决定）。*

```javascript
layout: {
  sidebar_width: "300px", // 更宽的侧边栏
  toc_width: "250px"      // 更宽的目录
}
```

调整这些值可以在不同设备上优化阅读体验，特别是对于具有复杂结构的文档或长标题。

#### mobile_breakpoint

定义移动设备的断点，低于此宽度的设备将使用移动布局（隐藏侧边栏，使用下拉菜单代替）。

```javascript
layout: {
  mobile_breakpoint: "992px" // 在更宽的屏幕上使用移动布局
}
```

## 导航设置

导航设置控制用户在文档之间导航的体验，包括导航链接、面包屑、文档索引等。

### 可用配置项

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|-------|------|
| `home_text` | 字符串 | `"首页"` | 首页链接文本 |
| `breadcrumb` | 布尔值 | `true` | 是否显示面包屑导航 |
| `auto_collapse` | 布尔值 | `true` | 自动折叠非当前文档的目录 |
| `back_to_top` | 布尔值 | `true` | 显示返回顶部按钮 |
| `prev_next_buttons` | 布尔值 | `true` | 显示上一篇/下一篇导航 |
| `folder_expand_mode` | 数字 | `5` | 文件夹默认展开方式 |
| `nav_links` | 数组 | `[...]` | 导航栏链接 |

### 详细说明

#### home_text

设置顶部导航中首页链接的显示文本。

```javascript
navigation: {
  home_text: "主页"
}
```

#### breadcrumb

控制是否在文档顶部显示面包屑导航，帮助用户了解当前文档在整体结构中的位置。

```javascript
navigation: {
  breadcrumb: false // 不显示面包屑导航
}
```

面包屑导航对于具有深层次结构的文档非常有用，它显示从根目录到当前页面的路径。

#### auto_collapse

控制侧边栏导航中的目录是否自动折叠。设为 `true` 时，只有当前文档所在的目录路径会展开，其他目录会折叠，使导航更加清晰。

```javascript
navigation: {
  auto_collapse: false // 不自动折叠目录
}
```

关闭此功能可以让用户看到完整的导航结构，但在大型文档系统中可能会使导航栏过长。

#### folder_expand_mode

控制文档目录在初始加载时的默认展开方式。可以设置为以下值：

| 值 | 说明 |
|---|------|
| `1` | 展开全部第一级文件夹 |
| `2` | 展开全部文件夹（所有层级） |
| `3` | 在根目录时，仅展开第一个文件夹的第一级 |
| `4` | 在根目录时，展开第一个文件夹的全部内容 |
| `5` | 不默认展开任何文件夹（默认值） |

此设置会与 `auto_collapse` 设置一起影响侧边栏导航的显示方式。如果两者同时启用，系统会首先按照 `folder_expand_mode` 展开文件夹，然后在用户导航时应用 `auto_collapse` 的行为。

```javascript
navigation: {
  folder_expand_mode: 1, // 默认展开所有第一级文件夹
  auto_collapse: true    // 但仍在导航时折叠非当前路径
}
```

这个设置特别适合以下情况：

- 值 `1`：适合文档层次清晰，希望用户一眼看到所有主要类别的情况
- 值 `2`：适合小型文档，希望用户一览无余地看到所有内容
- 值 `3` 或 `4`：适合有明确默认类别或推荐阅读路径的文档
- 值 `5`：适合大型文档，避免侧边栏过长，让用户按需展开

#### back_to_top 和 prev_next_buttons

控制是否显示返回顶部按钮和文档间导航按钮。

```javascript
navigation: {
  back_to_top: true,        // 显示返回顶部按钮
  prev_next_buttons: false  // 不显示上一篇/下一篇导航
}
```

返回顶部按钮在长文档中很有用，而上一篇/下一篇导航允许用户按照预定的顺序浏览文档。

#### nav_links

定义显示在顶部导航栏中的链接。每个链接项可以包含以下属性：

- `text`: 链接显示文本
- `url`: 链接目标URL或下拉菜单项数组（支持折叠菜单）
- `icon`: 可选的图标名称（支持的值取决于FontAwesome 6图标库）
- `external`: 布尔值，指示链接是否应在新标签页中打开

##### 图标使用说明

EasyDocument使用FontAwesome 6图标库，在配置中使用图标时需注意：

1. 图标名称直接使用FontAwesome的名称，**需要**添加如`fas`、`fab`等前缀，例如：
   - `fas fa-house` - 首页图标
   - `fab fa-github` - GitHub图标
2. 注意FontAwesome 6中一些图标名称与之前版本不同，如：
   - `home` → `house`
   - `file-alt` → `file-lines`

3. 常用图标参考：
   - `house` - 首页图标
   - `file-lines` - 文档图标
   - `graduation-cap` - 教程图标
   - `book` - 书籍图标
   - `cog` - 设置图标
   - `rocket` - 火箭图标
   - `github` - GitHub图标
   - `user` - 用户图标
   - `download` - 下载图标

4. 可以在[FontAwesome官网](https://fontawesome.com/icons)查找更多图标

##### 基本链接配置

```javascript
navigation: {
  nav_links: [
    {
      text: "首页",
      url: "index.html"
    },
    {
      text: "文档",
      url: "main/"
    },
    {
      text: "GitHub",
      url: "https://github.com/LoosePrince/EasyDocument",
      icon: "fab fa-github",
      external: true
    }
  ]
}
```

##### 折叠下拉菜单配置

您可以通过将`url`设置为链接数组来创建折叠式下拉菜单：

```javascript
navigation: {
  nav_links: [
    // 基本链接
    {
      text: "首页",
      url: "index.html",
      icon: "fas fa-house"
    },
    // 折叠下拉菜单
    {
      text: "教程",
      icon: "fas fa-graduation-cap",
      url: [
        {
          text: "快速开始",
          url: "main/#/快速入门/",
          icon: "fas fa-rocket"
        },
        {
          text: "使用指南",
          url: "main/#/高级功能/",
          icon: "fas fa-book"
        }
      ]
    }
  ]
}
```

折叠下拉菜单支持以下特性：

- 点击菜单标题展开/折叠子菜单
- 点击页面其他区域自动折叠子菜单
- 支持在桌面端和移动端不同显示方式的适配
- 子菜单项支持图标和外部链接

您可以添加任意数量的导航链接，但请注意过多的链接可能会影响布局，特别是在移动设备上。

## 布局与导航的配合使用

布局和导航设置通常需要配合使用以创建最佳的用户体验。以下是一些常见的配置组合：

### 紧凑型文档

适合简单或小型文档：

```javascript
layout: {
  sidebar_width: "220px",
  toc_width: "200px"
},
navigation: {
  auto_collapse: false,
  folder_expand_mode: 2, // 展开所有文件夹
  prev_next_buttons: false
}
```

### 复杂大型文档

适合具有多层次结构的大型文档：

```javascript
layout: {
  sidebar_width: "280px",
  toc_width: "250px"
},
navigation: {
  breadcrumb: true,
  auto_collapse: true,
  folder_expand_mode: 1, // 只展开第一级文件夹
  prev_next_buttons: true
}
```

### 自定义顶栏和底栏

使用自定义 HTML 文件进行品牌强化：

```javascript
layout: {
  show_header: true,
  header_file: "/header.html",
  show_footer: true,
  footer_file: "/footer.html"
}
```

在项目根目录或对应路径放置 `header.html`、`footer.html`，编写所需内容即可。

### 导航菜单与下拉组合

组合使用普通链接与下拉菜单创建丰富的导航体验：

```javascript
navigation: {
  nav_links: [
    { text: "首页", url: "index.html" },
    { text: "文档", url: "main/" },
    {
      text: "教程",
      url: [
        { text: "快速开始", url: "main/#/快速入门/" },
        { text: "高级功能", url: "main/#/高级功能/" }
      ]
    },
    {
      text: "资源",
      url: [
        { text: "下载", url: "downloads.html" },
        { text: "社区", url: "https://github.com/LoosePrince/EasyDocument/discussions", external: true }
      ]
    }
  ]
}
```

## 最佳实践

1. **屏幕适配**: 确保在设置宽度时考虑到不同的屏幕尺寸，测试您的文档在各种设备上的显示效果
2. **导航清晰度**: 为复杂文档启用面包屑和自动折叠，帮助用户理解文档结构
3. **文件夹展开策略**: 根据文档结构选择适当的`folder_expand_mode`，大型文档推荐使用`1`或`5`，小型文档可以使用`2`
4. **自定义顶栏底栏**: 仅在有特殊需求时使用自定义HTML，否则使用默认设置以保持一致性
5. **导航链接**: 保持顶部导航链接的简洁，仅包含最重要的链接
6. **下拉菜单**: 使用下拉菜单对相关链接进行分组，而不是在顶部导航栏中放置过多链接
7. **响应式设计**: 确保您的导航在移动设备上同样易于使用，测试不同断点的显示效果

## 相关文档

- [外观设置](配置详解/外观设置.md)
- [配置详解](配置详解/README.md)
- [基本使用流程](使用指南/基本使用流程.md)
