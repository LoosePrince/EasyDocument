import { Menu, Moon, Search, Sun } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { useSite } from "~/components/providers/config-provider";
import { useTheme } from "~/components/providers/theme-provider";
import { NavLinkItem } from "./nav-links";
import { siteHref } from "~/lib/content/routes";
import { SearchDialog } from "~/components/search/search-dialog";

export function SiteHeader({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const { config, branches, defaultBranch } = useSite();
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl+K 打开搜索
  useEffect(() => {
    if (!config.search.enable) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [config.search.enable]);

  return (
    <>
      <header className="sticky top-0 z-50 h-[var(--ed-header-height)] border-b border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-3 px-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="grid size-9 place-items-center rounded-lg text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] lg:hidden"
            aria-label="打开文档导航"
          >
            <Menu className="size-5" />
          </button>

          <Link
            to={siteHref("/", config.site.base_url)}
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            {config.appearance.logo ? (
              <img
                src={siteHref(config.appearance.logo, config.site.base_url)}
                alt=""
                className="size-7"
                width={28}
                height={28}
              />
            ) : null}
            <span className="hidden text-[15px] sm:block">{config.site.name}</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="主导航">
            {config.navigation.nav_links.map((link, index) => (
              <NavLinkItem key={`${link.text}-${index}`} link={link} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {config.search.enable ? (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-subtle)] px-2.5 py-1.5 text-sm text-[var(--ed-text-muted)] transition-colors hover:border-[var(--ed-primary)] hover:text-[var(--ed-text)]"
                aria-label="搜索文档"
              >
                <Search className="size-4" />
                <span className="hidden lg:block">{config.search.placeholder}</span>
                <kbd className="hidden rounded border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] lg:block">
                  ⌘K
                </kbd>
              </button>
            ) : null}

            <button
              type="button"
              onClick={toggle}
              className="grid size-9 place-items-center rounded-lg text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
              aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
            >
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </button>
          </div>
        </div>
      </header>

      {config.search.enable ? (
        <SearchDialog
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          branches={branches}
          defaultBranch={defaultBranch}
        />
      ) : null}
    </>
  );
}
