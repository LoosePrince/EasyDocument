/**
 * 搜索索引
 *
 * 取代 legacy 的 `search.json`（build.py:508-613）：
 *  - content 取纯文本、合并空白、截断 1000 字符（与 build.py 一致）
 *  - keywords 取词频前 10（去停用词）
 *  - 运行时用 MiniSearch 建索引，支持前缀 + 模糊匹配
 */
import MiniSearch from "minisearch";

export interface SearchDoc {
  /** 唯一键：`{branch}/{language?}/{path}` */
  id: string;
  branch: string;
  /** 文档语言（默认语言省略） */
  language?: string;
  path: string;
  title: string;
  content: string;
  keywords: string[];
}

export interface SearchIndexFile {
  version: 1;
  branch: string;
  docs: SearchDoc[];
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "was",
  "were",
  "you",
  "your",
  "not",
  "但是",
  "可以",
  "如果",
  "需要",
  "使用",
  "一个",
  "这个",
  "以及",
  "或者",
  "并且",
  "以及",
  "我们",
  "他们",
  "the",
  "http",
  "https",
  "www",
]);

/** 把 Markdown / HTML 变成可搜索的纯文本 */
export function toPlainText(source: string, kind: "markdown" | "html", maxChars = 1000): string {
  let text = source;

  if (kind === "markdown") {
    text = stripMarkdown(text);
  } else {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
  }

  text = text
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxChars ? `${text.slice(0, maxChars)}` : text;
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\|/g, " ")
    .replace(/^-{3,}$/gm, " ");
}

/** 关键词提取（对齐 build.py extract_keywords：词频前 10、长度 > 1、去停用词） */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9_]+|[一-鿿]{2,}/g) ?? [];
  const frequency = new Map<string, number>();

  for (const token of tokens) {
    if (token.length <= 1) continue;
    if (STOPWORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxKeywords)
    .map(([token]) => token);
}

export function buildSearchDoc(params: {
  branch: string;
  path: string;
  title: string;
  content: string;
  kind: "markdown" | "html";
  language?: string;
}): SearchDoc {
  const plain = toPlainText(params.content, params.kind);
  return {
    id: `${params.branch}/${params.language ? `${params.language}/` : ""}${params.path}`,
    branch: params.branch,
    language: params.language,
    path: params.path,
    title: params.title,
    content: plain,
    keywords: extractKeywords(`${params.title} ${plain}`),
  };
}

/** 构建运行期 MiniSearch 实例（一次构建，多次查询） */
export function createSearchEngine(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const engine = new MiniSearch<SearchDoc>({
    fields: ["title", "content", "keywords"],
    storeFields: ["branch", "language", "path", "title", "content"],
    tokenize: tokenizeForSearch,
    processTerm: (term) => term.toLowerCase(),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 4, keywords: 2, content: 1 },
      combineWith: "OR",
    },
  });
  engine.addAll(docs);
  return engine;
}

/**
 * 分词：拉丁词按空白/标点切分；中文按二元组切分（无需词典，召回好）。
 */
export function tokenizeForSearch(text: string): string[] {
  const normalized = text.toLowerCase().normalize("NFKC");
  const tokens: string[] = [];
  const segments = normalized.match(/[a-z0-9_]+|[一-鿿]+/g) ?? [];

  for (const segment of segments) {
    if (/^[a-z0-9_]+$/.test(segment)) {
      tokens.push(segment);
      continue;
    }
    // 中文：单字 + 相邻二元组
    for (let i = 0; i < segment.length; i += 1) {
      tokens.push(segment[i]);
      if (i < segment.length - 1) tokens.push(segment.slice(i, i + 2));
    }
  }
  return tokens;
}

export interface SearchHit {
  branch: string;
  language?: string;
  path: string;
  title: string;
  snippet: string;
  score: number;
  matchedTerms: string[];
}

/** 统一搜索结果形态，供 UI 渲染 */
export function toSearchHits(
  engine: MiniSearch<SearchDoc>,
  query: string,
  maxResults: number,
): SearchHit[] {
  const results = engine.search(query, { prefix: true, fuzzy: 0.2 }).slice(0, maxResults);
  return results.map((result) => {
    const content = (result as unknown as { content?: string }).content ?? "";
    return {
      branch: String(result.branch ?? ""),
      language: result.language ? String(result.language) : undefined,
      path: String(result.path ?? ""),
      title: String(result.title ?? ""),
      snippet: buildSnippet(content, query),
      score: result.score,
      matchedTerms: result.terms ?? [],
    };
  });
}

/** 生成命中片段（居中的 ±60 字符） */
export function buildSnippet(content: string, query: string, radius = 60): string {
  if (!content) return "";
  const lower = content.toLowerCase();
  const needle = query.toLowerCase().trim();
  const hit = needle ? lower.indexOf(needle) : -1;
  if (hit === -1) return content.slice(0, radius * 2) + (content.length > radius * 2 ? "…" : "");

  const start = Math.max(0, hit - radius);
  const end = Math.min(content.length, hit + needle.length + radius);
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`;
}
