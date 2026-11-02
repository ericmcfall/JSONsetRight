# Schemas

A **JSON Schema** is a separate file that describes what another JSON file may contain: which
settings exist, what type each one is, which values are allowed, which are required, and what they
mean. Many programs publish schemas for their settings files, for example on
[schemastore.org](https://www.schemastore.org).

When a file has a schema, JSONsetRight becomes much more helpful:

- **It checks the file.** Problems are listed in plain language ("Must be one of: development,
  staging, production"), marked in the tree, and shown in the details panel.
- **It explains settings.** The schema's description of the selected setting appears at the top of
  the details panel.
- **It offers choices.** When only certain values are allowed, the value editor becomes a dropdown.
- **It suggests settings.** The **Add property** name box lists the settings the schema knows
  about, with their descriptions. New settings start with the schema's default value.
- **It lists what's missing.** Required settings that are missing appear as **+ name** buttons.
- **It shows defaults.** Under the value you'll see *Default: …* with a **Use default** link.
- **It warns on save.** Saving a file that breaks its schema shows the problems and lets you choose
  **Save anyway**, **Show first problem**, or **Cancel**.

## How JSONsetRight finds a file's schema

JSONsetRight looks in this order and uses the first one it finds:

1. **A schema you chose for this file** (see below).
2. **The file's own `"$schema"` setting**, a top-level setting that names its schema, for example:
   ```json
   { "$schema": "https://json.schemastore.org/package.json", "name": "my-app" }
   ```
   It can be a web address, or a path relative to the file such as `"./app.schema.json"`.
3. **A filename rule** from [Settings](11-settings.md#schema-rules), for example "files named
   `appsettings*.json` use `C:\schemas\appsettings.schema.json`".

The status bar shows the result: **Schema: name**, **No schema**, **Loading schema…**, or
**⚠ Schema not loaded** (hover over it to see why).

## Choosing a schema for a file

Click the schema item in the status bar. The schema dialog shows which schema is in use and why,
and lets you:

| Button | What it does |
|---|---|
| **Choose a schema file…** | Use a schema file from your PC for this file |
| *web address* + **Use** | Use a schema from the web, e.g. `https://json.schemastore.org/tsconfig.json` |
| **Don't use a schema** | Turn schema checking off for this file |
| **Back to automatic** | Forget your choice; use `$schema` or a filename rule again |
| **Reload schema** | Re-read the schema files and download web schemas again (use this after a schema changes) |

Choices are remembered per file. The file has to be saved somewhere before you can choose a schema for it.

## Schemas from the web

Web schemas are downloaded the first time they're needed and kept on your PC, so they keep working
without an internet connection. Use **Reload schema** to fetch a newer copy.

## When a schema problem is reported

Schema problems aren't syntax errors: the file is valid JSON, but it doesn't follow the rules the
program expects. Programs reading the file may reject it or behave unexpectedly. Typical messages:

| Message | Meaning |
|---|---|
| *Missing required property "name"* | The setting must exist; use the **+ name** button to add it |
| *"colour" is not a known property here* | The schema doesn't allow this setting; it may be misspelled |
| *Should be a number* | The value has the wrong type |
| *Must be one of: …* | Only the listed values are allowed |
| *Must be <= 65535* | The number is outside the allowed range |
| *Should be a valid hostname / email / uri* | The text isn't in the expected format |

## Notes

- JSONsetRight supports the common schema versions (draft-04, -06, -07, 2019-09 and 2020-12), including
  schemas that refer to other schema files.
- Deprecated settings (ones the schema says are no longer used) are marked *Deprecated* in the
  details panel.
