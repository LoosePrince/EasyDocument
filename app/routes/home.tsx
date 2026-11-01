import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { loadHomeContent } from "~/lib/site/home.server";
import { FontAwesomeCompat } from "~/components/markdown/doc-enhancements";

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
  const { config, resolveHref } = useSite();
  const { home } = config;

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--ed-primary)" }}
            aria-hidden="true"
          />
          <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:py-28">
            {home.hero.logo ? (
              <img
                src={resolveHref(home.hero.logo)}
                alt=""
                className="mb-6 size-16"
                width={64}
                height={64}
              />
            ) : null}

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {home.hero.title || config.site.name}
            </h1>

            {home.hero.subtitle ? (
              <p className="mt-3 text-lg text-[var(--ed-text-muted)]">{home.hero.subtitle}</p>
            ) : null}

            {home.hero.description ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--ed-text-muted)]">
                {home.hero.description}
              </p>
            ) : null}

            {home.hero.button_text ? (
              <Link
                to={resolveHref(home.hero.button_link || "/docs")}
                className="mt-8 rounded-xl bg-[var(--ed-primary)] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[var(--ed-primary)]/20 transition-transform hover:-translate-y-0.5"
              >
                {home.hero.button_text}
              </Link>
            ) : null}
          </div>
        </section>

        {/* 外部 HTML 首页（home.use_file） */}
        {home.use_file && data.customHtml ? (
          <section className="mx-auto max-w-4xl px-5 pb-16">
            <div
              className="doc-content"
              dangerouslySetInnerHTML={{ __html: data.customHtml }}
            />
          </section>
        ) : null}

        {/* 特性 */}
        {home.features.length > 0 ? (
          <section className="mx-auto max-w-6xl px-5 pb-16">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {home.features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5 transition-shadow hover:shadow-lg"
                >
                  {feature.icon ? (
                    <span className="mb-3 block text-[var(--ed-primary)] [&_.fa-compat]:size-5">
                      <FontAwesomeCompat className={feature.icon} />
                    </span>
                  ) : null}
                  <h2 className="text-base font-semibold">{feature.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--ed-text-muted)]">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 快速开始 */}
        {home.get_started.enable && (home.get_started.steps?.length ?? 0) > 0 ? (
          <section className="mx-auto max-w-4xl px-5 pb-20">
            <h2 className="mb-6 text-center text-2xl font-semibold">{home.get_started.title}</h2>
            <ol className="space-y-3">
              {home.get_started.steps?.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-3 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ed-primary-soft)] text-xs font-semibold text-[var(--ed-primary)]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--ed-text-muted)]">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>

            {home.get_started.button_text ? (
              <div className="mt-6 text-center">
                <Link
                  to={resolveHref(home.get_started.button_link || "/docs")}
                  className="inline-block rounded-lg border border-[var(--ed-primary)] px-5 py-2.5 text-sm font-medium text-[var(--ed-primary)] transition-colors hover:bg-[var(--ed-primary-soft)]"
                >
                  {home.get_started.button_text}
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      {config.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}
