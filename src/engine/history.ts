// Unlimited undo/redo. Files are small (< 1 MB), so each step simply keeps a whole snapshot.
// A history is never modified in place: every function returns a new one, which suits React.

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

export function startHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

/** Records a new state. Anything that was undone can no longer be redone. */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  return { past: [...history.past, history.present], present: next, future: [] };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
