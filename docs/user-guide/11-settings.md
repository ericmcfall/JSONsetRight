# Settings

Click **⚙** at the right end of the toolbar, or press **Ctrl+,**. Changes apply and are saved
immediately. Click **Done** to close.

| Setting | Choices | What it does |
|---|---|---|
| **Theme** | Match Windows (default), Light, Dark | Colours of the app. *Match Windows* follows the light/dark choice in Windows settings, and switches when Windows does |
| **Format uses** | The file's current indentation (default), 2 spaces, 4 spaces, Tabs | Indentation used by the **Format** button. Normal edits always match the file |
| **Trailing commas** | Keep them (default), Remove them when saving | Whether commas before a closing bracket, such as `[1, 2,]`, are removed when saving. See [File types](09-file-types.md#trailing-commas) |
| **Backups per file** | 0 to 50 (default 5) | How many earlier versions to keep per file. 0 turns backups off |
| **Schema rules** | A list of pattern → schema | See below |
| **Recent files** | **Clear list** | Empties the list on the welcome screen |

## Schema rules

Schema rules give files a [schema](07-schemas.md) automatically based on their name, for files
that don't name their own schema.

1. Click **+ Add rule**.
2. In the first box, type a file-name pattern. `*` matches anything and `?` matches one character:
   - `appsettings*.json` matches `appsettings.json` and `appsettings.Development.json`
   - `*.config.json` matches any file ending in `.config.json`
   - Include a folder, as in `C:\projects\*\settings.json`, to match the whole path
3. In the second box, enter the schema's file path or web address, or click **…** to choose a file.

Click **×** to remove a rule. A file's own `"$schema"`, or a schema you chose for that file in the
schema dialog, takes priority over these rules.

## Where settings are stored

In `%LOCALAPPDATA%\JSONsetRight\settings.json`. To reset everything to the defaults, close JSONsetRight
and delete that file.
