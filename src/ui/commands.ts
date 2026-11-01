// Window-level commands used by the toolbar, tabs and keyboard shortcuts.
import { formatDocument } from "../engine";
import { isDirty, useEditor } from "../store/editor";
import { askDialog } from "./dialog";

const store = () => useEditor.getState();

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
  const indent = tab.history.present.format.indent;
  apply((doc) => {
    const formatted = formatDocument(doc, indent);
    return formatted.text === doc.text ? doc : formatted;
  });
}

/** Global keyboard shortcuts. Text boxes keep their own Ctrl+Z / Ctrl+Y. */
export function handleShortcut(e: KeyboardEvent, focusSearch: () => void): void {
  const s = store();
  const inTextBox = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
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
    if (key === "f") return run(focusSearch);
    if (key === "tab" && s.tabs.length > 1) {
      const i = s.tabs.findIndex((t) => t.id === s.activeId);
      const next = (i + (e.shiftKey ? -1 : 1) + s.tabs.length) % s.tabs.length;
      return run(() => s.activate(s.tabs[next].id));
    }
    if (!inTextBox && key === "z" && !e.shiftKey) return run(s.undo);
    if (!inTextBox && (key === "y" || (key === "z" && e.shiftKey))) return run(s.redo);
  }
  if (e.shiftKey && e.altKey && key === "f") return run(formatActive);
}
