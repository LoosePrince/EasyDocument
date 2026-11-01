import { describe, expect, it } from "vitest";
import {
  buildSearchDoc,
  buildSnippet,
  createSearchEngine,
  extractKeywords,
  toPlainText,
  toSearchHits,
  tokenizeForSearch,
} from "./index";

describe("toPlainText", () => {
  it("剥离 Markdown 语法标记", () => {
    const text = toPlainText("# 标题\n\n**粗体** 与 `代码`\n\n- 列表", "markdown");
    expect(text).not.toContain("#");
    expect(text).not.toContain("**");
    expect(text).not.toContain("`");
    expect(text).toContain("标题");
    expect(text).toContain("粗体");
  });

  it("保留链接文字、去掉 URL", () => {
    const text = toPlainText("[链接](https://example.com)", "markdown");
    expect(text).toContain("链接");
    expect(text).not.toContain("https://");
  });

  it("去掉代码块内容", () => {
    const text = toPlainText("前\n```js\nconst secret = 1;\n```\n后", "markdown");
    expect(text).toContain("前");
    expect(text).not.toContain("secret");
  });

  it("剥离 HTML 标签与脚本", () => {
    const text = toPlainText("<h1>标题</h1><script>alert(1)</script><style>a{}</style>", "html");
    expect(text).toContain("标题");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("a{}");
  });

  it("截断到 1000 字符", () => {
    const text = toPlainText("字".repeat(2000), "markdown");
    expect(text.length).toBe(1000);
  });

  it("合并多余空白", () => {
    expect(toPlainText("a\n\n\n   b", "markdown")).toBe("a b");
  });
});

describe("extractKeywords", () => {
  it("按词频取前 N 个", () => {
    const keywords = extractKeywords("markdown markdown markdown 文档 文档 测试");
    expect(keywords[0]).toBe("markdown");
    expect(keywords[1]).toBe("文档");
  });

  it("过滤停用词与单字与纯数字", () => {
    const keywords = extractKeywords("the 中文 使用 123 x");
    expect(keywords).not.toContain("the");
    expect(keywords).not.toContain("123");
    expect(keywords).not.toContain("x");
  });

  it("最多返回 maxKeywords 个", () => {
    const keywords = extractKeywords(
      Array.from({ length: 30 }, (_, i) => `word${i}`).join(" "),
      5,
    );
    expect(keywords).toHaveLength(5);
  });
});

describe("tokenizeForSearch", () => {
  it("拉丁词整体切分", () => {
    expect(tokenizeForSearch("Hello World")).toEqual(["hello", "world"]);
  });

  it("中文切分为单字 + 二元组", () => {
    const tokens = tokenizeForSearch("文档");
    expect(tokens).toContain("文");
    expect(tokens).toContain("档");
    expect(tokens).toContain("文档");
  });
});

describe("搜索端到端", () => {
  const docs = [
    buildSearchDoc({
      branch: "main",
      path: "README.md",
      title: "EasyDocument 文档中心",
      content: "# EasyDocument\n\n一个静态文档系统，支持 Markdown 与数学公式。",
      kind: "markdown",
    }),
    buildSearchDoc({
      branch: "main",
      path: "指南/安装.md",
      title: "安装指南",
      content: "# 安装指南\n\n运行 npm install 后执行 npm run dev。",
      kind: "markdown",
    }),
  ];

  const engine = createSearchEngine(docs);

  it("按标题命中", () => {
    const hits = toSearchHits(engine, "安装", 10);
    expect(hits[0]?.path).toBe("指南/安装.md");
  });

  it("按正文命中", () => {
    const hits = toSearchHits(engine, "npm install", 10);
    expect(hits.some((hit) => hit.path === "指南/安装.md")).toBe(true);
  });

  it("前缀匹配生效", () => {
    const hits = toSearchHits(engine, "instal", 10);
    expect(hits.some((hit) => hit.path === "指南/安装.md")).toBe(true);
  });

  it("中文子串命中", () => {
    const hits = toSearchHits(engine, "数学公式", 10);
    expect(hits[0]?.path).toBe("README.md");
  });

  it("尊重最大结果数", () => {
    const hits = toSearchHits(engine, "npm", 1);
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it("返回字段完整", () => {
    const hit = toSearchHits(engine, "安装", 5)[0];
    expect(hit).toMatchObject({
      branch: "main",
      path: "指南/安装.md",
      title: "安装指南",
    });
    expect(hit.snippet.length).toBeGreaterThan(0);
  });
});

describe("buildSnippet", () => {
  it("围绕命中位置截取", () => {
    const snippet = buildSnippet("a".repeat(100) + "关键词" + "b".repeat(100), "关键词", 10);
    expect(snippet).toContain("关键词");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("无命中时返回开头", () => {
    const snippet = buildSnippet("一段内容", "不存在");
    expect(snippet).toBe("一段内容");
  });
});

describe("buildSearchDoc", () => {
  it("id 由版本与路径组成", () => {
    const doc = buildSearchDoc({
      branch: "1.3.4",
      path: "a.md",
      title: "A",
      content: "内容",
      kind: "markdown",
    });
    expect(doc.id).toBe("1.3.4/a.md");
    expect(doc.branch).toBe("1.3.4");
    expect(doc.keywords.length).toBeGreaterThan(0);
  });
});
