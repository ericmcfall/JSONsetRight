# Installing JSONsetRight

## What you need

- **Windows 10 or Windows 11.**
- **Microsoft Edge WebView2.** This is part of Windows 11 and current Windows 10, so you almost
  certainly have it already.
- About 6 MB of disk space.

## Download

1. Open the JSONsetRight releases page on GitHub (your administrator can give you the link).
2. Under the newest release (marked **Latest**), click **JSONsetRight.exe** to download it.

JSONsetRight is **portable**: there is no installer. The `.exe` file *is* the app.

3. Move `JSONsetRight.exe` somewhere convenient, for example a `Programs` or `Tools` folder in your
   Documents. Avoid leaving it in Downloads, where it's easy to delete by accident.
4. To make it easy to start, right-click `JSONsetRight.exe` and choose **Pin to Start** or **Send to →
   Desktop (create shortcut)**.

## Starting JSONsetRight for the first time

Double-click `JSONsetRight.exe`.

JSONsetRight is **digitally signed** by its publisher, Eric McFall, using a Microsoft-verified
identity. You can check this yourself: right-click `JSONsetRight.exe` → **Properties** →
**Digital Signatures**.

Windows may still show a warning for a new release:

| You see | What to do |
|---|---|
| **"Windows protected your PC"** | Windows hasn't seen this release often yet. Click **More info**, check that the publisher is **Eric McFall**, then click **Run anyway**. This stops appearing as the release becomes known. |
| **"Smart App Control blocked an app"** or **"An Application Control policy has blocked this file"** | You have an old, unsigned version: SafeJSON 1.0 or 2.0 (JSONsetRight's former name). Download the latest JSONsetRight. |

## Opening files with JSONsetRight from File Explorer

You can open a JSON file straight into JSONsetRight:

1. In File Explorer, right-click a `.json` file.
2. Choose **Open with → Choose another app**.
3. Click **More apps → Look for another app on this PC**, find `JSONsetRight.exe` and select it.
4. Tick **Always use this app to open .json files** if you want double-clicking to use JSONsetRight.

You can also **drag files** from File Explorer onto the JSONsetRight window.

## Updating

Download the new `JSONsetRight.exe` and replace the old one. Your settings, recent files and
backups are kept, because they're stored separately (see below).

## Coming from SafeJSON?

JSONsetRight used to be called **SafeJSON**. Version 3.2 is the first under the new name, with the
same features. If you used SafeJSON before:

1. **Save your work in SafeJSON first.** JSONsetRight doesn't pick up unsaved changes or
   crash-recovery copies from SafeJSON.
2. **Settings start fresh.** JSONsetRight keeps its data in a new folder,
   `%LOCALAPPDATA%\JSONsetRight`, so your theme, schema rules, backup count, recent files and
   per-file schema choices need setting up again in [Settings](11-settings.md).
3. **Old backups stay where they were**, in `%LOCALAPPDATA%\SafeJSON\backups`. **Backups…** in
   JSONsetRight doesn't list them, but you can still open them: each folder there holds earlier
   versions of one file (`source.txt` says which), and you can open a `.bak` file with
   **Compare… → Another file…** after choosing **All files** in the file picker.
4. **Set up "Open with" again** for `JSONsetRight.exe` (see
   [Opening files with JSONsetRight from File Explorer](#opening-files-with-jsonsetright-from-file-explorer)).
5. **Delete the old program and folder when you're ready:** remove `SafeJSON.exe`, and once you
   no longer need its backups, the `%LOCALAPPDATA%\SafeJSON` folder.

The **Help** button in old SafeJSON versions no longer works; the guide is now at
<https://ericmcfall.github.io/JSONsetRight/>.

## Where JSONsetRight keeps its own data

JSONsetRight never changes your files except when you save. Its own data lives in
`%LOCALAPPDATA%\JSONsetRight` (paste that into File Explorer's address bar to open it):

| Folder or file | What's in it |
|---|---|
| `settings.json` | Your settings, recent files and schema choices |
| `backups\` | Earlier versions of files you've saved (see [Backups](10-safety.md#backups)) |
| `recovery\` | Unsaved work, kept in case JSONsetRight closes unexpectedly |
| `schema-cache\` | Downloaded schemas, so they work offline |

## Removing JSONsetRight

1. Delete `JSONsetRight.exe` (and any shortcuts you made).
2. Optionally, delete the `%LOCALAPPDATA%\JSONsetRight` folder to remove settings and backups.

Your JSON files are not affected.
