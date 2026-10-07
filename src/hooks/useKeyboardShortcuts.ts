import { useEffect } from "react";
import { KeyboardShortcut } from "../types";

export interface ShortcutActions {
  toggleRecord: () => void;
  pauseResumeRecord: () => void;
  splitClip?: () => void;
  cancelRecord?: () => void;
  restartRecord?: () => void;
  restartProject?: () => void;
  deleteProject?: () => void;
  switchScene?: (index: number) => void;
}

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  actions: ShortcutActions,
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? e.ctrlKey : !e.ctrlKey;
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.altKey ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          e.stopPropagation();

          if (shortcut.id === "toggleRecord") {
            actions.toggleRecord();
          } else if (shortcut.id === "pauseResume") {
            actions.pauseResumeRecord();
          } else if (shortcut.id === "splitClip") {
            actions.splitClip?.();
          } else if (shortcut.id === "cancelRecord") {
            actions.cancelRecord?.();
          } else if (shortcut.id === "restartRecord") {
            actions.restartRecord?.();
          } else if (shortcut.id === "restartProject") {
            actions.restartProject?.();
          } else if (shortcut.id === "deleteProject") {
            actions.deleteProject?.();
          } else if (shortcut.id.startsWith("scene")) {
            const index = parseInt(shortcut.id.replace("scene", ""), 10) - 1;
            actions.switchScene?.(index);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, actions]);
};
