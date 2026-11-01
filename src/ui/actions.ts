// Editing actions shared by the tree, the details panel, the context menu and shortcuts.
// Each one runs an engine edit through the store and picks a sensible selection afterwards.
import {
  addProperty,
  changeType,
  defaultValue,
  describeTypeChangeLoss,
  duplicateChild,
  findNode,
  insertItem,
  keysOf,
  moveChild,
  removeValue,
  renameKey,
  setNumberText,
  setValue,
  valueOf,
  type JsonDocument,
  type JsonValue,
  type Path,
  type ValueKind,
} from "../engine";
import { useEditor } from "../store/editor";
import { confirmDialog } from "./dialog";
import { kindName } from "./KindBadge";

const store = () => useEditor.getState();

export function currentDoc(): JsonDocument | undefined {
  const { tabs, activeId } = store();
  return tabs.find((t) => t.id === activeId)?.history.present;
}

/** The deepest part of `path` that still exists (selections can go stale after undo). */
export function existingPath(doc: JsonDocument, path: Path): Path {
  let p = path;
  while (p.length > 0 && !findNode(doc, p)) p = p.slice(0, -1);
  return p;
}

const parentOf = (path: Path): Path => path.slice(0, -1);

/** Position of the value at `path` among its siblings. */
function indexInParent(doc: JsonDocument, path: Path): number {
  const last = path[path.length - 1];
  if (typeof last === "number") return last;
  return keysOf(findNode(doc, parentOf(path))!).indexOf(last);
}

/** Path of the sibling at `index` inside `parent`, or the parent itself if there is none. */
function childPath(doc: JsonDocument, parent: Path, index: number): Path {
  const node = findNode(doc, parent);
  const count = node?.children?.length ?? 0;
  if (!node || count === 0) return parent;
  const i = Math.max(0, Math.min(index, count - 1));
  return [...parent, node.type === "object" ? keysOf(node)[i] : i];
}

export function setScalar(path: Path, value: JsonValue): boolean {
  return store().apply((doc) => setValue(doc, path, value));
}

export function setNumber(path: Path, text: string): boolean {
  return store().apply((doc) => setNumberText(doc, path, text));
}

export function rename(path: Path, newKey: string): boolean {
  const parent = parentOf(path);
  return store().apply((doc) => renameKey(doc, parent, path[path.length - 1] as string, newKey), [...parent, newKey]);
}

/** Adds a new child to an object (needs `key`) or array (appends). */
export function addChild(containerPath: Path, kind: ValueKind, key?: string): boolean {
  return addChildValue(containerPath, defaultValue(kind), key);
}

/** Like addChild, with a specific starting value (e.g. a schema's default). */
export function addChildValue(containerPath: Path, value: JsonValue, key?: string): boolean {
  const doc = currentDoc();
  const container = doc && findNode(doc, containerPath);
  if (!container) return false;
  const ok =
    container.type === "object"
      ? store().apply((d) => addProperty(d, containerPath, key ?? "", value), [...containerPath, key ?? ""])
      : store().apply((d) => insertItem(d, containerPath, value), [...containerPath, container.children?.length ?? 0]);
  // Put the cursor in the new value's editor once the details panel has re-rendered.
  if (ok) setTimeout(() => document.getElementById("value-editor")?.focus());
  return ok;
}

export function remove(path: Path): boolean {
  const doc = currentDoc();
  if (!doc || path.length === 0) return false;
  const parent = parentOf(path);
  const index = indexInParent(doc, path);
  let next: JsonDocument | undefined;
  const ok = store().apply((d) => (next = removeValue(d, path)));
  if (ok && next) store().select(childPath(next, parent, index));
  return ok;
}

export function duplicate(path: Path): boolean {
  const doc = currentDoc();
  if (!doc || path.length === 0) return false;
  const parent = parentOf(path);
  let newKey: string | number = 0;
  const ok = store().apply((d) => {
    const result = duplicateChild(d, parent, indexInParent(d, path));
    newKey = result.key;
    return result.doc;
  });
  if (ok) store().select([...parent, newKey]);
  return ok;
}

/** Moves a value up (-1) or down (+1) among its siblings. */
export function moveBy(path: Path, delta: number): boolean {
  const doc = currentDoc();
  if (!doc || path.length === 0) return false;
  const from = indexInParent(doc, path);
  const count = findNode(doc, parentOf(path))?.children?.length ?? 0;
  const to = from + delta;
  if (to < 0 || to >= count) return false;
  return moveTo(parentOf(path), from, to);
}

export function moveTo(parent: Path, from: number, to: number): boolean {
  let next: JsonDocument | undefined;
  const ok = store().apply((d) => (next = moveChild(d, parent, from, to)));
  if (ok && next) store().select(childPath(next, parent, to));
  return ok;
}

/** Changes a value's type, asking first if data would be lost. */
export async function changeKind(path: Path, kind: ValueKind): Promise<boolean> {
  const doc = currentDoc();
  if (!doc) return false;
  const loss = describeTypeChangeLoss(doc, path, kind);
  if (loss) {
    const ok = await confirmDialog({
      title: `Change to ${kindName(kind)}?`,
      message: `${loss} You can undo this with Ctrl+Z.`,
      confirmLabel: `Change to ${kindName(kind)}`,
      danger: true,
    });
    if (!ok) return false;
  }
  return store().apply((d) => changeType(d, path, kind));
}

export function valueAsJson(path: Path): string {
  const doc = currentDoc();
  const node = doc && findNode(doc, path);
  return node ? JSON.stringify(valueOf(node), null, 2) : "";
}
