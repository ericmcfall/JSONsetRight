import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { isDirty, useEditor } from "./store/editor";
import { useSettings } from "./store/settings";
import { BackupsDialog } from "./ui/BackupsDialog";
import { ConfirmDialog, MessageBar, ProblemsPanel, StatusBar, TabBar, Toolbar, Welcome } from "./ui/Chrome";
import { handleShortcut } from "./ui/commands";
import { DetailsPanel } from "./ui/DetailsPanel";
import { startSafetyNet } from "./ui/safety";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TreeView } from "./ui/TreeView";

// React runs effects twice in development; this keeps one-time startup work from repeating.
let started = false;

// Lets developers inspect the editor state from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { safejson: useEditor });

function App() {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === s.activeId));
  const theme = useSettings((s) => s.theme);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"backups" | "settings" | null>(null);

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
      // In a plain browser (no desktop app), open a sample so the UI can be tried.
      import("../samples/vscode-settings.jsonc?raw").then((m) => useEditor.getState().openText("vscode-settings.jsonc", m.default));
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
            <TreeView tab={tab} query={query} />
            <DetailsPanel tab={tab} />
          </main>
          <ProblemsPanel doc={tab.history.present} />
          <StatusBar tab={tab} />
        </>
      ) : (
        <Welcome />
      )}
      {dialog === "backups" && tab && <BackupsDialog tab={tab} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SettingsDialog onClose={() => setDialog(null)} />}
      <ConfirmDialog />
    </div>
  );
}

export default App;
