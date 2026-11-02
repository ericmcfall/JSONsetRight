# JSONsetRight — Project Plan

A standalone Windows app for creating and editing JSON config files through a GUI, built so that **syntax errors are impossible** and schema mistakes are caught before saving.

> Originally named **SafeJSON**; renamed to **JSONsetRight** in v3.2.0 (see [RENAME-PLAN.md](RENAME-PLAN.md)).
> This plan has been updated to the new name throughout.

Status: **All planned phases are done.** Released as SafeJSON v1.0.0–v3.1.0, then as JSONsetRight from
v3.2.0 (code-signed since v3.0.0). The browser version ([PLAN-WEB.md](PLAN-WEB.md)) is on hold.

Changes from the original plan, made during Phase 2:
- Schema discovery order: a schema the user picks for a file now comes *first* (before `$schema`),
  so an explicit choice always wins. "Don't use a schema" is also a per-file choice.
- Raw mode is called "Text" mode in the app. It also opens files that aren't valid JSON, so they
  can be fixed in JSONsetRight (v1 refused them).
- Files that were strict JSON when opened stay strict in text mode (comments/trailing commas refused).

Changes from the original plan, made during Phase 3:
- JSON5 went with Option A, in a stronger form: JSONsetRight has its own JSON5 parser (checked against
  the official `json5` package) and its own offset-based editor, so JSON5 files keep comments,
  unquoted keys and quote styles. Format isn't offered for JSON5 yet.
- That editor now handles *all* structural edits for every file type. jsonc-parser's edit
  function re-formatted neighbouring lines and mishandled compact one-line files; jsonc-parser is
  still used for parsing JSON/JSONC and for the Format command.
- Compare is a list of differences with both values side by side (plus copy buttons), rather
  than two aligned trees: clearer for non-technical users and easy to act on.

---

## 1. Decisions from the interview

| Topic | Decision |
|---|---|
| Primary use | Config files (settings.json, appsettings.json, tsconfig, etc.) |
| Users | Mixed team, both technical and non-technical |
| File size | Small (< 1 MB). No streaming or virtualization tricks needed |
| Schemas | Optional. Editing without a schema must work well |
| Views | Tree view, Table view, validated Raw text mode |
| Formats | Strict JSON, JSONC (comments), trailing commas, JSON5 |
| Formatting on save | Preserve the original by default, plus a "Format document" command |
| Guardrails | Typed value editors, duplicate-key blocking, schema hints, type-change warnings |
| Safety | Unlimited undo/redo, backup on save, schema check on save, auto-recovery |
| Schema discovery | `$schema` property, manual pick (remembered), filename-pattern mapping |
| Multi-file | Tabs, plus side-by-side structural compare |
| Stack | Tauri 2 + TypeScript + React |
| Distribution | Portable .exe |
| Invalid save | Warn and list the errors; user may "Save anyway" |
| Theme | Follow the Windows light/dark setting, with manual override |
| Source control | Local git + GitHub |
| Your experience level | Beginner: code stays readable, setup steps spelled out |

---

## 2. Core idea: how syntax errors become impossible

Users never type JSON punctuation. They edit **values** through controls, and the app writes the text.

1. **Open:** the file is parsed into a syntax tree that remembers where every key, value, and comment sits in the text.
2. **Edit:** each GUI action (rename key, change value, add item, delete, move) becomes a small, precise text edit made by a trusted library. Text outside the edit stays as it was, comments included.
3. **Re-parse:** after every edit the text is parsed again, and the tree view refreshes from it. If an edit ever produced invalid text (a bug), it is rejected and rolled back automatically.
4. **Save:** the text is written to disk atomically (temp file, then rename), so a crash mid-save can't corrupt the file.

Because the GUI only ever applies validated edits, the file on disk is always valid JSON (or JSONC/JSON5).

---

## 3. Technology stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Tauri 2** | Small native .exe (~10 MB) using Windows' built-in Edge WebView2 |
| Backend (small) | **Rust**, via Tauri | File read/write, atomic saves, backups, recovery drafts, watching files for outside changes. Kept minimal: you'll rarely touch it |
| UI | **React + TypeScript**, built with **Vite** | Most widely documented; TypeScript catches many bugs before running |
| JSON/JSONC engine | **jsonc-parser** (Microsoft) | The parser VS Code uses. Handles comments and trailing commas, and makes format-preserving edits |
| JSON5 | **json5** package + custom adapter | See Phase 3 risk note |
| Schema validation | **Ajv** + **ajv-formats** | Standard JSON Schema validator (drafts 07, 2019-09, 2020-12) |
| Raw text editor | **Monaco** | VS Code's editor component, with JSON error highlighting built in |
| Compare | **jsondiffpatch** (or a small custom diff) | Structural diff by key/path, not by line |
| Tests | **Vitest** | Fast unit tests for the document engine |
| State | **Zustand** | Simple, beginner-friendly state store for tabs and documents |

---

## 4. Architecture

```
┌─────────────────────────── JSONsetRight window ───────────────────────────┐
│  Menu / Toolbar   [Open] [Save] [Undo] [Redo] [Format] [View: Tree ▾]  │
│  Tabs:  appsettings.json ●  |  tsconfig.json  |  + …                    │
├───────────────────────────────┬─────────────────────────────────────────┤
│  Tree view                    │  Details panel                          │
│  ▾ { } root                   │  Key:   [ Logging        ]              │
│    ▾ { } Logging              │  Type:  [ Object ▾ ]                    │
│        "LogLevel"  { }        │  Schema: "Logging configuration"        │
│    ☑ AllowedHosts  "*"        │  ⚠ required: "LogLevel"                 │
├───────────────────────────────┴─────────────────────────────────────────┤
│  Problems: 1 schema warning · JSONC · UTF-8 · CRLF · Schema: appsettings│
└─────────────────────────────────────────────────────────────────────────┘
```

**Modules (frontend, `src/`):**

- `engine/` — pure TypeScript, no UI. Easiest part to test.
  - `document.ts` — holds the file's text, its parsed tree, dialect (JSON/JSONC/JSON5), indent style, line endings, BOM.
  - `edits.ts` — the only code allowed to change the text: `setValue`, `renameKey`, `insert`, `remove`, `move`, `changeType`. Each returns a new text or an error.
  - `history.ts` — undo/redo. Files are < 1 MB, so each step simply stores the full text. Simple and reliable.
  - `validate.ts` — duplicate-key detection, number checks, schema validation via Ajv.
  - `schema/` — schema discovery, resolution, hint lookup ("what's allowed at this path?").
  - `format.ts` — "Format document" with chosen indent.
- `ui/` — React components: `TreeView`, `ValueEditors/*`, `TableView`, `RawEditor`, `CompareView`, `Tabs`, `ProblemsPanel`, `SettingsDialog`.
- `store/` — Zustand store: open tabs, active tab, settings.

**Backend (`src-tauri/`, Rust):** commands `read_file`, `write_file_atomic`, `make_backup`, `save_recovery_draft`, `list_recovery_drafts`, `watch_file`.

**App data location:** `%LOCALAPPDATA%\JSONsetRight\` → `settings.json`, `backups\`, `recovery\`, `schema-cache\`.

---

## 5. Feature specifications

### 5.1 Tree view (v1)
- Collapsible nodes showing type icons: `{ }` object, `[ ]` array, `"a"` string, `#` number, `☑` boolean, `∅` null.
- Inline editing of keys and values; Details panel for the selected node.
- Right-click menu: Add child / Add sibling / Duplicate / Delete / Change type / Copy path / Copy value as JSON.
- Drag-and-drop to reorder array items and object keys.
- Search box: filter by key or value, with matches highlighted.
- Keyboard: arrows to navigate, Enter to edit, Del to delete, Ctrl+Z / Ctrl+Y, Ctrl+S.
- Comments in JSONC files appear as tooltips on the nearest node and are always preserved.

### 5.2 Typed value editors (v1)
| Type | Editor | Prevents |
|---|---|---|
| String | Text box (multi-line toggle) | Unescaped quotes, backslashes, and newlines. Escaping is automatic |
| Number | Number box | Letters, `NaN`, `Infinity`, leading zeros. Warns when a number exceeds safe precision (> 2^53) |
| Boolean | Checkbox / toggle | Typos like `True` or `"false"` |
| Null | Fixed "null" chip | — |
| Object / Array | Expand in tree; "Add" button | — |

### 5.3 Guardrails (v1, schema parts v2)
- **Duplicate keys:** rename and add are rejected with an inline message. Duplicates already in an opened file are flagged in Problems.
- **Type-change warning:** changing object/array → scalar, or anything that discards child data, shows a confirmation listing what will be lost (also undoable).
- **Schema hints (v2):** enum → dropdown; "Add property" lists allowed/known keys with descriptions; required-but-missing keys flagged; `default` values pre-filled when adding; `description` shown as help text; min/max/pattern checked live.

### 5.4 Formatting & dialects
- On open, detect: dialect, indent (spaces/tabs, width), line endings (CRLF/LF), BOM, trailing newline. All are preserved on save.
- **Format document** command re-indents using the chosen style (Settings: 2 spaces default).
- Trailing commas: tolerated on open; Settings choose **Keep / Remove** on save (default Keep).
- Dialect shown in status bar. Saving a JSONC file as strict JSON (strip comments) is a separate, explicit "Save as strict JSON…" action.

### 5.5 Safety (v1)
- **Undo/redo:** unlimited per tab, covering every edit, including drag-moves and type changes.
- **Backups:** before each save, the previous version is copied to `%LOCALAPPDATA%\JSONsetRight\backups\` (last 5 per file, configurable). Kept out of your project folders so git repos stay clean. "Restore from backup…" menu item.
- **Auto-recovery:** unsaved changes saved as drafts every 30 seconds. After a crash, the app offers to restore them on next launch.
- **Atomic save:** write to a temp file, then replace, so the original is never left half-written.
- **External changes:** if the file changes on disk (e.g. edited in VS Code), the app prompts: Reload / Keep mine / Compare.
- **Save with schema errors:** dialog lists the problems; buttons "Go to first problem" / "Save anyway" / "Cancel".

### 5.6 Schemas (v2)
Discovery order:
1. `$schema` in the file (local path, or URL fetched once and cached for offline use)
2. A manual pairing the user chose earlier (remembered per file path)
3. Filename-pattern rules in Settings (e.g. `appsettings*.json` → `C:\schemas\appsettings.schema.json`)
4. None. The app still guarantees valid syntax

Status bar shows the active schema; clicking it lets you change or detach it.

### 5.7 Raw mode (v2)
- Toggle per tab between GUI and Raw (Monaco).
- Live red squiggles for syntax errors, plus schema-aware autocomplete.
- Edits in Raw mode are applied to the tree **only when the text is valid**. Switching back to the tree while the text is invalid is blocked, with an explanation.
- Raw edits are part of the same undo history.

### 5.8 Table view (v3)
- Available on any array of objects. Columns = union of keys; rows = items.
- Cells use the same typed editors. Missing keys shown as empty cells and added only when filled.
- Add/delete/reorder rows; sort for viewing only (doesn't change file order unless confirmed).

### 5.9 Compare (v3)
- Pick two open tabs (or a tab vs. its saved/backup version).
- Side-by-side trees highlighting added / removed / changed values by path, ignoring formatting and key order differences.
- Copy a value from one side to the other.

### 5.10 Settings
Theme (System/Light/Dark), indent style, trailing-comma policy, backup count, auto-recovery interval, schema mapping rules, recent files.

---

## 6. Phased roadmap

Each milestone ends with a working app, a git commit, and a tag.

### Phase 0 — Setup (one session)
- Install prerequisites (see §8).
- `git init`, create the GitHub repo, `.gitignore`.
- Scaffold Tauri 2 + React + TypeScript project; confirm an empty window launches.
- Add Vitest; add a `samples/` folder of test JSON/JSONC files.

### Phase 1 — Core editor (v1)
1. **M1 Engine:** document model, parse/edit/re-parse loop, undo/redo, with unit tests. Key test: *opening and saving an unchanged file produces identical bytes.*
2. **M2 Open/Save:** file dialogs, atomic save, encoding/line-ending/BOM preservation, backups.
3. **M3 Tree view:** display, selection, expand/collapse, Details panel, search.
4. **M4 Editing:** typed editors, add/delete/rename/duplicate, drag-and-drop, type-change warnings, duplicate-key blocking.
5. **M5 Tabs & safety:** multiple tabs, unsaved-dot indicator, close prompts, auto-recovery, external-change detection.
6. **M6 Polish & release:** theming, keyboard shortcuts, Settings dialog, Format document, trailing-comma policy, build portable `JSONsetRight.exe`, publish as GitHub Release **v1.0**.

### Phase 2 — Schemas & raw mode (v2)
7. **M7 Schema engine:** Ajv integration, discovery (3 methods), cache, Problems panel.
8. **M8 Schema-aware UI:** enum dropdowns, add-property suggestions, required flags, descriptions, defaults, save-time warning dialog.
9. **M9 Raw mode:** Monaco integration, validity-gated sync, shared undo. Release **v2.0**.

### Phase 3 — Power features (v3)
10. **M10 JSON5:** open, edit, save (see risk below).
11. **M11 Table view.**
12. **M12 Compare view.** Release **v3.0**.

---

## 7. Risks & open decisions

| Risk | Plan |
|---|---|
| **JSON5 format preservation.** No mainstream library edits JSON5 while keeping comments and unquoted keys. | **Resolved in M10:** JSONsetRight's own JSON5 parser and offset-based editor keep comments, quoting and layout. |
| **SmartScreen warning.** Unsigned portable .exe files trigger "Windows protected your PC" for teammates. | Acceptable for internal use ("More info → Run anyway"). Code-signing certificate (~$100–300/yr) can be added later. |
| **WebView2 requirement.** | Built into Windows 11 and current Windows 10. The portable build will show a clear message if it's missing. |
| **"Portable" settings location.** | Settings in `%LOCALAPPDATA%`. If you later want a USB-stick mode, add "store settings next to the exe" when a `portable.flag` file is present. |
| **Large numbers** (> 2^53) lose precision in JavaScript. | The engine edits text, not parsed numbers, so untouched values are never altered. Editing such a value shows a warning. |
| **Remote `$schema` URLs** need internet once. | Cached after first fetch; works offline afterward. |

---

## 8. Prerequisites to install (Phase 0, step by step later)

1. **Node.js LTS** (includes npm)
2. **Rust** via `rustup` (Tauri's backend compiler)
3. **Visual Studio C++ Build Tools** ("Desktop development with C++" workload), which Rust needs on Windows
4. **Git** and **GitHub CLI** (`gh`), then sign in with `gh auth login`
5. VS Code extensions: *rust-analyzer*, *Tauri*, *ESLint*

WebView2 is already present on Windows 11.

---

## 9. Definition of done for v1
- Opens any valid JSON/JSONC config file under 1 MB; an unchanged save is byte-identical.
- No GUI action can produce invalid JSON (covered by automated tests).
- Duplicate keys cannot be created; destructive type changes require confirmation.
- Undo/redo works across all edit types; backups and crash recovery verified manually.
- Runs as a single portable `JSONsetRight.exe` downloaded from a GitHub Release.
