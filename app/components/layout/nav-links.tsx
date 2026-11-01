import { Link } from "react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { NavLinkConfig } from "~/lib/config/types";
import { useSite } from "~/components/providers/config-provider";
import { cn } from "~/lib/utils";
import { FontAwesomeCompat } from "~/components/markdown/doc-enhancements";

export function NavLinkItem({ link, className }: { link: NavLinkConfig; className?: string }) {
  const { resolveHref } = useSite();
  const isExternal = link.external || (typeof link.url === "string" && /^https?:/i.test(link.url));

  if (Array.isArray(link.url)) {
    return (
      <div className={cn("group relative", className)}>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
          aria-haspopup="menu"
        >
          <FontAwesomeCompat className={link.icon} />
          {link.text}
          <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" />
        </button>
        <div
          className="invisible absolute left-0 top-full z-50 min-w-48 translate-y-1 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-1.5 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
          role="menu"
        >
          {link.url.map((child) => (
            <NavDropdownItem key={`${child.text}-${String(child.url)}`} link={child} />
          ))}
        </div>
      </div>
    );
  }

  const href = isExternal ? link.url : resolveHref(link.url);

  return (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]",
        className,
      )}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <FontAwesomeCompat className={link.icon} />
      {link.text}
      {isExternal ? <ExternalLink className="size-3 opacity-60" /> : null}
    </Link>
  );
}

function NavDropdownItem({ link }: { link: NavLinkConfig }) {
  const { resolveHref } = useSite();
  const url = Array.isArray(link.url) ? (link.url[0]?.url ?? "/") : link.url;
  const isExternal = link.external || /^https?:/i.test(String(url));
  const href = isExternal ? String(url) : resolveHref(String(url));

  return (
    <Link
      to={href}
      role="menuitem"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <FontAwesomeCompat className={link.icon} />
      {link.text}
    </Link>
  );
}
