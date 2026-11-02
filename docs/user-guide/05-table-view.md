# Table view

Many files contain **lists of similar items**, such as users, products or servers, where each item
has the same kinds of settings. Table view shows such a list as a grid, like a spreadsheet: one row
per item, one column per setting.

```
 #   sku     name     qty    price   active
 1   A-100   Bolt     250    0.12    ☑
 2   B-200   Nut      1200   0.05    ░░░░░    ← hatched: this item has no "active" setting
 3   C-300   Washer   0      0.02    ☐
```

## Opening a table

1. In the tree, select a list whose items are groups (`[ ]` containing `{ }` items), or anything inside such a list.
2. Click **Table** in the toolbar, or **▦ Show this list as a table** in the details panel.

If **Table** is greyed out, the selection isn't inside a list of groups. Table view needs a list
where every item is a group of settings.

Click **‹ Tree** (top left) to go back to the tree.

## Reading the table

- **Columns** are every setting name that appears in any row, in the order first seen. The small
  badge shows the column's usual type. Hover over a column name to see how many rows have it, plus
  the schema's description of it, if there is one.
- **Hatched (striped) cells** mean that row doesn't have that setting at all, which is different
  from having an empty value.
- **True/false** cells show a checkbox you can click directly.
- **Groups and lists** inside a cell show as `{2} ›` or `[3] ›`. Click to open them in the tree.
- **⛔** next to a row number, or a red line under a cell, marks a problem. Hover to read it.

## Editing cells

- **Click** a cell to select it. Use the **arrow keys** or **Tab** to move between cells.
- **Double-click**, or press **Enter** or **F2**, to edit the selected cell. Press **Enter** to save
  or **Escape** to cancel.
- Numbers are checked as you type, just like in the details panel.
- If the schema lists allowed values for a column, editing shows a dropdown.
- **Space** toggles a true/false cell.
- **Delete** removes that setting from the row; the cell becomes hatched.

**Filling in a hatched cell** adds the setting to that row, placed in column order, with the
column's usual type.

## Rows

Hover over a row number to see its buttons:

| Button | What it does |
|---|---|
| **↑** / **↓** | Move the row up or down |
| **⧉** | Duplicate the row |
| **×** | Delete the row |

**+ Add row** (top right) adds a new row at the end, with every column filled in with an empty
value or the schema's default.

## Columns

- **+ Add column** adds an empty column. It becomes part of the file as soon as you fill in a cell.
- **Rename a column:** double-click its name. Every row that has the setting is renamed. If any
  row already has a setting with the new name, nothing is renamed and JSONsetRight explains why.
- **Remove a column:** hover over its name and click **×**. JSONsetRight asks before removing the
  setting from every row.

## Sorting

Click a column name to sort the rows by it. Click again to reverse the order (▲ / ▼), and a third
time to stop sorting. Numbers sort by value, text sorts naturally (`item2` before `item10`), and
rows without the setting go last.

**Sorting only changes what you see.** A banner reminds you that the file's order hasn't changed.
Click **Save this order to the file** to make the order permanent (one undo step), or **Unsort** to
go back to the file's order. Row moves are turned off while sorted.

## Undo

Every change in the table, including renaming or removing a column across all rows, is a single
undo step. Press **Ctrl+Z** to undo it.
