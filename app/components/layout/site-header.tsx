import { Check, Globe, Menu, Moon, Search, Sun } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { useSite } from "~/components/providers/config-provider";
import { useTheme } from "~/components/providers/theme-provider";
import { useI18n } from "~/lib/i18n/provider";
import { isIconUrl } from "~/lib/icons";
import { Icon } from "~/components/ui/icon";
import { NavLinkItem } from "./nav-links";
import { siteHref } from "~/lib/content/routes";
import { SearchDialog } from "~/components/search/search-dialog";
import { cn } from "~/lib/utils";

export function SiteHeader({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const { config, branches, defaultBranch } = useSite();
  const { theme, toggle } = useTheme();
  const { t, language, languages, switchLanguage, enabled, documentLanguage, documentLanguages, switchDocumentLanguage, documentSwitcherEnabled } = useI18n();
  const [searchOpen, setSearchOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

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
            aria-label={t("打开文档导航")}
          >
            <Menu className="size-5" />
          </button>

          <Link
            to={siteHref("/", config.site.base_url)}
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            {config.appearance.logo ? (
              isIconUrl(config.appearance.logo) ? (
                <img
                  src={siteHref(config.appearance.logo, config.site.base_url)}
                  alt=""
                  className="size-7"
                  width={28}
                  height={28}
                />
              ) : (
                <Icon name={config.appearance.logo} className="size-7" />
              )
            ) : null}
            <span className="hidden text-[15px] sm:block">{config.site.name}</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label={t("主导航")}>
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
                aria-label={t("搜索文档")}
              >
                <Search className="size-4" />
                <span className="hidden lg:block">{config.search.placeholder}</span>
                <kbd className="hidden rounded border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] lg:block">
                  ⌘K
                </kbd>
              </button>
            ) : null}

            {enabled || documentSwitcherEnabled ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLanguageOpen((value) => !value)}
                  className="grid size-9 place-items-center rounded-lg text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
                  aria-label={t("切换语言")}
                  aria-expanded={languageOpen}
                  aria-haspopup="listbox"
                >
                  <Globe className="size-4.5" />
                </button>
                {languageOpen ? (
                  <>
                    <div
                      className="fixed inset-0 z-[59]"
                      role="presentation"
                      onClick={() => setLanguageOpen(false)}
                    />
                    <ul
                      className="absolute right-0 top-full z-[60] mt-1 min-w-44 overflow-hidden rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-1 text-xs shadow-xl"
                      role="listbox"
                      aria-label={t("语言")}
                    >
                      <li className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-[var(--ed-text-subtle)]">
                        {t("站点语言")}
                      </li>
                      {languages.map((item) => (
                        <li key={`site-${item.code}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={item.code === language}
                            onClick={() => {
                              switchLanguage(item.code);
                              setLanguageOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--ed-bg-subtle)]",
                              item.code === language
                                ? "font-medium text-[var(--ed-primary)]"
                                : "text-[var(--ed-text-muted)]",
                            )}
                          >
                            <span className="flex-1">{item.label}</span>
                            {item.code === language ? <Check className="size-3.5" /> : null}
                          </button>
                        </li>
                      ))}

                      {documentSwitcherEnabled ? (
                        <>
                          <li className="my-1 border-t border-[var(--ed-border)]" role="separator" />
                          <li className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wide text-[var(--ed-text-subtle)]">
                            {t("文档语言")}
                          </li>
                          {documentLanguages.map((item) => (
                            <li key={`doc-${item.code}`}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={item.code === documentLanguage}
                                onClick={() => {
                                  switchDocumentLanguage(item.code);
                                  setLanguageOpen(false);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--ed-bg-subtle)]",
                                  item.code === documentLanguage
                                    ? "font-medium text-[var(--ed-primary)]"
                                    : "text-[var(--ed-text-muted)]",
                                )}
                              >
                                <span className="flex-1">{item.label}</span>
                                {item.code === documentLanguage ? <Check className="size-3.5" /> : null}
                              </button>
                            </li>
                          ))}
                        </>
                      ) : null}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={toggle}
              className="grid size-9 place-items-center rounded-lg text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
              aria-label={theme === "dark" ? t("切换到亮色模式") : t("切换到暗色模式")}
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
