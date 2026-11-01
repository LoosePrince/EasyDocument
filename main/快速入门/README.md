# 快速入门

十分钟内完成：本地跑起来 → 写第一篇文档 → 部署上线。

## 1. 准备环境

| 依赖 | 版本要求 |
| --- | --- |
| Node.js | ≥ 20.19 |
| git | 任意较新版本 |

检出代码与内容分支：

```bash
git clone https://github.com/LoosePrince/EasyDocument.git
cd EasyDocument

# 把内容分支检出到 .data，构建时从这里读取
git worktree add .data origin/data
```

> [NOTE] 没有 `.data` 目录时，构建会自动回退到从 GitHub 远程读取内容分支（需要网络）。

## 2. 本地运行

```bash
npm install
npm run dev      # http://localhost:5173
```

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（热更新） |
| `npm run build` | 构建静态站点到 `build/client` |
| `npm run preview` | 以 GitHub Pages 语义预览构建产物 |
| `npm run typecheck` | 类型检查 |
| `npm run test` | 单元测试 |
| `npm run test:e2e` | 端到端测试 |

## 3. 写第一篇文档

在内容分支的版本目录下新建文件，例如 `data/main/我的第一篇.md`：

```md
# 我的第一篇

这是我的第一篇文档。

## 小节

支持 **粗体**、`行内代码`、[链接](./README.md) 与列表：

- 第一项
- 第二项
```

保存并重新构建后即可在 `/docs/main/我的第一篇` 访问。

> [TIP] 也可以在网页端写：打开任意文档点「编辑此页」，在正文区就地编辑，点「保存修改」写入本地草稿。

## 4. 让入口可点击

侧栏与顶部导航只对**真实存在**的页面给出可点击入口：

- 文件本身总是可点击
- 目录只有在包含 `README.md`（或 `index.md` 等索引页）时才可点击
- 顶部导航里配置的路径如果不存在，会显示为灰色不可点，而不是跳到 404

所以想让「配置详解」这类目录可点，就在里面放一个 `README.md`。

## 5. 部署到 GitHub Pages

仓库自带 `.github/workflows/deploy.yml`：

1. 在仓库 **Settings → Pages** 把 Source 设为 **GitHub Actions**
2. 推送到 `main`，或手动运行 `Deploy GitHub Pages`
3. 工作流会：读取 `easydocument.json` → 检出内容分支到 `.data` → `npm ci` → 构建 → 部署

也可以手动触发：

```bash
gh workflow run deploy.yml --ref main
```

> [IMPORTANT] 内容分支的提交不会自动触发部署，这是有意设计：先在网页端提交草稿，确认后再手动触发重建，避免半成品上线。

## 5 分钟检查清单

- [ ] `npm run dev` 能看到首页与文档
- [ ] 新建的 `.md` 出现在侧栏且可点击
- [ ] 目录里的 `README.md` 让目录可点击
- [ ] 顶部导航中没有指向 404 的链接
- [ ] 网页端「编辑此页 → 保存修改 → 一键提交 → 重建」链路走通

## 下一步

- [使用指南](../使用指南/README.md)：目录、链接、搜索、主题
- [编辑与发布](../编辑与发布/README.md)：编辑语义与权限
- [配置详解](../配置详解/README.md)：改站点配置
