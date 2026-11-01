// The logic behind the table view: which lists can be shown as a table, their columns,
// sorting for display, and where a newly filled-in cell's key goes. No React, so it's testable.
import type { Node } from "jsonc-parser";
import { childrenOf, findNode, kindOf, sourceOf, type JsonDocument, type Path, type ValueKind } from "../engine";

export interface Column {
  key: string;
  /** How many rows have this key. */
  count: number;
  /** The most common kind of value in this column (used for new cells). */
  kind: ValueKind;
}

export interface TableRow {
  /** Position in the list (in the file). */
  index: number;
  path: Path;
  /** The row's keys in file order. */
  keys: string[];
  cells: Map<string, Node>;
}

export interface TableModel {
  path: Path;
  columns: Column[];
  rows: TableRow[];
}

/** A list can be shown as a table if it has items and every item is an object. */
export function isTableArray(node: Node | undefined): boolean {
  return !!node && node.type === "array" && (node.children?.length ?? 0) > 0 && node.children!.every((c) => c.type === "object");
}

/** The nearest list (at or above `path`) that can be shown as a table, or null. */
export function tableTarget(doc: JsonDocument, path: Path): Path | null {
  for (let p = path; ; p = p.slice(0, -1)) {
    if (isTableArray(findNode(doc, p))) return p;
    if (p.length === 0) return null;
  }
}

/** Builds the table. `extraColumns` are columns the user added that no row has yet. */
export function buildTable(doc: JsonDocument, path: Path, extraColumns: string[] = []): TableModel | null {
  const array = findNode(doc, path);
  if (!isTableArray(array)) return null;
  const order: string[] = [];
  const stats = new Map<string, Map<ValueKind, number>>();
  const rows = childrenOf(array!).map(({ node }, index) => {
    const cells = new Map<string, Node>();
    const keys: string[] = [];
    for (const { key, node: value } of childrenOf(node)) {
      const k = key as string;
      if (cells.has(k)) continue; // a duplicate key: the Problems panel reports it
      cells.set(k, value);
      keys.push(k);
      if (!stats.has(k)) {
        stats.set(k, new Map());
        order.push(k);
      }
      const kinds = stats.get(k)!;
      kinds.set(kindOf(value), (kinds.get(kindOf(value)) ?? 0) + 1);
    }
    return { index, path: [...path, index], keys, cells };
  });
  for (const extra of extraColumns) {
    if (!stats.has(extra)) {
      stats.set(extra, new Map());
      order.push(extra);
    }
  }
  const columns = order.map((key) => {
    const kinds = [...stats.get(key)!.entries()].sort((a, b) => b[1] - a[1]);
    return { key, count: kinds.reduce((n, [, c]) => n + c, 0), kind: kinds[0]?.[0] ?? "string" };
  });
  return { path, columns, rows };
}

/** Row indexes in display order when sorted by `key`. Missing values always go last. */
export function sortedOrder(doc: JsonDocument, model: TableModel, key: string, direction: "asc" | "desc"): number[] {
  const sign = direction === "asc" ? 1 : -1;
  const sortValue = (row: TableRow): number | string | null => {
    const node = row.cells.get(key);
    if (!node) return null;
    if (node.type === "number" || node.type === "boolean") return Number(node.value);
    if (node.type === "string") return node.value as string;
    return sourceOf(doc, node);
  };
  return model.rows
    .map((row) => ({ index: row.index, value: sortValue(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1;
      if (typeof a.value === "number" && typeof b.value === "number") return sign * (a.value - b.value) || a.index - b.index;
      return sign * String(a.value).localeCompare(String(b.value), undefined, { numeric: true }) || a.index - b.index;
    })
    .map((r) => r.index);
}

/**
 * Where a new key should go among a row's existing keys so the row follows the column order:
 * just before the first existing key that comes after it in the table.
 */
export function insertionIndexFor(model: TableModel, row: TableRow, key: string): number {
  const column = model.columns.findIndex((c) => c.key === key);
  const later = new Set(model.columns.slice(column + 1).map((c) => c.key));
  const at = row.keys.findIndex((k) => later.has(k));
  return at === -1 ? row.keys.length : at;
}

/**
 * The moves (from, to) that rearrange a list into `order` (a list of original indexes),
 * applied one after another.
 */
export function movesFor(order: number[]): [number, number][] {
  const current = order.map((_, i) => i);
  const moves: [number, number][] = [];
  order.forEach((wanted, target) => {
    const from = current.indexOf(wanted);
    if (from !== target) {
      moves.push([from, target]);
      current.splice(target, 0, current.splice(from, 1)[0]);
    }
  });
  return moves;
}
