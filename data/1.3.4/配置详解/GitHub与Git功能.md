# GitHub与Git功能配置

EasyDocument系统内置了GitHub与Git集成功能，可以显示文档的贡献者信息、最后修改时间以及提供一键编辑链接。本文档将详细介绍如何配置和使用这些功能。

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
  
  // Git功能配置
  git: {
    enable: true,            // 是否启用Git相关功能
    show_last_modified: true, // 启用文档最后编辑时间显示
    show_contributors: true   // 启用参与者名称显示
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

EasyDocument的Git与GitHub功能需要预先计算和收集文档的Git相关信息，这通常是在构建步骤中完成的。当您使用`build.py`脚本生成`path.json`文件时，脚本会从Git仓库中收集：

1. 每个文档的最后修改时间和修改者
2. 每个文档的贡献者列表及其贡献次数
3. 如果可能，通过GitHub API获取贡献者的GitHub用户名和头像URL

这些信息会被保存在`path.json`文件中，然后在前端显示。

## 实例展示

启用所有GitHub与Git功能后，文档页面底部会显示类似以下内容：

- **最后修改**：2025-03-15 by 用户名
- **贡献者**：[头像1] [头像2] [头像3] 共3人贡献
- **在GitHub上编辑**：[链接]

## 注意事项

1. 要确保Git功能正常工作，您的项目必须是一个有效的Git仓库
2. 要显示GitHub头像，您的仓库需要与GitHub关联
3. 获取GitHub头像需要调用GitHub API，如果您的构建环境无法访问互联网，可能无法获取头像
4. 对于私有仓库，某些GitHub功能可能需要配置访问令牌

## 手动创建贡献者信息

如果您不想使用自动生成的Git信息，也可以手动在`path.json`文件中添加贡献者信息。格式如下：

```json
{
  "title": "文档标题",
  "path": "文档路径",
  "git": {
    "last_modified": {
      "date": "2025-03-15",
      "time": "14:30:00",
      "author": "作者名称"
    },
    "contributors": [
      {
        "name": "贡献者1",
        "commits": 10,
        "github_username": "github用户名1",
        "github_avatar": "https://github.com/头像URL1"
      },
      {
        "name": "贡献者2",
        "commits": 5,
        "github_username": "github用户名2",
        "github_avatar": "https://github.com/头像URL2"
      }
    ]
  }
}
```

## 相关文档

- [配置详解](配置详解/README.md)
- [构建工具与搜索功能](使用指南/构建工具与搜索功能.md)
- [基本使用流程](使用指南/基本使用流程.md) 