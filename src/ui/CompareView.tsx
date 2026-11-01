// Compare view: every difference between this file (left, editable) and another version
// (right), with buttons to copy values across. Re-computed after every change.
import { useMemo, useState } from "react";
import type { Node } from "jsonc-parser";
import {
  addProperty,
  canonical,
  diffDocuments,
  formatPath,
  insertItem,
  kindOf,
  removeValue,
  setNumberText,
  setValue,
  sourceOf,
  valueOf,
  type DiffEntry,
  type DiffKind,
  type JsonDocument,
  type Path,
} from "../engine";
import { useEditor, type Tab } from "../store/editor";

const LABELS: Record<DiffKind, string> = { different: "Changed", onlyLeft: "Only in this file", onlyRight: "Only in the other" };

export function CompareView({ tab }: { tab: Tab }) {
  const target = tab.compare!;
  const otherTab = useEditor((s) => (target.otherTabId ? s.tabs.find((t) => t.id === target.otherTabId) : undefined));
  const left = tab.history.present;
  const right = otherTab?.history.present ?? target.doc;
  const entries = useMemo(() => diffDocuments(left, right), [left, right]);
  const [filter, setFilter] = useState<DiffKind | "all">("all");
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
  const count = (kind: DiffKind) => entries.filter((e) => e.kind === kind).length;

  const close = () => {
    useEditor.setState((s) => ({ tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, view: "tree", compare: null } : t)) }));
  };
  const showInTree = (path: Path) => {
    const store = useEditor.getState();
    store.select(path);
    close();
  };

  /** Makes one side match the other for this difference (an undoable edit on that side). */
  const copy = (entry: DiffEntry, direction: "toLeft" | "toRight") => {
    const toLeft = direction === "toLeft";
    const [fromDoc, fromNode, targetPath] = toLeft ? [right, entry.right, entry.leftPath] : [left, entry.left, entry.rightPath];
    const tabId = toLeft ? tab.id : otherTab?.id;
    if (!tabId) return;
    useEditor.getState().apply((doc) => {
      if (!fromNode) return removeValue(doc, targetPath); // it only exists on the target side
      const existsOnTarget = toLeft ? entry.kind !== "onlyRight" : entry.kind !== "onlyLeft";
      if (existsOnTarget) {
        // Numbers are copied exactly as written (so huge integers stay exact).
        if (fromNode.type === "number" && kindOf(fromNode) === "number") return setNumberText(doc, targetPath, sourceOf(fromDoc, fromNode));
        return setValue(doc, targetPath, valueOf(fromNode));
      }
      const parent = targetPath.slice(0, -1);
      const key = targetPath[targetPath.length - 1];
      return typeof key === "string" ? addProperty(doc, parent, key, valueOf(fromNode)) : insertItem(doc, parent, valueOf(fromNode), key);
    }, undefined, tabId);
  };

  return (
    <div className="compare-view">
      <div className="table-header">
        <button type="button" onClick={close}>‹ Done comparing</button>
        <span>
          <strong>{tab.title}</strong> <span className="muted">(left, editable)</span> vs <strong>{target.label}</strong>{" "}
          <span className="muted">{otherTab ? "(right, editable)" : "(right)"}</span>
        </span>
      </div>
      <div className="compare-filters" role="group" aria-label="Show">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label={`All differences (${entries.length})`} />
        {(["different", "onlyLeft", "onlyRight"] as DiffKind[]).map((k) => (
          <FilterButton key={k} active={filter === k} onClick={() => setFilter(k)} label={`${LABELS[k]} (${count(k)})`} />
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="compare-same">
          <p>✓ No differences. Both contain the same data.</p>
          <p className="muted">Formatting, comments and the order of keys are ignored.</p>
        </div>
      ) : (
        <div className="table-grid">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Where</th>
                <th>This file</th>
                <th />
                <th>{target.label}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry, i) => (
                <tr key={i} className={`diff-${entry.kind}`}>
                  <td>
                    <span className={`diff-badge ${entry.kind}`}>{LABELS[entry.kind]}</span>{" "}
                    {entry.kind !== "onlyRight" ? (
                      <button type="button" className="link" title="Show in the tree" onClick={() => showInTree(entry.leftPath)}>
                        {formatPath(entry.leftPath)}
                      </button>
                    ) : (
                      <code>{formatPath(entry.rightPath)}</code>
                    )}
                  </td>
                  <td className="diff-value"><Value doc={left} node={entry.left} /></td>
                  <td className="diff-actions">
                    <button type="button" onClick={() => copy(entry, "toLeft")} title="Make this file match the other version here">
                      {entry.kind === "onlyLeft" ? "Remove here" : entry.kind === "onlyRight" ? "← Add here" : "← Use theirs"}
                    </button>
                    {otherTab && (
                      <button type="button" onClick={() => copy(entry, "toRight")} title={`Make ${otherTab.title} match this file here`}>
                        {entry.kind === "onlyRight" ? "Remove there" : entry.kind === "onlyLeft" ? "Add there →" : "Use mine →"}
                      </button>
                    )}
                  </td>
                  <td className="diff-value"><Value doc={right} node={entry.right} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-footer muted">
        Every change made here can be undone with Ctrl+Z.{" "}
        {otherTab ? `Changes to ${otherTab.title} are undone in its own tab.` : ""}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick(): void; label: string }) {
  return (
    <button type="button" className={active ? "on" : ""} onClick={onClick}>
      {label}
    </button>
  );
}

/** A short, readable rendering of a value for the comparison table. */
function Value({ doc, node }: { doc: JsonDocument; node: Node | undefined }) {
  if (!node) return <span className="muted">(not present)</span>;
  const kind = kindOf(node);
  const text =
    kind === "string" ? JSON.stringify(node.value)
    : kind === "number" ? sourceOf(doc, node)
    : kind === "object" || kind === "array" ? canonical(valueOf(node))
    : String(node.value);
  return (
    <code className={`kind-${kind}`} title={text.length > 120 ? text : undefined}>
      {text.length > 120 ? `${text.slice(0, 120)}…` : text}
    </code>
  );
}
