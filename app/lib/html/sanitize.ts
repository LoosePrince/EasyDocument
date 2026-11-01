/**
 * HTML 消毒
 *
 * 用于两处用户提供的内容：
 *  - `home.use_file` 指定的自定义首页 HTML
 *  - `layout.header_file` / `layout.footer_file` 自定义顶栏底栏
 *
 * 策略：黑名单式移除危险节点与属性（不引入额外依赖，规则保守）。
 * 与 legacy 的差异：legacy 直接注入任意 HTML/脚本，这里默认移除脚本。
 */
const DANGEROUS_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "link",
  "meta",
  "base",
] as const;

export function sanitizeHtml(input: string): string {
  let html = input;

  // 1. 移除危险标签（含内容）
  for (const tag of DANGEROUS_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), "");
  }

  // 2. 移除内联事件处理器
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 3. 移除 javascript: / data: 协议的 url
  html = html.replace(
    /\s+(href|src)\s*=\s*(?:"\s*(?:javascript|data):[^"]*"|'\s*(?:javascript|data):[^']*')/gi,
    "",
  );

  // 4. 移除 style 中的 expression()
  html = html.replace(/expression\s*\(/gi, "(");

  return html;
}

/** 提取 <body> 内部内容（自定义文件通常带完整文档结构） */
export function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}
