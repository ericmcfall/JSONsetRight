// Preferences. Changes apply and save immediately.
import { useSettings, type Settings } from "../store/settings";

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const settings = useSettings();
  const update = (change: Partial<Settings>) => settings.update(change);

  return (
    <div className="dialog-backdrop" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="dialog settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 id="settings-title">Settings</h2>

        <label className="setting">
          <span>Theme</span>
          <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Settings["theme"] })}>
            <option value="system">Match Windows</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="setting">
          <span>
            Format uses
            <small>Indentation applied by the Format button. Normal edits always match the file.</small>
          </span>
          <select value={settings.formatIndent} onChange={(e) => update({ formatIndent: e.target.value as Settings["formatIndent"] })}>
            <option value="keep">The file's current indentation</option>
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tabs</option>
          </select>
        </label>

        <label className="setting">
          <span>
            Trailing commas
            <small>A comma before a closing bracket, e.g. [1, 2,]. Allowed in VS Code settings, not in strict JSON.</small>
          </span>
          <select value={settings.trailingCommas} onChange={(e) => update({ trailingCommas: e.target.value as Settings["trailingCommas"] })}>
            <option value="keep">Keep them</option>
            <option value="remove">Remove them when saving</option>
          </select>
        </label>

        <label className="setting">
          <span>
            Backups per file
            <small>Earlier versions kept in %LOCALAPPDATA%\SafeJSON\backups. 0 turns backups off.</small>
          </span>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.backupCount}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n)) update({ backupCount: Math.max(0, Math.min(50, n)) });
            }}
          />
        </label>

        <label className="setting">
          <span>Recent files</span>
          <button type="button" disabled={settings.recentFiles.length === 0} onClick={() => update({ recentFiles: [] })}>
            Clear list ({settings.recentFiles.length})
          </button>
        </label>

        <div className="dialog-buttons">
          <button type="button" className="primary" autoFocus onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
