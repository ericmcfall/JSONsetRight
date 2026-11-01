// The right-hand panel: everything about the selected value, with an editor suited to its type.
import { useState, type ReactNode } from "react";
import {
  childrenOf,
  commentsFor,
  findNode,
  formatPath,
  isUnsafeNumber,
  JSON_NUMBER,
  keysOf,
  kindOf,
  sourceOf,
  VALUE_KINDS,
  type JsonDocument,
  type Path,
  type ValueKind,
} from "../engine";
import type { Tab } from "../store/editor";
import * as actions from "./actions";
import { KindBadge, kindName } from "./KindBadge";
import { pathKey } from "./tree-model";

export function DetailsPanel({ tab }: { tab: Tab }) {
  const doc = tab.history.present;
  const path = actions.existingPath(doc, tab.selectedPath);
  const node = findNode(doc, path)!;
  const kind = kindOf(node);
  const last = path[path.length - 1];
  const parent = path.length > 0 ? findNode(doc, path.slice(0, -1)) : undefined;
  const comments = commentsFor(doc, path);
  // Remount editors whenever the value changes underneath them (undo, edits in the tree).
  const editorKey = `${pathKey(path)}:${sourceOf(doc, node)}`;

  return (
    <aside className="details" aria-label="Selected value">
      <div className="details-path">
        <code title={formatPath(path)}>{formatPath(path)}</code>
        <button type="button" className="link" onClick={() => navigator.clipboard.writeText(formatPath(path))}>
          Copy path
        </button>
      </div>

      {typeof last === "string" && parent && (
        <Field label="Key">
          <KeyEditor key={pathKey(path)} path={path} siblings={keysOf(parent)} />
        </Field>
      )}
      {typeof last === "number" && <Field label="Position">Item {last + 1} of {parent?.children?.length}</Field>}

      <Field label="Type">
        <span className="type-row">
          <KindBadge kind={kind} />
          <select
            value={kind}
            onChange={(e) => actions.changeKind(path, e.target.value as ValueKind)}
            aria-label="Type"
          >
            {VALUE_KINDS.map((k) => (
              <option key={k} value={k}>{kindName(k)}</option>
            ))}
          </select>
        </span>
      </Field>

      <Field label="Value">
        <ValueEditor key={editorKey} doc={doc} path={path} kind={kind} />
      </Field>

      {(kind === "object" || kind === "array") && (
        <Field label={kind === "object" ? "Add property" : "Add item"}>
          <AddChildForm key={pathKey(path)} path={path} kind={kind} existingKeys={kind === "object" ? keysOf(node) : []} />
        </Field>
      )}

      {comments.length > 0 && (
        <Field label="Comments">
          {comments.map((c, i) => (
            <pre key={i} className="comment">{c}</pre>
          ))}
        </Field>
      )}

      {path.length > 0 && (
        <div className="details-actions">
          <button type="button" onClick={() => actions.moveBy(path, -1)} title="Alt+↑">Move up</button>
          <button type="button" onClick={() => actions.moveBy(path, 1)} title="Alt+↓">Move down</button>
          <button type="button" onClick={() => actions.duplicate(path)} title="Ctrl+D">Duplicate</button>
          <button type="button" className="danger" onClick={() => actions.remove(path)} title="Delete">Delete</button>
        </div>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-body">{children}</div>
    </div>
  );
}

function KeyEditor({ path, siblings }: { path: Path; siblings: string[] }) {
  const original = path[path.length - 1] as string;
  const [text, setText] = useState(original);
  const error =
    text === "" ? "Key names can't be empty" : text !== original && siblings.includes(text) ? `There is already a key named "${text}"` : null;
  const commit = () => {
    if (!error && text !== original) actions.rename(path, text);
  };
  return (
    <>
      <input
        className={error ? "invalid" : ""}
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (error ? setText(original) : commit())}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setText(original);
        }}
        aria-label="Key name"
      />
      {error && <div className="field-error">{error}</div>}
    </>
  );
}

function ValueEditor({ doc, path, kind }: { doc: JsonDocument; path: Path; kind: ValueKind }) {
  const node = findNode(doc, path)!;
  switch (kind) {
    case "string":
      return <StringEditor path={path} initial={node.value as string} />;
    case "number":
      return <NumberEditor path={path} initial={sourceOf(doc, node)} />;
    case "boolean":
      return (
        <label className="toggle">
          <input id="value-editor" type="checkbox" checked={node.value === true} onChange={(e) => actions.setScalar(path, e.target.checked)} />
          <span>{node.value ? "true" : "false"}</span>
        </label>
      );
    case "null":
      return <span className="muted">null: deliberately empty. Change the type above to give it a value.</span>;
    case "object":
    case "array": {
      const count = childrenOf(node).length;
      const noun = kind === "object" ? (count === 1 ? "property" : "properties") : count === 1 ? "item" : "items";
      return <span className="muted">{count} {noun}. Select one in the tree to edit it.</span>;
    }
  }
}

function StringEditor({ path, initial }: { path: Path; initial: string }) {
  const [text, setText] = useState(initial);
  const commit = () => {
    if (text !== initial) actions.setScalar(path, text);
  };
  return (
    <>
      <textarea
        id="value-editor"
        value={text}
        rows={Math.min(12, Math.max(2, text.split("\n").length))}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) commit();
          if (e.key === "Escape") setText(initial);
        }}
        aria-label="Text value"
      />
      <div className="field-hint">
        Saved as <code>{JSON.stringify(text).slice(0, 200)}</code>. Quotes and line breaks are handled for you.
        Ctrl+Enter or click away to apply.
      </div>
    </>
  );
}

function NumberEditor({ path, initial }: { path: Path; initial: string }) {
  const [text, setText] = useState(initial);
  const valid = JSON_NUMBER.test(text.trim());
  const commit = () => {
    if (valid && text.trim() !== initial) actions.setNumber(path, text);
  };
  return (
    <>
      <input
        id="value-editor"
        className={valid ? "" : "invalid"}
        value={text}
        inputMode="decimal"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (valid ? commit() : setText(initial))}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setText(initial);
        }}
        aria-label="Number value"
      />
      {!valid && <div className="field-error">Use digits with an optional minus sign, decimal point or exponent, e.g. -12, 3.5, 1e6.</div>}
      {valid && isUnsafeNumber(text.trim()) && (
        <div className="field-warning">This number is too large for many programs to store exactly.</div>
      )}
    </>
  );
}

function AddChildForm({ path, kind, existingKeys }: { path: Path; kind: "object" | "array"; existingKeys: string[] }) {
  const [key, setKey] = useState("");
  const [childKind, setChildKind] = useState<ValueKind>("string");
  const error = kind === "object" && key !== "" && existingKeys.includes(key) ? `There is already a key named "${key}"` : null;
  const canAdd = kind === "array" || (key !== "" && !error);
  const add = () => {
    if (canAdd && actions.addChild(path, childKind, kind === "object" ? key : undefined)) setKey("");
  };
  return (
    <>
      <div className="add-row">
        {kind === "object" && (
          <input
            placeholder="New key name"
            className={error ? "invalid" : ""}
            value={key}
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label="New key name"
          />
        )}
        <select value={childKind} onChange={(e) => setChildKind(e.target.value as ValueKind)} aria-label="New value type">
          {VALUE_KINDS.map((k) => (
            <option key={k} value={k}>{kindName(k)}</option>
          ))}
        </select>
        <button type="button" className="primary" disabled={!canAdd} onClick={add}>Add</button>
      </div>
      {error && <div className="field-error">{error}</div>}
    </>
  );
}
