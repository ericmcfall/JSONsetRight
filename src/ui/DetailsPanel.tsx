// The right-hand panel: everything about the selected value, with an editor suited to its type.
// When the file has a JSON Schema, it also shows the schema's description, allowed values,
// default and known properties.
import { useState, type ReactNode } from "react";
import {
  childrenOf,
  commentsFor,
  defaultValue,
  findNode,
  formatPath,
  isUnsafeNumber,
  JSON_NUMBER,
  keysOf,
  kindOf,
  samePath,
  sourceOf,
  VALUE_KINDS,
  valueOf,
  type JsonDocument,
  type JsonValue,
  type Path,
  type ValueKind,
} from "../engine";
import { hintsAt, kindOfValue, type PropertyHint, type SchemaHint } from "../engine/schema";
import type { Tab } from "../store/editor";
import { useTabSchema } from "../store/schemas";
import * as actions from "./actions";
import { KindBadge, kindName } from "./KindBadge";
import { allProblems } from "./problems";
import { pathKey } from "./tree-model";

export function DetailsPanel({ tab }: { tab: Tab }) {
  const doc = tab.history.present;
  const path = actions.existingPath(doc, tab.selectedPath);
  const node = findNode(doc, path)!;
  const kind = kindOf(node);
  const last = path[path.length - 1];
  const parent = path.length > 0 ? findNode(doc, path.slice(0, -1)) : undefined;
  const comments = commentsFor(doc, path);
  const schema = useTabSchema(tab.id);
  const hint = schema.compiled ? hintsAt(schema.compiled, path) : null;
  const problems = allProblems(tab.id, doc).filter((p) => samePath(p.path, path));
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

      {(hint?.title || hint?.description) && (
        <div className="schema-help">
          {hint.title && <strong>{hint.title}</strong>}
          {hint.description && <p>{hint.description}</p>}
        </div>
      )}
      {hint?.deprecated && <div className="field-warning">Deprecated: {hint.deprecated}</div>}
      {problems.map((p, i) => (
        <div key={i} className={p.severity === "error" ? "field-error" : "field-warning"}>
          {p.severity === "error" ? "⛔" : "⚠"} {p.message}
        </div>
      ))}

      {typeof last === "string" && parent && (
        <Field label="Key">
          <KeyEditor key={pathKey(path)} path={path} siblings={keysOf(parent)} />
        </Field>
      )}
      {typeof last === "number" && <Field label="Position">Item {last + 1} of {parent?.children?.length}</Field>}

      <Field label="Type">
        <span className="type-row">
          <KindBadge kind={kind} />
          <select value={kind} onChange={(e) => actions.changeKind(path, e.target.value as ValueKind)} aria-label="Type">
            {VALUE_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindName(k)}{hint?.kinds.includes(k) ? " (expected)" : ""}
              </option>
            ))}
          </select>
        </span>
        {hint && hint.kinds.length > 0 && !hint.kinds.includes(kind) && (
          <div className="field-warning">The schema expects {hint.kinds.map(kindName).join(" or ")}.</div>
        )}
      </Field>

      <Field label="Value">
        <ValueEditor key={editorKey} doc={doc} path={path} kind={kind} hint={hint} />
        {hint?.hasDefault && (
          <DefaultHint path={path} current={valueOf(node)} defaultValue={hint.defaultValue!} />
        )}
      </Field>

      {(kind === "object" || kind === "array") && (
        <Field label={kind === "object" ? "Add property" : "Add item"}>
          <AddChildForm key={pathKey(path)} path={path} kind={kind} existingKeys={kind === "object" ? keysOf(node) : []} hint={hint} />
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

function ValueEditor({ doc, path, kind, hint }: { doc: JsonDocument; path: Path; kind: ValueKind; hint: SchemaHint | null }) {
  const node = findNode(doc, path)!;
  const choices = hint?.enumValues;
  if (choices && choices.length > 0 && kind !== "object" && kind !== "array" && choices.every((v) => v === null || typeof v !== "object")) {
    return <EnumEditor path={path} current={valueOf(node)} choices={choices} descriptions={hint?.enumDescriptions} />;
  }
  switch (kind) {
    case "string":
      return <StringEditor path={path} initial={node.value as string} />;
    case "number":
      return <NumberEditor path={path} initial={sourceOf(doc, node)} integer={hint?.integer ?? false} />;
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

/** A dropdown for values the schema lists as the only ones allowed. */
function EnumEditor({ path, current, choices, descriptions }: { path: Path; current: JsonValue; choices: JsonValue[]; descriptions?: string[] }) {
  const currentLabel = JSON.stringify(current);
  const index = choices.findIndex((c) => JSON.stringify(c) === currentLabel);
  return (
    <>
      <select
        id="value-editor"
        className={index === -1 ? "invalid" : ""}
        value={index}
        onChange={(e) => actions.setScalar(path, choices[Number(e.target.value)])}
        aria-label="Value"
      >
        {index === -1 && <option value={-1}>{currentLabel} (not allowed)</option>}
        {choices.map((choice, i) => (
          <option key={i} value={i}>
            {typeof choice === "string" ? choice : JSON.stringify(choice)}
            {descriptions?.[i] ? `: ${descriptions[i]}` : ""}
          </option>
        ))}
      </select>
      <div className="field-hint">The schema allows only these values.</div>
    </>
  );
}

function DefaultHint({ path, current, defaultValue: value }: { path: Path; current: JsonValue; defaultValue: JsonValue }) {
  const isDefault = JSON.stringify(current) === JSON.stringify(value);
  return (
    <div className="field-hint">
      Default: <code>{JSON.stringify(value)}</code>
      {!isDefault && (
        <button type="button" className="link" onClick={() => actions.setScalar(path, value)}>
          Use default
        </button>
      )}
    </div>
  );
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

function NumberEditor({ path, initial, integer }: { path: Path; initial: string; integer: boolean }) {
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
      {valid && integer && !/^-?\d+$/.test(text.trim()) && <div className="field-warning">The schema expects a whole number.</div>}
      {valid && isUnsafeNumber(text.trim()) && (
        <div className="field-warning">This number is too large for many programs to store exactly.</div>
      )}
    </>
  );
}

/** The starting value for a new property or item, using the schema's default or first allowed value. */
function startingValue(kind: ValueKind, known?: { hasDefault: boolean; defaultValue?: JsonValue; enumFirst?: JsonValue }): JsonValue {
  if (known?.hasDefault && kindOfValue(known.defaultValue!) === kind) return known.defaultValue!;
  if (known?.enumFirst !== undefined && kindOfValue(known.enumFirst) === kind) return known.enumFirst;
  return defaultValue(kind);
}

function AddChildForm({ path, kind, existingKeys, hint }: { path: Path; kind: "object" | "array"; existingKeys: string[]; hint: SchemaHint | null }) {
  const suggestions = (hint?.properties ?? []).filter((p) => !existingKeys.includes(p.name));
  const missingRequired = suggestions.filter((p) => p.required);
  const firstItemKind = hint?.itemKinds[0];
  const [key, setKey] = useState("");
  const [childKind, setChildKind] = useState<ValueKind>(kind === "array" && firstItemKind ? firstItemKind : "string");
  const known = suggestions.find((p) => p.name === key);

  const error = kind === "object" && key !== "" && existingKeys.includes(key) ? `There is already a key named "${key}"` : null;
  const unknownKey = kind === "object" && key !== "" && !known && !error && hint && !hint.allowsOtherProperties;
  const canAdd = kind === "array" || (key !== "" && !error);

  const chooseKey = (name: string) => {
    setKey(name);
    const property = suggestions.find((p) => p.name === name);
    if (property?.kinds[0]) setChildKind(property.kinds[0]);
  };
  const addProperty = (property: PropertyHint, kindToUse: ValueKind) =>
    actions.addChildValue(path, startingValue(kindToUse, property), property.name);
  const add = () => {
    if (!canAdd) return;
    const ok = known
      ? addProperty(known, childKind)
      : actions.addChildValue(path, startingValue(childKind), kind === "object" ? key : undefined);
    if (ok) setKey("");
  };

  return (
    <>
      {missingRequired.length > 0 && (
        <div className="required-missing">
          <span className="field-error">Required but missing:</span>
          {missingRequired.map((p) => (
            <button type="button" key={p.name} title={p.description} onClick={() => addProperty(p, p.kinds[0] ?? "string")}>
              + {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="add-row">
        {kind === "object" && (
          <>
            <input
              placeholder={suggestions.length > 0 ? "Key name (or pick a suggestion)" : "New key name"}
              className={error ? "invalid" : ""}
              value={key}
              list={`suggest-${pathKey(path)}`}
              spellCheck={false}
              onChange={(e) => chooseKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              aria-label="New key name"
            />
            <datalist id={`suggest-${pathKey(path)}`}>
              {suggestions.map((p) => (
                <option key={p.name} value={p.name} label={`${p.required ? "Required. " : ""}${p.deprecated ? "Deprecated. " : ""}${p.description ?? ""}`.slice(0, 120)} />
              ))}
            </datalist>
          </>
        )}
        <select value={childKind} onChange={(e) => setChildKind(e.target.value as ValueKind)} aria-label="New value type">
          {VALUE_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindName(k)}{(known?.kinds ?? (kind === "array" ? hint?.itemKinds : []) ?? []).includes(k) ? " (expected)" : ""}
            </option>
          ))}
        </select>
        <button type="button" className="primary" disabled={!canAdd} onClick={add}>Add</button>
      </div>
      {error && <div className="field-error">{error}</div>}
      {known?.description && <div className="field-hint">{known.description}</div>}
      {unknownKey && <div className="field-warning">The schema doesn't list "{key}" here, so it will be reported as a problem.</div>}
    </>
  );
}
