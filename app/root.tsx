import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/root";
import { loadSiteData } from "~/lib/site/load.server";
import { applyTheme, buildThemeInitScript, resolveTheme } from "~/lib/theme";
import { hexToRgbTriplet } from "~/lib/utils";
import { ConfigProvider } from "~/components/providers/config-provider";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { EditorProvider } from "~/lib/editor/editor-store";
import { DraftIndicator } from "~/components/editor/edit-toolbar";
import stylesheet from "~/styles/app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://raw.githubusercontent.com" },
];

/**
 * 全站 loader：把配置与站点结构注入每个页面。
 *
 * ssr:false 时，loader 在构建期（prerender）与客户端导航时各执行一次；
 * 结果会被序列化进 `.data` 文件，客户端无需再次请求。
 */
export async function loader() {
  const site = await loadSiteData();
  return {
    config: site.config,
    configWarnings: site.configWarnings,
    defaultBranch: site.defaultBranch,
    branches: site.branches.map((branch) => ({
      name: branch.name,
      label: branch.label,
      tree: branch.tree,
      docCount: branch.docs.size,
    })),
    pointer: {
      owner: site.pointer.owner,
      repo: site.pointer.repo,
      branch: site.pointer.branch,
      configPath: site.pointer.configPath,
      rootDir: site.pointer.rootDir,
    },
  };
}

export type RootLoaderData = Awaited<ReturnType<typeof loader>>;

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as RootLoaderData | undefined;
  const appearance = data?.config.appearance;
  const favicon = appearance?.favicon;
  const themeScript = buildThemeInitScript(appearance?.default_dark_mode ?? "auto");

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {favicon ? <link rel="icon" href={favicon} /> : null}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* 主题色/字体在首屏即生效，避免闪烁 */}
        {appearance ? (
          <style
            dangerouslySetInnerHTML={{
              __html: `:root{--ed-primary:${appearance.theme_color};--ed-primary-rgb:${hexToRgbTriplet(
                appearance.theme_color,
              )};--ed-sidebar-width:${data?.config.layout.sidebar_width};--ed-toc-width:${
                data?.config.layout.toc_width
              };${appearance.font_family ? `--ed-font-family:${appearance.font_family};` : ""}}`,
            }}
          />
        ) : null}
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const data = useLoaderData<RootLoaderData>();

  // 主题色与字体注入（CSS 变量），避免每个组件重复处理
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ed-primary", data.config.appearance.theme_color);
    root.style.setProperty(
      "--ed-primary-rgb",
      hexToRgbTriplet(data.config.appearance.theme_color),
    );
    if (data.config.appearance.font_family) {
      root.style.setProperty("--ed-font-family", data.config.appearance.font_family);
    }
    root.dataset.animations = data.config.animation.enable ? "on" : "off";
    root.style.setProperty("--ed-sidebar-width", data.config.layout.sidebar_width);
    root.style.setProperty("--ed-toc-width", data.config.layout.toc_width);
    applyTheme(resolveTheme(data.config.appearance.default_dark_mode));
  }, [
    data.config.appearance.theme_color,
    data.config.appearance.font_family,
    data.config.animation.enable,
    data.config.layout.sidebar_width,
    data.config.layout.toc_width,
    data.config.appearance.default_dark_mode,
  ]);

  return (
    <ConfigProvider value={data}>
      <ThemeProvider defaultMode={data.config.appearance.default_dark_mode}>
        <EditorProvider
          repo={{ owner: data.pointer.owner, repo: data.pointer.repo }}
          dataBranch={data.pointer.branch}
          canEdit={data.config.admin.enable}
        >
          <Outlet />
          {/* 未进入编辑模式时，若有本地草稿，用悬浮按钮提示 */}
          <DraftIndicator />
        </EditorProvider>
      </ThemeProvider>
    </ConfigProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-7xl font-semibold text-[var(--ed-primary)]">{is404 ? "404" : "错误"}</p>
      <h1 className="text-xl font-medium">
        {is404 ? "页面不存在" : "页面加载失败"}
      </h1>
      <p className="text-sm text-[var(--ed-text-muted)]">
        {is404
          ? "该文档可能已被移动或删除，请从文档首页重新查找。"
          : "发生意外错误，请稍后重试。"}
      </p>
      <a
        href="/"
        className="mt-2 rounded-lg bg-[var(--ed-primary)] px-4 py-2 text-sm font-medium text-white"
      >
        返回首页
      </a>
    </main>
  );
}
