import { resolveIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

/**
 * 配置图标渲染
 *
 * 配置里的 `icon` 使用设计图标 id（如 `rocket`），这里映射到 lucide 组件。
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
  const Component = resolveIcon(name);
  return (
    <Component
      className={cn("size-4 shrink-0", className)}
      aria-hidden="true"
      strokeWidth={strokeWidth}
    />
  );
}
