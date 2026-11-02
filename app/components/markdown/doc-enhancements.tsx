import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

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
