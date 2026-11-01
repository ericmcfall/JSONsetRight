# File types and formatting

## The three kinds of JSON file

SafeJSON works with three closely related formats. It detects the format automatically and shows
it in the status bar.

| Status bar | Format | Typical files | What it allows |
|---|---|---|---|
| **JSON** | Standard JSON | `package.json`, `appsettings.json`, API data | Only the strict rules: double-quoted names and text, no comments, no trailing commas |
| **JSON with Comments** | JSONC | VS Code `settings.json`, `tsconfig.json` | Standard JSON plus `//` and `/* */` comments and trailing commas |
| **JSON5** | JSON5 | `.json5` config files | Also unquoted names, 'single quotes', hex numbers (`0xFF`), `Infinity`, `NaN`, `.5`, `+1`, and text continued over several lines |

A *trailing comma* is a comma after the last item: `[1, 2, 3,]`.

**SafeJSON never changes a file's format by itself.** A standard JSON file stays standard JSON:
SafeJSON never adds comments to it, and [text mode](06-text-mode.md) refuses comments and trailing
commas in it, because programs that expect standard JSON would fail to read them.

### JSON5 files keep their style

In JSON5 files, SafeJSON writes new content the way the file already does: if the file uses
unquoted names and single-quoted text, new settings follow suit. Renamed settings and edited text
keep their original quoting. (Format is not available for JSON5 files yet.)

## What SafeJSON keeps exactly as it was

When you change something, SafeJSON rewrites only that part of the file. Everything else stays
byte-for-byte the same:

- comments, wherever they are
- indentation (spaces or tabs, and how many)
- line endings (Windows **CRLF** or Unix **LF**)
- the order of settings
- blank lines and alignment
- lists written on one line, like `["a", "b"]`, which stay on one line
- numbers exactly as written (`1.50` stays `1.50`; very large numbers aren't rounded)
- a byte-order mark (BOM) at the start of the file, if it had one

This keeps changes small and easy to review, which matters if your files are tracked in a system such as git.

New content is indented to match the file.

## Formatting

**Format** (**Shift+Alt+F**) re-indents the whole file neatly, one setting per line, keeping
comments. It's useful for files that were written on one long line. Format is one undo step.

By default, Format keeps the file's current indentation style. You can choose 2 spaces, 4 spaces
or tabs instead in [Settings](11-settings.md).

## Trailing commas

JSONC files may contain trailing commas. In [Settings](11-settings.md), choose:

- **Keep them** (default), or
- **Remove them when saving:** SafeJSON removes them as an undoable step just before saving.

JSON5 files always keep their trailing commas, since they're a normal part of JSON5.

## Encoding and size limits

- Files must be **UTF-8** text, the standard for JSON. Other encodings are refused with a message,
  rather than risking damage to the file.
- Files up to **10 MB** can be opened. SafeJSON is designed for configuration files, which are
  usually far smaller.

## Large numbers

Most programs can only store whole numbers up to about 9 million billion (9,007,199,254,740,991)
exactly. SafeJSON keeps larger numbers exactly as written, but shows a warning in the
**Problems** panel, because the program reading the file may round them.

## Duplicate names

If a file somehow contains the same setting name twice in one group, SafeJSON reports it in the
**Problems** panel. Most programs silently use only the last one, which is a common source of
confusing bugs. SafeJSON never lets you create duplicates yourself.
