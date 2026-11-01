// A small text box used inside a tree row to rename a key or edit a text/number value.
// Enter saves, Escape cancels, clicking away saves. Invalid input is shown in red and not saved.
import { useEffect, useRef, useState } from "react";
import { JSON_NUMBER } from "../engine";

interface Props {
  kind: "key" | "string" | "number";
  initial: string;
  /** Returns false if the edit was refused (the store shows why). */
  onCommit(text: string): boolean;
  onDone(): void;
}

export function InlineEditor({ kind, initial, onCommit, onDone }: Props) {
  const [text, setText] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const error =
    kind === "number" && !JSON_NUMBER.test(text.trim())
      ? "Not a valid number"
      : kind === "key" && text === ""
        ? "Key can't be empty"
        : null;

  const finish = (save: boolean) => {
    if (finished.current) return;
    if (save && text !== initial) {
      if (error || !onCommit(text)) {
        input.current?.focus();
        return; // keep editing so the person can fix it
      }
    }
    finished.current = true;
    onDone();
  };

  return (
    <input
      ref={input}
      className={`inline-editor${error ? " invalid" : ""}`}
      value={text}
      title={error ?? undefined}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      onBlur={() => {
        if (!error) finish(true);
        else finish(false);
      }}
    />
  );
}
