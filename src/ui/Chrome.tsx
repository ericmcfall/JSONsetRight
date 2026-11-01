// The window's frame around the editor: toolbar, tabs, messages, problems list, status bar,
// and the confirmation dialog.
import { useEffect, useRef } from "react";
import { findProblems, formatPath, type JsonDocument } from "../engine";
import { fileNameOf } from "../platform/files";
import { isDirty, useEditor, type Tab } from "../store/editor";
import { useSettings } from "../store/settings";
import { useDialog } from "./dialog";
import { closeTabWithPrompt, formatActive } from "./commands";

interface ToolbarProps {
  query: string;
  onQuery(q: string): void;
  onBackups(): void;
  onSettings(): void;
}

export function Toolbar({ query, onQuery, onBackups, onSettings }: ToolbarProps) {
  const { newFile, openFiles, save, saveAs, undo, redo } = useEditor.getState();
  const tab = useEditor((s) => s.tabs.find((t) => t.id === s.activeId));
  const has = !!tab;
  return (
    <header className="toolbar" role="toolbar">
      <button type="button" onClick={newFile} title="New file (Ctrl+N)">New</button>
      <button type="button" onClick={() => openFiles()} title="Open file (Ctrl+O)">Open…</button>
      <button type="button" onClick={() => save()} disabled={!has} title="Save (Ctrl+S)">Save</button>
      <button type="button" onClick={() => saveAs()} disabled={!has} title="Save as (Ctrl+Shift+S)">Save as…</button>
      <span className="toolbar-gap" />
      <button type="button" onClick={undo} disabled={!tab?.history.past.length} title="Undo (Ctrl+Z)">Undo</button>
      <button type="button" onClick={redo} disabled={!tab?.history.future.length} title="Redo (Ctrl+Y)">Redo</button>
      <button type="button" onClick={formatActive} disabled={!has} title="Re-indent the whole file (Shift+Alt+F)">Format</button>
      <button type="button" onClick={onBackups} disabled={!tab?.filePath} title="Restore an earlier saved version">Backups…</button>
      <span className="toolbar-spacer" />
      <input
        id="search"
        type="search"
        placeholder="Search keys and values (Ctrl+F)"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        disabled={!has}
        aria-label="Search"
      />
      <button type="button" onClick={onSettings} title="Settings (Ctrl+,)" aria-label="Settings">⚙</button>
    </header>
  );
}

export function TabBar() {
  const tabs = useEditor((s) => s.tabs);
  const activeId = useEditor((s) => s.activeId);
  const activate = useEditor((s) => s.activate);
  if (tabs.length === 0) return null;
  return (
    <nav className="tabbar" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeId}
          className={`tab${tab.id === activeId ? " active" : ""}`}
          title={tab.filePath ?? "Not saved yet"}
          onClick={() => activate(tab.id)}
          onAuxClick={(e) => e.button === 1 && closeTabWithPrompt(tab.id)}
        >
          <span className="tab-title">{tab.title}</span>
          {isDirty(tab) && <span className="dirty" title="Unsaved changes">●</span>}
          <button
            type="button"
            className="tab-close"
            aria-label={`Close ${tab.title}`}
            onClick={(e) => {
              e.stopPropagation();
              closeTabWithPrompt(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </nav>
  );
}

export function MessageBar() {
  const message = useEditor((s) => s.message);
  const showMessage = useEditor((s) => s.showMessage);
  if (!message) return null;
  return (
    <div className={`message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
      <span>{message.text}</span>
      <button type="button" className="link" onClick={() => showMessage(null)}>Dismiss</button>
    </div>
  );
}

export function ProblemsPanel({ doc }: { doc: JsonDocument }) {
  const select = useEditor((s) => s.select);
  const problems = findProblems(doc);
  if (problems.length === 0) return null;
  return (
    <section className="problems" aria-label="Problems">
      <div className="problems-title">Problems ({problems.length})</div>
      {problems.map((p, i) => (
        <button type="button" key={i} className={`problem ${p.severity}`} onClick={() => select(p.path)}>
          <span className="problem-icon">{p.severity === "error" ? "⛔" : "⚠"}</span>
          <code>{formatPath(p.path)}</code> {p.message}
        </button>
      ))}
    </section>
  );
}

export function StatusBar({ tab }: { tab: Tab }) {
  const doc = tab.history.present;
  const { indent, eol, bom } = doc.format;
  const count = findProblems(doc).length;
  return (
    <footer className="statusbar">
      <span title="Where this file is saved">{tab.filePath ?? "Not saved yet"}</span>
      <span className="toolbar-spacer" />
      {count > 0 && <span>{count} problem{count === 1 ? "" : "s"}</span>}
      <span title={doc.dialect === "jsonc" ? "JSON with comments and/or trailing commas" : "Standard JSON"}>
        {doc.dialect === "jsonc" ? "JSON with Comments" : "JSON"}
      </span>
      <span>{indent === "\t" ? "Tabs" : `Spaces: ${indent.length}`}</span>
      <span>{eol === "\r\n" ? "CRLF" : "LF"}</span>
      <span>{bom ? "UTF-8 with BOM" : "UTF-8"}</span>
    </footer>
  );
}

export function ConfirmDialog() {
  const request = useDialog((s) => s.request);
  const answer = useDialog((s) => s.answer);
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmButton.current?.focus(), [request]);
  if (!request) return null;
  return (
    <div className="dialog-backdrop" onKeyDown={(e) => e.key === "Escape" && answer("cancel")}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{request.title}</h2>
        <p>{request.message}</p>
        <div className="dialog-buttons">
          <button type="button" ref={confirmButton} className={request.danger ? "danger-solid" : "primary"} onClick={() => answer("confirm")}>
            {request.confirmLabel}
          </button>
          {request.extraLabel && (
            <button type="button" onClick={() => answer("extra")}>{request.extraLabel}</button>
          )}
          <button type="button" onClick={() => answer("cancel")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function Welcome() {
  const { newFile, openFiles } = useEditor.getState();
  const recent = useSettings((s) => s.recentFiles);
  return (
    <div className="welcome">
      <h1>SafeJSON</h1>
      <p>Edit JSON config files without worrying about commas, quotes or brackets.</p>
      <div className="welcome-buttons">
        <button type="button" className="primary" onClick={() => openFiles()}>Open a file…</button>
        <button type="button" onClick={newFile}>New file</button>
      </div>
      {recent.length > 0 && (
        <div className="recent">
          <div className="field-label">Recent files</div>
          {recent.map((path) => (
            <button type="button" key={path} className="link recent-file" title={path} onClick={() => openFiles([path])}>
              <strong>{fileNameOf(path)}</strong> <span className="muted">{path}</span>
            </button>
          ))}
        </div>
      )}
      <p className="muted">Tip: drag files onto this window to open them. Each file gets its own tab.</p>
    </div>
  );
}
