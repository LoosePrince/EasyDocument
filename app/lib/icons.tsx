/**
 * 图标系统
 *
 * v2.0.1 起配置里的 `icon` 使用**设计图标 id**（如 `rocket`、`book`），
 * 不再依赖 FontAwesome 类名（`fas fa-rocket`）。渲染层映射到 lucide 图标，
 * 因此站点不引入任何图标字体。
 *
 * - 配置里仍可写 FontAwesome 类名（自动剥离前缀后按 id 查找，只是兼容旧配置）
 * - 未知 id 渲染为默认图标（点），不会出现空白
 */
import type { SVGProps } from "react";
import {
  BookMarked,
  BookOpen,
  Boxes,
  Braces,
  Cloud,
  Code2,
  Compass,
  ExternalLink,
  Feather,
  FileText,
  FolderTree,
  Gauge,
  Globe,
  GraduationCap,
  HelpCircle,
  House,
  Info,
  Layers,
  Layout,
  LifeBuoy,
  Link2,
  ListTree,
  Mail,
  MessageSquare,
  Package,
  Palette,
  PenLine,
  Puzzle,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  SquarePen,
  Star,
  Tag,
  Terminal,
  Users,
  Wand2,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** GitHub 品牌图标（lucide 已移除品牌图标） */
const GithubIcon: LucideIcon = ((props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    width="1em"
    height="1em"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1 .3-2 0-3 0 0-1 0-3 1.5-2.6-.5-5.4-.5-8 0C6 3 5 3 5 3c-.3 1-.3 2 0 3-.7 1-1.1 2.2-1 3.5 0 3.5 3 5.5 6 5.5a4.8 4.8 0 0 0-1 3.5v4" />
    <path d="M9 18c-4.5 2-5-2-7-2" />
  </svg>
)) as unknown as LucideIcon;

/** 设计图标 id → lucide 图标 */
export const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  book: BookOpen,
  "book-open": BookOpen,
  "book-marked": BookMarked,
  guide: Compass,
  compass: Compass,
  graduation: GraduationCap,
  education: GraduationCap,
  learn: GraduationCap,
  settings: Settings,
  config: Settings,
  gear: Settings,
  wrench: Wrench,
  tools: Wrench,
  edit: SquarePen,
  pen: PenLine,
  write: PenLine,
  palette: Palette,
  design: Palette,
  theme: Palette,
  layers: Layers,
  stack: Layers,
  versions: Layers,
  search: Search,
  find: Search,
  feather: Feather,
  "file-text": FileText,
  doc: FileText,
  docs: FileText,
  folder: FolderTree,
  tree: ListTree,
  link: Link2,
  anchor: Link2,
  sparkles: Sparkles,
  sparkle: Sparkles,
  code: Code2,
  braces: Braces,
  terminal: Terminal,
  command: Terminal,
  cloud: Cloud,
  "external-link": ExternalLink,
  info: Info,
  help: HelpCircle,
  faq: LifeBuoy,
  support: LifeBuoy,
  shield: Shield,
  security: Shield,
  zap: Zap,
  fast: Zap,
  gauge: Gauge,
  speed: Gauge,
  github: GithubIcon,
  git: GithubIcon,
  globe: Globe,
  web: Globe,
  home: House,
  house: House,
  layout: Layout,
  template: Layout,
  puzzle: Puzzle,
  plugin: Puzzle,
  extension: Puzzle,
  boxes: Boxes,
  package: Package,
  message: MessageSquare,
  chat: MessageSquare,
  mail: Mail,
  contact: Mail,
  users: Users,
  team: Users,
  star: Star,
  favorite: Star,
  tag: Tag,
  wand: Wand2,
  magic: Wand2,
};

/** 默认图标（未知 id 时使用） */
export const DEFAULT_ICON = Sparkles;

/** 配置值是否是图标链接 / 图片路径（而非图标 id） */
export function isIconUrl(input?: string): boolean {
  const value = String(input ?? "").trim();
  if (!value) return false;
  return (
    /^(https?:)?\/\//i.test(value) ||
    /^data:image\//i.test(value) ||
    /^(\.{0,2}\/|\/)/.test(value) ||
    /\.(svg|png|jpe?g|gif|webp|ico)(\?.*)?$/i.test(value)
  );
}

/** 图标库可选项（去重后的 id 列表，供选择器展示） */
export const ICON_CATALOG: Array<{ id: string; label: string }> = Object.keys(ICONS)
  .filter((id, index, list) => list.indexOf(id) === index)
  .map((id) => ({ id, label: id }));

/**
 * 把配置中的 icon 值归一为设计 id：
 *  - "fas fa-rocket" → "rocket"
 *  - "rocket"        → "rocket"
 */
export function normalizeIconId(input?: string): string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "";
  const withoutFontAwesome = raw
    .replace(/^(fa[srlbd]?|fab|far|fas)\b\s*/g, "")
    .replace(/^fa[-_]/g, "")
    .replace(/[\s_]+/g, "-");
  return withoutFontAwesome;
}

/** 取得图标组件（未知 id 回落到默认图标） */
export function resolveIcon(input?: string): LucideIcon {
  const id = normalizeIconId(input);
  if (!id) return DEFAULT_ICON;
  return ICONS[id] ?? DEFAULT_ICON;
}
