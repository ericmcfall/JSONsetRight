// The editor's state: open tabs, each with its document, undo history and save status.
// Components read from this store and call its actions; they never edit text themselves.
import { create } from "zustand";
import {
  EditError,
  JsonSyntaxError,
  parseDocument,
  pushHistory,
  redoHistory,
  startHistory,
  toFileText,
  undoHistory,
  type History,
  type JsonDocument,
  type Path,
} from "../engine";
import { fileNameOf, pickFilesToOpen, pickSavePath, readTextFile, saveTextFile } from "../platform/files";

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
}

export interface Message {
  kind: "error" | "info";
  text: string;
}

interface EditorState {
  tabs: Tab[];
  activeId: string | null;
  message: Message | null;
  backupCount: number;

  newFile(): void;
  openFiles(paths?: string[]): Promise<void>;
  save(tabId?: string): Promise<boolean>;
  saveAs(tabId?: string): Promise<boolean>;
  closeTab(tabId: string): void;
  activate(tabId: string): void;
  select(path: Path): void;
  /** Runs an engine edit on the active document. Returns false (and shows why) if it was refused. */
  apply(edit: (doc: JsonDocument) => JsonDocument, selectAfter?: Path): boolean;
  undo(): void;
  redo(): void;
  showMessage(message: Message | null): void;
}

let nextTabNumber = 1;
let untitledCount = 0;

export const useEditor = create<EditorState>((set, get) => {
  const activeTab = () => get().tabs.find((t) => t.id === get().activeId);
  const updateTab = (id: string, change: Partial<Tab>) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...change } : t)) }));
  const fail = (text: string) => set({ message: { kind: "error", text } });

  return {
    tabs: [],
    activeId: null,
    message: null,
    backupCount: 5,

    newFile() {
      untitledCount++;
      const doc = parseDocument("{\r\n}\r\n");
      const tab: Tab = {
        id: `tab-${nextTabNumber++}`,
        filePath: null,
        title: `Untitled-${untitledCount}.json`,
        history: startHistory(doc),
        savedText: "",
        diskModifiedMs: null,
        selectedPath: [],
      };
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
          const doc = parseDocument(file.text);
          const tab: Tab = {
            id: `tab-${nextTabNumber++}`,
            filePath: path,
            title: fileNameOf(path),
            history: startHistory(doc),
            savedText: file.text,
            diskModifiedMs: file.modifiedMs,
            selectedPath: [],
          };
          set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
        } catch (error) {
          if (error instanceof JsonSyntaxError) {
            fail(
              `${fileNameOf(path)} can't be opened because it isn't valid JSON yet. ${error.message}. ` +
                "Fix that spot in a text editor such as VS Code, then open it again.",
            );
          } else {
            fail(String(error));
          }
        }
      }
    },

    async save(tabId) {
      const tab = tabId ? get().tabs.find((t) => t.id === tabId) : activeTab();
      if (!tab) return false;
      if (!tab.filePath) return get().saveAs(tab.id);
      const text = toFileText(tab.history.present);
      try {
        const modifiedMs = await saveTextFile(tab.filePath, text, get().backupCount);
        updateTab(tab.id, { savedText: text, diskModifiedMs: modifiedMs });
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
      if (tab) updateTab(tab.id, { selectedPath: path });
    },

    apply(edit, selectAfter) {
      const tab = activeTab();
      if (!tab) return false;
      try {
        const next = edit(tab.history.present);
        if (next === tab.history.present) return true; // no change
        updateTab(tab.id, {
          history: pushHistory(tab.history, next),
          ...(selectAfter ? { selectedPath: selectAfter } : {}),
        });
        return true;
      } catch (error) {
        fail(error instanceof EditError ? error.message : `Unexpected problem: ${error}`);
        return false;
      }
    },

    undo() {
      const tab = activeTab();
      if (tab) updateTab(tab.id, { history: undoHistory(tab.history) });
    },

    redo() {
      const tab = activeTab();
      if (tab) updateTab(tab.id, { history: redoHistory(tab.history) });
    },

    showMessage(message) {
      set({ message });
    },
  };
});

export function isDirty(tab: Tab): boolean {
  return toFileText(tab.history.present) !== tab.savedText;
}
