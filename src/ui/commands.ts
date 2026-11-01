// Window-level commands used by the toolbar, tabs and keyboard shortcuts.
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatDocument } from "../engine";
import { isDirty, useEditor } from "../store/editor";
import { formatIndentFor } from "../store/settings";
import { askDialog } from "./dialog";

const store = () => useEditor.getState();

/** The HTML user guide, published from docs/ by GitHub Pages. */
export const USER_GUIDE_URL = "https://ericmcfall.github.io/SafeJSON/user-guide/SafeJSON-User-Guide.html";

/** Opens the user guide in the default web browser. */
export function openUserGuide(): void {
  if (isTauri()) {
    openUrl(USER_GUIDE_URL).catch((error) =>
      store().showMessage({ kind: "error", text: `Couldn't open the user guide (${error}). It's at ${USER_GUIDE_URL}` }),
    );
  } else {
    window.open(USER_GUIDE_URL, "_blank", "noopener");
  }
}

/** Closes a tab, asking to save first if it has unsaved changes. */
export async function closeTabWithPrompt(tabId: string): Promise<boolean> {
  const tab = store().tabs.find((t) => t.id === tabId);
  if (!tab) return true;
  if (isDirty(tab)) {
    store().activate(tabId);
    const answer = await askDialog({
      title: `Save changes to ${tab.title}?`,
      message: "Your changes will be lost if you don't save them.",
      confirmLabel: "Save",
      extraLabel: "Don't save",
    });
    if (answer === "cancel") return false;
    if (answer === "confirm" && !(await store().save(tabId))) return false;
  }
  store().closeTab(tabId);
  return true;
}

/** Re-indents the active document with its current indent style. */
export function formatActive(): void {
  const { tabs, activeId, apply } = store();
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return;
  const indent = formatIndentFor(tab.history.present.format.indent);
  apply((doc) => {
    const formatted = formatDocument(doc, indent);
    return formatted.text === doc.text && formatted.format.indent === doc.format.indent ? doc : formatted;
  });
}

/** Global keyboard shortcuts. Text boxes keep their own Ctrl+Z / Ctrl+Y. */
export function handleShortcut(e: KeyboardEvent, focusSearch: () => void): void {
  const s = store();
  const inTextBox = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  // The text-mode editor has its own Find (Ctrl+F) and Format (Shift+Alt+F).
  const inCodeEditor = e.target instanceof Element && e.target.closest(".monaco-editor") !== null;
  const key = e.key.toLowerCase();
  const run = (action: () => unknown) => {
    e.preventDefault();
    action();
  };
  if (e.ctrlKey && !e.altKey) {
    if (key === "n") return run(s.newFile);
    if (key === "o") return run(() => s.openFiles());
    if (key === "s" && e.shiftKey) return run(() => s.saveAs());
    if (key === "s") return run(() => s.save());
    if (key === "w" && s.activeId) return run(() => closeTabWithPrompt(s.activeId!));
    if (key === "f" && !inCodeEditor) return run(focusSearch);
    if (key === "t" && e.shiftKey) {
      const tab = s.tabs.find((t) => t.id === s.activeId);
      if (tab) return run(() => s.setView(tab.view === "tree" ? "text" : "tree"));
    }
    if (key === "tab" && s.tabs.length > 1) {
      const i = s.tabs.findIndex((t) => t.id === s.activeId);
      const next = (i + (e.shiftKey ? -1 : 1) + s.tabs.length) % s.tabs.length;
      return run(() => s.activate(s.tabs[next].id));
    }
    if (!inTextBox && key === "z" && !e.shiftKey) return run(s.undo);
    if (!inTextBox && (key === "y" || (key === "z" && e.shiftKey))) return run(s.redo);
  }
  if (e.shiftKey && e.altKey && key === "f" && !inCodeEditor) return run(formatActive);
  // F1 is the usual Windows help key (in text mode it opens the code editor's command list instead).
  if (e.key === "F1" && !e.ctrlKey && !e.shiftKey && !e.altKey && !inCodeEditor) return run(openUserGuide);
}
