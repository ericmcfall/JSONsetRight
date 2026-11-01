// The collapsible tree of the document. Click to select, double-click to edit in place,
// drag to reorder, right-click for more actions. All changes go through ui/actions.ts.
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { commentsFor, findNode, samePath, type Path } from "../engine";
import { useEditor, type Tab } from "../store/editor";
import { useTabSchema } from "../store/schemas";
import { allProblems, problemsByPath } from "./problems";
import * as actions from "./actions";
import { ContextMenu, type MenuPosition } from "./ContextMenu";
import { InlineEditor } from "./InlineEditor";
import { KindBadge } from "./KindBadge";
import { buildRows, pathKey, type Row } from "./tree-model";

interface Props {
  tab: Tab;
  query: string;
}

type Editing = { path: Path; part: "key" | "value" } | null;
type Drop = { parent: string; from: number } | null;

export function TreeView({ tab, query }: Props) {
  const doc = tab.history.present;
  const select = useEditor((s) => s.select);
  const setExpanded = useEditor((s) => s.setExpanded);
  const selected = actions.existingPath(doc, tab.selectedPath);

  const rows = useMemo(() => buildRows(doc, tab.expanded, query), [doc, tab.expanded, query]);
  const selectedIndex = rows.findIndex((r) => samePath(r.path, selected));

  // Problem markers: on the row itself, and a dot on collapsed rows that hide problems inside.
  const schema = useTabSchema(tab.id);
  const { byPath, hidden } = useMemo(() => {
    const problems = allProblems(tab.id, doc);
    const inside = new Set<string>();
    for (const p of problems) for (let i = 0; i < p.path.length; i++) inside.add(pathKey(p.path.slice(0, i)));
    return { byPath: problemsByPath(problems), hidden: inside };
  }, [tab.id, doc, schema.compiled]); // schema.compiled: results change when the schema loads

  const [editing, setEditing] = useState<Editing>(null);
  const [menu, setMenu] = useState<{ position: MenuPosition; path: Path } | null>(null);
  const [drag, setDrag] = useState<Drop>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; after: boolean } | null>(null);
  const container = useRef<HTMLDivElement>(null);

  // Keep the selected row on screen.
  useEffect(() => {
    container.current?.querySelector(".tree-row.selected")?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const focusTree = () => container.current?.focus();
  // The row preview is shortened for display; editing needs the whole string.
  const fullString = (row: Row) => findNode(doc, row.path)?.value as string;

  const startEdit = (row: Row, part: "key" | "value") => {
    if (part === "key" && typeof row.key !== "string") return; // only object keys can be renamed
    if (part === "value" && row.kind === "boolean") {
      actions.setScalar(row.path, row.preview !== "true");
      return;
    }
    if (part === "value" && (row.kind === "object" || row.kind === "array" || row.kind === "null")) return;
    // Multi-line text is edited in the details panel, since a one-line box would drop the line breaks.
    if (part === "value" && row.kind === "string" && fullString(row).includes("\n")) {
      document.getElementById("value-editor")?.focus();
      return;
    }
    setEditing({ path: row.path, part });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (editing) return;
    // Read the selection from the store, not this render, so fast click-then-key works.
    const latest = useEditor.getState().tabs.find((t) => t.id === tab.id)?.selectedPath ?? selected;
    const selectedIndex = rows.findIndex((r) => samePath(r.path, actions.existingPath(doc, latest)));
    const row = rows[selectedIndex];
    if (!row) return;
    const handled = () => e.preventDefault();
    if (e.altKey && e.key === "ArrowUp") { handled(); actions.moveBy(row.path, -1); }
    else if (e.altKey && e.key === "ArrowDown") { handled(); actions.moveBy(row.path, 1); }
    else if (e.key === "ArrowUp") { handled(); if (selectedIndex > 0) select(rows[selectedIndex - 1].path); }
    else if (e.key === "ArrowDown") { handled(); if (selectedIndex < rows.length - 1) select(rows[selectedIndex + 1].path); }
    else if (e.key === "ArrowRight") {
      handled();
      if (row.childCount > 0 && !row.expanded) setExpanded(row.path, true);
      else if (row.expanded) select(rows[selectedIndex + 1].path);
    } else if (e.key === "ArrowLeft") {
      handled();
      if (row.expanded) setExpanded(row.path, false);
      else if (row.path.length > 0) select(row.path.slice(0, -1));
    } else if (e.key === "F2") { handled(); startEdit(row, "key"); }
    else if (e.key === "Enter") { handled(); startEdit(row, "value"); }
    else if (e.key === "Delete") { handled(); actions.remove(row.path); }
    else if (e.ctrlKey && e.key.toLowerCase() === "d") { handled(); actions.duplicate(row.path); }
    else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      handled();
      const el = container.current?.querySelector(".tree-row.selected")?.getBoundingClientRect();
      setMenu({ position: { x: (el?.left ?? 0) + 40, y: el?.bottom ?? 0 }, path: row.path });
    }
  };

  // ---- drag and drop: only between siblings (same parent), which is what reordering means
  const parentKeyOf = (row: Row) => pathKey(row.path.slice(0, -1));
  const onDragStart = (e: DragEvent, row: Row) => {
    if (row.index < 0 || query) return e.preventDefault();
    e.dataTransfer.effectAllowed = "move";
    setDrag({ parent: parentKeyOf(row), from: row.index });
  };
  const onDragOver = (e: DragEvent, row: Row) => {
    if (!drag || row.index < 0 || parentKeyOf(row) !== drag.parent) return;
    e.preventDefault();
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropTarget({ key: pathKey(row.path), after: e.clientY > box.top + box.height / 2 });
  };
  const onDrop = (e: DragEvent, row: Row) => {
    e.preventDefault();
    if (drag && dropTarget && parentKeyOf(row) === drag.parent) {
      const insertAt = dropTarget.after ? row.index + 1 : row.index;
      const to = insertAt > drag.from ? insertAt - 1 : insertAt;
      if (to !== drag.from) actions.moveTo(row.path.slice(0, -1), drag.from, to);
    }
    endDrag();
  };
  const endDrag = () => {
    setDrag(null);
    setDropTarget(null);
  };

  return (
    <div className="tree" role="tree" tabIndex={0} ref={container} onKeyDown={onKeyDown} aria-label="Document tree">
      {rows.length === 1 && query && <div className="tree-empty">No matches for “{query}”</div>}
      {rows.map((row) => {
        const key = pathKey(row.path);
        const isSelected = samePath(row.path, selected);
        const isEditing = editing && samePath(editing.path, row.path) ? editing.part : null;
        const comments = commentsFor(doc, row.path);
        const dropClass = dropTarget?.key === key ? (dropTarget.after ? " drop-after" : " drop-before") : "";
        return (
          <div
            key={key}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={row.childCount > 0 ? row.expanded : undefined}
            className={`tree-row${isSelected ? " selected" : ""}${row.match ? " match" : ""}${dropClass}`}
            style={{ paddingLeft: 6 + row.depth * 18 }}
            onClick={() => select(row.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              select(row.path);
              setMenu({ position: { x: e.clientX, y: e.clientY }, path: row.path });
            }}
            draggable={!isEditing && row.index >= 0}
            onDragStart={(e) => onDragStart(e, row)}
            onDragOver={(e) => onDragOver(e, row)}
            onDrop={(e) => onDrop(e, row)}
            onDragEnd={endDrag}
          >
            <span
              className="chevron"
              onClick={(e) => {
                e.stopPropagation();
                if (row.childCount > 0) setExpanded(row.path, !row.expanded);
              }}
            >
              {row.childCount > 0 ? (row.expanded ? "▾" : "▸") : ""}
            </span>
            <KindBadge kind={row.kind} />
            {isEditing === "key" ? (
              <InlineEditor
                dialect={doc.dialect}
                kind="key"
                initial={String(row.key)}
                onCommit={(text) => actions.rename(row.path, text)}
                onDone={() => { setEditing(null); focusTree(); }}
              />
            ) : (
              <span className={`key${row.key === null ? " root" : ""}`} onDoubleClick={() => startEdit(row, "key")}>
                {row.key === null ? tab.title : typeof row.key === "number" ? `[${row.key}]` : row.key}
              </span>
            )}
            {isEditing === "value" ? (
              <InlineEditor
                dialect={doc.dialect}
                kind={row.kind === "number" ? "number" : "string"}
                initial={row.kind === "string" ? fullString(row) : row.preview}
                onCommit={(text) => (row.kind === "number" ? actions.setNumber(row.path, text) : actions.setScalar(row.path, text))}
                onDone={() => { setEditing(null); focusTree(); }}
              />
            ) : (
              <span className={`value kind-${row.kind}`} onDoubleClick={() => startEdit(row, "value")}>
                {row.kind === "string" ? `"${row.preview}"` : row.preview}
              </span>
            )}
            {byPath.has(key) && (
              <span
                className={`problem-flag ${byPath.get(key)!.some((p) => p.severity === "error") ? "error" : "warning"}`}
                title={byPath.get(key)!.map((p) => p.message).join("\n")}
              >
                {byPath.get(key)!.some((p) => p.severity === "error") ? "⛔" : "⚠"}
              </span>
            )}
            {!byPath.has(key) && !row.expanded && hidden.has(key) && (
              <span className="problem-flag warning" title="Something inside has a problem">●</span>
            )}
            {comments.length > 0 && (
              <span className="comment-flag" title={comments.join("\n")}>
                // {comments[0].split("\n")[0]}
              </span>
            )}
          </div>
        );
      })}
      {menu && (
        <ContextMenu
          position={menu.position}
          path={menu.path}
          onClose={() => { setMenu(null); focusTree(); }}
          onRename={() => {
            const row = rows.find((r) => samePath(r.path, menu.path));
            if (row) startEdit(row, "key");
          }}
        />
      )}
    </div>
  );
}
