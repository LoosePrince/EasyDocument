import { Link, useLoaderData } from "react-router";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import type { Route } from "./+types/home";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { FontAwesomeCompat } from "~/components/markdown/doc-enhancements";
import { PreviewPane } from "~/components/editor/preview-pane";
import { SearchDialog } from "~/components/search/search-dialog";
import { loadHomeContent } from "~/lib/site/home.server";
import { docUrlPath } from "~/lib/content/routes";
import { stripExtension } from "~/lib/content/types";
import { staggerStyle } from "~/lib/utils";

export function loader() {
  return loadHomeContent();
}

export function meta({ data }: Route.MetaArgs) {
  const config = data?.config;
  return [
    { title: config?.site.title ?? "EasyDocument" },
    { name: "description", content: config?.site.description ?? "" },
    { name: "keywords", content: config?.site.keywords ?? "" },
    { property: "og:title", content: config?.site.title ?? "" },
    { property: "og:description", content: config?.site.description ?? "" },
  ];
}

export default function HomePage() {
  const data = useLoaderData<typeof loader>();
  const { config } = useSite();
  const { home } = config;
  const [searchOpen, setSearchOpen] = useState(false);

  const sections = home.sections;
  const showSearch = config.search.enable && Boolean(home.hero.search_placeholder);
  const docsHref = docUrlPath({ branch: data.defaultBranch, path: "" });

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden border-b border-[var(--ed-border)]">
          <BackdropGrid />

          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-16 pt-16 text-center sm:pt-24">
            {home.hero.badge ? (
              <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-3 py-1 text-xs text-[var(--ed-text-muted)]">
                <Sparkles className="size-3 text-[var(--ed-primary)]" />
                {home.hero.badge}
              </span>
            ) : null}

            {home.hero.logo ? (
              <img src={home.hero.logo} alt="" className="mb-6 size-16" width={64} height={64} />
            ) : null}

            <h1 className="text-4xl font-semibold tracking-tight sm:text-[3.25rem] sm:leading-[1.1]">
              {home.hero.title || config.site.name}
            </h1>

            {home.hero.subtitle ? (
              <p className="mt-4 text-lg text-[var(--ed-text-muted)] sm:text-xl">
                {home.hero.subtitle}
              </p>
            ) : null}

            {home.hero.description ? (
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ed-text-muted)]">
                {home.hero.description}
              </p>
            ) : null}

            {/* Hero 搜索 */}
            {showSearch ? (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="group mt-8 flex w-full max-w-md items-center gap-2.5 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-4 py-3 text-left text-sm text-[var(--ed-text-subtle)] shadow-sm transition-colors hover:border-[var(--ed-primary)]"
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 truncate">{home.hero.search_placeholder}</span>
                <kbd className="rounded border border-[var(--ed-border)] px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>
              </button>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {home.hero.button_text ? (
                <Link
                  to={home.hero.button_link || docsHref}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ed-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-[var(--ed-primary)]/20 transition-transform hover:-translate-y-0.5"
                >
                  {home.hero.button_text}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}

              {home.hero.secondary_text ? (
                <Link
                  to={home.hero.secondary_link || docsHref}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ed-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--ed-primary)] hover:text-[var(--ed-primary)]"
                >
                  {home.hero.secondary_text}
                </Link>
              ) : null}
            </div>

            {/* 统计数字 */}
            {home.stats.length > 0 ? (
              <dl className="mt-12 grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
                {home.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]/70 px-3 py-3"
                  >
                    <dt className="mt-1 text-xs text-[var(--ed-text-muted)]">{stat.label}</dt>
                    <dd className="text-xl font-semibold text-[var(--ed-primary)]">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>

        {/* 自定义 HTML 首页内容（home.use_file） */}
        {home.use_file && data.customHtml ? (
          <section className="mx-auto max-w-4xl px-5 py-12">
            <div className="doc-content" dangerouslySetInnerHTML={{ __html: data.customHtml }} />
          </section>
        ) : null}

        {/* ---------- 文档入口 ---------- */}
        {sections.docs.enable && data.branches.length > 0 ? (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <SectionHeading
              eyebrow={<BookOpen className="size-4" />}
              title={sections.docs.title || "文档"}
              description={sections.docs.description}
            />

            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <div className="space-y-2">
                {data.branches.map((branch) => (
                  <Link
                    key={branch.name}
                    to={docUrlPath({ branch: branch.name, path: "" })}
                    className="group flex items-center gap-3 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-4 py-3 transition-colors hover:border-[var(--ed-primary)]"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--ed-primary-soft)] text-[var(--ed-primary)]">
                      <BookOpen className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {branch.label}
                        {branch.name === data.defaultBranch ? (
                          <span className="rounded bg-[var(--ed-primary-soft)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--ed-primary)]">
                            默认
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--ed-text-muted)]">
                        {branch.docCount} 篇文档
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-[var(--ed-text-subtle)] transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-2">
                {data.featuredDocs.length > 0 ? (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {data.featuredDocs.map((doc) => (
                      <li key={`${doc.branch}/${doc.path}`}>
                        <Link
                          to={docUrlPath({ branch: doc.branch, path: stripExtension(doc.path) })}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
                        >
                          <FileText className="size-3.5 shrink-0 opacity-60" />
                          <span className="truncate">{doc.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-8 text-center text-sm text-[var(--ed-text-subtle)]">
                    文档正在编写中。
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* ---------- 特性 ---------- */}
        {sections.features.enable && home.features.length > 0 ? (
          <section className="border-y border-[var(--ed-border)] bg-[var(--ed-bg-subtle)]/50">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <SectionHeading
                eyebrow={<Sparkles className="size-4" />}
                title={sections.features.title || "核心特性"}
                description={sections.features.description}
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-stagger>
                {home.features.map((feature, index) => (
                  <div
                    key={feature.title}
                    style={staggerStyle(index, config.animation.sidebar.stagger_delay)}
                    className="rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5 transition-shadow hover:shadow-lg"
                  >
                    <span className="mb-3 grid size-10 place-items-center rounded-xl bg-[var(--ed-primary-soft)] text-[var(--ed-primary)] [&_.fa-compat]:size-5">
                      <FontAwesomeCompat className={feature.icon} />
                    </span>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--ed-text-muted)]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ---------- 代码演示 ---------- */}
        {sections.code_demo.enable && home.code_demo.content ? (
          <section className="mx-auto max-w-6xl px-5 py-16">
            <SectionHeading
              eyebrow={<Terminal className="size-4" />}
              title={sections.code_demo.title || "Markdown 驱动"}
              description={sections.code_demo.description}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg)]">
                <div className="flex items-center gap-1.5 border-b border-[var(--ed-border)] bg-[var(--ed-bg-subtle)] px-3 py-2">
                  <span className="size-2.5 rounded-full bg-red-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-400/70" />
                  <span className="size-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ml-2 font-mono text-[11px] text-[var(--ed-text-subtle)]">
                    {home.code_demo.filename}
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-[var(--ed-text-muted)]">
                  <code>{home.code_demo.content}</code>
                </pre>
              </div>

              <PreviewPane
                markdown={home.code_demo.content}
                docPath={home.code_demo.filename || "README.md"}
                branch={data.defaultBranch}
                defaultBranch={data.defaultBranch}
                versions={data.branches.map((branch) => branch.name)}
                indexPages={config.document.index_pages}
                supportedExtensions={config.document.supported_extensions}
                baseUrl={config.site.base_url}
                codeBlock={{
                  lineNumbers: config.document.code_block.line_numbers,
                  startLine: config.document.code_block.start_line,
                  theme: {
                    light: config.document.code_block.theme.light ?? "github-light",
                    dark: config.document.code_block.theme.dark ?? "github-dark",
                  },
                }}
                codeCopyButton={config.document.code_copy_button}
                math={config.extensions.math}
                highlight={config.extensions.highlight}
                mermaid={config.extensions.mermaid}
                tocNumbering={config.document.toc_numbering}
                tocIgnoreH1={config.document.toc_ignore_h1}
                className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5"
              />
            </div>
          </section>
        ) : null}

        {/* ---------- 快速开始 ---------- */}
        {sections.get_started.enable &&
        home.get_started.enable &&
        (home.get_started.steps?.length ?? 0) > 0 ? (
          <section className="border-t border-[var(--ed-border)] bg-[var(--ed-bg-subtle)]/50">
            <div className="mx-auto max-w-4xl px-5 py-16">
              <SectionHeading
                eyebrow={<GraduationCap className="size-4" />}
                title={sections.get_started.title || home.get_started.title || "快速开始"}
                description={sections.get_started.description}
              />
              <ol className="relative space-y-3 border-l border-[var(--ed-border)] pl-6">
                {home.get_started.steps?.map((step, index) => (
                  <li key={step.title} className="relative">
                    <span className="absolute -left-[1.85rem] grid size-6 place-items-center rounded-full border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] text-[11px] font-semibold text-[var(--ed-primary)]">
                      {index + 1}
                    </span>
                    <div className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="mt-1 text-sm text-[var(--ed-text-muted)]">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {home.get_started.button_text ? (
                <div className="mt-6 pl-6">
                  <Link
                    to={home.get_started.button_link || docsHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ed-primary)] px-4 py-2 text-sm font-medium text-[var(--ed-primary)] transition-colors hover:bg-[var(--ed-primary-soft)]"
                  >
                    {home.get_started.button_text}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ---------- 快捷入口 ---------- */}
        {home.quick_links.length > 0 ? (
          <section className="mx-auto max-w-6xl px-5 py-14">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {home.quick_links.map((link) => (
                <Link
                  key={link.title}
                  to={link.url}
                  className="group rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4 transition-colors hover:border-[var(--ed-primary)]"
                >
                  <FontAwesomeCompat className={link.icon} />
                  <p className="mt-2 text-sm font-medium">{link.title}</p>
                  <p className="mt-1 text-xs text-[var(--ed-text-muted)]">{link.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {config.layout.show_footer ? <SiteFooter /> : null}

      {config.search.enable ? (
        <SearchDialog
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          branches={data.branches}
          defaultBranch={data.defaultBranch}
        />
      ) : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 text-center">
      {eyebrow ? (
        <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ed-primary)]">
          {eyebrow}
          {title}
        </span>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--ed-text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

/** Hero 背景网格与光晕 */
function BackdropGrid() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--ed-border) 1px, transparent 1px), linear-gradient(to bottom, var(--ed-border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 size-[520px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--ed-primary)" }}
      />
    </>
  );
}
