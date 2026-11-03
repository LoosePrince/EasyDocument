import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSite } from "~/components/providers/config-provider";
import { docUrlPath, parseDocsUrl } from "~/lib/content/routes";

/**
 * 旧文档链接（/docs/{version}/...）→ /docs-{文档语言}/{version}/...
 *
 * 站点语言只在 localStorage，不参与 URL。
 */
export function meta() {
  return [{ title: "跳转中…" }, { name: "robots", content: "noindex" }];
}

export default function DocsLegacyRedirect() {
  const { config } = useSite();
  const location = useLocation();
  const navigate = useNavigate();

  const parsed = parseDocsUrl(location.pathname, config);
  const target = parsed
    ? docUrlPath({
        branch: parsed.branch,
        path: parsed.path,
        documentLanguage: parsed.documentLanguage,
      })
    : `/docs-${config.i18n.default_document_language}`;

  useEffect(() => {
    navigate(`${target}${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.search, navigate, target]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 text-sm text-[var(--ed-text-muted)]">
      正在跳转到 <code>{target}</code>…
    </main>
  );
}
