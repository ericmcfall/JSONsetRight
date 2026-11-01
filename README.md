# SafeJSON

A Windows app for editing JSON config files through a GUI, so you can't introduce syntax
errors such as missing commas, unclosed quotes or mismatched brackets.

## Using it

- **Open** a `.json`, `.jsonc` or `.json5` file (or drag it onto the window). Each file opens in a tab.
- **Click** a value in the tree to edit it on the right. Each type has its own editor: text box,
  number box, true/false checkbox. Double-click in the tree to edit in place.
- **Right-click** for Duplicate, Move, Delete, Change type, Copy path.
- **Ctrl+Z / Ctrl+Y** undo and redo everything, as many steps as you like.
- Comments (`//`, `/* */`) and the file's formatting are kept exactly as they were. Only what
  you change is rewritten.

### Schemas
If a file has a JSON Schema, SafeJSON checks the file against it and helps you fill it in:
descriptions for each setting, dropdowns for allowed values, suggested property names,
required properties you're missing, and defaults. Saving a file that breaks its schema asks first.

SafeJSON finds the schema, in this order:
1. One you chose for the file. Click the schema name in the status bar to choose, reload, or switch off.
2. The file's own `"$schema"` property (a web address or a path relative to the file). Web schemas
   are downloaded once and cached in `%LOCALAPPDATA%\SafeJSON\schema-cache` for offline use.
3. A filename rule in Settings, such as `appsettings*.json`.

### Text mode
Click **Text** (Ctrl+Shift+T) to edit the JSON directly in a code editor with schema-aware
autocomplete. Changes apply once the text is valid. Until then a banner shows the problem, and
saving and the tree are blocked. Files that aren't valid JSON open in text mode so you can fix
them. Files that were standard JSON stay that way: comments and trailing commas are refused there.

### Table view
Select a list of objects (or anything inside one) and click **Table** to see it as a grid: one
row per item, one column per key. Cells use the same safe editors as the tree. Empty cells mean
that row doesn't have the key yet; filling one in adds it. Rows can be added, moved, duplicated
and deleted; columns can be added, renamed (double-click the header) and removed. Clicking a
column header sorts the rows on screen only. **Save this order to the file** makes it permanent.

### Compare
**Compare…** shows what differs between this file and its saved version, another open tab, a
backup, or another file. Only the data is compared: formatting, comments and key order are
ignored. Each difference has buttons to make one side match the other (both ways when the other
side is an open tab), and every change can be undone.

### JSON5
JSON5 files (unquoted keys, 'single quotes', hex numbers, trailing commas, comments) are edited
the same way. SafeJSON keeps the file's style: new keys and strings are written the way the file
already writes them. Format isn't available for JSON5 yet.

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
| Ctrl+F | Search keys and values (in text mode: find in text) |
| Ctrl+Shift+T | Switch between Tree and Text |
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

### Signed release builds
`npm run build:signed` builds `release\SafeJSON.exe` and signs it with Azure Artifact Signing, so
Windows (including Smart App Control) trusts it. A Microsoft sign-in page opens in your browser
during signing. Requirements: the Windows SDK `signtool` (included with the Visual Studio Build
Tools) and Microsoft's Artifact Signing plug-in
(`winget install -e --id Microsoft.Azure.ArtifactSigningClientTools`). The signing account
details are in `src-tauri/signing/` (`metadata.json`, `tenant-id.txt`); none of them are secrets.
The signing account needs the role "Artifact Signing Certificate Profile Signer".

`npm run dev` alone opens the interface in a normal browser with a sample file. Opening and saving
files only works in the desktop app.

### Layout
| Folder | What's there |
|---|---|
| `src/engine/` | JSON document engine: parsing, format-preserving edits, validation, undo history. No UI. |
| `src/engine/schema/` | Finding a file's JSON Schema, validating with Ajv, and reading hints for the UI. |
| `src/engine/json5/` | JSON5 parser that builds the same syntax tree as the JSON/JSONC parser. |
| `src/engine/text-edits.ts` | All structural edits (set, insert, remove), touching only the text they must. |
| `src/engine/diff.ts` | Structural comparison of two documents (for Compare). |
| `src/store/` | App state (open tabs, settings). |
| `src/ui/` | React components and editing actions. |
| `src/platform/` | Calls into the Rust side (files, dialogs). |
| `src-tauri/src/` | Rust: reading/saving files, backups, recovery drafts, settings. |
| `samples/` | Test files. They must round-trip byte-for-byte, so git leaves their line endings alone. |
