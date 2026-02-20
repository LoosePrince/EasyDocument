# EasyDocument - 简易静态文档系统

## 项目概述

EasyDocument 是一个轻量级、免编译的纯静态前端文档系统。它允许用户通过简单地添加 Markdown 或 HTML 文件到 `/data` 目录，即可自动生成美观、结构化的文档网站。无需后端支持，纯前端实现，简单易用。

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
├── index.html          # 网站首页（项目介绍、入口）
├── main/
│   └── index.html      # 文档页 SPA（基于 hash 路由，渲染 data 下文档）
├── 404.html            # 自定义 404 页
├── header.html         # 全局顶栏（可选）
├── footer.html         # 全局底栏（可选）
├── config.js           # 网站与文档配置（分支、导航、搜索等）
├── meta.json           # 项目元信息（版本、描述等）
├── build.py            # 文档结构/搜索索引生成脚本
├── requirements.txt    # Python 依赖（如 GitPython）
├── LICENSE
├── README.md
├── tool/
│   └── path-editor.html # 可视化 path.json 编辑器
├── assets/
│   ├── css/            # 主样式、Markdown、右键菜单等
│   ├── js/             # 主逻辑、文档页、侧栏、渲染、缓存、主题等
│   └── img/            # favicon、logo 等
└── data/               # 文档根目录（config.js 中 document.root_dir）
    ├── main/           # 默认分支（document.default_branch）
    │   ├── path.json   # 该分支文档树（build.py 生成）
    │   ├── search.json # 该分支搜索索引（build.py 生成）
    │   ├── README.md   # 分支首页
    │   └── 分类/       # 子目录
    │       ├── README.md  # 目录索引（index_pages）
    │       └── 文档.md
    └── 1.3.4/          # 其他分支（可选，与 available_branches 一致）
        ├── path.json
        ├── search.json
        └── ...
```

- 未启用 **分支支持**（`config.js` 中 `document.branch_support: false`）时，文档放在 `data/` 下，`path.json` / `search.json` 由 `build.py` 生成在项目根或 `data/`（视脚本参数而定）。
- 启用 **分支支持** 时，`data/` 下每个子目录（如 `main`、`1.3.4`）对应一个分支，各分支目录内包含自己的 `path.json` 与 `search.json`。

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

### 5. 新版链接格式 (v1.3.5+)

文档页使用 **hash 路由**，链接格式如下。

**默认分支**（如 `main`）：
- 文档链接：`main/#/路径/到/文档`（扩展名可省略）
- 带锚点：`main/#/路径/到/文档#锚点`

**其他分支**（启用 `document.branch_support` 且切换分支时）：
- 格式：`main/#分支名/#/路径/到/文档`，例如 `main/#1.3.4/#/配置详解/README`

**特点**：
- 路径清晰、易分享、对 SEO 友好
- 与「分支 + 路径」一一对应


**推荐**：
- 文档内优先用 Markdown 相对路径：`[文档](./path/file)`，系统会解析为上述 hash 格式
- 需要写死链接时使用：`main/#/使用指南/README` 或带分支的 `main/#分支/#/路径`
- 右键菜单「复制链接」会生成当前使用的 hash 格式

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

1. **索引页**：每个目录可包含一个索引页，由 `config.js` 中 `document.index_pages` 指定（默认包含 `README.md`、`README.html`、`index.md`、`index.html`）。访问该目录时优先加载第一个存在的索引文件。
2. **文档文件**：仅 `document.supported_extensions` 中的扩展名（默认 `.md`、`.html`）会出现在导航与搜索中。
3. **路径与分支**：
   - 未启用分支时：所有文档放在 `data/` 下，按目录层级形成树。
   - 启用分支时：`data/` 下每个子目录为一个分支（如 `data/main/`、`data/1.3.4/`），分支名需与 `document.available_branches` 一致；各分支内再按目录组织文档。
4. **无索引页的目录**：若某目录下没有任何索引页，该目录在导航中仅作分组，不可点击进入；其子文档仍会出现在侧栏中。

## 使用方法

### 基本使用流程

1. **放置文档**：将 `.md` 或 `.html` 放入 `data/`（单分支）或 `data/<分支名>/`（多分支，如 `data/main/`）。
2. **组织目录**：用子目录分类，每目录可放索引页（如 `README.md`），其余为正文。
3. **配置**：在 `config.js` 中设置站点信息、`document.branch_support`、`document.available_branches`（多分支时）等。
4. **生成索引**：运行 `python build.py --merge` 生成或更新各分支的 `path.json`、`search.json`（可手写替代）。
5. **访问**：用浏览器打开 `index.html` 进入首页，或打开 `main/` 进入文档页。

### 多分支时

- 在 `config.js` 的 `document` 中设置 `branch_support: true`、`default_branch`、`available_branches`（与 `data/` 下子目录名一致）。
- `build.py --merge` 会为每个分支目录生成各自的 `path.json` 和 `search.json`。
- 文档页侧栏可切换分支，链接格式见上文「新版链接格式」。

### 右键菜单

- 在侧栏文档/文件夹、右侧目录、正文内链上右键，可复制链接、复制为 Markdown 链接、预览文档。
- 使用 `ESC` 关闭预览或菜单。

### 自定义外观

- 编辑 `header.html`、`footer.html` 自定义顶栏与底栏。
- 在 `config.js` 的 `appearance`、`layout`、`footer` 等中调整 Logo、主题色、字体、页脚等。

## 部署说明

作为纯静态项目，EasyDocument 可以部署在任何静态文件服务器上:

1. 将整个项目目录复制到服务器的 Web 根目录
2. 或部署到 GitHub Pages, Netlify, Vercel 等静态网站托管服务

## 浏览器兼容性

支持所有现代浏览器，包括:
- Chrome, Firefox, Safari, Edge 的最新版本
- 不保证支持 IE 浏览器