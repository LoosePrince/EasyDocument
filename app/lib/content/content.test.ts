import { describe, expect, it } from "vitest";
import { buildDocsTree, extractTitle } from "./tree";
import { buildContentPointer, normalizeSlashes, parseContentRef, parseRepoSlug, resolveRepo } from "./pointer";
import { buildPrevNext, docUrlPath, normalizeDocPath, siteHref } from "./routes";
import { collectDocPaths, isIndexFileName, stripExtension } from "./types";

const INDEX_PAGES = ["README.md", "index.md"];
const EXTS = [".md", ".html"];

describe("buildDocsTree", () => {
  it("按目录结构建树，索引页挂在目录上", () => {
    const tree = buildDocsTree(
      [
        { path: "README.md", title: "首页" },
        { path: "指南/README.md", title: "指南" },
        { path: "指南/安装.md", title: "安装" },
      ],
      { indexPages: INDEX_PAGES, supportedExtensions: EXTS },
    );

    expect(tree.index?.path).toBe("README.md");
    const guide = tree.children.find((node) => node.path === "指南");
    expect(guide?.index?.path).toBe("指南/README.md");
    expect(guide?.children.map((child) => child.path)).toEqual(["指南/安装.md"]);
  });

  it("同一目录内文件在前、目录在后，各自按标题排序", () => {
    const tree = buildDocsTree(
      [
        { path: "b.md", title: "B" },
        { path: "a.md", title: "A" },
        { path: "zzz/README.md", title: "Z" },
        { path: "aaa/README.md", title: "A目录" },
      ],
      { indexPages: INDEX_PAGES, supportedExtensions: EXTS },
    );
    expect(tree.children.map((node) => node.path)).toEqual(["a.md", "b.md", "aaa", "zzz"]);
  });

  it("忽略不支持的扩展名", () => {
    const tree = buildDocsTree(
      [
        { path: "a.md", title: "A" },
        { path: "b.txt", title: "B" },
        { path: "c.png", title: "C" },
      ],
      { indexPages: INDEX_PAGES, supportedExtensions: EXTS },
    );
    expect(tree.children.map((node) => node.path)).toEqual(["a.md"]);
  });

  it("目录标题跟随索引页标题", () => {
    const tree = buildDocsTree([{ path: "guide/README.md", title: "使用指南" }], {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
    });
    expect(tree.children[0].title).toBe("使用指南");
  });

  it("collectDocPaths 收集全部可访问文档", () => {
    const tree = buildDocsTree(
      [
        { path: "README.md", title: "首页" },
        { path: "g/README.md", title: "G" },
        { path: "g/x.md", title: "X" },
      ],
      { indexPages: INDEX_PAGES, supportedExtensions: EXTS },
    );
    expect(collectDocPaths(tree).map((doc) => doc.path)).toEqual([
      "README.md",
      "g/README.md",
      "g/x.md",
    ]);
  });

  it("HTML 文档同样入树", () => {
    const tree = buildDocsTree([{ path: "demo.html", title: "示例" }], {
      indexPages: INDEX_PAGES,
      supportedExtensions: EXTS,
    });
    expect(tree.children[0].path).toBe("demo.html");
  });
});

describe("extractTitle", () => {
  it("取 Markdown 首个 h1", () => {
    expect(extractTitle("# 标题\n\n内容", "a.md", "markdown")).toBe("标题");
  });

  it("无 h1 时取 h2", () => {
    expect(extractTitle("## 二级\n", "a.md", "markdown")).toBe("二级");
  });

  it("都没有时用文件名（下划线转空格）", () => {
    expect(extractTitle("无标题", "my_file.md", "markdown")).toBe("my file");
  });

  it("HTML 取 <title>", () => {
    expect(extractTitle("<html><title>页面标题</title></html>", "a.html", "html")).toBe(
      "页面标题",
    );
  });

  it("HTML 无 title 时取 h1", () => {
    expect(extractTitle("<h1>正文标题</h1>", "a.html", "html")).toBe("正文标题");
  });
});

describe("URL 生成", () => {
  it("索引页折叠为目录路径", () => {
    expect(normalizeDocPath("README.md", INDEX_PAGES, "main")).toEqual({ branch: "main", path: "" });
    expect(normalizeDocPath("指南/README.md", INDEX_PAGES, "main")).toEqual({
      branch: "main",
      path: "指南",
    });
  });

  it("普通文档去掉扩展名", () => {
    expect(normalizeDocPath("指南/安装.md", INDEX_PAGES, "main")).toEqual({
      branch: "main",
      path: "指南/安装",
    });
  });

  it("docUrlPath 兜底折叠未去索引名的路径", () => {
    expect(docUrlPath({ branch: "main", path: "参考/README" })).toBe("/docs/main/参考");
    expect(docUrlPath({ branch: "main", path: "README" })).toBe("/docs/main");
    expect(docUrlPath({ branch: "main", path: "参考/index" })).toBe("/docs/main/参考");
    expect(docUrlPath({ branch: "main", path: "参考/常见问题" })).toBe("/docs/main/参考/常见问题");
  });

  it("生成 /docs/{branch}/{path} 真实路径", () => {
    expect(docUrlPath({ branch: "main", path: "" })).toBe("/docs/main");
    expect(docUrlPath({ branch: "main", path: "指南/安装" })).toBe("/docs/main/指南/安装");
    expect(docUrlPath({ branch: "1.3.4", path: "指南" })).toBe("/docs/1.3.4/指南");
  });

  it("URL 段做编码，锚点附在末尾", () => {
    expect(docUrlPath({ branch: "main", path: "a b" })).toBe("/docs/main/a%20b");
    expect(docUrlPath({ branch: "main", path: "x" }, "标题")).toBe("/docs/main/x#标题");
  });

  it("siteHref 拼接 base_url 且保留外链", () => {
    expect(siteHref("/docs", "/")).toBe("/docs");
    expect(siteHref("/docs", "/sub")).toBe("/sub/docs");
    expect(siteHref("https://example.com", "/sub")).toBe("https://example.com");
  });

  it("buildPrevNext 处理边界", () => {
    const docs = [
      { path: "a.md", title: "A" },
      { path: "b.md", title: "B" },
    ];
    expect(buildPrevNext(docs, "a.md")).toEqual({ prev: null, next: docs[1] });
    expect(buildPrevNext(docs, "b.md")).toEqual({ prev: docs[0], next: null });
    expect(buildPrevNext(docs, "missing")).toEqual({ prev: null, next: null });
  });
});

describe("内容指针", () => {
  it("解析 data:/config.js", () => {
    const parsed = parseContentRef("data:/config.js");
    expect(parsed.branch).toBe("data");
    expect(parsed.configPath).toBe("config.js");
    expect(parsed.rootDir).toBe("");
  });

  it("解析带子目录的指针", () => {
    const parsed = parseContentRef("content:docs/config.js");
    expect(parsed.branch).toBe("content");
    expect(parsed.configPath).toBe("docs/config.js");
    expect(parsed.rootDir).toBe("docs");
  });

  it("省略分支时默认 data", () => {
    expect(parseContentRef("/config.js").branch).toBe("data");
  });

  it("parseRepoSlug 支持多种写法", () => {
    expect(parseRepoSlug("https://github.com/a/b")).toEqual({ owner: "a", repo: "b" });
    expect(parseRepoSlug("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseRepoSlug("github.com/a/b/tree/main")).toEqual({ owner: "a", repo: "b" });
    expect(parseRepoSlug("not-a-repo")).toBeNull();
  });

  it("resolveRepo 优先环境变量，其次 Pages 域名", () => {
    expect(
      resolveRepo(undefined, { envRepo: "env/repo", origin: "https://o.github.io/r/" }),
    ).toEqual({ owner: "env", repo: "repo" });

    expect(resolveRepo(undefined, { origin: "https://owner.github.io/myrepo/" })).toEqual({
      owner: "owner",
      repo: "myrepo",
    });

    expect(resolveRepo(undefined, { origin: "https://owner.github.io/" })).toEqual({
      owner: "owner",
      repo: "owner.github.io",
    });
  });

  it("buildContentPointer 合并指针与仓库信息", () => {
    const pointer = buildContentPointer({ data: "data:/config.js", repo: "a/b" }, {});
    expect(pointer).toMatchObject({ branch: "data", owner: "a", repo: "b", rootDir: "" });
  });

  it("normalizeSlashes 归一", () => {
    expect(normalizeSlashes("/a/b/")).toBe("a/b");
    expect(normalizeSlashes("")).toBe("");
    expect(normalizeSlashes("/")).toBe("");
  });
});

describe("小工具", () => {
  it("isIndexFileName 大小写不敏感", () => {
    expect(isIndexFileName("readme.md", INDEX_PAGES)).toBe(true);
    expect(isIndexFileName("README.MD", INDEX_PAGES)).toBe(true);
    expect(isIndexFileName("other.md", INDEX_PAGES)).toBe(false);
  });

  it("stripExtension 处理 md/html", () => {
    expect(stripExtension("a/b/c.md")).toBe("a/b/c");
    expect(stripExtension("a/b.html")).toBe("a/b");
    expect(stripExtension("a/b")).toBe("a/b");
  });
});
