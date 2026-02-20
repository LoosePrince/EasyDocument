# 快速入门

在本节中，您将了解如何快速开始使用 EasyDocument 构建您自己的文档网站。

## 系统要求

EasyDocument 是一个纯前端静态系统，几乎没有特殊的系统要求：

- 支持现代浏览器（Chrome, Firefox, Safari, Edge的最新版本）
- 不需要服务器支持，可以在本地直接打开使用
- 无需数据库或其他后端服务

## 安装步骤

1. 从 GitHub 下载或克隆仓库：
   ```bash
   git clone https://github.com/LoosePrince/EasyDocument.git
   ```

2. 进入项目目录：
   ```bash
   cd EasyDocument
   ```

3. 直接在浏览器中打开 `index.html` 文件即可开始使用
   
### 快速配置

您可以通过修改 `config.js` 文件来自定义 EasyDocument：

- **网站信息**: 修改网站名称、标题、描述等
- **外观设置**: 调整主题色、字体等
- **功能配置**: 开启/关闭特定功能

详细配置说明请参考[配置详解](配置详解)。

## 添加文档

创建文档非常简单：

1. 在 `data` 目录下创建 Markdown (.md) 或 HTML (.html) 文件
2. 如果需要，可以创建子目录来组织文档结构
3. 在每个目录中，可以创建 `README.md` 作为该目录的介绍文档
4. 运行 `build.py` 创建/更新 `path.json`
4. 刷新浏览器，新添加的文档会自动出现在导航栏中

## 部署

EasyDocument 可以部署在任何支持静态文件的服务上：

1. 将整个项目目录复制到 Web 服务器的根目录
2. 或者使用 GitHub Pages, Netlify, Vercel 等静态网站托管服务

## 后续学习

完成上述步骤后，您已经可以开始使用 EasyDocument 构建文档网站了。接下来，您可以深入了解：

- [Markdown语法](快速入门/Markdown语法.md)
- [示例与模板](示例与模板/README.md)
- [文档编写规范](使用指南/文档编写规范.md)
