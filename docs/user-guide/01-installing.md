# Installing SafeJSON

## What you need

- **Windows 10 or Windows 11.**
- **Microsoft Edge WebView2.** This is part of Windows 11 and current Windows 10, so you almost
  certainly have it already.
- About 6 MB of disk space.

## Download

1. Open the SafeJSON releases page on GitHub (your administrator can give you the link).
2. Under the newest release (marked **Latest**), click **SafeJSON.exe** to download it.

SafeJSON is **portable**: there is no installer. The `.exe` file *is* the app.

3. Move `SafeJSON.exe` somewhere convenient, for example a `Programs` or `Tools` folder in your
   Documents. Avoid leaving it in Downloads, where it's easy to delete by accident.
4. To make it easy to start, right-click `SafeJSON.exe` and choose **Pin to Start** or **Send to →
   Desktop (create shortcut)**.

## Starting SafeJSON for the first time

Double-click `SafeJSON.exe`.

SafeJSON 3.0 is **digitally signed** by its publisher, Eric McFall, using a Microsoft-verified
identity. You can check this yourself: right-click `SafeJSON.exe` → **Properties** →
**Digital Signatures**.

Windows may still show a warning for a new release:

| You see | What to do |
|---|---|
| **"Windows protected your PC"** | Windows hasn't seen this release often yet. Click **More info**, check that the publisher is **Eric McFall**, then click **Run anyway**. This stops appearing as the release becomes known. |
| **"Smart App Control blocked an app"** or **"An Application Control policy has blocked this file"** | You have an older, unsigned version (1.0 or 2.0). Download SafeJSON 3.0 or later. |

## Opening files with SafeJSON from File Explorer

You can open a JSON file straight into SafeJSON:

1. In File Explorer, right-click a `.json` file.
2. Choose **Open with → Choose another app**.
3. Click **More apps → Look for another app on this PC**, find `SafeJSON.exe` and select it.
4. Tick **Always use this app to open .json files** if you want double-clicking to use SafeJSON.

You can also **drag files** from File Explorer onto the SafeJSON window.

## Updating

Download the new `SafeJSON.exe` and replace the old one. Your settings, recent files and
backups are kept, because they're stored separately (see below).

## Where SafeJSON keeps its own data

SafeJSON never changes your files except when you save. Its own data lives in
`%LOCALAPPDATA%\SafeJSON` (paste that into File Explorer's address bar to open it):

| Folder or file | What's in it |
|---|---|
| `settings.json` | Your settings, recent files and schema choices |
| `backups\` | Earlier versions of files you've saved (see [Backups](10-safety.md#backups)) |
| `recovery\` | Unsaved work, kept in case SafeJSON closes unexpectedly |
| `schema-cache\` | Downloaded schemas, so they work offline |

## Removing SafeJSON

1. Delete `SafeJSON.exe` (and any shortcuts you made).
2. Optionally, delete the `%LOCALAPPDATA%\SafeJSON` folder to remove settings and backups.

Your JSON files are not affected.
