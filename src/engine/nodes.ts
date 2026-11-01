// Helpers for reading the syntax tree: finding nodes by path, value kinds, and display paths.
import { findNodeAtLocation, getNodeValue, type JSONPath, type Node } from "jsonc-parser";
import type { JsonDocument } from "./document";

export type Path = JSONPath; // e.g. ["Logging", "LogLevel", "Default"] or ["items", 0]

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ValueKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export const VALUE_KINDS: ValueKind[] = ["object", "array", "string", "number", "boolean", "null"];

/** The value node at a path, or undefined if there is none. */
export function findNode(doc: JsonDocument, path: Path): Node | undefined {
  return path.length === 0 ? doc.root : findNodeAtLocation(doc.root, path);
}

export function kindOf(node: Node): ValueKind {
  if (node.type === "property") throw new Error("kindOf expects a value node, not a property");
  return node.type;
}

export function valueOf(node: Node): JsonValue {
  return getNodeValue(node) as JsonValue;
}

/** The exact source text of a node (e.g. a number exactly as written: 1.50, 1e3). */
export function sourceOf(doc: JsonDocument, node: Node): string {
  return doc.text.slice(node.offset, node.offset + node.length);
}

/** Keys of an object node, in file order. */
export function keysOf(objectNode: Node): string[] {
  return (objectNode.children ?? []).map((prop) => prop.children![0].value as string);
}

export interface ChildEntry {
  /** Property name for objects, index for arrays. */
  key: string | number;
  node: Node;
}

/** Children of an object or array value node. Scalars have none. */
export function childrenOf(node: Node): ChildEntry[] {
  if (node.type === "object") {
    return (node.children ?? []).map((prop) => ({
      key: prop.children![0].value as string,
      node: prop.children![1],
    }));
  }
  if (node.type === "array") {
    return (node.children ?? []).map((child, index) => ({ key: index, node: child }));
  }
  return [];
}

/** Readable path for people, e.g. Logging.LogLevel["Microsoft.AspNetCore"] or items[0].name */
export function formatPath(path: Path): string {
  if (path.length === 0) return "(root)";
  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") out += `[${segment}]`;
    else if (/^[A-Za-z_$][\w$]*$/.test(segment)) out += out ? `.${segment}` : segment;
    else out += `[${JSON.stringify(segment)}]`;
  }
  return out;
}

export function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((segment, i) => segment === b[i]);
}
