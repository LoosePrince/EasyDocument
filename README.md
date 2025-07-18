# EasyDocument - 简易静态文档系统

## 项目概述

EasyDocument 是一个轻量级、免编译的纯静态前端文档系统。它允许用户通过简单地添加 Markdown 或 HTML 文件到 `/data` 目录，即可自动生成美观、结构化的文档网站。无需后端支持，纯前端实现，简单易用。

**新特性**:
- 🖱️ 右键菜单功能：复制链接、生成MD格式链接、快速预览（v1.2.5+）
- 🔗 新版链接格式：更简洁的 `main/#path/file` 格式（v1.2.7+）

## 设计风格

![image](https://github.com/user-attachments/assets/f9a14da2-d50a-421d-8805-de2eda484da8)


## 技术栈

- **TailwindCSS**: 用于快速构建现代化响应式界面
- **FontAwesome**: 丰富的图标库
- **Alpine.js**: 轻量级JavaScript框架，用于实现交互功能
- **Marked.js**: 将Markdown转换为HTML
- **Mermaid**: 流程图和序列图
- **KaTeX**: 数学公式渲染
- **Canvg**: 矢量图渲染
- **原生JavaScript**: 右键菜单、链接处理、主题切换等核心功能

## 项目结构

```
EasyDocument/
├── index.html          # 网站首页（项目首页，如项目介绍、"开始"进入文档页）
├── header.html         # 全局顶栏（可选）
├── footer.html         # 全局底栏（可选）
├── main.html           # 重定向
├── config.js           # 网站配置文件
├── path.json           # 文档路径文件（data文件夹中的文档结构）
├── search.json         # 搜索索引文件
├── build.py            # 一键创建文档路径脚本
├── path-editor.html    # 可视化路径编辑器
├── requirements.txt    # Python依赖文件
├── LICENSE             # 开源协议
├── main/
│   └── index.html      # 文档页面模板（文档首页，文档渲染，基于get属性）
├── assets/             # 静态资源
│   ├── css/            # CSS文件
│   │   ├── style.css           # 主样式文件
│   │   ├── md.css              # Markdown渲染样式
│   │   └── context-menu.css    # 右键菜单样式
│   ├── js/             # JavaScript文件
│   │   ├── main.js             # 主要功能逻辑
│   │   ├── document-page.js    # 文档页面处理
│   │   ├── content-renderer.js # 内容渲染模块
│   │   ├── sidebar-navigation.js # 侧边栏导航模块
│   │   ├── context-menu.js     # 右键菜单功能
│   │   ├── cache-manager.js    # 缓存管理
│   │   ├── document-cache.js   # 文档缓存
│   │   ├── navigation.js       # 导航功能
│   │   ├── progress-bar.js     # 进度条组件
│   │   ├── theme.js            # 主题切换
│   │   ├── image-modal.js      # 图片放大模态框
│   │   ├── utils.js            # 通用工具函数
│   │   ├── sundry.js           # 杂项功能
│   │   ├── katex-handler.js    # 数学公式处理
│   │   ├── mermaid-handler.js  # 图表处理
│   │   └── tailwindcss.js      # TailwindCSS框架
│   └── img/            # 图片资源
│       ├── favicon.ico         # 网站图标
│       └── logo.svg            # 网站Logo
└── data/               # 文档存储目录
    ├── README.md       # 根目录文档
    ├── 分类1/
    │   ├── README.md   # 分类1的介绍文档
    │   ├── 文档1.md     # 具体文档
    │   ├── 文档2.html   # HTML格式文档
    │   └── 分类3/
    │       ├── README.md   # 分类3的介绍文档
    │       └── ...
    └── 分类2/
        ├── README.md   # 分类2的介绍文档
        └── ...
```

## 核心功能

### 1. 文档自动识别与渲染

- 自动识别 `/data` 目录中的 Markdown (.md) 和 HTML (.html) 文件
- 支持嵌套目录结构，自动生成文档树
- 智能解析文档标题和目录结构

### 2. 界面布局

- **左侧边栏**: 显示完整的文档目录结构
- **中间区域**: 渲染当前选中的文档内容
- **右侧边栏**: 显示当前文档的目录导航（标题和子标题）

### 3. 导航功能

- 目录树自动展开/折叠
- 面包屑导航
- 文档内锚点跳转
- 移动设备适配的响应式设计

### 4. 右键菜单功能 (v1.2.5+)

- **<i class="fas fa-copy"></i> 复制链接**: 快速复制文档或文件夹的完整链接地址
- **<i class="fas fa-file-alt"></i> 复制MD格式链接**: 自动生成 `[标题](链接)` 格式的Markdown链接
- **<i class="fas fa-eye"></i> 预览文档**: 在弹窗中快速预览文档内容，支持主题切换

支持的元素：
- 左侧导航栏的文档链接和文件夹
- 右侧目录中的标题链接
- 文档内容中的内部链接
- 面包屑导航和顶部导航链接

### 5. 新版链接格式 (v1.2.7+)

EasyDocument 引入了更简洁的链接格式：

**新格式**: `main/#root/path/to/file#anchor`
- 更简洁、直观的路径表示
- SEO友好，更适合分享
- 类似文件系统的路径结构

**兼容性**: 继续支持旧的查询参数格式 `main.html?path=xxx&root=xxx#anchor`

**推荐用法**:
- 文档内链接优先使用 Markdown 相对路径: `[文档](./path/file)`
- 特殊需求使用新哈希格式: `[文档](main/#path/file)`
- 右键菜单自动生成最适合的链接格式

## 配置系统

项目使用 `config.js` 文件进行全局配置，可自定义以下内容：

- **网站基本信息**: 网站名称、标题、描述、关键词等
- **外观设置**: Logo、图标、主题色、字体等
- **布局设置**: 侧边栏位置、宽度、移动端断点等
- **导航设置**: 面包屑、自动折叠、上/下一篇导航等
- **文档设置**: 支持的文件类型、目录深度、代码复制按钮等
- **搜索功能**: 搜索设置、结果数量限制等
- **扩展功能**: 数学公式、图表、语法高亮等支持
- **自定义代码**: 添加额外的脚本和样式

详细配置项请参考 `config.js` 文件中的注释说明。

## 文档组织规则

1. 每个目录可以包含一个 `README.md` 或 `README.html` 文件，作为该目录的介绍文档
   - 例如: `/data/工具/README.md` 将作为"工具"分类的介绍文档
   
2. 其他文档按照以下规则组织:
   - 例如: `/data/工具/Git使用指南.md` 将显示为"工具"分类下的"Git使用指南"文档
   
3. 如果目录没有 README 文件，则该目录在导航中不可点击，仅作为分类存在

## 使用方法

### 基本使用流程

1. 将文档 (.md 或 .html) 放入 `/data` 目录
2. 按照需要组织目录结构
3. 根据需要修改 `config.js` 文件自定义网站
4. 运行 `build.py` 脚本生成文档路径（可选，用于生成文档路径，你可以自己手写）
5. 直接通过浏览器访问 `index.html`

### 右键菜单使用

- 在任何文档链接或文件夹上右键点击即可使用菜单功能
- 支持复制链接、生成Markdown格式链接、快速预览
- 使用 `ESC` 键可以关闭预览窗口和右键菜单

### 自定义外观

- 修改 `header.html` 和 `footer.html` 自定义网站的顶栏和底栏
- 通过 TailwindCSS 类调整样式
- 在 `config.js` 中调整颜色、字体等设置

## 部署说明

作为纯静态项目，EasyDocument 可以部署在任何静态文件服务器上:

1. 将整个项目目录复制到服务器的 Web 根目录
2. 或部署到 GitHub Pages, Netlify, Vercel 等静态网站托管服务

## 浏览器兼容性

支持所有现代浏览器，包括:
- Chrome, Firefox, Safari, Edge 的最新版本
- 不保证支持 IE 浏览器