# A tour of the window

```
TOOLBAR      New  Open…  Save  Save as…  Undo  Redo  Format  Tree|Table|Text  Backups…  Compare…  [search]  Help  ⚙
TABS         settings.json ● ×   build.json5 ×
MESSAGE BAR  (notices appear here)

┌─ TREE ──────────────────────────────┬─ DETAILS PANEL ─────────────────────────┐
│ ▾ { } settings.json {5}             │ port                         Copy path  │
│     # port: 8080             (!)   │ KEY     [ port              ]           │
│     Aa host: "localhost"            │ TYPE    # [ Number ▾ ]                  │
│   ▸ { } logging: {2}                │ VALUE   [ 8080              ]           │
│                                     │ [Move up] [Move down] [Duplicate] …     │
└─────────────────────────────────────┴─────────────────────────────────────────┘
PROBLEMS     ⛔ port  Must be <= 65535                                    Schema
STATUS BAR   C:\config\settings.json   1 problem   Schema: app.schema.json   JSON   Spaces: 2   CRLF   UTF-8
```

## Toolbar

| Button | What it does | Shortcut |
|---|---|---|
| **New** | Starts a new, empty file in a new tab | Ctrl+N |
| **Open…** | Opens one or more files, each in its own tab | Ctrl+O |
| **Save** | Saves the current file | Ctrl+S |
| **Save as…** | Saves the current file under a new name or location | Ctrl+Shift+S |
| **Undo** / **Redo** | Steps backwards or forwards through your changes | Ctrl+Z / Ctrl+Y |
| **Format** | Re-indents the whole file neatly (see [Formatting](09-file-types.md#formatting)) | Shift+Alt+F |
| **Tree** / **Table** / **Text** | Switches how you view and edit the file ([Table view](05-table-view.md), [Text mode](06-text-mode.md)) | Ctrl+Shift+T switches between Tree and Text |
| **Backups…** | Restores an earlier saved version ([Backups](10-safety.md#backups)) | |
| **Compare…** | Compares this file with another version ([Comparing files](08-compare.md)) | |
| **Search box** | Shows only the settings whose name or value matches | Ctrl+F |
| **Help** | Opens this user guide in your web browser | F1 |
| **⚙** | Opens [Settings](11-settings.md) | Ctrl+, |

Hover over any button to see a short description. In a narrow window, the last buttons move to a
second row of the toolbar.

## Tabs

Each open file has a tab. A **●** after the name means the file has unsaved changes.

- Click a tab to switch to it, or press **Ctrl+Tab** to go to the next tab.
- Click **×**, middle-click the tab, or press **Ctrl+W** to close it. If it has unsaved changes,
  JSONsetRight asks whether to **Save**, **Don't save**, or **Cancel**.
- Opening a file that's already open just switches to its tab.

## Message bar

Information and warnings appear in a bar below the tabs, for example when a file was changed by
another program. Click **Dismiss** to hide the message.

## Tree

The tree shows the whole file as an outline. Each line shows:

| Part | Meaning |
|---|---|
| **▸ / ▾** | Opens or closes a group or list |
| **Badge** | The kind of value (see below) |
| **Name** | The setting's name (its *key*). In lists, items are numbered `[0]`, `[1]`, … |
| **Value** | The value, or `{3}` / `[5]` for a group or list with 3 or 5 entries |
| **// comment** | A comment written in the file next to this setting (hover to read it all) |
| **⛔ / ⚠** | A problem with this setting (hover to read it; shown as `(!)` in the diagram above). A small **●** on a closed group means something inside it has a problem |

### Value types (badges)

| Badge | Type | Example | Notes |
|---|---|---|---|
| `Aa` | **Text** | `"localhost"` | Any text, including line breaks |
| `#` | **Number** | `8080`, `0.5`, `-3`, `1e6` | Whole or decimal numbers |
| `✓` | **True / false** | `true` | Also called a *boolean* |
| `∅` | **Null (no value)** | `null` | A deliberately empty value |
| `{ }` | **Object** | `{ "a": 1 }` | A group of named settings |
| `[ ]` | **Array (list)** | `[1, 2, 3]` | An ordered list of values |

See [Editing in the tree](04-editing.md) for everything you can do here.

## Details panel

The right-hand panel shows the selected setting:

- **Path:** where the setting is in the file, such as `Logging.LogLevel.Default`. Click
  **Copy path** to copy it.
- **Schema help:** if the file has a [schema](07-schemas.md), a description of the setting appears here.
- **Key:** the setting's name, which you can rename here. For list items, **Position** shows the item's number.
- **Type:** change the kind of value. If the schema expects certain types, they're marked **(expected)**.
- **Value:** an editor suited to the type: a text box, a number box, a checkbox, or a dropdown when only certain values are allowed.
- **Add property / Add item:** shown for groups and lists.
- **Comments:** any comments the file has for this setting.
- **Move up**, **Move down**, **Duplicate**, **Delete**.

## Problems panel

Appears at the bottom when the file has problems. Each line shows where the problem is, what's
wrong, and where the check came from:

- **JSONsetRight:** built-in checks, such as duplicate names or numbers too large to store exactly.
- **Schema:** the file breaks a rule in its [schema](07-schemas.md).

Click a problem to jump to it.

## Status bar

The blue bar at the bottom shows, from left to right:

| Item | Meaning |
|---|---|
| File location | Where the file is saved, or "Not saved yet" |
| *N* problems | How many problems the file has |
| Schema | Which schema checks this file, if any. Click it to choose one ([Schemas](07-schemas.md)) |
| JSON / JSON with Comments / JSON5 | The file's type ([File types](09-file-types.md)) |
| Spaces: 2 / Tabs | How the file is indented |
| CRLF / LF | The file's line-ending style |
| UTF-8 / UTF-8 with BOM | The file's text encoding |

## Welcome screen

When no files are open, JSONsetRight shows **Open a file…**, **New file**, and your **Recent files**.
Click a recent file to reopen it.
