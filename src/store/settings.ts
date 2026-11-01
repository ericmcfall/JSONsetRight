// User preferences, saved to %LOCALAPPDATA%\SafeJSON\settings.json.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { SchemaPairs, SchemaRule } from "../engine/schema";

export interface Settings {
  theme: "system" | "light" | "dark";
  /** Indentation used by Format document. "keep" = whatever the file already uses. */
  formatIndent: "keep" | "2" | "4" | "tab";
  /** What to do with trailing commas (e.g. [1, 2,]) when saving. */
  trailingCommas: "keep" | "remove";
  /** How many earlier versions to keep per file (0 = no backups). */
  backupCount: number;
  recentFiles: string[];
  /** Schemas the user picked for specific files (key: lower-case file path; "" = no schema). */
  schemaPairs: SchemaPairs;
  /** Filename patterns that get a schema automatically. */
  schemaRules: SchemaRule[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  formatIndent: "keep",
  trailingCommas: "keep",
  backupCount: 5,
  recentFiles: [],
  schemaPairs: {},
  schemaRules: [],
};

const MAX_RECENT = 10;

interface SettingsState extends Settings {
  load(): Promise<void>;
  update(change: Partial<Settings>): void;
  addRecent(path: string): void;
  /** Picks a schema for one file. "" = no schema; undefined = back to automatic. */
  setSchemaFor(filePath: string, schema: string | undefined): void;
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    if (!isTauri()) return;
    const { load: _l, update: _u, addRecent: _a, setSchemaFor: _s, ...settings } = get();
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

    setSchemaFor(filePath, schema) {
      const pairs = { ...get().schemaPairs };
      if (schema === undefined) delete pairs[filePath.toLowerCase()];
      else pairs[filePath.toLowerCase()] = schema;
      set({ schemaPairs: pairs });
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
