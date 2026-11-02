// Protections that run in the background: crash recovery drafts, noticing when another
// program changes an open file, and asking about unsaved work when the window closes.
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  deleteRecoveryDraft,
  fileModifiedMs,
  listRecoveryDrafts,
  readTextFile,
  writeRecoveryDraft,
} from "../platform/files";
import { currentFileText, isDirty, useEditor } from "../store/editor";
import { closeTabWithPrompt } from "./commands";
import { askDialog } from "./dialog";

const RECOVERY_INTERVAL_MS = 30_000;
const DISK_CHECK_INTERVAL_MS = 5_000;

const store = () => useEditor.getState();
/** Unique per run, so drafts from a crashed run are never overwritten by this one. */
const sessionId = Date.now().toString(36);
const draftsWritten = new Set<string>();

/** Starts everything. Returns a function that stops it. */
export function startSafetyNet(): () => void {
  void offerRecovery();
  const recovery = setInterval(() => void saveDrafts(), RECOVERY_INTERVAL_MS);
  const disk = setInterval(() => void checkDisk(), DISK_CHECK_INTERVAL_MS);
  window.addEventListener("focus", checkDisk);

  const unlisten: Promise<() => void>[] = [
    getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (await closeAllTabs()) {
        await clearDrafts();
        await getCurrentWindow().destroy();
      }
    }),
    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop") void store().openFiles(event.payload.paths);
    }),
  ];

  return () => {
    clearInterval(recovery);
    clearInterval(disk);
    window.removeEventListener("focus", checkDisk);
    unlisten.forEach((p) => p.then((stop) => stop()));
  };
}

async function closeAllTabs(): Promise<boolean> {
  for (const tab of [...store().tabs]) {
    if (isDirty(tab) && !(await closeTabWithPrompt(tab.id))) return false;
  }
  return true;
}

// ---- crash recovery

async function saveDrafts(): Promise<void> {
  const dirty = new Set<string>();
  for (const tab of store().tabs) {
    if (!isDirty(tab)) continue;
    const id = `${sessionId}-${tab.id}`;
    dirty.add(id);
    await writeRecoveryDraft({
      id,
      filePath: tab.filePath,
      title: tab.title,
      text: currentFileText(tab),
      savedAtMs: Date.now(),
    }).catch(() => undefined);
    draftsWritten.add(id);
  }
  // Drafts for tabs that were saved or closed are no longer needed.
  for (const id of [...draftsWritten]) {
    if (!dirty.has(id)) {
      await deleteRecoveryDraft(id).catch(() => undefined);
      draftsWritten.delete(id);
    }
  }
}

async function clearDrafts(): Promise<void> {
  await Promise.all([...draftsWritten].map((id) => deleteRecoveryDraft(id).catch(() => undefined)));
  draftsWritten.clear();
}

async function offerRecovery(): Promise<void> {
  const drafts = (await listRecoveryDrafts().catch(() => [])).filter((d) => !d.id.startsWith(sessionId));
  if (drafts.length === 0) return;
  const names = drafts.map((d) => d.title).join(", ");
  const answer = await askDialog({
    title: "Recover unsaved work?",
    message: `JSONsetRight didn't close normally last time. Unsaved changes were found for: ${names}.`,
    confirmLabel: "Recover",
    extraLabel: "Discard",
  });
  if (answer === "cancel") return; // ask again next time
  for (const draft of drafts) {
    if (answer === "confirm") {
      // Compare against the file as it is now, so the recovered tab shows as unsaved.
      const disk = draft.filePath ? await readTextFile(draft.filePath).catch(() => null) : null;
      store().openRecovered(draft.filePath, draft.title, draft.text, disk?.text ?? "", disk?.modifiedMs ?? null);
    }
    await deleteRecoveryDraft(draft.id).catch(() => undefined);
  }
}

// ---- changes made by other programs

let checking = false;

async function checkDisk(): Promise<void> {
  if (checking) return; // a prompt may still be open
  checking = true;
  try {
    for (const tab of store().tabs) {
      if (!tab.filePath || tab.diskModifiedMs === null) continue;
      const onDisk = await fileModifiedMs(tab.filePath).catch(() => undefined);
      if (onDisk === undefined || onDisk === tab.diskModifiedMs) continue;

      if (onDisk === null) {
        store().acknowledgeDisk(tab.id, null);
        store().showMessage({ kind: "info", text: `${tab.title} was deleted or moved by another program. Save to create it again.` });
        continue;
      }
      const file = await readTextFile(tab.filePath).catch(() => null);
      if (!file || file.text === tab.savedText) {
        store().acknowledgeDisk(tab.id, onDisk); // only the timestamp changed
        continue;
      }
      if (!isDirty(tab)) {
        store().reloadFromDisk(tab.id, file.text, file.modifiedMs);
        store().showMessage({ kind: "info", text: `${tab.title} was changed by another program and has been reloaded. Press Ctrl+Z to go back.` });
        continue;
      }
      store().activate(tab.id);
      const answer = await askDialog({
        title: `${tab.title} was changed by another program`,
        message: "You also have unsaved changes here. Load the other version, or keep yours? (Loading can be undone with Ctrl+Z.)",
        confirmLabel: "Load their version",
        extraLabel: "Keep mine",
      });
      if (answer === "confirm") store().reloadFromDisk(tab.id, file.text, file.modifiedMs);
      else store().acknowledgeDisk(tab.id, file.modifiedMs);
    }
  } finally {
    checking = false;
  }
}
