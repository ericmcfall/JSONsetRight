// Shows which schema the current file uses and why, and lets the user change it.
import { useState } from "react";
import { pickSchemaFile } from "../platform/files";
import type { Tab } from "../store/editor";
import { updateTabSchema, useTabSchema } from "../store/schemas";
import { useSettings } from "../store/settings";

const HOW_FOUND = {
  manual: "You chose this schema for this file.",
  $schema: 'The file names it in its "$schema" property.',
  rule: "A filename rule in Settings matched this file.",
};

export function SchemaDialog({ tab, onClose }: { tab: Tab; onClose(): void }) {
  const schema = useTabSchema(tab.id);
  const settings = useSettings();
  const [url, setUrl] = useState("");
  const manual = tab.filePath ? settings.schemaPairs[tab.filePath.toLowerCase()] : undefined;

  const choose = (location: string | undefined) => {
    if (!tab.filePath) return;
    settings.setSchemaFor(tab.filePath, location);
    void updateTabSchema(tab);
  };

  return (
    <div className="dialog-backdrop" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="dialog settings" role="dialog" aria-modal="true" aria-labelledby="schema-title">
        <h2 id="schema-title">Schema for {tab.title}</h2>
        <p className="muted">
          A JSON Schema describes which properties and values a file may contain. SafeJSON uses it to
          check the file, suggest properties, and offer allowed values.
        </p>

        {schema.status === "none" && <p>{manual === "" ? "Schema checking is switched off for this file." : "No schema found for this file."}</p>}
        {schema.source && (
          <div className="schema-current">
            <code>{schema.source.location}</code>
            <div className="muted">{HOW_FOUND[schema.source.kind]}</div>
            {schema.status === "loading" && <div>Loading…</div>}
            {schema.status === "ready" && <div className="ok">✓ Loaded and checking this file.</div>}
            {schema.status === "error" && <div className="field-error">{schema.error}</div>}
          </div>
        )}

        {!tab.filePath && <p className="field-warning">Save the file first to choose a schema for it.</p>}

        <div className="schema-actions">
          <button type="button" disabled={!tab.filePath} onClick={async () => { const p = await pickSchemaFile(); if (p) choose(p); }}>
            Choose a schema file…
          </button>
          <span className="add-row">
            <input placeholder="https://… schema address" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Schema web address" />
            <button type="button" disabled={!tab.filePath || !/^https?:\/\/\S+$/i.test(url.trim())} onClick={() => choose(url.trim())}>
              Use
            </button>
          </span>
          <button type="button" disabled={!tab.filePath || manual === ""} onClick={() => choose("")}>Don't use a schema</button>
          <button type="button" disabled={manual === undefined} onClick={() => choose(undefined)}>Back to automatic</button>
          <button type="button" disabled={!schema.source} onClick={() => updateTabSchema(tab, true)} title="Re-read schema files and download web schemas again">
            Reload schema
          </button>
        </div>

        <div className="dialog-buttons">
          <button type="button" className="primary" autoFocus onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
