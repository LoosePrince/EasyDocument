import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { docUrlPath, siteHref } from "~/lib/content/routes";
import { stripExtension } from "~/lib/content/types";

export interface BreadcrumbsProps {
  branch: string;
  branchLabel: string;
  language?: string;
  crumbs: Array<{ title: string; path: string; linkable?: boolean }>;
  currentTitle: string;
  /** 版本根是否有索引页；false 时版本名不可点 */
  branchLinkable?: boolean;
}

export function Breadcrumbs({
  branch,
  branchLabel,
  language,
  crumbs,
  currentTitle,
  branchLinkable = true,
}: BreadcrumbsProps) {
  const { config, branches } = useSite();
  const documentLanguage = language;
  if (!config.navigation.breadcrumb) return null;

  const showVersion = config.document.branch_support && branches.length > 1;

  return (
    <nav aria-label="面包屑" className="mb-4 flex flex-wrap items-center gap-1 text-[13px] text-[var(--ed-text-muted)]">
      <Link
        to={siteHref("/", config.site.base_url)}
        className="flex items-center gap-1 transition-colors hover:text-[var(--ed-primary)]"
      >
        <Home className="size-3.5" />
        {config.navigation.home_text}
      </Link>

      <Separator />
      {branchLinkable ? (
        <Link
          to={docUrlPath({ branch, path: "", documentLanguage })}
          className="transition-colors hover:text-[var(--ed-primary)]"
        >
          {showVersion ? branchLabel : config.site.name}
        </Link>
      ) : (
        <span className="text-[var(--ed-text-subtle)]">
          {showVersion ? branchLabel : config.site.name}
        </span>
      )}

      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <Separator />
          {crumb.linkable === false ? (
            <span className="cursor-default text-[var(--ed-text-subtle)]">{crumb.title}</span>
          ) : (
            <Link
              to={docUrlPath({
                branch,
                path: stripExtension(crumb.path),
                documentLanguage,
              })}
              className="transition-colors hover:text-[var(--ed-primary)]"
            >
              {crumb.title}
            </Link>
          )}
        </span>
      ))}

      <Separator />
      <span aria-current="page" className="text-[var(--ed-text)]">
        {currentTitle}
      </span>
    </nav>
  );
}

function Separator() {
  return <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />;
}
