# GitHub与Git功能配置

EasyDocument系统内置了GitHub集成功能，可以显示文档的贡献者信息、最后修改时间以及提供一键编辑链接。本文档将详细介绍如何配置和使用这些功能。

## 功能概述

EasyDocument的GitHub与Git集成功能主要包括：

1. **贡献者显示**：在文档页面底部显示所有参与编写和修改该文档的贡献者
2. **最后修改时间**：显示文档最后一次被修改的时间和修改人
3. **GitHub编辑链接**：提供一键跳转到GitHub编辑页面的链接，方便用户直接参与文档改进
4. **贡献者头像**：可选择显示贡献者的GitHub头像或仅显示名称

## 配置项

这些功能在`config.js`文件的`extensions`部分进行配置：

```javascript
extensions: {
  // 其他扩展配置...
  
  // GitHub功能配置
  github: {
    enable: true,            // 是否启用GitHub相关功能
    repo_url: "https://github.com/LoosePrince/EasyDocument", // GitHub仓库地址
    edit_link: true,         // 是否启用参与编辑链接
    branch: "main",          // 默认分支名称
    show_avatar: true        // 显示贡献者的GitHub头像而不是名称
  },
  
  // Git配置段仍可保留（用于前端显示开关）
  git: {
    enable: true,
    show_last_modified: true,
    show_contributors: true
  }
}
```

## 配置详解

### GitHub功能配置

#### enable

- **类型**：布尔值
- **默认值**：`true`
- **说明**：是否启用GitHub相关功能。设为`false`将禁用所有GitHub相关功能，包括编辑链接和头像显示。
- **示例**：
  ```javascript
  github: {
    enable: false  // 禁用所有GitHub功能
  }
  ```

#### repo_url

- **类型**：字符串
- **默认值**：`"https://github.com/LoosePrince/EasyDocument"`
- **说明**：指定您的GitHub仓库地址，这将用于生成编辑链接和其他GitHub相关功能。
- **示例**：
  ```javascript
  github: {
    repo_url: "https://github.com/您的用户名/您的仓库名"
  }
  ```

#### edit_link

- **类型**：布尔值
- **默认值**：`true`
- **说明**：是否在文档页面显示"编辑此页"链接。启用后，用户可以通过点击链接直接跳转到GitHub编辑页面。
- **示例**：
  ```javascript
  github: {
    edit_link: false  // 不显示编辑链接
  }
  ```

#### branch

- **类型**：字符串
- **默认值**：`"main"`
- **说明**：指定仓库的默认分支名称，用于构建编辑链接。如果您的仓库使用不同的默认分支，如`master`，请相应修改。
- **示例**：
  ```javascript
  github: {
    branch: "master"  // 使用master分支
  }
  ```

#### show_avatar

- **类型**：布尔值
- **默认值**：`true`
- **说明**：是否显示贡献者的GitHub头像。设为`true`时显示头像，设为`false`时仅显示名称。
- **注意**：此选项受`github.enable`设置影响。如果`github.enable`为`false`，则无论此项如何设置都不会显示头像。
- **示例**：
  ```javascript
  github: {
    show_avatar: false  // 只显示贡献者名称，不显示头像
  }
  ```

### Git功能配置

#### enable

- **类型**：布尔值
- **默认值**：`true`
- **说明**：是否启用Git相关功能。设为`false`将禁用所有Git功能，包括最后修改时间和贡献者信息（除非头像功能通过GitHub配置启用）。
- **示例**：
  ```javascript
  git: {
    enable: false  // 禁用所有Git功能
  }
  ```

#### show_last_modified

- **类型**：布尔值
- **默认值**：`true`
- **说明**：是否显示文档的最后修改时间和修改人。
- **示例**：
  ```javascript
  git: {
    show_last_modified: false  // 不显示最后修改信息
  }
  ```

#### show_contributors

- **类型**：布尔值
- **默认值**：`true`
- **说明**：是否显示文档的所有贡献者列表。
- **注意**：此选项与`github.show_avatar`配合使用时会有不同效果。即使此项设置为`false`，如果`github.show_avatar`为`true`且`github.enable`为`true`，仍然会显示贡献者头像。
- **示例**：
  ```javascript
  git: {
    show_contributors: false  // 不显示贡献者列表
  }
  ```

## 功能交互关系

GitHub与Git功能配置项之间存在一些交互关系：

1. 当`github.enable`为`false`时：
   - 不显示GitHub编辑链接
   - 不显示贡献者头像（无论`github.show_avatar`设置为何值）

2. 当`git.enable`为`false`时：
   - 不显示最后修改时间信息
   - 不显示贡献者列表（除非`github.show_avatar`为`true`且`github.enable`为`true`）

3. 当`github.show_avatar`为`true`且`github.enable`为`true`时：
   - 即使`git.enable`或`git.show_contributors`为`false`，仍然会显示贡献者头像

## 如何工作

当前版本中，Git 信息在前端运行时通过 GitHub API 实时获取，不再依赖 `build.py` 写入 `path.json.git`。  

前端会基于以下信息查询：

1. 仓库地址：`extensions.github.repo_url`
2. 分支：`extensions.github.branch`
3. 当前文档在仓库中的文件路径

然后动态显示：

- 最后修改时间
- 贡献者列表（头像或名称）
- GitHub 编辑链接

## 实例展示

启用所有GitHub与Git功能后，文档页面底部会显示类似以下内容：

- **最后修改**：2025-03-15 by 用户名
- **贡献者**：[头像1] [头像2] [头像3] 共3人贡献
- **在GitHub上编辑**：[链接]

## 注意事项

1. 要显示 Git 信息，页面运行环境需要能访问 GitHub API
2. GitHub 匿名请求存在频率限制，访问过多时可能暂时无法显示贡献者/更新时间
3. 对于外部挂载文档，仅 `github_tree` 模式支持完整 Git 信息映射
4. 不再支持通过手动编辑 `path.json.git` 来维护 Git 信息

## 相关文档

- [配置详解](配置详解/README.md)
- [构建工具 (build.py)](使用指南/构建工具.md)
- [基本使用流程](使用指南/基本使用流程.md) 