import { describe, expect, it, vi } from "vitest";
import {
  loadExternalMount,
  mergeMountIntoTree,
  parseGithubTreeUrl,
} from "./external";
import { buildDocsTree } from "./tree";
import type { DocsNode } from "./types";

const OPTIONS = {
  indexPages: ["README.md", "index.md"],
  supportedExtensions: [".md", ".html"],
};

function mockFetch(map: Record<string, { status?: number; body: unknown }>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(map).find((candidate) => url.includes(candidate));
    if (!key) {
      return new Response("not found", { status: 404 });
    }
    const entry = map[key];
    const status = entry.status ?? 200;
    const body = typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body);
    return new Response(body, { status });
  }) as unknown as typeof fetch;
}

describe("parseGithubTreeUrl", () => {
  it("解析 owner/repo/branch/dir", () => {
    expect(
      parseGithubTreeUrl("https://github.com/LoosePrince/EasyDocument/tree/data/main/指南"),
    ).toEqual({
      owner: "LoosePrince",
      repo: "EasyDocument",
      branch: "data",
      dirPath: "main/指南",
    });
  });

  it("无子目录", () => {
    expect(parseGithubTreeUrl("https://github.com/o/r/tree/main")).toEqual({
      owner: "o",
      repo: "r",
      branch: "main",
      dirPath: "",
    });
  });

  it("解码中文路径", () => {
    const parsed = parseGithubTreeUrl(
      `https://github.com/o/r/tree/main/${encodeURIComponent("指南")}`,
    );
    expect(parsed?.dirPath).toBe("指南");
  });

  it("非 GitHub / 非 tree 链接返回 null", () => {
    expect(parseGithubTreeUrl("https://example.com/o/r/tree/main")).toBeNull();
    expect(parseGithubTreeUrl("https://github.com/o/r/blob/main/x.md")).toBeNull();
    expect(parseGithubTreeUrl("not a url")).toBeNull();
  });
});

describe("loadExternalMount · path_json", () => {
  it("读取 path.json 并映射虚拟路径", async () => {
    const fetchImpl = mockFetch({
      "https://example.com/docs/path.json": {
        body: {
          title: "外部文档",
          children: [
            { path: "入门.md", title: "入门" },
            { path: "指南", index: { path: "指南/README.md" }, children: [] },
          ],
        },
      },
    });

    const { result } = await loadExternalMount(
      { mode: "path_json", url: "https://example.com/docs/path.json", path: "外部" },
      { ...OPTIONS, fetchImpl },
    );

    expect(result).not.toBeNull();
    expect(result!.node.path).toBe("外部");
    expect(result!.node.children.map((node) => node.path)).toEqual([
      "外部/入门.md",
      "外部/指南",
    ]);
    // URL 里 CJK 会被百分号编码，比较解码后的结果
    expect(decodeURI(result!.resolvers.get("外部/入门.md")!)).toBe(
      "https://example.com/docs/入门.md",
    );
    expect(decodeURI(result!.resolvers.get("外部/指南/README.md")!)).toBe(
      "https://example.com/docs/指南/README.md",
    );
  });

  it("目录 URL 自动补 path.json", async () => {
    const fetchImpl = mockFetch({
      "https://example.com/docs/path.json": { body: { children: [] } },
    });
    const { result } = await loadExternalMount(
      { mode: "path_json", url: "https://example.com/docs/", path: "外部" },
      { ...OPTIONS, fetchImpl },
    );
    expect(result).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/docs/path.json",
      expect.anything(),
    );
  });

  it("读取失败时返回 warning 而不是抛错", async () => {
    const fetchImpl = mockFetch({});
    const { result, warning } = await loadExternalMount(
      { mode: "path_json", url: "https://example.com/none/path.json", path: "外部" },
      { ...OPTIONS, fetchImpl },
    );
    expect(result).toBeNull();
    expect(warning).toContain("读取失败");
  });
});

describe("loadExternalMount · github_tree", () => {
  it("递归列出目录并生成树", async () => {
    const fetchImpl = mockFetch({
      "contents/指南?ref=main": {
        body: [
          { name: "README.md", path: "指南/README.md", type: "file" },
          { name: "安装.md", path: "指南/安装.md", type: "file" },
          { name: "深入", path: "指南/深入", type: "dir" },
        ],
      },
      "contents/指南/深入?ref=main": {
        body: [{ name: "原理.md", path: "指南/深入/原理.md", type: "file" }],
      },
    });

    const { result } = await loadExternalMount(
      {
        mode: "github_tree",
        url: "https://github.com/o/r/tree/main/指南",
        path: "外部",
      },
      { ...OPTIONS, fetchImpl },
    );

    expect(result).not.toBeNull();
    const node = result!.node;
    // 根目录：文件（安装）+ 子目录（深入），索引页 README 挂在挂载节点上
    expect(node.children.map((child) => child.title)).toEqual(["安装", "深入"]);
    // README 作为挂载节点自身的索引页
    expect(node.index?.path).toBe("外部/README.md");
    expect(decodeURI(result!.resolvers.get("外部/深入/原理.md")!)).toBe(
      "https://raw.githubusercontent.com/o/r/main/指南/深入/原理.md",
    );
  });

  it("目录里有 path.json 时优先使用", async () => {
    const fetchImpl = mockFetch({
      "contents/指南?ref=main": {
        body: [{ name: "path.json", path: "指南/path.json", type: "file" }],
      },
      "指南/path.json": {
        body: { children: [{ path: "自定义.md", title: "自定义" }] },
      },
    });

    const { result } = await loadExternalMount(
      {
        mode: "github_tree",
        url: "https://github.com/o/r/tree/main/指南",
        path: "外部",
      },
      { ...OPTIONS, fetchImpl },
    );

    expect(result!.node.children.map((child) => child.path)).toEqual(["外部/自定义.md"]);
  });

  it("非 GitHub 目录链接给出 warning", async () => {
    const { result, warning } = await loadExternalMount(
      { mode: "github_tree", url: "https://example.com/x", path: "外部" },
      { ...OPTIONS, fetchImpl: mockFetch({}) },
    );
    expect(result).toBeNull();
    expect(warning).toContain("GitHub");
  });

  it("API 出错时返回 warning", async () => {
    const fetchImpl = mockFetch({
      "api.github.com": { status: 403, body: { message: "rate limited" } },
    });
    const { result, warning } = await loadExternalMount(
      {
        mode: "github_tree",
        url: "https://github.com/o/r/tree/main/指南",
        path: "外部",
      },
      { ...OPTIONS, fetchImpl },
    );
    expect(result).toBeNull();
    expect(warning).toContain("加载失败");
  });
});

describe("mergeMountIntoTree", () => {
  it("把外部节点挂到本地树上，不覆盖同名内容", () => {
    const tree = buildDocsTree(
      [{ path: "指南/README.md", title: "指南" }, { path: "指南/本地.md", title: "本地" }],
      { indexPages: OPTIONS.indexPages, supportedExtensions: OPTIONS.supportedExtensions },
    );

    const mounted: DocsNode = {
      title: "外部文档",
      path: "指南",
      children: [{ title: "远端", path: "指南/远端.md", children: [] }],
    };

    mergeMountIntoTree(tree, mounted);

    const guide = tree.children.find((node) => node.path === "指南")!;
    expect(guide.title).toBe("外部文档");
    expect(guide.children.map((node) => node.path)).toEqual(["指南/本地.md", "指南/远端.md"]);
    expect(guide.mount).toBeDefined();
  });

  it("目标目录不存在时按路径创建", () => {
    const tree = buildDocsTree([{ path: "a.md", title: "A" }], {
      indexPages: OPTIONS.indexPages,
      supportedExtensions: OPTIONS.supportedExtensions,
    });

    mergeMountIntoTree(tree, {
      title: "外部文档",
      path: "外部/深层",
      children: [{ title: "X", path: "外部/深层/x.md", children: [] }],
    });

    const external = tree.children.find((node) => node.path === "外部")!;
    expect(external).toBeDefined();
    const deep = external.children.find((node) => node.path === "外部/深层")!;
    expect(deep.children[0].path).toBe("外部/深层/x.md");
  });
});
