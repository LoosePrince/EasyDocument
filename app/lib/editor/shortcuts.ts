import { useEffect } from "react";
import { useEditorContext } from "~/lib/editor/editor-store";

/**
 * 全局快捷键
 *
 *  - E            进入 / 退出编辑模式（焦点不在输入框时）
 *  - Ctrl/Cmd + S 提交待提交修改
 *  - Ctrl/Cmd + K 打开搜索（由 SiteHeader 处理，此处不拦截）
 *  - ?            显示快捷键说明（暂由 tooltip 承担）
 */
export function useGlobalShortcuts(onOpenSearch?: () => void) {
  const editor = useEditorContext();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target?.closest("input, textarea, select, [contenteditable='true']") !== null;

      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editor.dirty && !editor.submitting && editor.token) {
          void editor.commit("docs: 网页端编辑");
        }
        return;
      }

      if (mod && event.key.toLowerCase() === "k") {
        onOpenSearch?.();
        return;
      }

      if (!inField && !mod && (event.key === "e" || event.key === "E") && editor.canEdit) {
        const selection = window.getSelection();
        if (selection && selection.type === "Range" && selection.toString().trim()) return;
        event.preventDefault();
        editor.setEditing(!editor.editing);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, onOpenSearch]);
}
