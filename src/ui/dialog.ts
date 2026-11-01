// A simple in-app confirmation dialog: `if (await confirmDialog({...})) { ... }`.
import { create } from "zustand";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** Extra buttons, e.g. "Don't save". Resolve with the button's value. */
  extraLabel?: string;
  danger?: boolean;
}

type Answer = "confirm" | "extra" | "cancel";

interface DialogState {
  request: ConfirmRequest | null;
  resolve: ((answer: Answer) => void) | null;
  answer(answer: Answer): void;
}

export const useDialog = create<DialogState>((set, get) => ({
  request: null,
  resolve: null,
  answer(answer) {
    get().resolve?.(answer);
    set({ request: null, resolve: null });
  },
}));

/** Shows the dialog and waits for a button press. */
export function askDialog(request: ConfirmRequest): Promise<Answer> {
  return new Promise((resolve) => useDialog.setState({ request, resolve }));
}

export async function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  return (await askDialog(request)) === "confirm";
}
