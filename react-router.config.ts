import type { Config } from "@react-router/dev/config";

/**
 * EasyDocument v2 — SSG 配置
 *
 * - ssr: false  → 构建产物为纯静态文件（无 Node 运行时）
 * - prerender   → 枚举全部 /docs/** 路径，输出真实 HTML（SEO 与直链刷新均可用）
 *                 额外预渲染 /404 作为站内静态 404 页（postbuild 落成 404.html）
 * - basename    → 跟随 config.site.base_url，部署到子目录时无需改代码
 */
export default {
  ssr: false,
  appDirectory: "app",
  buildDirectory: "build",
  async prerender({ getStaticPaths }) {
    const { enumerateDocPaths, writeRuntimeArtifacts } = await import(
      "./app/lib/prerender.server"
    );

    // 运行期产物（搜索索引 / 内容清单）写入客户端产物目录
    await writeRuntimeArtifacts(process.cwd(), "build/client");

    const staticPaths = getStaticPaths().filter((path) => !path.startsWith("/admin"));
    const docPaths = await enumerateDocPaths();

    return [...new Set([...staticPaths, "/docs", "/404", ...docPaths])].sort();
  },
} satisfies Config;
