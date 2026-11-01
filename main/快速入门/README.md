# 快速入门

三分钟跑起来。

## 安装

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

> [TIP] 构建会自动读取 `data` 分支并预渲染全部文档页面。

## 数学公式

行内公式 $E = mc^2$，块级公式：

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## 表格

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| SSG | ✅ | 真实路径 |
| 搜索 | ✅ | MiniSearch |
| 编辑 | ✅ | GitHub API |

## Mermaid

```mermaid
flowchart LR
  A[data 分支] --> B[构建]
  B --> C[GitHub Pages]
```

> [WARNING] 修改内容后需要重新构建才会生效。
