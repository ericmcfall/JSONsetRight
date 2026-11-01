# Troubleshooting and FAQ

## Starting SafeJSON

**"Windows protected your PC" appears.**
Click **More info**, check the publisher is **Eric McFall**, and click **Run anyway**. This warning
appears for new releases until Windows has seen them often.

**"Smart App Control blocked an app" / "An Application Control policy has blocked this file".**
You're running SafeJSON 1.0 or 2.0, which aren't signed. Download version 3.0 or later.

**Nothing happens, or an error mentions WebView2.**
SafeJSON needs Microsoft Edge WebView2, which comes with Windows 11 and current Windows 10. Run Windows
Update, or install the "Evergreen WebView2 Runtime" from Microsoft's website.

## Opening files

**"…isn't valid JSON yet (line 3, column 5: …)".**
The file has a mistake. SafeJSON opens it in [text mode](06-text-mode.md) so you can fix it.
See the table of common mistakes there.

**"…is not UTF-8 text, so SafeJSON can't open it safely."**
The file uses an older text encoding. Open it in Notepad, choose **File → Save as**, set
**Encoding** to **UTF-8**, and save. Then open it in SafeJSON.

**"…is larger than SafeJSON supports (10 MB)."**
SafeJSON is designed for configuration files. Use a text editor for very large data files.

**Table is greyed out.**
Select a list whose items are all groups of settings (`{ }`), or something inside one. See
[Table view](05-table-view.md).

## Editing

**My number turns red.**
It isn't a valid JSON number. Use digits with an optional `-`, one `.` for decimals, and `e` for
powers of ten: `1500`, `-2.5`, `1e6`. Don't use thousands separators or units (`1,500`, `12px`).

**I can't add a setting: "This object already has a key named …".**
Each name can appear only once in a group. Choose another name or edit the existing setting.

**I need to move a setting into another group.**
Copy its value (right-click → **Copy value as JSON**), add a setting with the same name in the
other group, paste the value in [text mode](06-text-mode.md) or re-enter it, then delete the
original.

**Format says it isn't available.**
Format isn't available for JSON5 files yet. Your edits still keep the file's layout.

**I want to add or edit comments.**
Use [text mode](06-text-mode.md) in a JSON with Comments or JSON5 file. Standard JSON files can't
have comments.

## Schemas

**The status bar says "⚠ Schema not loaded".**
Hover over it to see why. Common causes: the schema file was moved, the web address is wrong, or
there's no internet connection and the schema hasn't been downloaded before. Click the item to
choose another schema or **Reload schema**.

**The schema is wrong or out of date for my program's version.**
Click the schema item in the status bar and choose a different schema, or **Don't use a schema**.
Schema problems never stop you saving.

**Every setting is "not a known property here".**
The file is probably being checked against the wrong schema. Check which one in the schema dialog.

## Saving

**"Can't be saved until it's valid JSON."**
Text mode has a mistake; the red banner shows where. Fix it, then save.

**"Windows denied access to …"**
The file is read-only, in a protected folder (such as Program Files), or open and locked in
another program. Close the other program, or use **Save as…** to save elsewhere.

**I saved something by mistake.**
Click **Backups…** and restore the previous version, then save again. Or press **Ctrl+Z**
(undo still works after saving) and save again.

## FAQ

**Does SafeJSON send my files anywhere?**
No. Files are read and saved only on your PC. The only internet access is downloading schemas from
web addresses that a file (or you) names.

**Will SafeJSON change parts of my file I didn't touch?**
No. Only the part you change is rewritten; comments, spacing, order and line endings are kept. The
exceptions are things you ask for: **Format**, and removing trailing commas if you turned that on.

**Can several people edit the same file?**
SafeJSON notices when another program or person saves the file while you have it open, and
asks before overwriting their changes. It doesn't merge edits automatically, but
[Compare](08-compare.md) helps you combine them.

**Can I use SafeJSON on a Mac or Linux?**
Not currently. SafeJSON is built for Windows.

**Where are my backups and settings?**
In `%LOCALAPPDATA%\SafeJSON`. See [Installing](01-installing.md#where-safejson-keeps-its-own-data).
