# 使用指南

## 目录结构

```text
data 分支
├── config.js          # 站点配置
└── main/              # 版本目录
    ├── README.md      # 版本首页
    ├── 使用指南/
    └── 快速入门/
```

## 文档链接

支持相对路径写法：

- [基本使用流程](./基本使用流程.md)
- [返回首页](../README.md)

## 提示框

> [NOTE] 提示框语法为 `> [TYPE] 标题`，TYPE 支持 NOTE / TIP / IMPORTANT / WARNING / CAUTION / DANGER。

## 代码块

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```
