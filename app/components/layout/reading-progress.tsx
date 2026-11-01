import { useEffect, useState } from "react";

/** 顶部阅读进度条（extensions.progress_bar.enable） */
export function ReadingProgress({ enabled }: { enabled: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;

    const update = () => {
      const scrollTop = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(scrollTop / height, 1) : 0);
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="reading-progress" aria-hidden="true">
      <div style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

/** 返回顶部按钮（navigation.back_to_top） */
export function BackToTop({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const handler = () => setVisible(window.scrollY > 480);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [enabled]);

  if (!enabled || !visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-40 grid size-10 place-items-center rounded-full border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] text-[var(--ed-text-muted)] shadow-lg transition-colors hover:text-[var(--ed-primary)]"
      aria-label="返回顶部"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
