# Comparing files

**Compare…** shows exactly how the current file differs from another version of the same data.
Common uses:

- "What have I changed since I last saved?"
- "How does the test server's config differ from the live one?"
- "What did this file look like before last Tuesday's change?"

## Starting a comparison

Click **Compare…** in the toolbar and choose what to compare with:

| Choice | Compares with |
|---|---|
| **Saved version** | The file as it was when you last saved, so you see your unsaved changes. Only available when there are unsaved changes |
| *Another open tab* | Another file that's open in SafeJSON. Changes can be copied in **both** directions |
| **Backup** | One of the automatic [backups](10-safety.md#backups) of this file |
| **Another file…** | Any file you choose |

## Reading the comparison

The current file is on the **left** and can be edited. The other version is on the **right**.

Only the **data** is compared. These differences are ignored:

- spacing, indentation and line breaks
- comments
- the order of settings within a group
- quote style (in JSON5 files)
- number spelling, e.g. `1.0` and `1`

Lists are lined up by matching items, so inserting one item shows as a single addition instead of
making everything after it look changed.

Each difference is one row:

| Label | Meaning |
|---|---|
| **Changed** | The setting exists in both, with different values (or different types) |
| **Only in this file** | The setting or item exists only on the left |
| **Only in the other** | The setting or item exists only on the right |

The filter buttons at the top show the count of each kind and let you show just one kind.
Click a highlighted location (left column) to show it in the tree.

If there are no differences, SafeJSON says so: both contain the same data.

## Copying differences across

Each row has buttons to make the two sides match at that spot:

| Row | Button | Effect |
|---|---|---|
| Changed | **← Use theirs** | Copy the right-hand value into this file |
| Only in the other | **← Add here** | Add it to this file |
| Only in this file | **Remove here** | Remove it from this file |

When the right side is **another open tab**, there are also buttons for the opposite direction:
**Use mine →**, **Add there →** and **Remove there**.

The list updates after every change. Each change is one undo step in the file it changed, so
undo changes to the other file in that file's own tab.

Click **‹ Done comparing** to return to the tree.
