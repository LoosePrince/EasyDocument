import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

/**
 * FontAwesome 类名兼容层
 *
 * 旧版 config 的 `nav_links[].icon` / `home.features[].icon` 用 FontAwesome 类名
 * （如 "fas fa-rocket"）。v2 不引入 FontAwesome 字体，因此这里把常见类名映射到
 * 内联 SVG，避免旧配置下图标空白。
 */
const FA_ICON_PATHS: Record<string, string> = {
  "fa-rocket":
    '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.1 2.1 0 0 0-2.9-.1Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2a12.9 12.9 0 0 1-6.1 11 22 22 0 0 1-3.9 2Z"/><path d="M9 12H4s.5-3 2-4c1.6-1.1 5 0 5 0"/><path d="M12 15v5s3-.5 4-2c1.1-1.6 0-5 0-5"/>',
  "fa-book":
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  "fa-cog":
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  "fa-graduation-cap":
    '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  "fa-github":
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1 .3-2 0-3 0 0-1 0-3 1.5-2.6-.5-5.4-.5-8 0C6 3 5 3 5 3c-.3 1-.3 2 0 3-.7 1-1.1 2.2-1 3.5 0 3.5 3 5.5 6 5.5a4.8 4.8 0 0 0-1 3.5v4"/><path d="M9 18c-4.5 2-5-2-7-2"/>',
  "fa-feather":
    '<path d="M20.2 3.8a6 6 0 0 0-8.5 0L4 11.5V20h8.5l7.7-7.7a6 6 0 0 0 0-8.5Z"/><path d="M16 8 2 22M17.5 15H9"/>',
  "fa-paint-brush":
    '<path d="M18.4 2.6a2 2 0 0 1 3 3L14 13l-3-3 7.4-7.4Z"/><path d="M9 12a3 3 0 0 0-3 3c0 1.6-1 3-3 3 1.5 2 3.5 2 5 2a4 4 0 0 0 4-4 3 3 0 0 0-3-3Z"/>',
  "fa-home":
    '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
};

/** 把 FontAwesome 类名渲染为内联 SVG（非 FA 类名原样返回 null） */
export function FontAwesomeCompat({ className, label }: { className?: string; label?: string }) {
  if (!className) return null;
  const match = Object.keys(FA_ICON_PATHS).find((key) =>
    className.split(/\s+/).includes(key),
  );
  if (!match) return null;

  return (
    <span
      className={`fa-compat inline-grid size-4 shrink-0 place-items-center ${className}`}
      aria-hidden="true"
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-full"
        dangerouslySetInnerHTML={{ __html: FA_ICON_PATHS[match] }}
      />
    </span>
  );
}

/**
 * 文档增强（客户端水合后执行）
 *
 * - 代码复制按钮
 * - Mermaid 惰性渲染
 * - 图片灯箱
 * 这些能力依赖真实 DOM，因此在 SSG 之外的 effect 中处理，
 * 保证预渲染 HTML 本身就已完整可读（无脚本也能看文档）。
 */
export function useDocEnhancements(
  containerRef: React.RefObject<HTMLElement | null>,
  /** 内容签名（如文档路径 + 渲染时间戳）；变化时重新绑定增强行为 */
  contentKey: string,
) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cleanups: Array<() => void> = [];

    // ---- 代码复制 ----
    container.querySelectorAll<HTMLButtonElement>("[data-code-copy]").forEach((button) => {
      const handler = async () => {
        const wrapper = button.closest(".code-wrapper");
        const code = wrapper?.querySelector("pre code")?.textContent ?? "";
        try {
          await navigator.clipboard.writeText(code);
          button.dataset.copied = "true";
          const original = button.textContent;
          button.textContent = "已复制";
          window.setTimeout(() => {
            button.dataset.copied = "false";
            button.textContent = original ?? "复制";
          }, 1600);
        } catch {
          button.textContent = "复制失败";
        }
      };
      button.addEventListener("click", handler);
      cleanups.push(() => button.removeEventListener("click", handler));
    });

    // ---- 图片灯箱 ----
    container.querySelectorAll<HTMLImageElement>("img.doc-image").forEach((image) => {
      const handler = () => setLightboxSrc(image.currentSrc || image.src);
      image.addEventListener("click", handler);
      cleanups.push(() => image.removeEventListener("click", handler));
    });

    return () => cleanups.forEach((fn) => fn());
  }, [containerRef, contentKey]);

  return { lightboxSrc, closeLightbox: () => setLightboxSrc(null) };
}

/** Mermaid 渲染（按需加载，避免首屏体积） */
export function useMermaid(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  contentKey: string,
) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const blocks = [...container.querySelectorAll<HTMLElement>(".mermaid-block")].filter(
      (block) => block.dataset.rendered !== "true",
    );
    if (blocks.length === 0) return;

    let cancelled = false;

    void (async () => {
      const { default: mermaid } = await import("mermaid");
      if (cancelled) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "inherit",
      });

      for (const block of blocks) {
        const source = decodeURIComponent(block.dataset.mermaid ?? "");
        try {
          const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, source);
          if (cancelled) return;
          block.innerHTML = svg;
          block.dataset.rendered = "true";
        } catch {
          block.dataset.rendered = "error";
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [containerRef, enabled, contentKey]);
}

/** 图片灯箱 */
export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!src) return;
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+") setScale((value) => Math.min(value + 0.25, 4));
      if (event.key === "-") setScale((value) => Math.max(value - 0.25, 0.25));
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <div className="absolute right-4 top-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
        <LightboxButton onClick={() => setScale((value) => Math.min(value + 0.25, 4))} label="放大">
          <ZoomIn className="size-4" />
        </LightboxButton>
        <LightboxButton onClick={() => setScale((value) => Math.max(value - 0.25, 0.25))} label="缩小">
          <ZoomOut className="size-4" />
        </LightboxButton>
        <LightboxButton onClick={() => setRotation((value) => value + 90)} label="旋转">
          <RotateCw className="size-4" />
        </LightboxButton>
        <LightboxButton
          onClick={() => {
            const link = document.createElement("a");
            link.href = src;
            link.download = src.split("/").pop() ?? "image";
            link.click();
          }}
          label="下载"
        >
          <Download className="size-4" />
        </LightboxButton>
        <LightboxButton onClick={onClose} label="关闭">
          <X className="size-4" />
        </LightboxButton>
      </div>

      <img
        src={src}
        alt=""
        className="max-h-[88vh] max-w-[92vw] cursor-grab select-none rounded-lg object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
          transition: dragRef.current ? "none" : "transform 150ms ease",
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          setOffset({
            x: dragRef.current.offsetX + (event.clientX - dragRef.current.x),
            y: dragRef.current.offsetY + (event.clientY - dragRef.current.y),
          });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        draggable={false}
      />
    </div>
  );
}

function LightboxButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
    >
      {children}
    </button>
  );
}
