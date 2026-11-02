# Quick start

This walk-through takes about five minutes. You'll open a file, change some values, add a new
setting, save, and undo a mistake.

## 1. Open a file

1. Start JSONsetRight. The welcome screen appears.
2. Click **Open a file…** (or press **Ctrl+O**) and choose a `.json` file.

The file opens in a **tab**. On the left is the **tree**, which shows everything in the file. On
the right is the **details panel**, which shows the item you've selected.

> **Tip:** to practise without risk, copy a file first and open the copy. You can always undo,
> but practising on a copy is reassuring.

## 2. Look around the tree

Each line in the tree is one setting. For example:

```
▾ { }  appsettings.json  {4}
    Aa  AllowedHosts: "*"
  ▾ { }  Logging: {1}
    ▸ { }  LogLevel: {2}
```

- The **badge** at the start of each line shows what kind of value it is: `Aa` text, `#` number,
  `✓` true/false, `{ }` a group of settings (an *object*), `[ ]` a list (an *array*), `∅` empty.
- Click **▸** to open a group, and **▾** to close it.
- The part before the colon is the setting's **name** (its *key*), and the part after it is its **value**.

## 3. Change a value

1. Click a setting with a `#` (number) badge.
2. In the details panel on the right, change the number in the **Value** box.
3. Press **Enter**.

The change appears in the tree, and a **●** dot on the tab shows you have unsaved changes.

Now try typing something that isn't a number, such as `12px`. The box turns red and explains what
it expects. JSONsetRight won't save an invalid value, so you can't break the file.

For a text value (`Aa`), type anything you like, including quotes `"` and backslashes `\`.
JSONsetRight handles the special characters for you.

For true/false (`✓`), just tick or untick the checkbox.

## 4. Add a new setting

1. Click the group (`{ }`) you want to add to. To add at the top level, click the first line of the tree.
2. In the details panel under **Add property**, type a name for the new setting.
3. Choose its type (for example **Text** or **Number**) and click **Add**.
4. The new setting is selected, so type its value straight away.

If you type a name that already exists in that group, JSONsetRight tells you and won't add it.
Duplicate names are a common cause of hard-to-find mistakes.

## 5. Save

Click **Save** (or press **Ctrl+S**). The **●** dot disappears.

JSONsetRight keeps a copy of the previous version as a **backup** each time you save, so you can go
back later with **Backups…**.

## 6. Undo a mistake

Delete something: select it and press **Delete**. Then click **Undo** (or press **Ctrl+Z**).
It's back. **Undo** remembers every change since you opened the file, and **Redo** (**Ctrl+Y**)
re-applies what you undid.

## What next?

- [A tour of the window](03-window-tour.md) explains every part of the screen.
- [Editing in the tree](04-editing.md) covers renaming, moving, duplicating and more.
- If your file has a **schema** (a description of what it may contain), JSONsetRight can check the
  file and suggest settings: see [Schemas](07-schemas.md).
