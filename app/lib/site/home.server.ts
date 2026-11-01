/**
 * 首页自定义 HTML（home.use_file）
 *
 * 默认走配置驱动渲染；仅当 use_file=true 时读取 file_path 指向的 HTML，
 * 并做消毒（移除 script/事件属性/javascript: 协议）后注入。
 */
import { loadSiteData } from "./load.server";
import { sanitizeHtml } from "../html/sanitize";

export interface HomeContentData {
  config: Awaited<ReturnType<typeof loadSiteData>>["config"];
  customHtml?: string;
}

export async function loadHomeContent(): Promise<HomeContentData> {
  const site = await loadSiteData();
  const home = site.config.home;

  if (!home.use_file || !home.file_path) {
    return { config: site.config };
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const absolute = path.resolve(process.cwd(), ".data", home.file_path.replace(/^\/+/, ""));
    const raw = await readFile(absolute, "utf8");
    return { config: site.config, customHtml: sanitizeHtml(raw) };
  } catch {
    return { config: site.config };
  }
}
