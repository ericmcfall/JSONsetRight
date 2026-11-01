import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import "./App.css";
import { useEditor } from "./store/editor";
import { ConfirmDialog, MessageBar, ProblemsPanel, StatusBar, TabBar, Toolbar, Welcome } from "./ui/Chrome";
import { handleShortcut } from "./ui/commands";
import { DetailsPanel } from "./ui/DetailsPanel";
import { TreeView } from "./ui/TreeView";

// React runs effects twice in development; this keeps the dev sample from opening twice.
let sampleRequested = false;

// Lets developers inspect the editor state from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { safejson: useEditor });

function App() {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === s.activeId));
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleShortcut(e, () => document.getElementById("search")?.focus());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Developer convenience: in a plain browser (no Tauri), open a sample so the UI can be tried.
  useEffect(() => {
    if (import.meta.env.DEV && !isTauri() && !sampleRequested) {
      sampleRequested = true;
      import("../samples/vscode-settings.jsonc?raw").then((m) => useEditor.getState().openText("vscode-settings.jsonc", m.default));
    }
  }, []);

  return (
    <div className="app">
      <Toolbar query={query} onQuery={setQuery} />
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
      <ConfirmDialog />
    </div>
  );
}

export default App;
