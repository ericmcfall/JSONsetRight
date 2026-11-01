// Text edits that work on any of SafeJSON's file types (JSON, JSONC, JSON5) using the syntax
// tree's exact offsets: inserting and removing object/array entries while keeping the
// surrounding layout, commas and comments intact.
import type { Node } from "jsonc-parser";

export interface TextLayout {
  /** One level of indentation, e.g. "  " or "	". */
  indent: string;
  eol: string;
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
