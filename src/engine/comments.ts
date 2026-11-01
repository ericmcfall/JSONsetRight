// Finds the comments that belong to a value, so the tree can show them as tooltips.
// A comment belongs to a value if it is on the lines just above it, or on the same line after it.
import type { Node } from "jsonc-parser";
import type { JsonDocument } from "./document";
import { findNode, type Path } from "./nodes";

const COMMENT = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;

export function commentsFor(doc: JsonDocument, path: Path): string[] {
  const value = findNode(doc, path);
  if (!value) return [];
  // For object members the "item" is the whole `"key": value` property.
  const item = value.parent?.type === "property" ? value.parent : value;
  const text = doc.text;

  let leading: string;
  if (path.length === 0) {
    leading = text.slice(0, item.offset);
  } else {
    const container = item.parent as Node;
    const siblings = container.children ?? [];
    const index = siblings.indexOf(item);
    const previous = siblings[index - 1];
    leading = text.slice(previous ? previous.offset + previous.length : container.offset + 1, item.offset);
    // Text on the previous sibling's line belongs to that sibling.
    const newline = leading.indexOf("\n");
    if (previous && newline !== -1) leading = leading.slice(newline + 1);
  }

  const end = item.offset + item.length;
  const lineEnd = text.indexOf("\n", end);
  let trailing = text.slice(end, lineEnd === -1 ? text.length : lineEnd);
  // Only count it if the rest of the line is just a comma, spaces and comments.
  if (trailing.replace(COMMENT, "").replace(/[\s,]/g, "") !== "") trailing = "";

  return [...(leading.match(COMMENT) ?? []), ...(trailing.match(COMMENT) ?? [])].map(cleanComment);
}

function cleanComment(raw: string): string {
  if (raw.startsWith("//")) return raw.slice(2).trim();
  return raw
    .slice(2, -2)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*?\s?/, "").trimEnd())
    .join("\n")
    .trim();
}
