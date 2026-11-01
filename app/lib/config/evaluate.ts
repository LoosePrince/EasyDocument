/**
 * 配置模块求值
 *
 * data 分支的 `config.js` 沿用 legacy 写法：
 *
 *   const config = { ... };
 *   export default config;
 *
 * 这里把 `export default` 转成 `return`，在 Node 与浏览器中都能求值，
 * 从而无需构建期打包内容仓库。
 */

export interface EvaluateOptions {
  /** 出错时返回的兜底对象 */
  fallback?: unknown;
  /** 文件名，仅用于报错信息 */
  label?: string;
}

/** 提取 ESM 默认导出表达式并求值 */
export function evaluateConfigModule(source: string, options: EvaluateOptions = {}): unknown {
  const { fallback = {}, label = "config.js" } = options;

  try {
    const body = source
      // 去 sourcemap 注释，避免 new Function 解析报错
      .replace(/\/\/#\s*sourceMappingURL=.*$/gm, "")
      // import 语句在内容配置中无意义，移除以免 SyntaxError
      .replace(/^\s*import\s[^;]*;\s*$/gm, "");

    const hasDefaultExport = /export\s+default\s+/.test(body);
    const transformed = hasDefaultExport
      ? body.replace(/export\s+default\s+/, "return ")
      : `${body}\nreturn typeof config !== "undefined" ? config : {};`;

    const factory = new Function(
      `"use strict";\n${transformed}`,
    ) as () => unknown;

    const result = factory();
    if (result && typeof result === "object") return result;
    console.warn(`[easydocument] ${label} 未导出配置对象，已使用空配置`);
    return fallback;
  } catch (error) {
    console.error(`[easydocument] ${label} 解析失败，已使用空配置`, error);
    return fallback;
  }
}

/**
 * 把配置对象序列化回 `config.js` 源文件（网页端编辑台保存用）。
 *
 * 输出保留注释头与 `export default`，与 legacy 文件形态一致，
 * 便于用户在本地继续手工维护。
 */
export function stringifyConfigModule(config: unknown): string {
  const json = JSON.stringify(config, null, 2)
    // JS 对象字面量：去掉 JSON 不允许的尾逗号问题的反向处理——保持 JSON 输出即可（合法 JS）
    .replace(/"([A-Za-z_$][\w$]*)":/g, "$1:");

  return `/**
 * EasyDocument 配置文件
 *
 * 本文件由 EasyDocument 网页端编辑台生成，也可手工编辑。
 * 结构参考：site / appearance / layout / animation / navigation /
 *          home / document / search / extensions / footer
 */

const config = ${json};

export default config;
`;
}
