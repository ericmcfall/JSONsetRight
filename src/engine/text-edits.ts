// Every structural edit SafeJSON makes (set, insert, remove) for all file types (JSON, JSONC,
// JSON5), using the syntax tree's exact offsets. Edits touch only the text they must: layout,
// comments, commas and quote styles elsewhere in the file are left exactly as they were.
// (jsonc-parser's modify() re-formats the lines it touches and can't read JSON5.)
import { findNodeAtLocation, type Node } from "jsonc-parser";
import { isIdentifier } from "./json5/parse";

export interface TextLayout {
  /** One level of indentation, e.g. "  " or "	". */
  indent: string;
  eol: string;
}

type Path = (string | number)[];
type Value = unknown;

export interface ModifyOptions {
  /** Insert into an array at the path's index instead of replacing that item. */
  isArrayInsertion?: boolean;
  /** For new object keys: position among the existing keys. */
  getInsertionIndex?: (keys: string[]) => number;
}

/**
 * Applies a set/insert/remove at `path` (value undefined = remove) and returns the new text.
 * New content follows `style`; pass "detect" (for JSON5) to match the file's own quoting.
 */
export function modifyAtPath(
  text: string,
  root: Node,
  path: Path,
  value: Value,
  layout: TextLayout,
  options: ModifyOptions = {},
  style: TextStyle | "detect" = JSON_STYLE,
): string {
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const container = parentPath.length === 0 ? root : findNodeAtLocation(root, parentPath);
  if (!container || (container.type !== "object" && container.type !== "array")) throw new Error("No container at path");
  const items = container.children ?? [];
  const fileStyle = style === "detect" ? detectStyle(text, root) : style;
  const serialize = (v: Value, baseIndent: string) => writeValue(v, layout, baseIndent, fileStyle);

  if (container.type === "object") {
    const index = items.findIndex((p) => p.children![0].value === last);
    if (value === undefined) return index === -1 ? text : removeChildText(text, container, index);
    if (index !== -1) return replace(text, items[index].children![1], serialize(value, lineIndent(text, items[index].offset)));
    const keys = items.map((p) => p.children![0].value as string);
    const at = Math.max(0, Math.min(options.getInsertionIndex?.(keys) ?? keys.length, keys.length));
    return insertChildText(text, container, at, (indent) => `${keyText(text, container, String(last), fileStyle)}: ${serialize(value, indent)}`, layout);
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
function keyText(text: string, object: Node, key: string, fileStyle: TextStyle): string {
  if (!fileStyle.json5) return JSON.stringify(key);
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

/** How keys and strings are written, so new content looks like the rest of the file. */
export interface TextStyle {
  /** "" = unquoted where possible (JSON5 only). */
  key: "" | "'" | '"';
  string: "'" | '"';
  /** JSON5 can write Infinity and NaN; JSON can't. */
  json5: boolean;
}

/** Standard JSON: double-quoted keys and strings. */
export const JSON_STYLE: TextStyle = { key: '"', string: '"', json5: false };

/** Takes the style from the first key and the first string value in the file. */
function detectStyle(text: string, root: Node): TextStyle {
  let key: TextStyle["key"] | undefined;
  let str: TextStyle["string"] | undefined;
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
  return { key: key ?? '"', string: str ?? (key === "'" ? "'" : '"'), json5: true };
}

/** Text for a new value in the given style; nested lines sit under `baseIndent`. */
function writeValue(value: Value, layout: TextLayout, baseIndent: string, style: TextStyle): string {
  const pad = (depth: number) => baseIndent + layout.indent.repeat(depth);
  const keyOut = (k: string) => (style.key === "" ? (isIdentifier(k) ? k : quote(k, style.string)) : quote(k, style.key));
  const write = (v: Value, depth: number): string => {
    if (typeof v === "string") return quote(v, style.string);
    if (typeof v === "number") return Number.isFinite(v) || !style.json5 ? JSON.stringify(v) : String(v); // JSON5: Infinity, NaN
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

/** Whitespace at the start of the line containing `offset`. */
export function lineIndent(text: string, offset: number): string {
  const start = lineStart(text, offset);
  return /^[ \t]*/.exec(text.slice(start))![0];
}

export function lineStart(text: string, offset: number): number {
  return Math.max(text.lastIndexOf("\n", offset - 1), text.lastIndexOf("\r", offset - 1)) + 1;
}

/** Position just after spaces/line breaks/comments starting at `pos`. */
function skipTrivia(text: string, pos: number): number {
  while (pos < text.length) {
    if (/\s/.test(text[pos])) pos++;
    else if (text.startsWith("//", pos)) pos = lineEnd(text, pos);
    else if (text.startsWith("/*", pos)) pos = text.indexOf("*/", pos + 2) + 2;
    else break;
  }
  return pos;
}

function lineEnd(text: string, pos: number): number {
  const m = /[\r\n]/.exec(text.slice(pos));
  return m ? pos + m.index : text.length;
}

/** Offset of the comma right after `node` (ignoring spaces and comments), or -1. */
function commaAfter(text: string, node: Node): number {
  const at = skipTrivia(text, node.offset + node.length);
  return text[at] === "," ? at : -1;
}

/**
 * Inserts an entry into an object or array at `index`, matching the container's layout
 * (one line or one entry per line) and keeping a trailing comma if the list has one.
 * `entry` receives the indentation that the entry's nested lines should use.
 */
export function insertChildText(text: string, container: Node, index: number, entry: (indent: string) => string, layout: TextLayout): string {
  const items = container.children ?? [];
  const containerText = text.slice(container.offset, container.offset + container.length);
  const multiline = /[\r\n]/.test(containerText);

  if (items.length === 0) {
    const inner = containerText.slice(1, -1);
    const outer = lineIndent(text, container.offset);
    const childIndent = outer + layout.indent;
    if (inner.trim() === "") {
      // Empty container: put the first entry on its own line, like a formatter would.
      const content = `${layout.eol}${childIndent}${entry(childIndent)}${layout.eol}${outer}`;
      return text.slice(0, container.offset + 1) + content + text.slice(container.offset + container.length - 1);
    }
    // Only comments inside: add the entry after the opening bracket, keeping the comments.
    return text.slice(0, container.offset + 1) + `${layout.eol}${childIndent}${entry(childIndent)}` + text.slice(container.offset + 1);
  }

  const childIndent = multiline ? lineIndent(text, items[0].offset) : "";
  const separator = multiline ? layout.eol + childIndent : " ";
  // Nested lines of a new value line up under the item's line (or the one-line container's line).
  const entryIndent = multiline ? childIndent : lineIndent(text, container.offset);
  if (index < items.length) {
    const before = items[index];
    return text.slice(0, before.offset) + entry(entryIndent) + "," + separator + text.slice(before.offset);
  }
  // Appending: keep a trailing comma if the list already ends with one.
  const lastItem = items[items.length - 1];
  const comma = commaAfter(text, lastItem);
  if (comma !== -1) {
    return text.slice(0, comma + 1) + separator + entry(entryIndent) + "," + text.slice(comma + 1);
  }
  const end = lastItem.offset + lastItem.length;
  return text.slice(0, end) + "," + separator + entry(entryIndent) + text.slice(end);
}

/**
 * Removes the entry at `index` with its comma, its same-line comment and (if it had one) its
 * whole line. Unlike jsonc-parser's removal, this works however the file is laid out.
 */
export function removeChildText(text: string, container: Node, index: number): string {
  const items = container.children!;
  const item = items[index];
  const comma = commaAfter(text, item);
  let start = item.offset;
  let end = comma !== -1 ? comma + 1 : item.offset + item.length;

  // A comment on the same line after the item belongs to it.
  const restOfLine = text.slice(end, lineEnd(text, end));
  if (/^\s*(\/\/.*|\/\*.*?\*\/\s*)$/.test(restOfLine)) end += restOfLine.length;

  // Removing the last item when the list has no trailing comma: the comma before it must go too.
  const previousComma = index === items.length - 1 && index > 0 && comma === -1 ? commaAfter(text, items[index - 1]) : -1;

  const ls = lineStart(text, start);
  const ownLine = /^[ \t]*$/.test(text.slice(ls, start)) && /^[ \t]*(\r\n|\n|\r|$)/.test(text.slice(end));
  let result: string;
  if (ownLine) {
    // The item had its own line: remove the whole line, then the dangling comma (if any).
    start = ls;
    end += /^[ \t]*(\r\n|\n|\r)?/.exec(text.slice(end))![0].length;
    result = text.slice(0, start) + text.slice(end);
    if (previousComma !== -1) result = result.slice(0, previousComma) + result.slice(previousComma + 1);
  } else {
    // Several items on one line: remove the item and the spacing around it, e.g. [1, 2] -> [1].
    if (previousComma !== -1) start = previousComma;
    else end += /^[ \t]*/.exec(text.slice(end))![0].length;
    result = text.slice(0, start) + text.slice(end);
  }

  // A container left with only spaces inside becomes empty: {} or [].
  if (items.length === 1) {
    const open = container.offset;
    const close = result.indexOf(text[container.offset + container.length - 1], open);
    if (result.slice(open + 1, close).trim() === "") result = result.slice(0, open + 1) + result.slice(close);
  }
  return result;
}
