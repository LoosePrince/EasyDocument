# Markdown 增强语法

除了标准 Markdown 与 GFM，EasyDocument 支持一组开箱即用的扩展。

## 提示框（Callout）

语法：

```md
> [NOTE] 自定义标题
> 正文内容
```

支持的类型：

| 类型 | 默认标题 | 颜色 |
| --- | --- | --- |
| `NOTE` | 注意 | 蓝 |
| `TIP` | 提示 | 绿 |
| `IMPORTANT` | 重要 | 紫 |
| `WARNING` | 警告 | 橙 |
| `CAUTION` | 小心 | 橙红 |
| `DANGER` | 危险 | 红 |

渲染效果：

> [NOTE] 这是一条提示
> 提示框会根据类型自动配图标与配色。

> [WARNING] 移除 `[TYPE]` 前的内容
> 如果第一行还带有行内代码或粗体，该行会整体作为正文，标题使用类型默认名。

## 表格

```md
| 列 A | 列 B |
| --- | --- |
| 1 | 2 |
```

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

## 代码块

### 基础

````md
```ts
export const hello = (name: string) => `Hello, ${name}`;
```
````

```ts
export const hello = (name: string) => `Hello, ${name}`;
```

- 双主题高亮（亮/暗），切换主题自动跟随
- 行号默认显示，起始行号可配（`document.code_block.start_line`）
- 右上角复制按钮（`document.code_copy_button`）

### Mermaid

````md
```mermaid
flowchart LR
  A[内容分支] --> B[构建]
  B --> C[静态站点]
```
````

```mermaid
flowchart LR
  A[内容分支] --> B[构建]
  B --> C[静态站点]
```

## 数学公式

行内：`$E = mc^2$` → $E = mc^2$

块级：

```md
$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$
```

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

- 使用 KaTeX 渲染，代码块内不解析
- 由 `extensions.math` 控制

## 任务列表

```md
- [x] 已完成
- [ ] 待办
```

- [x] 已完成
- [ ] 待办

## 图片灯箱

点击正文中的任意图片会打开灯箱：

| 操作 | 方式 |
| --- | --- |
| 缩放 | 滚轮 / 按钮 / <kbd>+</kbd> <kbd>-</kbd> |
| 旋转 | 按钮 |
| 平移 | 拖拽 |
| 下载 | 按钮 |
| 关闭 | <kbd>Esc</kbd> / 点击背景 |

## 标题锚点

标题右侧出现 `#` 链接（悬停可见），点击可复制/跳转到该标题。

## HTML 文档

`.html` 文件不解析 Markdown，而是放入沙箱 `iframe`：

- 默认 `sandbox="allow-same-origin"`，脚本不执行
- 文档页顶部提供「启用脚本」按钮，点击后重建 iframe 并放开脚本

## 已知限制

- HTML 文档的目录（TOC）由页面自行控制，站点不会注入
- 提示框不支持嵌套
- Mermaid 渲染在浏览器端完成，首屏为源码占位

## 下一步

- [参考：Markdown 语法速查](../参考/Markdown语法.md)
