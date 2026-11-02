# EasyDocument 文档中心

**EasyDocument 2.0.1** —— 把文档放在独立 git 分支、构建时预渲染成真实路径的静态文档系统。

## 它解决什么

传统文档站常见三个问题：内容与代码绑在一起、文档页对搜索引擎是空壳、改一句话也要走完整开发流程。

EasyDocument 把这三件事拆开：

- **内容在独立分支**：`main` 分支只放代码，`data` 分支只放文档与 `config.js`
- **构建期预渲染**：每篇文档生成独立 HTML，`/docs/main/快速入门` 这样的地址可以直接打开、可以分享、可以被收录
- **网页端就地编辑**：打开任意文档点「编辑此页」即可写作，保存为本地草稿，确认后一键提交

> [NOTE] 编辑与提交是两件事：**保存**只写入本浏览器草稿，**提交**才推送到 GitHub，**重建**才让线上生效。

## 从这里开始

| 文档 | 你将获得 |
| --- | --- |
| [快速入门](./快速入门/README.md) | 本地跑起来、写第一篇文档、部署上线 |
| [使用指南](./使用指南/README.md) | 目录结构、链接写法、搜索、主题、快捷键 |
| [编辑与发布](./编辑与发布/README.md) | 就地编辑、草稿机制、提交、重建与权限 |
| [配置详解](./配置详解/README.md) | `config.js` 每个字段的含义 |
| [参考](./参考/README.md) | Markdown 语法、常见问题、目录与限制 |

## 当前版本

| 项目 | 值 |
| --- | --- |
| 版本 | 2.0.1 |
| 技术栈 | React 19 · TypeScript · Vite 7 · TailwindCSS 4 · React Router 7 |
| 渲染 | SSG（`ssr: false` + `prerender`） |
| 内容来源 | git 分支 `data`（由 `easydocument.json` 指定） |

## 一分钟了解目录结构

```text
data 分支
├── config.js                # 站点配置（导航、首页、页脚…）
└── main/                    # 版本目录，对应 URL /docs/main
    ├── README.md            # 版本首页
    ├── 快速入门/README.md    # → /docs/main/快速入门
    ├── 使用指南/
    │   ├── README.md        # → /docs/main/使用指南
    │   └── 目录结构.md       # → /docs/main/使用指南/目录结构
    └── 参考/README.md
```

- 目录里有 `README.md`（或 `index.md`）时，该目录**可点击**进入
- 没有索引页的目录只作分组，侧栏中不可点击，不会跳到 404

## 相关链接

- 源码仓库：[github.com/LoosePrince/EasyDocument](https://github.com/LoosePrince/EasyDocument)
- 旧版（v1.3.x，免编译 + hash 路由）保留在 `legacy` 分支
