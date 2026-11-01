// Turns a document into the flat list of rows the tree view draws, honoring which nodes are
// expanded and the search filter. Pure logic (no React), so it can be unit-tested.
import type { Node } from "jsonc-parser";
import { childrenOf, kindOf, sourceOf, type JsonDocument, type Path, type ValueKind } from "../engine";

export interface Row {
  path: Path;
  /** Property name, array index, or null for the root. */
  key: string | number | null;
  depth: number;
  kind: ValueKind;
  childCount: number;
  expanded: boolean;
  /** Short text shown after the key, e.g. "localhost", 42, {3}, [5]. */
  preview: string;
  /** Position within the parent (for moving); -1 for the root. */
  index: number;
  /** True if this row itself matches the search. */
  match: boolean;
}

export const pathKey = (path: Path): string => JSON.stringify(path);

export function buildRows(doc: JsonDocument, expanded: Set<string>, query: string): Row[] {
  const rows: Row[] = [];
  const q = query.trim().toLowerCase();

  // Returns true if this node or something inside it matches the search.
  const visit = (node: Node, path: Path, key: string | number | null, depth: number, index: number): boolean => {
    const kind = kindOf(node);
    const children = childrenOf(node);
    const preview = previewOf(doc, node, kind, children.length);
    const match = q !== "" && (String(key ?? "").toLowerCase().includes(q) || (children.length === 0 && kind !== "object" && kind !== "array" && preview.toLowerCase().includes(q)));
    const row: Row = { path, key, depth, kind, childCount: children.length, expanded: false, preview, index, match };
    const rowIndex = rows.length;
    rows.push(row);

    let descendantMatches = false;
    const open = q !== "" || expanded.has(pathKey(path));
    if (children.length > 0 && open) {
      children.forEach((child, i) => {
        if (visit(child.node, [...path, child.key], child.key, depth + 1, i)) descendantMatches = true;
      });
    }

    if (q !== "") {
      // While searching, show only matches and the rows leading to them.
      if (!match && !descendantMatches) {
        rows.length = rowIndex;
        return false;
      }
      row.expanded = descendantMatches;
      if (!descendantMatches) rows.length = rowIndex + 1;
      return true;
    }
    row.expanded = open && children.length > 0;
    return false;
  };

  visit(doc.root, [], null, 0, -1);
  return rows;
}

function previewOf(doc: JsonDocument, node: Node, kind: ValueKind, count: number): string {
  switch (kind) {
    case "object": return `{${count}}`;
    case "array": return `[${count}]`;
    case "string": {
      const s = node.value as string;
      return s.length > 120 ? `${s.slice(0, 120)}…` : s;
    }
    default: return sourceOf(doc, node);
  }
}
