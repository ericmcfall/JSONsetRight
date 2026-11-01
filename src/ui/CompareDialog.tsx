// Chooses what to compare the current file with: its saved version, another open tab,
// one of its backups, or another file.
import { useEffect, useState } from "react";
import { parseDocument, type JsonDocument } from "../engine";
import { fileNameOf, listBackups, pickFilesToOpen, readTextFile, type BackupInfo } from "../platform/files";
import { isDirty, useEditor, type Tab } from "../store/editor";

export function CompareDialog({ tab, onClose }: { tab: Tab; onClose(): void }) {
  // Select the tab list itself (a new filtered list on every check would re-render forever).
  const tabs = useEditor((s) => s.tabs);
  const others = tabs.filter((t) => t.id !== tab.id);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab.filePath) listBackups(tab.filePath).then(setBackups, () => setBackups([]));
  }, [tab.filePath]);

  const start = (label: string, doc: JsonDocument, otherTabId: string | null = null) => {
    useEditor.getState().startCompare({ label, doc, otherTabId });
    onClose();
  };

  /** Reads text (from disk or memory) and starts comparing, or explains why it can't. */
  const startFromText = (label: string, text: string) => {
    try {
      start(label, parseDocument(text));
    } catch (e) {
      setError(`${label} isn't valid JSON, so it can't be compared: ${e instanceof Error ? e.message : e}`);
    }
  };

  const fromFile = async () => {
    const [path] = await pickFilesToOpen();
    if (!path) return;
    try {
      startFromText(fileNameOf(path), (await readTextFile(path)).text);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="dialog-backdrop" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="dialog settings" role="dialog" aria-modal="true" aria-labelledby="compare-title">
        <h2 id="compare-title">Compare {tab.title} with…</h2>
        <p className="muted">Only the data is compared. Formatting, comments and the order of keys are ignored.</p>
        {error && <div className="field-error">{error}</div>}

        <div className="compare-choices">
          {tab.filePath && (
            <button type="button" disabled={!isDirty(tab)} onClick={() => startFromText("Saved version on disk", tab.savedText)}
              title={isDirty(tab) ? "See what you've changed since you last saved" : "No unsaved changes to compare"}>
              <strong>Saved version</strong>
              <span className="muted">{isDirty(tab) ? "See your unsaved changes" : "No unsaved changes"}</span>
            </button>
          )}
          {others.map((other) => (
            <button type="button" key={other.id} disabled={!!other.pendingText}
              onClick={() => start(other.title, other.history.present, other.id)}>
              <strong>{other.title}</strong>
              <span className="muted">Open tab: changes can be copied both ways</span>
            </button>
          ))}
          {backups.slice(0, 5).map((backup) => (
            <button type="button" key={backup.path}
              onClick={async () => {
                try {
                  startFromText(`Backup from ${new Date(backup.createdMs).toLocaleString()}`, (await readTextFile(backup.path)).text);
                } catch (e) {
                  setError(String(e));
                }
              }}>
              <strong>Backup</strong>
              <span className="muted">{new Date(backup.createdMs).toLocaleString()}</span>
            </button>
          ))}
          <button type="button" onClick={fromFile}>
            <strong>Another file…</strong>
            <span className="muted">Choose a file to compare with</span>
          </button>
        </div>

        <div className="dialog-buttons">
          <button type="button" autoFocus onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
