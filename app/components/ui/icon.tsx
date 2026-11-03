import { isIconUrl, resolveIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

/**
 * 配置图标渲染
 *
 * 配置里的 `icon` 可以是：
 *  - 设计图标 id（如 `rocket`）→ 映射到 lucide 组件
 *  - 图片链接 / 路径（http(s)、/assets/icon.svg、data:image…）→ 渲染 img
 * 兼容旧配置里的 FontAwesome 类名（`fas fa-rocket`）。
 */
export function Icon({
  name,
  className,
  strokeWidth,
}: {
  name?: string;
  className?: string;
  strokeWidth?: number;
}) {
  if (!name) return null;
  if (isIconUrl(name)) {
    return (
      <img
        src={name}
        alt=""
        aria-hidden="true"
        className={cn("size-4 shrink-0 object-contain", className)}
        loading="lazy"
      />
    );
  }
  const Component = resolveIcon(name);
  return (
    <Component
      className={cn("size-4 shrink-0", className)}
      aria-hidden="true"
      strokeWidth={strokeWidth}
    />
  );
}
