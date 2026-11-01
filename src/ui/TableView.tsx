// Table view: a list of objects shown as a grid (one row per item, one column per key).
// Every change goes through the same engine edits as the tree, so it's safe and undoable.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Node } from "jsonc-parser";
import {
  addProperty,
  defaultValue,
  formatPath,
  isValidNumber,
  kindOf,
  moveChild,
  removeValue,
  renameKey,
  setNumberText,
  setValue,
  sourceOf,
  valueOf,
  type JsonValue,
  type Path,
} from "../engine";
import { hintsAt, type SchemaHint } from "../engine/schema";
import { useEditor, type Tab } from "../store/editor";
import { useTabSchema } from "../store/schemas";
import * as actions from "./actions";
import { confirmDialog } from "./dialog";
import { KindBadge } from "./KindBadge";
import { allProblems, problemsByPath } from "./problems";
import { buildTable, insertionIndexFor, movesFor, sortedOrder, type Column, type TableModel, type TableRow } from "./table-model";
import { pathKey } from "./tree-model";

type Sort = { key: string; direction: "asc" | "desc" } | null;
type Cell = { row: number; col: number }; // positions on screen

export function TableView({ tab }: { tab: Tab }) {
  const path = tab.tablePath ?? [];
  // Start fresh (no added columns, sort or selection) whenever a different list is shown.
  return <Table key={`${tab.id}:${pathKey(path)}`} tab={tab} path={path} />;
}

function Table({ tab, path }: { tab: Tab; path: Path }) {
  const doc = tab.history.present;
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const [active, setActive] = useState<Cell | null>(null);
  const [editing, setEditing] = useState(false);
  const [newColumn, setNewColumn] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const schema = useTabSchema(tab.id);

  const model = useMemo(() => buildTable(doc, path, extraColumns), [doc, path, extraColumns]);
  const problems = useMemo(() => problemsByPath(allProblems(tab.id, doc)), [tab.id, doc, schema.compiled]); // schema.compiled: results change when it loads
  const hints = useMemo(() => {
    const map = new Map<string, SchemaHint | null>();
    if (schema.compiled && model) for (const c of model.columns) map.set(c.key, hintsAt(schema.compiled, [...path, 0, c.key]));
    return map;
  }, [schema.compiled, model, path]);

  if (!model) {
    return (
      <div className="table-missing">
        <p>This is no longer a list of objects, so it can't be shown as a table.</p>
        <button type="button" onClick={() => useEditor.getState().setView("tree")}>Back to tree</button>
      </div>
    );
  }

  const order = sort ? sortedOrder(doc, model, sort.key, sort.direction) : model.rows.map((r) => r.index);
  const rows = order.map((i) => model.rows[i]);
  const columns = model.columns;
  const activeRow = active ? rows[active.row] : undefined;
  const activeColumn = active ? columns[active.col] : undefined;

  const activate = (cell: Cell) => {
    setActive(cell);
    setEditing(false);
    const row = rows[cell.row];
    const key = columns[cell.col]?.key;
    if (row) useEditor.getState().select(key && row.cells.has(key) ? [...row.path, key] : row.path);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (editing || !active || !activeRow || !activeColumn) return;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      activate({ row: Math.max(0, Math.min(rows.length - 1, active.row + dr)), col: Math.max(0, Math.min(columns.length - 1, active.col + dc)) });
    };
    if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowLeft") move(0, -1);
    else if (e.key === "ArrowRight" || e.key === "Tab") move(0, 1);
    else if (e.key === "Enter" || e.key === "F2" || (e.key === " " && activeRow.cells.get(activeColumn.key)?.type === "boolean")) {
      e.preventDefault();
      startEdit(active);
    } else if (e.key === "Delete" && activeRow.cells.has(activeColumn.key)) {
      e.preventDefault();
      actions.remove([...activeRow.path, activeColumn.key]);
    }
  };

  /** Begins editing a cell. True/false, object, list and null cells act directly instead. */
  const startEdit = (cell: Cell) => {
    const row = rows[cell.row];
    const column = columns[cell.col];
    if (!row || !column) return;
    const node = row.cells.get(column.key);
    const hint = hints.get(column.key);
    const hasChoices = (hint?.enumValues ?? []).some((v) => v === null || typeof v !== "object");
    const kind = node ? kindOf(node) : hint?.kinds[0] ?? column.kind;
    const cellPath = [...row.path, column.key];
    if (hasChoices || kind === "string" || kind === "number") {
      setEditing(true);
    } else if (!node) {
      // Fill in an empty cell with a starting value of the column's type.
      useEditor.getState().apply((d) => addProperty(d, row.path, column.key, defaultValue(kind), insertionIndexFor(model, row, column.key)));
    } else if (kind === "boolean") {
      actions.setScalar(cellPath, node.value !== true);
    } else if (kind === "object" || kind === "array") {
      useEditor.getState().select(cellPath);
      useEditor.getState().setView("tree");
    }
  };

  // ---- column actions
  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, direction: "asc" } : s.direction === "asc" ? { key, direction: "desc" } : null));

  const renameColumn = (from: string, to: string) => {
    setRenaming(null);
    if (!to || to === from) return;
    if (columns.some((c) => c.key === to)) {
      useEditor.getState().showMessage({ kind: "error", text: `There is already a column named "${to}".` });
      return;
    }
    setExtraColumns((x) => x.map((k) => (k === from ? to : k)));
    useEditor.getState().apply((d) => model.rows.reduce((acc, row) => (row.cells.has(from) ? renameKey(acc, row.path, from, to) : acc), d));
  };

  const deleteColumn = async (column: Column) => {
    if (column.count > 0) {
      const ok = await confirmDialog({
        title: `Remove "${column.key}" from every row?`,
        message: `It will be removed from ${column.count} row${column.count === 1 ? "" : "s"}. You can undo this with Ctrl+Z.`,
        confirmLabel: "Remove column",
        danger: true,
      });
      if (!ok) return;
      useEditor.getState().apply((d) => model.rows.reduce((acc, row) => (row.cells.has(column.key) ? removeValue(acc, [...row.path, column.key]) : acc), d));
    }
    setExtraColumns((x) => x.filter((k) => k !== column.key));
    setActive(null);
  };

  const addColumn = (key: string) => {
    setNewColumn(null);
    const name = key.trim();
    if (!name) return;
    if (columns.some((c) => c.key === name)) {
      useEditor.getState().showMessage({ kind: "error", text: `There is already a column named "${name}".` });
      return;
    }
    setExtraColumns((x) => [...x, name]);
  };

  // ---- row actions
  const addRow = () => {
    const item: Record<string, JsonValue> = {};
    for (const c of columns) {
      if (c.count === 0) continue;
      const hint = hints.get(c.key);
      item[c.key] = hint?.hasDefault ? hint.defaultValue! : defaultValue(c.kind);
    }
    if (actions.addChildValue(path, item)) {
      setSort(null);
      setActive({ row: model.rows.length, col: 0 });
      setTimeout(() => grid.current?.focus());
    }
  };

  const saveOrder = () => {
    useEditor.getState().apply((d) => movesFor(order).reduce((acc, [from, to]) => moveChild(acc, path, from, to), d));
    setSort(null);
  };

  return (
    <div className="table-view">
      <div className="table-header">
        <button type="button" onClick={() => useEditor.getState().setView("tree")}>‹ Tree</button>
        <code>{path.length ? formatPath(path) : "(root)"}</code>
        <span className="muted">{rows.length} rows · {columns.length} columns</span>
        <span className="toolbar-spacer" />
        <button type="button" onClick={addRow}>+ Add row</button>
        <button type="button" onClick={() => setNewColumn("")}>+ Add column</button>
      </div>
      {sort && (
        <div className="message info">
          <span>Sorted by “{sort.key}” on screen only. The file's order hasn't changed.</span>
          <button type="button" onClick={saveOrder}>Save this order to the file</button>
          <button type="button" className="link" onClick={() => setSort(null)}>Unsort</button>
        </div>
      )}
      <div className="table-grid" ref={grid} tabIndex={0} onKeyDown={onKeyDown} role="grid" aria-label="Table">
        <table>
          <thead>
            <tr>
              <th className="row-head">#</th>
              {columns.map((c) => {
                const hint = hints.get(c.key);
                return (
                  <th key={c.key} title={`${hint?.description ? `${hint.description}\n\n` : ""}In ${c.count} of ${rows.length} rows. Click to sort, double-click to rename.`}>
                    {renaming === c.key ? (
                      <ColumnNameInput initial={c.key} onDone={(name) => renameColumn(c.key, name)} />
                    ) : (
                      <span className="col-head">
                        <button type="button" className="col-name" onClick={() => toggleSort(c.key)} onDoubleClick={() => setRenaming(c.key)}>
                          {c.key}
                          {sort?.key === c.key && (sort.direction === "asc" ? " ▲" : " ▼")}
                        </button>
                        {c.count > 0 && <KindBadge kind={c.kind} />}
                        <button type="button" className="col-delete" aria-label={`Remove column ${c.key}`} title="Remove this column" onClick={() => deleteColumn(c)}>×</button>
                      </span>
                    )}
                  </th>
                );
              })}
              {newColumn !== null && (
                <th>
                  <ColumnNameInput initial="" onDone={addColumn} />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const rowProblems = problems.get(pathKey(row.path));
              return (
                <tr key={row.index}>
                  <th className="row-head">
                    <span className="row-number" title={rowProblems?.map((p) => p.message).join("\n")}>
                      {rowProblems ? "⛔ " : ""}{row.index + 1}
                    </span>
                    <span className="row-actions">
                      <button type="button" title="Move up" disabled={!!sort || row.index === 0} onClick={() => actions.moveBy(row.path, -1)}>↑</button>
                      <button type="button" title="Move down" disabled={!!sort || row.index === model.rows.length - 1} onClick={() => actions.moveBy(row.path, 1)}>↓</button>
                      <button type="button" title="Duplicate row" onClick={() => actions.duplicate(row.path)}>⧉</button>
                      <button type="button" title="Delete row" className="danger" onClick={() => actions.remove(row.path)}>×</button>
                    </span>
                  </th>
                  {columns.map((c, col) => {
                    const isActive = active?.row === r && active.col === col;
                    const node = row.cells.get(c.key);
                    const cellProblems = problems.get(pathKey([...row.path, c.key]));
                    return (
                      <td
                        key={c.key}
                        className={`${isActive ? "active" : ""}${cellProblems ? " has-problem" : ""}${node ? "" : " missing"}`}
                        title={cellProblems?.map((p) => p.message).join("\n")}
                        onClick={() => activate({ row: r, col })}
                        onDoubleClick={() => {
                          activate({ row: r, col });
                          startEdit({ row: r, col });
                        }}
                      >
                        {isActive && editing ? (
                          <CellEditor
                            model={model}
                            row={row}
                            column={c}
                            node={node}
                            hint={hints.get(c.key) ?? null}
                            onDone={() => {
                              setEditing(false);
                              grid.current?.focus();
                            }}
                          />
                        ) : (
                          <CellValue node={node} row={row} column={c} />
                        )}
                      </td>
                    );
                  })}
                  {newColumn !== null && <td className="missing" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer muted">
        Click a cell to select it; double-click, Enter or F2 to edit. Empty cells mean the row doesn't have
        that key yet. Fill one in to add it.
      </div>
    </div>
  );
}

/** How a cell looks when it isn't being edited. */
function CellValue({ node, row, column }: { node: Node | undefined; row: TableRow; column: Column }) {
  const doc = useEditor((s) => s.tabs.find((t) => t.id === s.activeId)!.history.present);
  if (!node) return null;
  const kind = kindOf(node);
  if (kind === "boolean") {
    return (
      <input
        type="checkbox"
        checked={node.value === true}
        aria-label={`${column.key} of row ${row.index + 1}`}
        onChange={(e) => actions.setScalar([...row.path, column.key], e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  if (kind === "object" || kind === "array") {
    const count = node.children?.length ?? 0;
    return (
      <button
        type="button"
        className="link"
        title="Open in the tree"
        onClick={(e) => {
          e.stopPropagation();
          const store = useEditor.getState();
          store.select([...row.path, column.key]);
          store.setView("tree");
        }}
      >
        {kind === "object" ? `{${count}}` : `[${count}]`} ›
      </button>
    );
  }
  if (kind === "null") return <span className="kind-null">null</span>;
  if (kind === "number") return <span className="kind-number">{sourceOf(doc, node)}</span>;
  return <span className="kind-string">{node.value as string}</span>;
}

/** Editing a cell: a text/number box or a dropdown of allowed values. Enter saves, Escape cancels. */
function CellEditor(props: { model: TableModel; row: TableRow; column: Column; node: Node | undefined; hint: SchemaHint | null; onDone(): void }) {
  const { model, row, column, node, hint, onDone } = props;
  const doc = useEditor((s) => s.tabs.find((t) => t.id === s.activeId)!.history.present);
  const cellPath = [...row.path, column.key];
  const kind = node ? kindOf(node) : hint?.kinds[0] ?? column.kind;
  const initial = !node ? "" : kind === "string" ? (node.value as string) : sourceOf(doc, node);
  const [text, setText] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);

  const apply = useEditor((s) => s.apply);
  const index = insertionIndexFor(model, row, column.key);
  // Enter saves and then focus leaves the box; make sure that only counts once.
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  /** Sets the cell, adding the key to the row first if the row doesn't have it yet. */
  const save = (value: JsonValue, numberText?: string) => {
    if (finished.current) return;
    const ok = apply((d) => {
      let next = node ? d : addProperty(d, row.path, column.key, numberText !== undefined ? 0 : value, index);
      if (numberText !== undefined) next = setNumberText(next, cellPath, numberText);
      else if (node) next = setValue(next, cellPath, value);
      return next;
    });
    if (ok) finish();
  };

  // Allowed values from the schema: a dropdown.
  const choices = hint?.enumValues?.filter((v) => v === null || typeof v !== "object");
  if (choices && choices.length > 0) {
    const current = node ? JSON.stringify(valueOf(node)) : "";
    return (
      <select autoFocus defaultValue={current} onBlur={finish} onKeyDown={(e) => e.key === "Escape" && finish()}
        onChange={(e) => save(JSON.parse(e.target.value) as JsonValue)} aria-label={column.key}>
        {!node && <option value="">(choose)</option>}
        {choices.map((v) => <option key={JSON.stringify(v)} value={JSON.stringify(v)}>{typeof v === "string" ? v : JSON.stringify(v)}</option>)}
      </select>
    );
  }

  const invalid = kind === "number" && !isValidNumber(text, doc.dialect);
  const commit = () => {
    if (invalid) return;
    if (text === initial && node) return finish();
    if (kind === "number") save(0, text.trim());
    else save(text);
  };
  return (
    <input
      ref={input}
      autoFocus
      className={`cell-input${invalid ? " invalid" : ""}`}
      value={text}
      title={invalid ? "Not a valid number" : undefined}
      inputMode={kind === "number" ? "decimal" : undefined}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => (invalid ? finish() : commit())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") finish();
      }}
      aria-label={column.key}
    />
  );
}

function ColumnNameInput({ initial, onDone }: { initial: string; onDone(name: string): void }) {
  const [text, setText] = useState(initial);
  const done = useRef(false);
  const finish = (name: string) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      autoFocus
      className="cell-input"
      placeholder="Column name"
      value={text}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(text)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(text);
        if (e.key === "Escape") finish(initial);
      }}
    />
  );
}
