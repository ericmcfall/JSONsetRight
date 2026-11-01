// Structural comparison of two documents: what data differs, ignoring formatting, comments,
// key order and quote style. Lists are lined up by their matching items, so inserting one
// item shows as one addition rather than everything after it looking changed.
import type { Node } from "jsonc-parser";
import type { JsonDocument } from "./document";
import { childrenOf, kindOf, sourceOf, valueOf, type JsonValue, type Path } from "./nodes";

export type DiffKind =
  /** Present in both, with different values (or different types). */
  | "different"
  /** Only in the left document. */
  | "onlyLeft"
  /** Only in the right document. */
  | "onlyRight";

export interface DiffEntry {
  kind: DiffKind;
  /** Where it is in the left document. For "onlyRight": where it would go if copied over. */
  leftPath: Path;
  /** Where it is in the right document. For "onlyLeft": where it would go if copied over. */
  rightPath: Path;
  left?: Node;
  right?: Node;
}

export function diffDocuments(left: JsonDocument, right: JsonDocument): DiffEntry[] {
  const out: DiffEntry[] = [];
  compare(left, right, left.root, right.root, [], [], out);
  return out;
}

function compare(ld: JsonDocument, rd: JsonDocument, l: Node, r: Node, lp: Path, rp: Path, out: DiffEntry[]): void {
  const lk = kindOf(l);
  const rk = kindOf(r);
  if (lk !== rk) {
    out.push({ kind: "different", leftPath: lp, rightPath: rp, left: l, right: r });
    return;
  }
  if (lk === "object") {
    const rightChildren = new Map(childrenOf(r).map((c) => [c.key as string, c.node]));
    const leftKeys = new Set<string>();
    for (const { key, node } of childrenOf(l)) {
      const k = key as string;
      leftKeys.add(k);
      const other = rightChildren.get(k);
      if (other) compare(ld, rd, node, other, [...lp, k], [...rp, k], out);
      else out.push({ kind: "onlyLeft", leftPath: [...lp, k], rightPath: [...rp, k], left: node });
    }
    for (const { key, node } of childrenOf(r)) {
      if (!leftKeys.has(key as string)) out.push({ kind: "onlyRight", leftPath: [...lp, key], rightPath: [...rp, key], right: node });
    }
    return;
  }
  if (lk === "array") {
    compareLists(ld, rd, l.children ?? [], r.children ?? [], lp, rp, out);
    return;
  }
  if (!sameScalar(ld, rd, l, r)) out.push({ kind: "different", leftPath: lp, rightPath: rp, left: l, right: r });
}

function sameScalar(ld: JsonDocument, rd: JsonDocument, l: Node, r: Node): boolean {
  if (l.type === "number") {
    // 1.0 and 1 are the same number; very large integers are compared exactly as written.
    const ls = sourceOf(ld, l);
    const rs = sourceOf(rd, r);
    return ls === rs || (Number.isSafeInteger(l.value) && l.value === r.value) || (!Number.isInteger(l.value) && l.value === r.value);
  }
  return l.value === r.value;
}

function compareLists(ld: JsonDocument, rd: JsonDocument, ls: Node[], rs: Node[], lp: Path, rp: Path, out: DiffEntry[]): void {
  const lkeys = ls.map((n) => canonicalNode(ld, n));
  const rkeys = rs.map((n) => canonicalNode(rd, n));
  const matches = longestCommonSubsequence(lkeys, rkeys);

  let li = 0;
  let ri = 0;
  for (const [mi, mj] of [...matches, [ls.length, rs.length]]) {
    // Between two matching items: pair up the rest in order, then report extras.
    const pairs = Math.min(mi - li, mj - ri);
    for (let k = 0; k < pairs; k++) compare(ld, rd, ls[li + k], rs[ri + k], [...lp, li + k], [...rp, ri + k], out);
    for (let k = li + pairs; k < mi; k++) out.push({ kind: "onlyLeft", leftPath: [...lp, k], rightPath: [...rp, ri + pairs], left: ls[k] });
    for (let k = ri + pairs; k < mj; k++) out.push({ kind: "onlyRight", leftPath: [...lp, li + pairs], rightPath: [...rp, k], right: rs[k] });
    li = mi + 1;
    ri = mj + 1;
  }
}

/** Index pairs of the longest run of equal items, in order. Lists in config files are small. */
function longestCommonSubsequence(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * Like canonical(), but from the syntax tree, so integers too big for JavaScript numbers are
 * compared exactly as written.
 */
function canonicalNode(doc: JsonDocument, node: Node): string {
  if (node.type === "number") {
    const n = node.value as number;
    return Number.isInteger(n) && !Number.isSafeInteger(n) ? sourceOf(doc, node) : JSON.stringify(n);
  }
  if (node.type === "array") return `[${(node.children ?? []).map((c) => canonicalNode(doc, c)).join(",")}]`;
  if (node.type === "object") {
    return `{${childrenOf(node)
      .map((c) => [c.key as string, c.node] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalNode(doc, v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(valueOf(node));
}

/** JSON text with object keys sorted, so key order doesn't make values look different. */
export function canonical(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}
