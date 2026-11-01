import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { isDirty, useEditor } from "./store/editor";
import { BackupsDialog } from "./ui/BackupsDialog";
import { ConfirmDialog, MessageBar, ProblemsPanel, StatusBar, TabBar, Toolbar, Welcome } from "./ui/Chrome";
import { handleShortcut } from "./ui/commands";
import { DetailsPanel } from "./ui/DetailsPanel";
import { startSafetyNet } from "./ui/safety";
import { TreeView } from "./ui/TreeView";

// React runs effects twice in development; this keeps the dev sample from opening twice.
let sampleRequested = false;

// Lets developers inspect the editor state from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { safejson: useEditor });

function App() {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === s.activeId));
  const [query, setQuery] = useState("");
  const [showBackups, setShowBackups] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleShortcut(e, () => document.getElementById("search")?.focus());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Crash recovery, outside-change detection, close prompts and drag-and-drop (desktop app only).
  useEffect(() => (isTauri() ? startSafetyNet() : undefined), []);

  // Window title: "settings.json ● - SafeJSON"
  const title = tab ? `${tab.title}${isDirty(tab) ? " ●" : ""} - SafeJSON` : "SafeJSON";
  useEffect(() => {
    document.title = title;
    if (isTauri()) void getCurrentWindow().setTitle(title);
  }, [title]);

  // Developer convenience: in a plain browser (no Tauri), open a sample so the UI can be tried.
  useEffect(() => {
    if (import.meta.env.DEV && !isTauri() && !sampleRequested) {
      sampleRequested = true;
      import("../samples/vscode-settings.jsonc?raw").then((m) => useEditor.getState().openText("vscode-settings.jsonc", m.default));
    }
  }, []);

  return (
    <div className="app">
      <Toolbar query={query} onQuery={setQuery} onBackups={() => setShowBackups(true)} />
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
      {showBackups && tab && <BackupsDialog tab={tab} onClose={() => setShowBackups(false)} />}
      <ConfirmDialog />
    </div>
  );
}

export default App;
