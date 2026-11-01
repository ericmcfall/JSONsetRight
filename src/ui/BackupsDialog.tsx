// Lists the automatic backups of the current file and restores one into the editor.
import { useEffect, useState } from "react";
import { listBackups, readTextFile, type BackupInfo } from "../platform/files";
import { useEditor, type Tab } from "../store/editor";

export function BackupsDialog({ tab, onClose }: { tab: Tab; onClose(): void }) {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.filePath) return;
    listBackups(tab.filePath).then(setBackups, (e) => setError(String(e)));
  }, [tab.filePath]);

  const restore = async (backup: BackupInfo) => {
    try {
      const file = await readTextFile(backup.path);
      if (useEditor.getState().replaceText(file.text)) {
        useEditor.getState().showMessage({
          kind: "info",
          text: `Restored the backup from ${new Date(backup.createdMs).toLocaleString()}. Save to keep it, or press Ctrl+Z to undo.`,
        });
        onClose();
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="dialog-backdrop" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="backups-title">
        <h2 id="backups-title">Backups of {tab.title}</h2>
        <p className="muted">A copy is kept each time you save, just before the file is replaced.</p>
        {error && <div className="field-error">{error}</div>}
        {backups === null && !error && <p>Loading…</p>}
        {backups?.length === 0 && <p>No backups yet. They are created the first time you save over this file.</p>}
        {backups && backups.length > 0 && (
          <ul className="backup-list">
            {backups.map((b) => (
              <li key={b.path}>
                <span>{new Date(b.createdMs).toLocaleString()}</span>
                <button type="button" onClick={() => restore(b)}>Restore</button>
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-buttons">
          <button type="button" autoFocus onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
