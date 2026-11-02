# Glossary

**Array (list)**
An ordered list of values, written `[1, 2, 3]`. Items are numbered from 0. Badge: `[ ]`.

**Backup**
A copy of a file's previous version, kept automatically each time you save. See [Backups](10-safety.md#backups).

**Boolean (true / false)**
A value that is either `true` or `false`. Badge: `✓`.

**BOM (byte-order mark)**
An invisible marker some programs put at the start of a text file. JSONsetRight keeps it if it's there.

**Comment**
A note in a file that programs ignore: `// like this` or `/* like this */`. Allowed in JSON with
Comments and JSON5, not in standard JSON.

**CRLF / LF**
The two styles of line ending. Windows traditionally uses CRLF; Linux and macOS use LF. JSONsetRight
keeps whichever the file uses.

**Default**
The value a [schema](07-schemas.md) says a setting has when it isn't specified.

**Deprecated**
A setting the schema says is no longer used, or will be removed.

**Enum (allowed values)**
A fixed list of values a schema allows for a setting. JSONsetRight shows these as a dropdown.

**Escape characters**
Codes like `\"` or `\n` used inside JSON text to represent quotes and line breaks. JSONsetRight adds
them automatically; you never type them.

**JSON**
JavaScript Object Notation: a common text format for settings and data, made of objects, arrays,
text, numbers, true/false and null.

**JSONC (JSON with Comments)**
JSON that also allows comments and trailing commas. Used by VS Code and others.

**JSON5**
A friendlier extension of JSON that also allows unquoted names, single quotes, hex numbers and more.

**Key (name)**
The name of a setting in an object, such as `"port"` in `"port": 8080`.

**Null**
A deliberately empty value, written `null`. Badge: `∅`.

**Number**
A numeric value such as `8080`, `-1.5` or `1e6`. Badge: `#`.

**Object (group)**
A group of named settings, written `{ "name": value, … }`. Badge: `{ }`.

**Path**
The location of a setting in a file, such as `servers[0].host`: the `host` setting of the first item
in the `servers` list.

**Property**
Another word for a named setting in an object (a key and its value).

**Required**
A setting a schema says must be present.

**Schema (JSON Schema)**
A file describing what another JSON file may contain. See [Schemas](07-schemas.md).

**String (text)**
A text value, written in quotes: `"hello"`. Badge: `Aa`.

**Trailing comma**
A comma after the last item in a list or object: `[1, 2,]`. Allowed in JSONC and JSON5 only.

**UTF-8**
The standard way of storing text in files, and the encoding JSON files use.

**Value**
The data part of a setting: text, a number, true/false, null, an object or a list.
