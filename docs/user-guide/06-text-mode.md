# Text mode

Text mode shows the file as text in a code editor, the same editor used in Visual Studio Code. It's
for people who prefer typing JSON, for quick large edits like pasting a block, and for **fixing files
that aren't valid JSON**.

Click **Text** in the toolbar, or press **Ctrl+Shift+T**, to switch. Click **Tree** (or press
**Ctrl+Shift+T** again) to switch back.

## How it stays safe

What you type is **applied to the file only once it's valid**:

- When you pause typing, SafeJSON checks the text. If it's valid, the change is applied, and each
  pause becomes one undo step.
- If it isn't valid, a red banner shows exactly where the problem is, for example
  *"Line 5, column 3: Expected ','"*. Click **Go to problem** to jump there.
- **While there's a problem, you can't save or switch to the tree.** Fix the text first.
  The rest of SafeJSON keeps using the last valid version.

The editor underlines mistakes as you type, and if the file has a [schema](07-schemas.md), it
suggests setting names and values as you type (press **Ctrl+Space** to see suggestions).

**Standard JSON files stay standard.** If the file was plain JSON when you opened it, text mode
won't accept comments or trailing commas, because the programs that read it might not understand them.
See [File types](09-file-types.md).

## Opening files that aren't valid JSON

If you open a file that has a mistake in it, SafeJSON opens it in text mode instead of refusing
it. A message says what's wrong and where. Fix the mistake, and once the text is valid the tree
and saving become available. The file's original line endings and encoding are kept.

Common mistakes and their messages:

| Message | Usual cause |
|---|---|
| *Expected ','* | A missing comma between two settings or list items |
| *Expected a property name in double quotes* | A comma after the last setting (in standard JSON), or a name without quotes |
| *Expected a value* | An extra comma, like `[1, , 2]`, or nothing after a `:` |
| *String is not closed* | A missing closing `"` |
| *Expected '}'* or *Expected ']'* | A missing closing bracket |
| *Unexpected content after the end of the JSON* | Extra text after the final `}` |

## Editor features

The code editor has its own tools:

| Keys | Action |
|---|---|
| **Ctrl+F** / **Ctrl+H** | Find / find and replace |
| **Ctrl+Space** | Show suggestions |
| **Shift+Alt+F** | Format the text |
| **Ctrl+Z** / **Ctrl+Y** | Undo / redo typing |
| **Alt+↑** / **Alt+↓** | Move a line up or down |
| **Ctrl+/** | Comment or uncomment a line (in files that allow comments) |

**Undo** on the toolbar undoes whole applied changes, and also throws away any text that wasn't
valid yet.

## Checking a selected setting

Clicking a problem in the **Problems** panel while in text mode moves the cursor to that setting in
the text.
