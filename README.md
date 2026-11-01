# EasyDocument

基于 **React 19 + TypeScript + Vite 7 + TailwindCSS 4** 的静态文档系统。文档内容存放在独立的 git 分支中，构建时预渲染为真实路径的静态页面，并支持在网页端直接编辑内容、修改站点配置、一键触发重新构建。

- 真实路径（`/docs/main/使用指南/README`）+ 预渲染 HTML，无 `#` 路由，SEO 友好
- 内容与代码分离：代码在 `main`，内容在 `data`（可配置）
- 配置与原版 `config.js` **完全兼容**，可直接复用
- 网页端编辑：填一次 GitHub PAT 即可新增/编辑/删除文档、改配置、触发重建

> v1（免编译的 Alpine.js + hash 路由版本）完整保留在 `legacy` 分支。

---

## 快速开始

```bash
npm install

# 把内容分支检出到 .data（构建读取它）
git worktree add .data origin/data

npm run dev      # http://localhost:5173
npm run build    # 产物在 build/client
npm run preview  # 以 GitHub Pages 语义本地预览产物
```

Windows 下若 `git worktree` 报路径冲突，可改用：

```bash
git clone -b data <repo-url> .data
```

或设置环境变量 `EASYDOCUMENT_DATA_DIR` 指向任意内容目录。

## 内容分支结构

```
data 分支
├── config.js          # 站点配置（与 v1 相同格式）
└── main/              # 版本目录（名称即 URL 中的 {version}）
    ├── README.md      # 版本首页（可省略）
    ├── 使用指南/
    │   ├── README.md
    │   └── 基本使用流程.md
    └── 示例.html
```

- 每个一级目录 = 一个版本；`document.available_branches` 控制展示顺序与标签，目录不存在时自动隐藏
- `index_pages` 中的文件名（默认 `README.md` / `README.html` / `index.md` / `index.html`）作为目录索引页
- 目录标题取自索引页的一级标题；没有索引页的目录只作分组

## URL 规则

| 内容路径 | URL |
| --- | --- |
| `main/README.md` | `/docs/main` |
| `main/使用指南/README.md` | `/docs/main/使用指南` |
| `main/使用指南/基本使用流程.md` | `/docs/main/使用指南/基本使用流程` |
| `1.3.4/配置详解/README.md` | `/docs/1.3.4/配置详解` |

锚点直接使用标题文本（中文会百分号编码）：`/docs/main/使用指南#常见问题`。

旧版链接（`main/#/使用指南/`、`main/#使用指南/`）在导航与首页按钮中会自动升级为新路径。

## 配置

配置全部来自内容分支的 `config.js`，格式与 v1 一致：

```js
const config = {
  site: { name, title, description, keywords, base_url },
  appearance: { logo, favicon, theme_color, default_dark_mode, font_family },
  layout: { show_header, show_footer, sidebar_width, toc_width, mobile_breakpoint },
  animation: { enable, sidebar, toc, article, general },
  navigation: { home_text, breadcrumb, auto_collapse, back_to_top, prev_next_buttons, folder_expand_mode, nav_links },
  home: { use_file, file_path, hero, features, get_started,
          sections, stats, quick_links, code_demo },
  document: { root_dir, branch_support, default_branch, available_branches, index_pages, supported_extensions, toc_*, code_*, external_docs },
  search: { enable, min_chars, max_results, placeholder, search_on_type, match_distance },
  extensions: { math, highlight, mermaid, github, git, progress_bar, cache_menu },
  footer: { copyright, powered_by, links, beian, columns },
};
export default config;
```

行为要点：

- 所有字段可选，缺失时使用默认值；类型不符会回退默认值并给出警告（可在编辑台看到）
- `appearance.font_family` 留空时使用内置 **Outfit** 可变字体
- `extensions.github.repo_url` 用于生成「在 GitHub 上编辑」链接
- `admin.enable`（v2 新增）控制是否显示网页端编辑入口，默认 `true`
- `home.sections` 控制首页各区块开关/标题；`home.stats`、`home.quick_links`、`home.code_demo` 为 v2 新增（缺失时用默认值）

### 首页区块

| 字段 | 说明 |
| --- | --- |
| `home.hero.badge` | Hero 上方胶囊标签（留空隐藏） |
| `home.hero.search_placeholder` | Hero 搜索框占位文案（留空隐藏搜索框） |
| `home.hero.secondary_text` / `secondary_link` | 次要按钮 |
| `home.stats[]` | `{ value, label }` 亮点数字，留空数组则不显示 |
| `home.sections.*` | `features` / `docs` / `code_demo` / `get_started` 各自的 `{ enable, title, description }` |
| `home.code_demo` | `{ filename, content }`：左侧源码、右侧用同一渲染管线预览 |
| `home.quick_links[]` | `{ title, description, url, icon }`，**url 需指向真实页面** |

### 入口可达性

- 侧栏中目录只有在包含索引页（`index_pages`，默认 `README.md`）时才可点击，否则只作分组
- 顶部导航里配置的站内路径若目标不存在，渲染为灰色且不可点击，不会跳到 404
- 构建时 `scripts/check-links.mjs` 会扫描全部产物页面，校验每个站内 `<a href>` 都有对应 HTML；有断链则构建失败

## 网页端编辑

编辑就在文档页里完成，不弹窗、不跳页：

1. 在任意文档页点「编辑此页」（或在控制台点「进入编辑模式」，或按 <kbd>E</kbd>）
2. 正文区域就地变成编辑器：
   - **预览**：占满宽度，显示的就是最终发布效果
   - **分栏**：左侧 Markdown 源码（工具栏 + Tab 缩进 + <kbd>Ctrl</kbd>+<kbd>S</kbd>），右侧实时预览
3. 预览使用与构建期**完全相同**的渲染管线（同一份 `renderMarkdown`），因此不会出现「编辑时好看、发布后变形」

### 保存 / 提交 / 重建 是三件事

| 动作 | 位置 | 是否联网 | 结果 |
| --- | --- | --- | --- |
| **保存修改** | 编辑区工具条 | 否 | 写入本浏览器草稿（`localStorage`），可切页、刷新、关浏览器 |
| **一键提交** | 顶部提交栏 | 是（需 PAT） | 把所有草稿推送到内容分支 |
| **重建站点** | 控制台 → 构建部署 | 是（需 PAT） | 触发 Actions，线上更新 |

- 保存后可自由切换页面预览效果；顶部提交栏（悬停展开）实时统计待提交清单，可逐条放弃
- 未进入编辑模式但存在草稿时，左下角有悬浮提示，不会「保存了却找不到」
- 内容分支的提交不会自动部署，需手动触发重建——避免半成品上线

### 侧栏管理

编辑模式下侧栏提供：

- 筛选框（快速定位目录）、全部展开 / 全部折叠、新建文档
- **右键菜单**：打开、复制链接、复制为 Markdown 链接、在此新建文档 / 文件夹、重命名、删除
- **双击**目录或文档就地重命名
- 本地草稿条目带「新增 / 修改 / 删除」标记

### 正文右键菜单

在文档正文右键：复制本页链接、复制为 Markdown 链接、复制本文大纲、编辑此页；
在链接上右键：新标签打开、复制链接、复制为 Markdown 链接；
在标题上右键：复制该标题的锚点链接。
选中文字或位于输入框时保留浏览器原生菜单。

### 控制台 `/admin`

| 标签 | 内容 |
| --- | --- |
| 总览 | 文档总数 / 版本数 / 待提交修改、快捷操作、内容来源（仓库、分支、配置路径） |
| 文档管理 | 按版本列出全部文档、新建、删除、跳转编辑 |
| 站点配置 | 表单 + 源码两种方式编辑 `config.js`，保存前用同一套 schema 校验 |
| 构建部署 | 触发重建、轮询运行状态、跳转 Actions |

### 凭据

1. 粘贴 **fine-grained PAT**，权限最小化为：仅本仓库，`Contents: Read and write` + `Actions: Read and write`
2. 勾选「记住本设备」写入 `localStorage`，不勾选则仅存 `sessionStorage`
3. 提交时携带文件 `sha`，他人已修改过会提示冲突而非静默覆盖

> Token 只存在于浏览器，绝不进入构建产物。公用设备上请勿勾选「记住本设备」。

### 快捷键

| 快捷键 | 作用 |
| --- | --- |
| <kbd>E</kbd> | 进入 / 退出编辑模式 |
| <kbd>Ctrl/Cmd</kbd>+<kbd>S</kbd> | 提交待提交修改 |
| <kbd>Ctrl/Cmd</kbd>+<kbd>K</kbd> | 打开搜索 |
| <kbd>Esc</kbd> | 关闭菜单 / 搜索 |

## 一键重建

网页端调用：

```
POST /repos/{owner}/{repo}/actions/workflows/deploy.yml/dispatches
{ "ref": "main", "inputs": { "reason": "web-editor" } }
```

对应 `.github/workflows/deploy.yml` 的 `workflow_dispatch`（同时支持 `repository_dispatch: [rebuild]`）。

## 内容指针 `easydocument.json`

```json
{ "data": "data:/config.js" }
```

`{分支}:{config.js 路径}`。文档根即该 `config.js` 所在目录，因此也可以写成 `content:docs/config.js` 把内容放在子目录。仓库归属自动推断（CI 的 `GITHUB_REPOSITORY` → 该文件可选 `repo` 字段 → GitHub Pages 域名），无需硬编码。

## 部署

`.github/workflows/deploy.yml` 会在 `main` 推送、手动触发、`repository_dispatch` 时：

1. 读取 `easydocument.json` 得到内容分支
2. 把内容分支检出到 `.data`
3. `npm ci` → `npm run typecheck` → `npm run build`
4. 上传 `build/client` 并部署到 GitHub Pages

首次使用需在仓库 **Settings → Pages** 中把 Source 设为 **GitHub Actions**。

## 开发

```bash
npm run dev         # 开发服务器（SSR-ish 路由 + 热更新）
npm run typecheck   # 类型检查
npm run lint        # ESLint
npm run test        # Vitest 单元测试
npm run test:e2e    # Playwright 端到端测试（需先 build）
```

### 目录

```
app/
├── root.tsx                 # 全局 loader（配置注入）、主题与样式初始化
├── routes.ts                # 路由表
├── routes/
│   ├── home.tsx             # 首页
│   ├── docs-index.tsx       # /docs 版本列表
│   ├── docs-page.tsx        # /docs/{version}/{path...}（文档页 / 版本首页）
│   ├── admin.tsx            # /admin 编辑台
│   └── not-found.tsx        # 404
├── components/
│   ├── layout/              # 顶栏、页脚、面包屑、翻页、进度条
│   ├── sidebar/             # 文档树、版本切换、git 信息
│   ├── toc/                 # 右侧目录
│   ├── search/              # 搜索面板
│   ├── markdown/            # 客户端增强（复制、Mermaid、灯箱）
│   ├── editor/              # 编辑面板、配置编辑器、PAT 登录
│   └── providers/           # 配置与主题上下文
├── lib/
│   ├── config/              # schema（Zod）、默认值、config.js 求值与序列化
│   ├── content/             # 内容指针、本地/远程内容源、文档树、URL 规则
│   ├── markdown/            # unified 渲染管线、TOC 提取
│   ├── search/              # 搜索索引与分词
│   ├── github/              # REST 客户端、凭据、触发重建
│   └── site/                # 构建期站点装配、页面数据
└── styles/app.css           # Tailwind 4 + 主题变量 + 文档排版
```

## 与 v1 的差异

| 项目 | v1（legacy 分支） | v2（当前） |
| --- | --- | --- |
| 技术栈 | 原生 JS + Alpine.js + CDN Tailwind | React 19 + TS + Vite 7 + Tailwind 4 |
| 路由 | hash：`main/#/路径` | 真实路径：`/docs/{版本}/{路径}` |
| 渲染 | 浏览器内渲染（SPA） | 构建期预渲染（SSG） |
| 内容位置 | 仓库 `data/` 目录 | 独立 git 分支（默认 `data`） |
| 索引文件 | `build.py` 生成 `path.json` / `search.json` | 构建期扫描 + MiniSearch 索引，无需索引文件 |
| 编辑 | 无 | 网页端直接编辑 |
| 主题 | FontAwesome 图标类 | lucide-react 图标（`nav_links.icon` 的 FontAwesome 类名仍会渲染，需自行引入该字体） |

## License

MIT
