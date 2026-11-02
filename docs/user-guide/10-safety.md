# Saving and safety features

JSONsetRight is built so that you can't damage a file by accident, and so that you can get your work
back if something goes wrong.

## The file is always valid

Every change you make in the tree, the table or the details panel is checked before it's applied.
A change that would produce invalid JSON is refused. In [text mode](06-text-mode.md), text is only
applied once it's valid, and saving is blocked while it isn't.

## Saving

- **Save** (**Ctrl+S**) writes the file. A file that has never been saved asks for a name first.
- **Save as…** (**Ctrl+Shift+S**) saves under a new name or location. The tab then refers to the new file.

**Crash-safe saving:** JSONsetRight writes to a temporary file next to yours and swaps it in only once
it's complete. If the PC loses power mid-save, your original file is still intact.

**Before saving, JSONsetRight may ask you about:**

| Question | Why | Your choices |
|---|---|---|
| *"…doesn't match its schema"* | The file breaks rules in its [schema](07-schemas.md) | **Save anyway**, **Show first problem**, **Cancel** |
| *"…was changed by another program"* | Someone else saved the file since you opened it | **Save anyway** (their version is kept as a backup), **Cancel** |

## Backups

Each time you save over a file, JSONsetRight first keeps a copy of the previous version. By default
it keeps the **5 most recent** per file; you can change this, or turn backups off, in
[Settings](11-settings.md).

To restore one:

1. Open the file and click **Backups…**.
2. Pick a version by its date and time, and click **Restore**.

The restored version replaces what's on screen but **isn't saved yet**: check it, then **Save**,
or press **Ctrl+Z** to undo the restore. You can also [compare](08-compare.md) the current file
with a backup first.

Backups are stored in `%LOCALAPPDATA%\JSONsetRight\backups`, not next to your files, so they don't
clutter your folders or project repositories.

## Crash recovery

Every 30 seconds, JSONsetRight keeps a private copy of any unsaved changes. If JSONsetRight closes
unexpectedly (a crash, a power cut, or Windows restarting for updates), the next time you start it
you'll see **"Recover unsaved work?"**:

- **Recover** reopens your unsaved changes in tabs, ready to review and save.
- **Discard** throws them away.
- **Cancel** decides later (you'll be asked again next time).

Recovery copies are deleted when you save or close normally.

## Changes made by other programs

JSONsetRight checks open files every few seconds, and whenever you switch back to its window:

- **If you have no unsaved changes**, it reloads the file automatically and tells you. Press
  **Ctrl+Z** to go back to what you had.
- **If you do have unsaved changes**, it asks: **Load their version** (undoable) or **Keep mine**.
- If the file was **deleted or moved**, it tells you; saving creates it again.
- If the other program left the file **invalid** (for example mid-save), JSONsetRight keeps your version and tells you.

## Closing

- Closing a tab with unsaved changes asks: **Save**, **Don't save**, or **Cancel**.
- Closing the JSONsetRight window asks about each file with unsaved changes.

## Undo

Every change, including deleting, moving, changing type, restoring a backup, reloading after another
program's change, and formatting, can be undone with **Ctrl+Z**, step by step, back to when you opened
the file.
