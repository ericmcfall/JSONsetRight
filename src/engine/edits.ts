// Every change SafeJSON makes to a file goes through these functions.
//
// Each one takes a document and returns a NEW document (the old one is never modified, which
// makes undo simple). Each edit changes only the text it has to, then the result is re-parsed:
// if an edit would ever produce invalid JSON, it throws EditError and nothing changes.
import { modify, applyEdits, type FormattingOptions, type ModificationOptions, type Node } from "jsonc-parser";
import { JsonSyntaxError, withText, type Dialect, type JsonDocument } from "./document";
import { isIdentifier, modifyJson5, quote } from "./json5";
import { removeChildText } from "./text-edits";
import {
  findNode,
  keysOf,
  kindOf,
  sourceOf,
  valueOf,
  type JsonValue,
  type Path,
  type ValueKind,
} from "./nodes";

export type EditErrorCode =
  | "not-found"
  | "not-a-container"
  | "duplicate-key"
  | "empty-key"
  | "invalid-number"
  | "cannot-remove-root"
  | "index-out-of-range"
  | "not-supported"
  | "internal";

export class EditError extends Error {
  readonly code: EditErrorCode;

  constructor(code: EditErrorCode, message: string) {
    super(message);
    this.name = "EditError";
    this.code = code;
  }
}

/** Strict JSON number: no leading zeros, no NaN/Infinity, no leading "+". */
export const JSON_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

/** JSON5 numbers also allow hex, a leading "+", .5 / 5., Infinity and NaN. */
export const JSON5_NUMBER = /^[+-]?(Infinity|NaN|0[xX][0-9a-fA-F]+|(0|[1-9]\d*)(\.\d*)?([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/;

/** Whether `text` is a number that can be written in a file of this dialect. */
export function isValidNumber(text: string, dialect: Dialect): boolean {
  const t = text.trim();
  return JSON_NUMBER.test(t) || (dialect === "json5" && JSON5_NUMBER.test(t));
}

// ---------------------------------------------------------------- values

/** Replaces the value at `path` (which must exist). */
export function setValue(doc: JsonDocument, path: Path, value: JsonValue): JsonDocument {
  const node = requireNode(doc, path);
  if (isScalar(value)) {
    // Scalars are swapped in place, so nothing around them moves.
    return replaceNodeText(doc, node, scalarText(doc, node, value));
  }
  if (path.length === 0) {
    const content = JSON.stringify(value, null, doc.format.indent).replace(/\n/g, doc.format.eol);
    return replaceNodeText(doc, node, content);
  }
  return commit(doc, modifyText(doc, path, value));
}

/**
 * Sets a number from text exactly as typed (e.g. "1.50" or "12345678901234567890"), so no
 * precision is lost by converting through a JavaScript number.
 */
export function setNumberText(doc: JsonDocument, path: Path, numberText: string): JsonDocument {
  const trimmed = numberText.trim();
  if (!isValidNumber(trimmed, doc.dialect)) {
    throw new EditError("invalid-number", `"${numberText}" is not a valid JSON number`);
  }
  return replaceNodeText(doc, requireNode(doc, path), trimmed);
}

/** Converts the value at `path` to another kind. Use describeTypeChangeLoss() to warn first. */
export function changeType(doc: JsonDocument, path: Path, kind: ValueKind): JsonDocument {
  const node = requireNode(doc, path);
  if (kindOf(node) === kind) return doc;
  return setValue(doc, path, convertValue(valueOf(node), kind));
}

/** Returns a sentence describing what a type change would throw away, or null if nothing. */
export function describeTypeChangeLoss(doc: JsonDocument, path: Path, kind: ValueKind): string | null {
  const node = requireNode(doc, path);
  const from = kindOf(node);
  if (from === kind) return null;
  const childCount = node.children?.length ?? 0;
  if ((from === "object" || from === "array") && childCount > 0) {
    const what = from === "object" ? `${childCount} propert${childCount === 1 ? "y" : "ies"}` : `${childCount} item${childCount === 1 ? "" : "s"}`;
    return `This ${from} contains ${what}, which will be deleted.`;
  }
  const before = valueOf(node);
  const after = convertValue(before, kind);
  if (from !== "object" && from !== "array" && convertValue(after, from) !== before) {
    return `The current value ${JSON.stringify(before)} cannot be kept and will become ${JSON.stringify(after)}.`;
  }
  return null;
}

// ---------------------------------------------------------------- objects

/** Adds a property to the object at `objectPath`. `index` = position among its keys (default: end). */
export function addProperty(
  doc: JsonDocument,
  objectPath: Path,
  key: string,
  value: JsonValue,
  index?: number,
): JsonDocument {
  const object = requireContainer(doc, objectPath, "object");
  checkNewKey(object, key);
  const extra: ModificationOptions = index === undefined ? {} : { getInsertionIndex: () => index };
  return commit(doc, modifyText(doc, [...objectPath, key], value, extra));
}

/** Renames a key, leaving its value and everything around it untouched. */
export function renameKey(doc: JsonDocument, objectPath: Path, oldKey: string, newKey: string): JsonDocument {
  if (oldKey === newKey) return doc;
  const object = requireContainer(doc, objectPath, "object");
  const property = (object.children ?? []).find((p) => p.children![0].value === oldKey);
  if (!property) throw new EditError("not-found", `There is no key "${oldKey}"`);
  checkNewKey(object, newKey);
  return replaceNodeText(doc, property.children![0], keyLike(doc, property.children![0], newKey));
}

// ---------------------------------------------------------------- arrays

/** Inserts a value into the array at `arrayPath`. `index` = position (default: end). */
export function insertItem(doc: JsonDocument, arrayPath: Path, value: JsonValue, index?: number): JsonDocument {
  const array = requireContainer(doc, arrayPath, "array");
  const length = array.children?.length ?? 0;
  const at = index ?? length;
  if (at < 0 || at > length) throw new EditError("index-out-of-range", `Index ${at} is outside the list`);
  return commit(doc, modifyText(doc, [...arrayPath, at], value, { isArrayInsertion: true }));
}

// ---------------------------------------------------------------- both

/** Deletes the property or array item at `path`. */
export function removeValue(doc: JsonDocument, path: Path): JsonDocument {
  if (path.length === 0) throw new EditError("cannot-remove-root", "The top-level value cannot be deleted");
  requireNode(doc, path);
  const container = requireContainer(doc, path.slice(0, -1));
  const last = path[path.length - 1];
  const index = typeof last === "number" ? last : keysOf(container).indexOf(last);
  return commit(doc, removeChildText(doc.text, container, index));
}

/**
 * Moves the child at position `from` to position `to` inside the object or array at
 * `containerPath`. The moved value keeps its exact text (formatting and inner comments).
 */
export function moveChild(doc: JsonDocument, containerPath: Path, from: number, to: number): JsonDocument {
  const container = requireContainer(doc, containerPath);
  const count = container.children?.length ?? 0;
  if (from < 0 || from >= count || to < 0 || to >= count) {
    throw new EditError("index-out-of-range", "Cannot move outside the list");
  }
  if (from === to) return doc;

  if (container.type === "array") {
    const raw = sourceOf(doc, container.children![from]);
    const removed = removeValue(doc, [...containerPath, from]);
    return insertRaw(removed, containerPath, raw, to);
  }
  const property = container.children![from];
  const key = property.children![0].value as string;
  const raw = sourceOf(doc, property.children![1]);
  const removed = removeValue(doc, [...containerPath, key]);
  return insertRawProperty(removed, containerPath, key, raw, to);
}

/**
 * Copies the child at `index` and places the copy right after it. Object keys get a
 * " copy" suffix (" copy 2", ... if needed). Returns the new document and the copy's key.
 */
export function duplicateChild(
  doc: JsonDocument,
  containerPath: Path,
  index: number,
): { doc: JsonDocument; key: string | number } {
  const container = requireContainer(doc, containerPath);
  const child = container.children?.[index];
  if (!child) throw new EditError("index-out-of-range", "Nothing to duplicate at that position");

  if (container.type === "array") {
    return { doc: insertRaw(doc, containerPath, sourceOf(doc, child), index + 1), key: index + 1 };
  }
  const key = child.children![0].value as string;
  const newKey = uniqueKey(keysOf(container), `${key} copy`);
  return {
    doc: insertRawProperty(doc, containerPath, newKey, sourceOf(doc, child.children![1]), index + 1),
    key: newKey,
  };
}

/** Returns `base`, or `base 2`, `base 3`, ... whichever is not already a key. */
export function uniqueKey(existing: string[], base: string): string {
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!existing.includes(candidate)) return candidate;
  }
}

/** The value a new child of each kind starts with. */
export function defaultValue(kind: ValueKind): JsonValue {
  switch (kind) {
    case "object": return {};
    case "array": return [];
    case "string": return "";
    case "number": return 0;
    case "boolean": return false;
    case "null": return null;
  }
}

// ---------------------------------------------------------------- internals

function convertValue(value: JsonValue, kind: ValueKind): JsonValue {
  switch (kind) {
    case "string":
      return value === null || typeof value === "object" ? "" : String(value);
    case "number": {
      if (typeof value === "boolean") return value ? 1 : 0;
      if (typeof value === "string" && JSON_NUMBER.test(value.trim())) return Number(value.trim());
      return 0;
    }
    case "boolean":
      if (typeof value === "string") return value.trim().toLowerCase() === "true";
      if (typeof value === "number") return value !== 0;
      return false;
    case "null":
      return null;
    case "object":
      return {};
    case "array":
      return value === null || typeof value === "object" ? [] : [value];
  }
}

function isScalar(value: JsonValue): value is string | number | boolean | null {
  return value === null || typeof value !== "object";
}

function requireNode(doc: JsonDocument, path: Path): Node {
  const node = findNode(doc, path);
  if (!node) throw new EditError("not-found", "That value no longer exists");
  return node;
}

function requireContainer(doc: JsonDocument, path: Path, kind?: "object" | "array"): Node {
  const node = requireNode(doc, path);
  if (kind ? node.type !== kind : node.type !== "object" && node.type !== "array") {
    throw new EditError("not-a-container", `Expected ${kind ? `an ${kind}` : "an object or array"} here`);
  }
  return node;
}

function checkNewKey(object: Node, key: string): void {
  if (key.length === 0) throw new EditError("empty-key", "Key names cannot be empty");
  if (keysOf(object).includes(key)) {
    throw new EditError("duplicate-key", `This object already has a key named "${key}"`);
  }
}

/** Inserts already-formatted value text into an array, by inserting a placeholder and swapping it. */
function insertRaw(doc: JsonDocument, arrayPath: Path, raw: string, index: number): JsonDocument {
  const withPlaceholder = insertItem(doc, arrayPath, PLACEHOLDER, index);
  return replaceNodeText(withPlaceholder, requireNode(withPlaceholder, [...arrayPath, index]), raw);
}

function insertRawProperty(doc: JsonDocument, objectPath: Path, key: string, raw: string, index: number): JsonDocument {
  const withPlaceholder = addProperty(doc, objectPath, key, PLACEHOLDER, index);
  return replaceNodeText(withPlaceholder, requireNode(withPlaceholder, [...objectPath, key]), raw);
}

const PLACEHOLDER = "safejson:placeholder";

function replaceNodeText(doc: JsonDocument, node: Node, content: string): JsonDocument {
  return commit(doc, applyEdits(doc.text, [{ offset: node.offset, length: node.length, content }]));
}

/** Text for a new scalar value. In JSON5 files a 'single-quoted' string stays single-quoted. */
function scalarText(doc: JsonDocument, node: Node, value: string | number | boolean | null): string {
  if (doc.dialect === "json5" && typeof value === "string" && doc.text[node.offset] === "'") return quote(value, "'");
  return JSON.stringify(value);
}

/** Text for a renamed key, keeping a JSON5 key's style (unquoted or 'single') where possible. */
function keyLike(doc: JsonDocument, keyNode: Node, key: string): string {
  if (doc.dialect !== "json5") return JSON.stringify(key);
  const style = doc.text[keyNode.offset];
  if (style === "'") return quote(key, "'");
  if (style !== '"' && isIdentifier(key)) return key;
  return JSON.stringify(key);
}

/**
 * Runs jsonc-parser's modify() and applies the result. Containers written on one line, like
 * [1, 2, 3], are kept on one line; otherwise new content is indented to match the file.
 */
function modifyText(doc: JsonDocument, path: Path, value: JsonValue | undefined, extra: ModificationOptions = {}): string {
  if (doc.dialect === "json5") {
    return modifyJson5(doc.text, doc.root, path, value, { indent: doc.format.indent, eol: doc.format.eol }, extra);
  }
  const container = findNode(doc, path.slice(0, -1));
  const containerText = container ? sourceOf(doc, container) : "";
  const oneLine = (container?.children?.length ?? 0) > 0 && !containerText.includes("\n");
  if (!oneLine) {
    return applyEdits(doc.text, modify(doc.text, path, value, { ...extra, formattingOptions: formatting(doc) }));
  }
  // Without formatting, jsonc-parser writes "a,b"; add the space people expect after commas.
  const edits = modify(doc.text, path, value, extra).map((edit) => ({
    ...edit,
    content: edit.content.replace(/^,/, ", ").replace(/,$/, ", "),
  }));
  return applyEdits(doc.text, edits);
}

function formatting(doc: JsonDocument): FormattingOptions {
  const tabs = doc.format.indent === "\t";
  return {
    insertSpaces: !tabs,
    tabSize: tabs ? 4 : doc.format.indent.length,
    eol: doc.format.eol,
  };
}

/** Re-parses edited text. An invalid result means a bug in SafeJSON, never a user mistake. */
function commit(doc: JsonDocument, text: string): JsonDocument {
  try {
    return withText(doc, text);
  } catch (error) {
    if (error instanceof JsonSyntaxError) {
      throw new EditError("internal", `SafeJSON blocked an edit that would have broken the file (${error.message})`);
    }
    throw error;
  }
}
