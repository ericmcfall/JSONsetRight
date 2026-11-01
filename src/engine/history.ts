// Unlimited undo/redo. Files are small (< 1 MB), so each step simply keeps a whole snapshot.

export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;

  constructor(initial: T) {
    this.current = initial;
  }

  get present(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Records a new state. Anything that was undone can no longer be redone. */
  push(next: T): void {
    this.past.push(this.current);
    this.current = next;
    this.future = [];
  }

  undo(): T {
    const previous = this.past.pop();
    if (previous !== undefined) {
      this.future.push(this.current);
      this.current = previous;
    }
    return this.current;
  }

  redo(): T {
    const next = this.future.pop();
    if (next !== undefined) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }
}
