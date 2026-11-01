import type { ValueKind } from "../engine";

const LABELS: Record<ValueKind, { icon: string; name: string }> = {
  object: { icon: "{ }", name: "Object" },
  array: { icon: "[ ]", name: "Array (list)" },
  string: { icon: "Aa", name: "Text" },
  number: { icon: "#", name: "Number" },
  boolean: { icon: "✓", name: "True / false" },
  null: { icon: "∅", name: "Null (no value)" },
};

export function KindBadge({ kind }: { kind: ValueKind }) {
  return (
    <span className={`badge kind-${kind}`} title={LABELS[kind].name}>
      {LABELS[kind].icon}
    </span>
  );
}

export function kindName(kind: ValueKind): string {
  return LABELS[kind].name;
}
