import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { docUrlPath, siteHref } from "~/lib/content/routes";
import { stripExtension } from "~/lib/content/types";

export interface BreadcrumbsProps {
  branch: string;
  branchLabel: string;
  crumbs: Array<{ title: string; path: string }>;
  currentTitle: string;
}

export function Breadcrumbs({ branch, branchLabel, crumbs, currentTitle }: BreadcrumbsProps) {
  const { config, branches } = useSite();
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
      <Link
        to={docUrlPath({ branch, path: "" })}
        className="transition-colors hover:text-[var(--ed-primary)]"
      >
        {showVersion ? branchLabel : config.site.name}
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <Separator />
          <Link
            to={docUrlPath({ branch, path: stripExtension(crumb.path) })}
            className="transition-colors hover:text-[var(--ed-primary)]"
          >
            {crumb.title}
          </Link>
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
