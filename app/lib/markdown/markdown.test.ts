import { describe, expect, it } from "vitest";
import { extractDocTitle, renderMarkdown, resolveDocLink, type MarkdownOptions } from "./render";
import { getServerHighlighter } from "./highlight.server";

/** 测试统一注入真实高亮器（与构建期、浏览器端同一实现路径） */
const highlight = getServerHighlighter();
import { extractTocFromHtml } from "./toc";

const baseOptions: MarkdownOptions = {
  docPath: "指南/安装.md",
  branch: "main",
  defaultBranch: "main",
  indexPages: ["README.md", "index.md"],
  supportedExtensions: [".md", ".html"],
  baseUrl: "/",
  codeBlock: { lineNumbers: true, startLine: 1, theme: { light: "github", dark: "github-dark" } },
  codeCopyButton: true,
  math: true,
  highlight: true,
  mermaid: true,
};

describe("extractDocTitle", () => {
  it("优先 h1", () => {
    expect(extractDocTitle("# 一级\n## 二级").title).toBe("一级");
  });
  it("无 h1 用 h2", () => {
    expect(extractDocTitle("## 二级").title).toBe("二级");
  });
  it("提取 firstH1 单独字段", () => {
    expect(extractDocTitle("# 一级\n## 二级").firstH1).toBe("一级");
    expect(extractDocTitle("## 二级").firstH1).toBeUndefined();
  });
});

describe("renderMarkdown", () => {
  it("输出 GFM 表格", async () => {
    const { html } = await renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |", baseOptions);
    expect(html).toContain("<table");
    expect(html).toContain("doc-table");
  });

  it("为标题生成 id（支持 CJK）", async () => {
    const { html } = await renderMarkdown("# 中文标题\n", baseOptions);
    expect(html).toContain('id="中文标题"');
  });

  it("重复标题去重生成不同 id", async () => {
    const { html } = await renderMarkdown("# 标题\n# 标题\n", baseOptions);
    expect(html).toContain('id="标题"');
    expect(html).toContain('id="标题-1"');
  });

  it("渲染 KaTeX 数学公式", async () => {
    const { html } = await renderMarkdown("行内 $E=mc^2$ 与\n\n$$\na^2+b^2=c^2\n$$\n", baseOptions);
    expect(html).toContain("katex");
  });

  it("math 关闭时不做 KaTeX 转换", async () => {
    const { html } = await renderMarkdown("$E=mc^2$", { ...baseOptions, math: false });
    expect(html).not.toContain("katex");
  });

  it("代码块套用 wrapper、行号与复制按钮", async () => {
    const { html } = await renderMarkdown("```ts\nconst a = 1;\n```", baseOptions, highlight);
    expect(html).toContain("code-wrapper");
    expect(html).toContain("data-line-numbers");
    expect(html).toContain("data-code-copy");
    expect(html).toContain("shiki");
  });

  it("legacy 主题名 github 归一为 github-light", async () => {
    const { html } = await renderMarkdown("```js\nlet a = 1;\n```", baseOptions, highlight);
    expect(html).not.toContain("fallback");
  });

  it("代码块起始行号生效", async () => {
    const { html } = await renderMarkdown(
      "```js\na\nb\n```",
      { ...baseOptions, codeBlock: { ...baseOptions.codeBlock, startLine: 10 } },
      highlight,
    );
    expect(html).toContain('data-start-line="10"');
    expect(html).toContain('data-line="10"');
    expect(html).toContain('data-line="11"');
  });

  it("关闭行号时不输出 line-numbers 标记", async () => {
    const { html } = await renderMarkdown(
      "```js\nlet a = 1;\n```",
      { ...baseOptions, codeBlock: { ...baseOptions.codeBlock, lineNumbers: false } },
      highlight,
    );
    expect(html).not.toContain('data-line-numbers="true"');
  });

  it("mermaid 代码块转为 mermaid-block", async () => {
    const { html } = await renderMarkdown("```mermaid\ngraph TD\nA-->B\n```", baseOptions);
    expect(html).toContain("mermaid-block");
    expect(html).toContain("data-mermaid=");
  });

  it("警告框语法转换为 callout", async () => {
    const { html } = await renderMarkdown("> [NOTE] 自定义标题\n> 正文内容", baseOptions);
    expect(html).toContain("callout-note");
    expect(html).toContain("自定义标题");
    expect(html).not.toContain("[NOTE]");
  });

  it("标题行含行内代码时不重复正文", async () => {
    const { html } = await renderMarkdown("> [TIP] 构建会自动读取 `data` 分支。", baseOptions);
    const decoded = decodeURI(html);
    expect(decoded).toContain("callout-tip");
    expect(decoded).toContain("提示"); // 使用默认标题
    expect(decoded).toContain("构建会自动读取"); // 正文保留
    expect(decoded.match(/构建会自动读取/g)).toHaveLength(1); // 不重复
    expect(decoded).not.toContain("[TIP]");
  });

  it("marker 前后换行的多段正文保留全部内容", async () => {
    const { html } = await renderMarkdown(
      "> [NOTE] 小节标题\n>\n> 正文第一段\n>\n> 正文第二段",
      baseOptions,
    );
    const decoded = decodeURI(html);
    expect(decoded).toContain("小节标题");
    expect(decoded).toContain("正文第一段");
    expect(decoded).toContain("正文第二段");
    expect(decoded).not.toContain("[NOTE]");
  });

  it("callout 图标内联渲染", async () => {
    const { html } = await renderMarkdown("> [DANGER] 危险操作", baseOptions);
    expect(html).toContain("callout-icon");
    expect(html).toContain("<svg");
  });

  it("未知类型的 [XXX] 引用块保持原样", async () => {
    const { html } = await renderMarkdown("> [UNKNOWN] 内容", baseOptions);
    expect(html).toContain("<blockquote");
  });

  it("外链加 target 与 rel", async () => {
    const { html } = await renderMarkdown("[外链](https://example.com)", baseOptions);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
  });

  it("相对内链改写为 /docs 路径", async () => {
    const { html } = await renderMarkdown("[另一篇](./其他.md)", baseOptions);
    // rehype-stringify 会对非 ASCII 做百分号编码，解码后比对语义
    expect(decodeURI(html)).toContain('href="/docs/main/指南/其他"');
  });

  it("索引页链接折叠到目录", async () => {
    const { html } = await renderMarkdown("[指南](./README.md)", baseOptions);
    expect(decodeURI(html)).toContain('href="/docs/main/指南"');
  });

  it("页内锚点链接保持原样", async () => {
    const { html } = await renderMarkdown("[跳转](#小节)", baseOptions);
    expect(decodeURI(html)).toContain('href="#小节"');
  });

  it("图片加灯箱 class 与懒加载", async () => {
    const { html } = await renderMarkdown("![图](./a.png)", baseOptions);
    expect(html).toContain("doc-image");
    expect(html).toContain('loading="lazy"');
  });

  it("标题追加锚点链接", async () => {
    const { html } = await renderMarkdown("## 小节", baseOptions);
    expect(html).toContain("heading-anchor");
  });
});

describe("resolveDocLink", () => {
  it("相对路径基于当前文档目录", () => {
    expect(resolveDocLink("其他.md", baseOptions)).toBe("/docs/main/指南/其他");
  });

  it(".. 上溯目录", () => {
    expect(resolveDocLink("../上层.md", baseOptions)).toBe("/docs/main/上层");
  });

  it("绝对路径按站点根解析", () => {
    expect(resolveDocLink("/docs/1.3.4/指南/x.md", baseOptions)).toBe("/docs/1.3.4/指南/x");
    expect(resolveDocLink("/docs/main/指南/README.md", baseOptions)).toBe("/docs/main/指南");
  });

  it("显式版本前缀被识别", () => {
    expect(resolveDocLink("/1.3.4/指南/x.md", { ...baseOptions, versions: ["1.3.4"] })).toBe(
      "/docs/1.3.4/指南/x",
    );
  });

  it("未知首段不当作版本，按当前版本处理", () => {
    expect(resolveDocLink("/1.3.4/指南/x.md", baseOptions)).toBe("/docs/main/1.3.4/指南/x");
  });

  it("带 base_url 时加前缀", () => {
    expect(resolveDocLink("其他.md", { ...baseOptions, baseUrl: "/sub" })).toBe(
      "/sub/docs/main/指南/其他",
    );
  });

  it("兼容 legacy /data/ 前缀", () => {
    expect(resolveDocLink("/data/main/指南/x.md", baseOptions)).toBe("/docs/main/指南/x");
  });
});

describe("extractTocFromHtml", () => {
  const html = `
    <h1 id="a">一级</h1>
    <h2 id="b">二级</h2>
    <h3 id="c">三级</h3>
    <h2 id="d">二级二</h2>
  `;

  it("按顺序提取标题与层级", () => {
    const toc = extractTocFromHtml(html, { tocNumbering: false, tocIgnoreH1: true });
    expect(toc.map((item) => [item.id, item.depth])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["d", 2],
    ]);
  });

  it("编号忽略 h1", () => {
    const toc = extractTocFromHtml(html, { tocNumbering: true, tocIgnoreH1: true });
    expect(toc.find((item) => item.id === "b")?.number).toBe("1");
    expect(toc.find((item) => item.id === "c")?.number).toBe("1.1");
    expect(toc.find((item) => item.id === "d")?.number).toBe("2");
    expect(toc.find((item) => item.id === "a")?.number).toBeUndefined();
  });

  it("编号包含 h1 时从 1 开始", () => {
    const toc = extractTocFromHtml(html, { tocNumbering: true, tocIgnoreH1: false });
    expect(toc.find((item) => item.id === "a")?.number).toBe("1");
    expect(toc.find((item) => item.id === "b")?.number).toBe("1.1");
  });

  it("无 id 的标题被跳过", () => {
    const toc = extractTocFromHtml("<h2>没有 id</h2><h2 id='x'>有 id</h2>", {
      tocNumbering: false,
      tocIgnoreH1: false,
    });
    expect(toc).toHaveLength(1);
  });

  it("剥掉锚点符号", () => {
    const toc = extractTocFromHtml(
      '<h2 id="x">标题<a class="heading-anchor" href="#x">#</a></h2>',
      { tocNumbering: false, tocIgnoreH1: false },
    );
    expect(toc[0].text).toBe("标题");
  });

  it("记录归属的浅层标题", () => {
    const toc = extractTocFromHtml(html, { tocNumbering: false, tocIgnoreH1: false });
    expect(toc.find((item) => item.id === "c")?.anchorId).toBe("b");
  });
});
