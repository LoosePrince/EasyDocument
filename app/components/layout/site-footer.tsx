import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";

export function SiteFooter() {
  const { config } = useSite();
  const { footer } = config;

  if (!config.layout.show_footer) return null;

  const enabledColumns = footer.columns.filter((column) => column.enable !== false);

  return (
    <footer className="mt-16 border-t border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]">
      <div className="mx-auto max-w-[1600px] px-5 py-10">
        {footer.beian.enable && footer.beian.position === "top" ? (
          <BeianRow records={footer.beian.icp} />
        ) : null}

        {enabledColumns.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {enabledColumns.map((column) => (
              <FooterColumn key={column.key ?? column.title} column={column} />
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--ed-border)] pt-6 text-sm text-[var(--ed-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{footer.copyright || `© ${new Date().getFullYear()} ${config.site.name}`}</p>

          {footer.powered_by.enable ? (
            <p className="flex flex-wrap items-center gap-1.5">
              <span>{footer.powered_by.text}</span>
              {footer.powered_by.links.map((link) => (
                <a
                  key={link.text}
                  href={link.url}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-[var(--ed-primary)] hover:underline"
                >
                  {link.text}
                </a>
              ))}
            </p>
          ) : null}
        </div>

        {footer.beian.enable && footer.beian.position !== "top" ? (
          <BeianRow records={footer.beian.icp} className="mt-4" />
        ) : null}
      </div>
    </footer>
  );
}

function FooterColumn({ column }: { column: { key?: string; title?: string; type?: string } }) {
  const { config, resolveHref } = useSite();

  if (column.type === "nav") {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--ed-text)]">{column.title}</h2>
        <ul className="space-y-2 text-sm">
          {config.navigation.nav_links
            .filter((link) => !Array.isArray(link.url))
            .map((link) => (
              <li key={link.text}>
                <Link
                  to={resolveHref(String(link.url))}
                  className="text-[var(--ed-text-muted)] transition-colors hover:text-[var(--ed-primary)]"
                >
                  {link.text}
                </Link>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  if (column.type === "links") {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--ed-text)]">{column.title}</h2>
        <ul className="space-y-2 text-sm">
          {config.footer.links.map((link) => (
            <li key={link.text}>
              <a
                href={link.url}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 text-[var(--ed-text-muted)] transition-colors hover:text-[var(--ed-primary)]"
              >
                {link.text}
                {link.external ? <ExternalLink className="size-3 opacity-60" /> : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (column.type === "stack") {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--ed-text)]">{column.title}</h2>
        <ul className="space-y-2 text-sm">
          {config.footer.powered_by.links.map((link) => (
            <li key={link.text}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--ed-text-muted)] transition-colors hover:text-[var(--ed-primary)]"
              >
                {link.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-[var(--ed-text)]">{column.title}</h2>
    </div>
  );
}

function BeianRow({
  records,
  className,
}: {
  records: Array<{ text: string; url?: string }>;
  className?: string;
}) {
  if (records.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--ed-text-subtle)] ${className ?? ""}`}>
      {records.map((record) =>
        record.url ? (
          <a
            key={record.text}
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--ed-primary)]"
          >
            {record.text}
          </a>
        ) : (
          <span key={record.text}>{record.text}</span>
        ),
      )}
    </div>
  );
}
