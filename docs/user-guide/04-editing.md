# Editing in the tree

Everything you change goes through SafeJSON's checks, so the file always stays valid. Every change
can be undone with **Undo** (**Ctrl+Z**).

## Selecting and moving around

- **Click** a line to select it. Its details appear on the right.
- **▸ / ▾** (or **→ / ←** on the keyboard) open and close groups and lists.
- **↑ / ↓** move the selection up and down.
- **←** on a closed item jumps to the group it belongs to.

## Changing a value

Select the setting, then use the **Value** editor in the details panel. Each type has its own editor:

| Type | Editor | How to finish |
|---|---|---|
| **Text** | A text box. It grows for longer text and accepts line breaks | Click elsewhere, or press **Ctrl+Enter** |
| **Number** | A number box. Invalid input turns red and is never saved | Press **Enter** or click elsewhere |
| **True / false** | A checkbox | Changes immediately |
| **Null** | Nothing to edit: change the type to give it a value | |
| **Object / list** | Shows how many entries it has; select an entry to edit it | |

Press **Escape** in a text or number box to cancel your typing.

**Under the text box**, SafeJSON shows how the text will be saved, for example
`"He said \"hi\""`. Quotes, backslashes and line breaks are converted automatically. You never
need to type escape codes yourself.

**Numbers** can be written as `42`, `-7`, `3.14`, or `1e6` (one million). SafeJSON rejects things
like `12px`, `1,000`, `.5`, or `NaN`, because standard JSON doesn't allow them. (JSON5 files are
more relaxed: there, `.5`, `+1`, hex numbers like `0xFF`, `Infinity` and `NaN` are accepted. See
[File types](09-file-types.md).) If a whole number
is too large for most programs to store exactly (more than about 9 million billion), SafeJSON
saves it exactly as you typed it and shows a warning.

### Editing directly in the tree

**Double-click** a value in the tree to edit it in place, then press **Enter** to save or **Escape**
to cancel. Double-clicking a true/false value flips it. Text that contains line breaks opens in the
details panel instead, so no line breaks are lost.

## Renaming a setting

- Select it and change the **Key** box in the details panel, then press **Enter**, or
- Double-click the name in the tree, or press **F2**.

SafeJSON won't accept an empty name, or a name already used by another setting in the same group.
List items don't have names; they're numbered by position.

## Adding settings and list items

Select the group (`{ }`) or list (`[ ]`) you want to add to. In the details panel:

- **For a group (Add property):** type a name, choose a type, and click **Add** (or press **Enter**).
- **For a list (Add item):** choose a type and click **Add**. The item is added at the end.

The new entry starts with a sensible empty value (`""`, `0`, `false`, `null`, `{}` or `[]`) and is
selected, ready for you to type its value.

If the file has a [schema](07-schemas.md), the name box suggests the settings the schema knows
about, new entries start with the schema's default value, and missing **required** settings are
listed with one-click **+** buttons.

## Deleting

Select the setting or item and press **Delete**, click **Delete** in the details panel, or
right-click it and choose **Delete**. The selection moves to the next item.

## Duplicating

Press **Ctrl+D**, or use **Duplicate**. The copy appears right after the original.
Duplicated settings in a group are named `name copy`, `name copy 2`, and so on; rename them as needed.

## Moving (changing the order)

- **Drag** a line up or down within the same group or list. A blue line shows where it will land.
- Or press **Alt+↑** / **Alt+↓**, or use **Move up** / **Move down**.

You can only reorder within the same group or list. To move a setting into a different group,
duplicate it there (copy its value) and delete the original.

> The order of settings in a group usually doesn't matter to programs, but it can make files easier to read.
> The order of items in a **list** often does matter.

## Changing a value's type

Use the **Type** dropdown in the details panel, or right-click → **Change type to**.

SafeJSON converts the value where it can: `5` becomes `"5"` as text, and `"42"` becomes `42` as a
number. If something would be lost, it asks first. For example, changing a group that contains
3 settings into text would delete those settings. You can undo any type change.

## Right-click menu

Right-click any line (or press **Shift+F10**):

| Item | What it does |
|---|---|
| **Rename key** (F2) | Rename the setting |
| **Duplicate** (Ctrl+D) | Copy it, placing the copy right after it |
| **Move up** / **Move down** (Alt+↑ / Alt+↓) | Reorder it |
| **Delete** (Del) | Remove it |
| **Change type to** | Convert it to another type |
| **Copy path** | Copy its location, e.g. `servers[0].host` |
| **Copy value as JSON** | Copy its value as JSON text, to paste elsewhere |

## Searching

Type in the **Search** box (**Ctrl+F**). The tree shows only matching settings, plus the groups
that contain them, with matches highlighted. The search covers both names and values and ignores
capital letters. Clear the box to see everything again. Drag-to-reorder is turned off while
searching.

## Comments

Files that allow comments (see [File types](09-file-types.md)) may contain notes like
`// The port to listen on`. SafeJSON shows a setting's comment in green next to it in the tree,
and in full in the details panel. Comments are always kept exactly as they are when you edit and
save. SafeJSON doesn't add, edit or delete comments in the tree; use [Text mode](06-text-mode.md)
for that.

## Undo and redo

- **Undo** (**Ctrl+Z**) steps back one change at a time, as far back as when you opened the file.
- **Redo** (**Ctrl+Y** or **Ctrl+Shift+Z**) re-applies what you undid.
- Making a new change after undoing clears the redo history.

While you're typing in a box, Ctrl+Z and Ctrl+Y undo and redo your typing in that box instead.
