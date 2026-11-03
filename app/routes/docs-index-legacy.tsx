import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useSite } from "~/components/providers/config-provider";

/** 旧 /docs 索引 → /docs-{站点语言} */
export function meta() {
  return [{ title: "跳转中…" }, { name: "robots", content: "noindex" }];
}

export default function DocsIndexLegacyRedirect() {
  const { config } = useSite();
  const navigate = useNavigate();
  const target = `/docs-${config.i18n.default_document_language}`;

  useEffect(() => {
    navigate(target, { replace: true });
  }, [navigate, target]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 text-sm text-[var(--ed-text-muted)]">
      正在跳转到 <code>{target}</code>…
    </main>
  );
}
