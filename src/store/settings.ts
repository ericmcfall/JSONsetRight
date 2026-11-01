// User preferences, saved to %LOCALAPPDATA%\SafeJSON\settings.json.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";

export interface Settings {
  theme: "system" | "light" | "dark";
  /** Indentation used by Format document. "keep" = whatever the file already uses. */
  formatIndent: "keep" | "2" | "4" | "tab";
  /** What to do with trailing commas (e.g. [1, 2,]) when saving. */
  trailingCommas: "keep" | "remove";
  /** How many earlier versions to keep per file (0 = no backups). */
  backupCount: number;
  recentFiles: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  formatIndent: "keep",
  trailingCommas: "keep",
  backupCount: 5,
  recentFiles: [],
};

const MAX_RECENT = 10;

interface SettingsState extends Settings {
  load(): Promise<void>;
  update(change: Partial<Settings>): void;
  addRecent(path: string): void;
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    if (!isTauri()) return;
    const { load: _l, update: _u, addRecent: _a, ...settings } = get();
    invoke("write_settings", { contents: JSON.stringify(settings, null, 2) }).catch(() => undefined);
  };

  return {
    ...DEFAULT_SETTINGS,

    async load() {
      if (!isTauri()) return;
      const text = await invoke<string | null>("read_settings").catch(() => null);
      if (!text) return;
      try {
        // Unknown or missing fields fall back to defaults, so old settings files keep working.
        const saved = JSON.parse(text) as Partial<Settings>;
        set({ ...DEFAULT_SETTINGS, ...saved });
      } catch {
        // A damaged settings file is ignored; defaults apply and the next change rewrites it.
      }
    },

    update(change) {
      set(change);
      persist();
    },

    addRecent(path) {
      const others = get().recentFiles.filter((p) => p.toLowerCase() !== path.toLowerCase());
      set({ recentFiles: [path, ...others].slice(0, MAX_RECENT) });
      persist();
    },
  };
});

/** The indent string Format document should use for a file currently indented with `current`. */
export function formatIndentFor(current: string): string {
  switch (useSettings.getState().formatIndent) {
    case "2": return "  ";
    case "4": return "    ";
    case "tab": return "\t";
    default: return current;
  }
}
