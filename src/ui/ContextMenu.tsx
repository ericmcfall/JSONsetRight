// Right-click menu for a tree row.
import { useEffect, useRef } from "react";
import { findNode, formatPath, kindOf, VALUE_KINDS, type Path } from "../engine";
import * as actions from "./actions";
import { kindName } from "./KindBadge";

export interface MenuPosition {
  x: number;
  y: number;
}

interface Props {
  position: MenuPosition;
  path: Path;
  onClose(): void;
  onRename(): void;
}

export function ContextMenu({ position, path, onClose, onRename }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const doc = actions.currentDoc();
  const node = doc && findNode(doc, path);

  useEffect(() => {
    menu.current?.focus();
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  if (!doc || !node) return null;
  const kind = kindOf(node);
  const isRoot = path.length === 0;
  const isProperty = typeof path[path.length - 1] === "string";

  const run = (action: () => unknown) => () => {
    onClose();
    action();
  };

  // Keep the menu inside the window.
  const style = {
    left: Math.min(position.x, window.innerWidth - 230),
    top: Math.min(position.y, window.innerHeight - 380),
  };

  return (
    <div
      className="context-menu"
      style={style}
      ref={menu}
      tabIndex={-1}
      role="menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {isProperty && <MenuItem label="Rename key" shortcut="F2" onClick={run(onRename)} />}
      {!isRoot && <MenuItem label="Duplicate" shortcut="Ctrl+D" onClick={run(() => actions.duplicate(path))} />}
      {!isRoot && <MenuItem label="Move up" shortcut="Alt+↑" onClick={run(() => actions.moveBy(path, -1))} />}
      {!isRoot && <MenuItem label="Move down" shortcut="Alt+↓" onClick={run(() => actions.moveBy(path, 1))} />}
      {!isRoot && <MenuItem label="Delete" shortcut="Del" danger onClick={run(() => actions.remove(path))} />}
      <div className="menu-separator" />
      <div className="menu-heading">Change type to</div>
      <div className="menu-kinds">
        {VALUE_KINDS.filter((k) => k !== kind).map((k) => (
          <button key={k} type="button" onClick={run(() => actions.changeKind(path, k))}>
            {kindName(k)}
          </button>
        ))}
      </div>
      <div className="menu-separator" />
      <MenuItem label="Copy path" onClick={run(() => navigator.clipboard.writeText(formatPath(path)))} />
      <MenuItem label="Copy value as JSON" onClick={run(() => navigator.clipboard.writeText(actions.valueAsJson(path)))} />
    </div>
  );
}

function MenuItem(props: { label: string; shortcut?: string; danger?: boolean; onClick(): void }) {
  return (
    <button type="button" role="menuitem" className={`menu-item${props.danger ? " danger" : ""}`} onClick={props.onClick}>
      <span>{props.label}</span>
      {props.shortcut && <span className="shortcut">{props.shortcut}</span>}
    </button>
  );
}
