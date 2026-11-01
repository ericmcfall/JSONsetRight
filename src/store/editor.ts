// The editor's state: open tabs, each with its document, undo history and save status.
// Components read from this store and call its actions; they never edit text themselves.
import { create } from "zustand";
import {
  childrenOf,
  EditError,
  findStrictJsonViolation,
  formatPath,
  JsonSyntaxError,
  parseDocument,
  pushHistory,
  redoHistory,
  removeTrailingCommas,
  startHistory,
  toFileText,
  undoHistory,
  withText,
  type History,
  type JsonDocument,
  type Path,
  type SyntaxProblem,
} from "../engine";
import { fileModifiedMs, fileNameOf, pickFilesToOpen, pickSavePath, readTextFile, saveTextFile } from "../platform/files";
import { askDialog, confirmDialog } from "../ui/dialog";
import { forgetTabSchema, schemaProblems } from "./schemas";
import { useSettings } from "./settings";
import { pathKey } from "../ui/tree-model";

export interface Tab {
  id: string;
  /** null for a new file that has never been saved. */
  filePath: string | null;
  title: string;
  history: History<JsonDocument>;
  /** Text as last loaded or saved, to tell whether there are unsaved changes. */
  savedText: string;
  /** File's modified time when last loaded or saved, to notice changes made by other programs. */
  diskModifiedMs: number | null;
  selectedPath: Path;
  /** Tree nodes that are expanded, as pathKey() strings. */
  expanded: Set<string>;
  /** Tree editing, or plain-text editing (Monaco). */
  view: "tree" | "text";
  /**
   * Text typed in text mode that isn't valid yet, so it hasn't been applied to the document.
   * While set, switching to the tree and saving are blocked.
   */
  pendingText: PendingText | null;
  /** True when the file was invalid on open: the document is a stand-in until the text is fixed. */
  placeholder: boolean;
}

export interface PendingText {
  text: string;
  problem: SyntaxProblem;
}

export interface Message {
  kind: "error" | "info";
  text: string;
}

interface EditorState {
  tabs: Tab[];
  activeId: string | null;
  message: Message | null;

  newFile(): void;
  /** Opens text that didn't come from a file on disk (used for the browser-only dev preview). */
  openText(title: string, text: string): void;
  openFiles(paths?: string[]): Promise<void>;
  /** Re-opens unsaved work found after a crash. `diskText` is the file's current text, if any. */
  openRecovered(filePath: string | null, title: string, text: string, diskText: string, diskModifiedMs: number | null): void;
  /** Replaces a tab's content with the file's new text from disk (undoable). */
  reloadFromDisk(tabId: string, text: string, modifiedMs: number): void;
  /** Replaces the active document with other text, e.g. a backup (undoable; not saved yet). */
  replaceText(text: string): boolean;
  /** Marks the file's current disk state as seen, so the outside-change prompt isn't repeated. */
  acknowledgeDisk(tabId: string, modifiedMs: number | null): void;
  save(tabId?: string): Promise<boolean>;
  saveAs(tabId?: string): Promise<boolean>;
  closeTab(tabId: string): void;
  activate(tabId: string): void;
  /** Selects a value and expands its parents so it is visible. */
  select(path: Path): void;
  setExpanded(path: Path, open: boolean): void;
  /** Runs an engine edit on the active document. Returns false (and shows why) if it was refused. */
  apply(edit: (doc: JsonDocument) => JsonDocument, selectAfter?: Path): boolean;
  undo(): void;
  redo(): void;
  showMessage(message: Message | null): void;
  /** Switches the active tab between tree and text editing. Returns false if blocked. */
  setView(view: "tree" | "text"): boolean;
  /** Applies text typed in text mode (one undo step), or keeps it pending if it isn't valid. */
  applyText(tabId: string, text: string): void;
}

/** Text mode registers this so typing that hasn't been applied yet is applied before saving. */
let flushTextEditor: (() => void) | null = null;
export function setTextEditorFlush(flush: (() => void) | null): void {
  flushTextEditor = flush;
}

let nextTabNumber = 1;
let untitledCount = 0;

/** A new tab shows the top level and the containers directly inside it. */
function initialExpanded(doc: JsonDocument): Set<string> {
  const keys = new Set([pathKey([])]);
  for (const child of childrenOf(doc.root)) {
    if (child.node.type === "object" || child.node.type === "array") keys.add(pathKey([child.key]));
  }
  return keys;
}

function makeTab(filePath: string | null, title: string, doc: JsonDocument, savedText: string, diskModifiedMs: number | null): Tab {
  return {
    id: `tab-${nextTabNumber++}`,
    filePath,
    title,
    history: startHistory(doc),
    savedText,
    diskModifiedMs,
    selectedPath: [],
    expanded: initialExpanded(doc),
    view: "tree",
    pendingText: null,
    placeholder: false,
  };
}

const BOM = "\uFEFF";

/**
 * Makes a tab for file text. Text that isn't valid JSON opens in text mode so it can be fixed,
 * with a stand-in document until then.
 */
function makeTabFromText(filePath: string | null, title: string, text: string, savedText: string, diskModifiedMs: number | null): Tab {
  try {
    return makeTab(filePath, title, parseDocument(text), savedText, diskModifiedMs);
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) throw error;
    const bom = text.startsWith(BOM);
    const tab = makeTab(filePath, title, parseDocument(bom ? `${BOM}null` : "null"), savedText, diskModifiedMs);
    return { ...tab, view: "text", placeholder: true, pendingText: { text: bom ? text.slice(1) : text, problem: error.problems[0] } };
  }
}

export const useEditor = create<EditorState>((set, get) => {
  const activeTab = () => get().tabs.find((t) => t.id === get().activeId);
  const updateTab = (id: string, change: Partial<Tab>) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...change } : t)) }));
  const fail = (text: string) => set({ message: { kind: "error", text } });

  return {
    tabs: [],
    activeId: null,
    message: null,

    newFile() {
      untitledCount++;
      const tab = makeTab(null, `Untitled-${untitledCount}.json`, parseDocument("{\r\n}\r\n"), "", null);
      set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    },

    openText(title, text) {
      const tab = makeTabFromText(null, title, text, text, null);
      set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    },

    async openFiles(paths) {
      const chosen = paths ?? (await pickFilesToOpen());
      for (const path of chosen) {
        const existing = get().tabs.find((t) => t.filePath?.toLowerCase() === path.toLowerCase());
        if (existing) {
          set({ activeId: existing.id });
          continue;
        }
        try {
          const file = await readTextFile(path);
          const tab = makeTabFromText(path, fileNameOf(path), file.text, file.text, file.modifiedMs);
          set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
          useSettings.getState().addRecent(path);
          if (tab.pendingText) {
            const { line, column, message } = tab.pendingText.problem;
            set({
              message: {
                kind: "info",
                text: `${tab.title} isn't valid JSON yet (line ${line}, column ${column}: ${message}). It's open as text so you can fix it; the tree becomes available once it's valid.`,
              },
            });
          }
        } catch (error) {
          fail(String(error));
        }
      }
    },

    openRecovered(filePath, title, text, diskText, diskModifiedMs) {
      const tab = makeTabFromText(filePath, title, text, diskText, diskModifiedMs);
      set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    },

    reloadFromDisk(tabId, text, modifiedMs) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      try {
        const doc = parseDocument(text);
        updateTab(tabId, {
          history: tab.placeholder ? startHistory(doc) : pushHistory(tab.history, doc),
          savedText: text,
          diskModifiedMs: modifiedMs,
          pendingText: null,
          placeholder: false,
        });
      } catch (error) {
        // The other program left the file invalid (maybe mid-edit). Keep ours and say so.
        updateTab(tabId, { diskModifiedMs: modifiedMs });
        fail(`${tab.title} was changed by another program, but the new version isn't valid JSON (${error}). Your version is still open here.`);
      }
    },

    replaceText(text) {
      try {
        const doc = parseDocument(text);
        return get().apply(() => doc, []);
      } catch (error) {
        fail(String(error));
        return false;
      }
    },

    acknowledgeDisk(tabId, modifiedMs) {
      updateTab(tabId, { diskModifiedMs: modifiedMs });
    },

    async save(tabId) {
      flushTextEditor?.();
      let tab = tabId ? get().tabs.find((t) => t.id === tabId) : activeTab();
      if (!tab) return false;
      if (tab.pendingText) {
        const { line, column, message } = tab.pendingText.problem;
        fail(`${tab.title} can't be saved until it's valid JSON. Fix line ${line}, column ${column}: ${message}.`);
        return false;
      }
      const filePath = tab.filePath;
      if (!filePath) return get().saveAs(tab.id);
      const settings = useSettings.getState();
      if (settings.trailingCommas === "remove" && tab.history.present.hasTrailingCommas && tab.history.present.dialect !== "json5") {
        // Recorded as an edit, so it shows in the tree and can be undone.
        updateTab(tab.id, { history: pushHistory(tab.history, removeTrailingCommas(tab.history.present)) });
        tab = get().tabs.find((t) => t.id === tab!.id)!;
      }
      const text = toFileText(tab.history.present);
      // Warn (but allow saving) when the file breaks its schema's rules.
      const problems = schemaProblems(tab.id, tab.history.present);
      if (problems.length > 0) {
        const list = problems.slice(0, 4).map((p) => `• ${formatPath(p.path)}: ${p.message}`).join("\n");
        const more = problems.length > 4 ? `\n…and ${problems.length - 4} more.` : "";
        const answer = await askDialog({
          title: `${tab.title} doesn't match its schema`,
          message: `${list}${more}\n\nPrograms that read this file may reject it.`,
          confirmLabel: "Save anyway",
          extraLabel: "Show first problem",
        });
        if (answer === "extra") {
          get().activate(tab.id);
          get().select(problems[0].path);
        }
        if (answer !== "confirm") return false;
      }
      // Don't silently overwrite changes another program made since we loaded the file.
      const onDisk = await fileModifiedMs(filePath).catch(() => null);
      if (onDisk !== null && tab.diskModifiedMs !== null && onDisk !== tab.diskModifiedMs) {
        const overwrite = await confirmDialog({
          title: `${tab.title} was changed by another program`,
          message: "Saving will replace those changes with your version. (The other version is kept as a backup.)",
          confirmLabel: "Save anyway",
          danger: true,
        });
        if (!overwrite) return false;
      }
      try {
        const modifiedMs = await saveTextFile(filePath, text, settings.backupCount);
        updateTab(tab.id, { savedText: text, diskModifiedMs: modifiedMs });
        settings.addRecent(filePath);
        return true;
      } catch (error) {
        fail(`Could not save: ${error}`);
        return false;
      }
    },

    async saveAs(tabId) {
      const tab = tabId ? get().tabs.find((t) => t.id === tabId) : activeTab();
      if (!tab) return false;
      const path = await pickSavePath(tab.filePath ?? tab.title);
      if (!path) return false;
      updateTab(tab.id, { filePath: path, title: fileNameOf(path) });
      return get().save(tab.id);
    },

    closeTab(tabId) {
      forgetTabSchema(tabId);
      set((state) => {
        const index = state.tabs.findIndex((t) => t.id === tabId);
        const tabs = state.tabs.filter((t) => t.id !== tabId);
        const activeId =
          state.activeId === tabId ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : state.activeId;
        return { tabs, activeId };
      });
    },

    activate(tabId) {
      set({ activeId: tabId });
    },

    select(path) {
      const tab = activeTab();
      if (!tab) return;
      const expanded = new Set(tab.expanded);
      for (let i = 0; i < path.length; i++) expanded.add(pathKey(path.slice(0, i)));
      updateTab(tab.id, { selectedPath: path, expanded });
    },

    setExpanded(path, open) {
      const tab = activeTab();
      if (!tab) return;
      const expanded = new Set(tab.expanded);
      if (open) expanded.add(pathKey(path));
      else expanded.delete(pathKey(path));
      updateTab(tab.id, { expanded });
    },

    apply(edit, selectAfter) {
      const tab = activeTab();
      if (!tab) return false;
      try {
        const next = edit(tab.history.present);
        if (next === tab.history.present) return true; // no change
        updateTab(tab.id, { history: pushHistory(tab.history, next) });
        if (selectAfter) get().select(selectAfter);
        return true;
      } catch (error) {
        fail(error instanceof EditError ? error.message : `Unexpected problem: ${error}`);
        return false;
      }
    },

    // Undo/redo also discard text that wasn't valid yet; the text view shows the restored version.
    undo() {
      const tab = activeTab();
      if (tab && !tab.placeholder) updateTab(tab.id, { history: undoHistory(tab.history), pendingText: null });
    },

    redo() {
      const tab = activeTab();
      if (tab && !tab.placeholder) updateTab(tab.id, { history: redoHistory(tab.history), pendingText: null });
    },

    showMessage(message) {
      set({ message });
    },

    setView(view) {
      flushTextEditor?.();
      const tab = activeTab();
      if (!tab) return false;
      if (view === "tree" && tab.pendingText) {
        const { line, column, message } = tab.pendingText.problem;
        fail(`Fix the text first: line ${line}, column ${column}: ${message}. The tree needs valid JSON.`);
        return false;
      }
      updateTab(tab.id, { view });
      return true;
    },

    applyText(tabId, text) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const doc = tab.history.present;
      if (!tab.placeholder && text === doc.text) {
        if (tab.pendingText) updateTab(tabId, { pendingText: null });
        return;
      }
      try {
        if (tab.placeholder) {
          const fixed = parseDocument((doc.format.bom ? BOM : "") + text);
          updateTab(tabId, { history: startHistory(fixed), placeholder: false, pendingText: null, expanded: initialExpanded(fixed) });
          return;
        }
        const next = withText(doc, text);
        // A file that was standard JSON stays standard JSON (other programs may require it).
        const violation = doc.dialect === "json" ? findStrictJsonViolation(text) : null;
        if (violation) {
          updateTab(tabId, { pendingText: { text, problem: violation } });
          return;
        }
        updateTab(tabId, { history: pushHistory(tab.history, next), pendingText: null });
      } catch (error) {
        if (!(error instanceof JsonSyntaxError)) throw error;
        updateTab(tabId, { pendingText: { text, problem: error.problems[0] } });
      }
    },
  };
});

/** The text that would be written to disk right now (including text not yet valid). */
export function currentFileText(tab: Tab): string {
  if (tab.pendingText) return (tab.history.present.format.bom ? BOM : "") + tab.pendingText.text;
  return toFileText(tab.history.present);
}

export function isDirty(tab: Tab): boolean {
  return currentFileText(tab) !== tab.savedText;
}
