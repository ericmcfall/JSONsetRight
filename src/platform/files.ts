// TypeScript side of the Rust file commands in src-tauri/src/files.rs, plus the Open/Save dialogs.
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface FileContents {
  text: string;
  modifiedMs: number;
}

export interface BackupInfo {
  path: string;
  createdMs: number;
}

const JSON_FILTERS = [
  { name: "JSON files", extensions: ["json", "jsonc", "code-workspace", "babelrc", "eslintrc"] },
  { name: "All files", extensions: ["*"] },
];

export function readTextFile(path: string): Promise<FileContents> {
  return invoke("read_text_file", { path });
}

/** Saves atomically and returns the file's new modified time. */
export function saveTextFile(path: string, text: string, backupCount: number): Promise<number> {
  return invoke("save_text_file", { path, text, backupCount });
}

/** null if the file no longer exists. */
export function fileModifiedMs(path: string): Promise<number | null> {
  return invoke("file_modified_ms", { path });
}

export function listBackups(path: string): Promise<BackupInfo[]> {
  return invoke("list_backups", { path });
}

/** Shows the Open dialog. Returns the chosen paths (empty if cancelled). */
export async function pickFilesToOpen(): Promise<string[]> {
  const result = await open({ multiple: true, filters: JSON_FILTERS, title: "Open JSON file" });
  if (result === null) return [];
  return Array.isArray(result) ? result : [result];
}

/** Shows the Save As dialog. Returns the chosen path, or null if cancelled. */
export async function pickSavePath(suggestedName: string): Promise<string | null> {
  return save({ defaultPath: suggestedName, filters: JSON_FILTERS, title: "Save JSON file" });
}

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
