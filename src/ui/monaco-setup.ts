// Loads the Monaco editor (VS Code's text editor) with only its JSON support. This module is
// imported on demand the first time text mode is opened, so app startup stays fast.
import * as monaco from "monaco-editor/editor/editor.api";
import { jsonDefaults } from "monaco-editor/languages/features/json/register";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";

// Monaco runs its language services in background workers bundled with the app (no internet).
globalThis.MonacoEnvironment = {
  getWorker: (_moduleId: string, label: string) => (label === "json" ? new JsonWorker() : new EditorWorker()),
};

export { monaco, jsonDefaults };
