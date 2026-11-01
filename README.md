# SafeJSON

A Windows app for editing JSON config files through a GUI, so you can't introduce syntax
errors such as missing commas, unclosed quotes or mismatched brackets.

## Using it

- **Open** a `.json` / `.jsonc` file (or drag it onto the window). Each file opens in a tab.
- **Click** a value in the tree to edit it on the right. Each type has its own editor: text box,
  number box, true/false checkbox. Double-click in the tree to edit in place.
- **Right-click** for Duplicate, Move, Delete, Change type, Copy path.
- **Ctrl+Z / Ctrl+Y** undo and redo everything, as many steps as you like.
- Comments (`//`, `/* */`) and the file's formatting are kept exactly as they were. Only what
  you change is rewritten.

### Guardrails
- Numbers reject letters; text is escaped automatically; keys can't be duplicated or empty.
- Changing a value's type asks first if anything would be lost.
- The Problems panel flags duplicate keys and numbers too large to store exactly.

### Safety
- **Backups:** each save keeps the previous version (5 by default) in
  `%LOCALAPPDATA%\SafeJSON\backups`. Use **Backups…** to restore one.
- **Crash recovery:** unsaved changes are saved as drafts every 30 seconds and offered back if
  SafeJSON closes unexpectedly.
- **Outside changes:** if another program (e.g. VS Code) changes an open file, SafeJSON reloads
  it, or asks you first if you have unsaved edits.
- Saving writes a temporary file and then swaps it in, so a crash mid-save never corrupts a file.

### Keyboard shortcuts
| Keys | Action |
|---|---|
| Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S | New / Open / Save / Save as |
| Ctrl+W, Ctrl+Tab | Close tab, next tab |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+F | Search keys and values |
| Shift+Alt+F | Format document |
| Ctrl+, | Settings |
| ↑ ↓ ← → | Move around the tree, collapse/expand |
| Enter / F2 | Edit value / Rename key |
| Alt+↑ / Alt+↓ | Move item up/down |
| Ctrl+D / Delete | Duplicate / Delete |

## Developing

Prerequisites (Windows): Node.js LTS, Rust (rustup), Visual Studio Build Tools with the C++
workload. See [PLAN.md](PLAN.md) for the full design and roadmap.

```bash
npm install          # first time only
npm run tauri dev    # run the app with live reload
npm test             # unit tests (engine, tree, store)
npm run tauri build -- --no-bundle   # portable exe -> src-tauri/target/release/safejson.exe
```

`npm run dev` alone opens the interface in a normal browser with a sample file. Opening and saving
files only works in the desktop app.

### Layout
| Folder | What's there |
|---|---|
| `src/engine/` | JSON document engine: parsing, format-preserving edits, validation, undo history. No UI. |
| `src/store/` | App state (open tabs, settings). |
| `src/ui/` | React components and editing actions. |
| `src/platform/` | Calls into the Rust side (files, dialogs). |
| `src-tauri/src/` | Rust: reading/saving files, backups, recovery drafts, settings. |
| `samples/` | Test files. They must round-trip byte-for-byte, so git leaves their line endings alone. |
