import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { declaredSchema } from "./engine/schema";
import { isDirty, useEditor } from "./store/editor";
import { updateTabSchema } from "./store/schemas";
import { useSettings } from "./store/settings";
import { BackupsDialog } from "./ui/BackupsDialog";
import { ConfirmDialog, MessageBar, ProblemsPanel, StatusBar, TabBar, Toolbar, Welcome } from "./ui/Chrome";
import { handleShortcut } from "./ui/commands";
import { DetailsPanel } from "./ui/DetailsPanel";
import { startSafetyNet } from "./ui/safety";
import { SchemaDialog } from "./ui/SchemaDialog";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TableView } from "./ui/TableView";
import { TextEditor } from "./ui/TextEditor";
import { TreeView } from "./ui/TreeView";

// React runs effects twice in development; this keeps one-time startup work from repeating.
let started = false;

// Lets developers inspect the editor state from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { safejson: useEditor });

function App() {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === s.activeId));
  const theme = useSettings((s) => s.theme);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"backups" | "settings" | "schema" | null>(null);

  // Load the right schema when the file, its "$schema" value, or the schema settings change.
  const declared = tab ? declaredSchema(tab.history.present) : null;
  const schemaPairs = useSettings((s) => s.schemaPairs);
  const schemaRules = useSettings((s) => s.schemaRules);
  useEffect(() => {
    const current = useEditor.getState().tabs.find((t) => t.id === tab?.id);
    if (current) void updateTabSchema(current);
  }, [tab?.id, tab?.filePath, declared, schemaPairs, schemaRules]);

  // One-time startup: settings, then files named on the command line ("Open with").
  useEffect(() => {
    if (started) return;
    started = true;
    void useSettings.getState().load();
    if (isTauri()) {
      invoke<string[]>("startup_files").then((paths) => {
        if (paths.length > 0) void useEditor.getState().openFiles(paths);
      });
    } else if (import.meta.env.DEV) {
      // In a plain browser (no desktop app), open samples so the UI can be tried. The second one
      // gets a pretend file path so its relative "$schema" can be found.
      void (async () => {
        const store = useEditor.getState();
        store.openText("vscode-settings.jsonc", (await import("../samples/vscode-settings.jsonc?raw")).default);
        store.openText("build.json5", (await import("../samples/build.json5?raw")).default);
        store.openText("inventory.json", (await import("../samples/inventory.json?raw")).default);
        store.openText("service.json", (await import("../samples/service.json?raw")).default);
        const id = useEditor.getState().activeId;
        useEditor.setState((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, filePath: "C:\\samples\\service.json" } : t)) }));
      })();
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setDialog("settings");
        return;
      }
      handleShortcut(e, () => document.getElementById("search")?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Crash recovery, outside-change detection, close prompts and drag-and-drop (desktop app only).
  useEffect(() => (isTauri() ? startSafetyNet() : undefined), []);

  // Theme: the Settings choice, or follow Windows (and keep following it if it changes).
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && system.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);

  // Window title: "settings.json ● - SafeJSON"
  const title = tab ? `${tab.title}${isDirty(tab) ? " ●" : ""} - SafeJSON` : "SafeJSON";
  useEffect(() => {
    document.title = title;
    if (isTauri()) void getCurrentWindow().setTitle(title);
  }, [title]);

  return (
    <div className="app">
      <Toolbar query={query} onQuery={setQuery} onBackups={() => setDialog("backups")} onSettings={() => setDialog("settings")} />
      <TabBar />
      <MessageBar />
      {tab ? (
        <>
          <main className="workspace">
            {tab.view === "text" ? (
              <TextEditor tab={tab} />
            ) : tab.view === "table" ? (
              <TableView tab={tab} />
            ) : (
              <>
                <TreeView tab={tab} query={query} />
                <DetailsPanel tab={tab} />
              </>
            )}
          </main>
          <ProblemsPanel tab={tab} />
          <StatusBar tab={tab} onSchema={() => setDialog("schema")} />
        </>
      ) : (
        <Welcome />
      )}
      {dialog === "backups" && tab && <BackupsDialog tab={tab} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SettingsDialog onClose={() => setDialog(null)} />}
      {dialog === "schema" && tab && <SchemaDialog tab={tab} onClose={() => setDialog(null)} />}
      <ConfirmDialog />
    </div>
  );
}

export default App;
