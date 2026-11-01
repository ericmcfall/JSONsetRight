// Format-preserving insert/remove/replace for JSON5 text. (jsonc-parser's modify() can't read
// JSON5, so JSON5 documents use this instead.) Edits touch only the text they must:
// comments, quote styles and trailing commas elsewhere in the file are left alone.
import { findNodeAtLocation, type Node } from "jsonc-parser";
import { insertChildText, lineIndent, removeChildText, type TextLayout } from "../text-edits";
import { isIdentifier } from "./parse";

type Path = (string | number)[];
type Value = unknown;

export interface Json5EditOptions {
  /** Insert into an array at the path's index instead of replacing that item. */
  isArrayInsertion?: boolean;
  /** For new object keys: position among the existing keys. */
  getInsertionIndex?: (keys: string[]) => number;
}

export type Json5Layout = TextLayout;

/** Applies a set/insert/remove at `path` (value undefined = remove). Returns the new text. */
export function modifyJson5(text: string, root: Node, path: Path, value: Value, layout: Json5Layout, options: Json5EditOptions = {}): string {
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const container = parentPath.length === 0 ? root : findNodeAtLocation(root, parentPath);
  if (!container || (container.type !== "object" && container.type !== "array")) throw new Error("No container at path");
  const items = container.children ?? [];
  const style = detectStyle(text, root);
  const serialize = (v: Value, baseIndent: string) => toJson5(v, layout, baseIndent, style);

  if (container.type === "object") {
    const index = items.findIndex((p) => p.children![0].value === last);
    if (value === undefined) return index === -1 ? text : removeChildText(text, container, index);
    if (index !== -1) return replace(text, items[index].children![1], serialize(value, lineIndent(text, items[index].offset)));
    const keys = items.map((p) => p.children![0].value as string);
    const at = Math.max(0, Math.min(options.getInsertionIndex?.(keys) ?? keys.length, keys.length));
    return insertChildText(text, container, at, (indent) => `${keyText(text, container, String(last), style)}: ${serialize(value, indent)}`, layout);
  }

  const index = last as number;
  if (value === undefined) return index < items.length ? removeChildText(text, container, index) : text;
  if (!options.isArrayInsertion && index < items.length) {
    return replace(text, items[index], serialize(value, lineIndent(text, items[index].offset)));
  }
  return insertChildText(text, container, Math.min(index, items.length), (indent) => serialize(value, indent), layout);
}

function replace(text: string, node: Node, content: string): string {
  return text.slice(0, node.offset) + content + text.slice(node.offset + node.length);
}

/**
 * Writes a new key in the style the file already uses (unquoted, 'single' or "double"),
 * taken from this object or, if it's empty, the nearest enclosing object with keys.
 */
function keyText(text: string, object: Node, key: string, fileStyle: Json5Style): string {
  let holder: Node | undefined = object;
  while (holder && !(holder.type === "object" && holder.children?.length)) holder = holder.parent;
  const sample = holder?.children?.[0]?.children?.[0];
  const style = sample ? text[sample.offset] : fileStyle.key;
  if (style === '"' || style === "'") return quote(key, style);
  // Unquoted style: keys that can't be bare get the quotes the file uses for strings.
  return isIdentifier(key) ? key : quote(key, fileStyle.string);
}

/** A string literal using the given quote character. */
export function quote(value: string, quoteChar: '"' | "'"): string {
  const json = JSON.stringify(value);
  if (quoteChar === '"') return json;
  return `'${json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
}

/** How the file writes keys and strings, so new content looks like the rest of the file. */
interface Json5Style {
  /** "" = unquoted where possible. */
  key: "" | "'" | '"';
  string: "'" | '"';
}

/** Takes the style from the first key and the first string value in the file. */
function detectStyle(text: string, root: Node): Json5Style {
  let key: Json5Style["key"] | undefined;
  let str: Json5Style["string"] | undefined;
  const visit = (node: Node) => {
    if (key !== undefined && str !== undefined) return;
    if (node.type === "property") {
      const k = text[node.children![0].offset];
      key ??= k === "'" || k === '"' ? k : "";
      visit(node.children![1]);
    } else if (node.type === "string") {
      str ??= text[node.offset] === "'" ? "'" : '"';
    } else {
      node.children?.forEach(visit);
    }
  };
  visit(root);
  return { key: key ?? '"', string: str ?? (key === "'" ? "'" : '"') };
}

/** JSON5 text for a new value in the file's style; nested lines sit under `baseIndent`. */
function toJson5(value: Value, layout: Json5Layout, baseIndent: string, style: Json5Style): string {
  const pad = (depth: number) => baseIndent + layout.indent.repeat(depth);
  const keyOut = (k: string) => (style.key === "" ? (isIdentifier(k) ? k : quote(k, style.string)) : quote(k, style.key));
  const write = (v: Value, depth: number): string => {
    if (typeof v === "string") return quote(v, style.string);
    if (typeof v === "number") return Number.isFinite(v) ? JSON.stringify(v) : String(v); // Infinity, NaN
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    const nl = layout.eol;
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return `[${nl}${v.map((x) => pad(depth + 1) + write(x, depth + 1)).join("," + nl)}${nl}${pad(depth)}]`;
    }
    const entries = Object.entries(v as Record<string, Value>);
    if (entries.length === 0) return "{}";
    return `{${nl}${entries.map(([k, x]) => `${pad(depth + 1)}${keyOut(k)}: ${write(x, depth + 1)}`).join("," + nl)}${nl}${pad(depth)}}`;
  };
  return write(value, 0);
}
