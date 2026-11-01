import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Code2, Loader2, ListTree, RefreshCw, Save } from "lucide-react";
import type { GitHubClient, RepoRef } from "~/lib/github/client";
import { evaluateConfigModule, stringifyConfigModule } from "~/lib/config/evaluate";
import { resolveConfig } from "~/lib/config/schema";
import { useSite } from "~/components/providers/config-provider";

interface ConfigEditorProps {
  client: GitHubClient | null;
  repo: RepoRef;
  dataBranch: string;
}

/**
 * 站点配置编辑器
 *
 * 两个视图：
 *  - 高级：直接编辑 config.js 全文（保留注释结构）
 *  - 表单：常用字段（站点信息 / 外观 / 布局 / 文档 / 搜索 / 编辑台）
 *
 * 保存前用同一套 Zod schema 校验，避免把坏配置推到内容分支。
 */
export function ConfigEditor({ client, repo, dataBranch }: ConfigEditorProps) {
  const { config, pointer } = useSite();
  const configPath = pointer.configPath || "config.js";

  const [source, setSource] = useState("");
  const [sha, setSha] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"form" | "raw">("form");
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setFeedback(null);
    try {
      const file = await client.getFile(repo, configPath, dataBranch);
      if (!file) {
        setFeedback({ type: "error", text: `未找到 ${configPath}` });
        return;
      }
      setSource(file.content);
      setSha(file.sha);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "读取失败" });
    } finally {
      setLoading(false);
    }
  }, [client, configPath, dataBranch, repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsed = useMemo(() => {
    if (!source) return null;
    const evaluated = evaluateConfigModule(source, { label: configPath });
    return resolveConfig(evaluated);
  }, [source, configPath]);

  const save = async () => {
    if (!client || !parsed) return;
    if (parsed.warnings.length > 0) {
      const proceed = window.confirm(
        `配置存在 ${parsed.warnings.length} 处警告：\n\n${parsed.warnings.slice(0, 6).join("\n")}\n\n仍要提交吗？`,
      );
      if (!proceed) return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await client.putFile(repo, {
        path: configPath,
        branch: dataBranch,
        content: source,
        sha,
        message: "chore(config): 更新站点配置（网页编辑台）",
      });
      setSha(result.content.sha);
      setFeedback({ type: "ok", text: "配置已提交，触发重建后生效" });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "提交失败" });
    } finally {
      setSaving(false);
    }
  };

  /** 表单改动 → 回写源码 */
  const patch = (updater: (draft: Record<string, unknown>) => void) => {
    const evaluated = evaluateConfigModule(source, { label: configPath }) as Record<string, unknown>;
    const draft = structuredClone(evaluated ?? {});
    updater(draft);
    setSource(stringifyConfigModule(draft));
  };

  if (loading) {
    return <div className="skeleton h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-[var(--ed-border)] p-1">
          <button
            type="button"
            onClick={() => setView("form")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
              view === "form" ? "bg-[var(--ed-bg-subtle)] font-medium" : "text-[var(--ed-text-muted)]"
            }`}
          >
            <ListTree className="size-3.5" />
            表单
          </button>
          <button
            type="button"
            onClick={() => setView("raw")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
              view === "raw" ? "bg-[var(--ed-bg-subtle)] font-medium" : "text-[var(--ed-text-muted)]"
            }`}
          >
            <Code2 className="size-3.5" />
            源码
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-xs text-[var(--ed-text-muted)] hover:text-[var(--ed-primary)]"
          >
            <RefreshCw className="size-3.5" />
            重新载入
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            提交配置
          </button>
        </div>
      </div>

      {parsed && parsed.warnings.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          {parsed.warnings.slice(0, 8).map((warning) => (
            <p key={warning} className="flex gap-1.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {view === "raw" ? (
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          spellCheck={false}
          className="h-[58vh] w-full resize-none rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg)] p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-[var(--ed-primary)]"
          aria-label="config.js 源码"
        />
      ) : (
        <ConfigForm config={config} patch={patch} parsed={parsed} />
      )}

      {feedback ? (
        <p
          className={`flex items-center gap-1.5 text-xs ${
            feedback.type === "ok" ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {feedback.type === "ok" ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}

function ConfigForm({
  config,
  patch,
  parsed,
}: {
  config: ReturnType<typeof useSite>["config"];
  patch: (updater: (draft: Record<string, unknown>) => void) => void;
  parsed: ReturnType<typeof resolveConfig> | null;
}) {
  if (!parsed) return null;

  const field = (
    section: string,
    key: string,
    label: string,
    value: string | number,
    type: "text" | "number" = "text",
  ) => (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--ed-text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => {
          const next = type === "number" ? Number(event.target.value) : event.target.value;
          patch((draft) => {
            const sectionDraft = (draft[section] as Record<string, unknown>) ?? {};
            sectionDraft[key] = next;
            draft[section] = sectionDraft;
          });
        }}
        className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--ed-primary)]"
      />
    </label>
  );

  const toggle = (section: string, key: string, label: string, value: boolean) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => {
          patch((draft) => {
            const sectionDraft = (draft[section] as Record<string, unknown>) ?? {};
            sectionDraft[key] = event.target.checked;
            draft[section] = sectionDraft;
          });
        }}
        className="size-4 accent-[var(--ed-primary)]"
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-5">
      <Section title="站点信息">
        <div className="grid gap-3 sm:grid-cols-2">
          {field("site", "name", "站点名称", config.site.name)}
          {field("site", "title", "浏览器标题", config.site.title)}
          {field("site", "description", "站点描述", config.site.description)}
          {field("site", "base_url", "基础路径 base_url", config.site.base_url)}
        </div>
      </Section>

      <Section title="外观">
        <div className="grid gap-3 sm:grid-cols-2">
          {field("appearance", "theme_color", "主题色", config.appearance.theme_color)}
          {field("appearance", "logo", "Logo 路径", config.appearance.logo)}
          {field("appearance", "favicon", "Favicon 路径", config.appearance.favicon)}
          {field("appearance", "font_family", "字体（留空使用 Outfit）", config.appearance.font_family)}
        </div>
      </Section>

      <Section title="布局">
        <div className="grid gap-3 sm:grid-cols-3">
          {field("layout", "sidebar_width", "侧栏宽度", config.layout.sidebar_width)}
          {field("layout", "toc_width", "目录宽度", config.layout.toc_width)}
          {field("layout", "mobile_breakpoint", "移动端断点", config.layout.mobile_breakpoint)}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {toggle("layout", "show_header", "显示顶栏", config.layout.show_header)}
          {toggle("layout", "show_footer", "显示页脚", config.layout.show_footer)}
        </div>
      </Section>

      <Section title="文档">
        <div className="grid gap-3 sm:grid-cols-3">
          {field("document", "default_branch", "默认版本", config.document.default_branch)}
          {field("document", "toc_depth", "目录深度", config.document.toc_depth, "number")}
          {field("document", "folder_expand_mode", "侧栏展开模式 (1–5)", config.navigation.folder_expand_mode, "number")}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {toggle("document", "toc_numbering", "目录编号", config.document.toc_numbering)}
          {toggle("document", "code_copy_button", "代码复制按钮", config.document.code_copy_button)}
          {toggle("navigation", "breadcrumb", "面包屑", config.navigation.breadcrumb)}
          {toggle("navigation", "prev_next_buttons", "上/下一篇", config.navigation.prev_next_buttons)}
        </div>
      </Section>

      <Section title="搜索与扩展">
        <div className="grid gap-3 sm:grid-cols-3">
          {field("search", "min_chars", "最小搜索字符数", config.search.min_chars, "number")}
          {field("search", "max_results", "最大结果数", config.search.max_results, "number")}
          {field("search", "placeholder", "搜索占位文本", config.search.placeholder)}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {toggle("extensions", "math", "数学公式", config.extensions.math)}
          {toggle("extensions", "mermaid", "Mermaid 图表", config.extensions.mermaid)}
          {toggle("extensions", "highlight", "代码高亮", config.extensions.highlight)}
          {toggle("extensions", "progress_bar", "阅读进度条", config.extensions.progress_bar.enable)}
        </div>
      </Section>

      <Section title="编辑台">
        {toggle("admin", "enable", "允许网页端编辑（admin.enable）", config.admin.enable)}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
