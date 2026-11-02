# JSONsetRight in the browser: plan

A version of JSONsetRight that runs in Microsoft Edge or Google Chrome, installable like an app,
alongside the existing desktop `.exe`.

> Originally written for **SafeJSON**, the app's former name; updated to **JSONsetRight**
> (see [RENAME-PLAN.md](RENAME-PLAN.md)).

Status: **Planned, on hold** (November 2026). No code written yet. Since the plan was written, the
repository has become public, so free GitHub Pages hosting is now an alternative to Cloudflare Pages.

## Why

Windows 11's **Smart App Control** blocks unsigned `.exe` files outright (no "Run anyway"), and
code signing costs money every year. A web app has no `.exe`, so Smart App Control never gets
involved. Edge (built into Windows) can open and save files on the PC directly, after asking
permission, so JSONsetRight keeps working on real files.

---

## 1. Decisions from the interview

| Topic | Decision |
|---|---|
| Desktop app | **Keep both.** One codebase, two builds: browser version for everyone, `.exe` where it runs |
| Hosting | **Cloudflare Pages** (free, works with the private repo, updates on every push) |
| Browsers | **Edge and Chrome** (full features). Firefox/Safari are not supported |
| Backups & recovery drafts | **Browser storage** (IndexedDB), restorable from Backups… |
| Access | **Open to anyone** with the address: the site holds no data, files never leave the PC |
| Schemas next to a file | **Ask for the folder** once (remembered); web-address schemas need no prompt |
| Offline | **Yes**: after the first visit, the app keeps a copy of itself and works with no connection |

---

## 2. What stays the same

About 85% of JSONsetRight is already browser code and is reused unchanged:
the editing engine (JSON/JSONC/JSON5, format-preserving edits, undo), schemas and hints, the tree,
table, text (Monaco) and compare views, validation, settings UI and all tests.

Only four places talk to the desktop app today, all backed by 11 small Rust commands:

| File | What it does now |
|---|---|
| `src/platform/files.ts` | Open/save dialogs, read/save files, backups, recovery drafts, schema download |
| `src/store/settings.ts` | Reads/writes `%LOCALAPPDATA%\JSONsetRight\settings.json` |
| `src/ui/safety.ts` | Close-window prompt, drag-and-drop, outside-change checks, crash recovery |
| `src/App.tsx` | Files from the command line ("Open with"), window title |

---

## 3. Design

### 3.1 A platform layer with two implementations
A single `Platform` interface covers everything the app needs from the outside world (open, read,
save, backups, drafts, settings, schema download, outside-change checks, startup files). Two
implementations:

- `platform/desktop.ts`: today's Tauri code, moved, unchanged in behavior.
- `platform/web.ts`: browser APIs (below).

The app picks one at startup. Nothing else in the code knows which it's running in.

### 3.2 Files are identified by a reference, not a path
Browsers never reveal a file's full path, only its name. So `Tab.filePath: string` becomes
`Tab.file: FileRef`:

```
FileRef = { id: string; name: string; path?: string }
```

- Desktop: `id` is the path (as now), `path` is filled in.
- Web: `id` is a random id; the browser's *file handle* is stored under that id in IndexedDB,
  so recent files, per-file schema choices and backups keep working across visits.

Recent files, `schemaPairs` and backup lookups switch from paths to ids.

### 3.3 How each desktop feature works in the browser

| Feature | Desktop today | Browser version |
|---|---|---|
| Open | Windows dialog | Edge's file picker (`showOpenFilePicker`), filtered to .json/.jsonc/.json5 |
| Save | Temp file + rename | `createWritable()`: Edge writes a hidden copy and swaps it in on close, so a crash mid-save can't corrupt the file. First save asks "Allow JSONsetRight to save changes?" |
| Save as | Windows dialog | `showSaveFilePicker` |
| Recent files | Paths in settings | Stored file handles; reopening asks to allow access again (one click) |
| Drag & drop | Tauri event | Dropped files become file handles (`getAsFileSystemHandle`) |
| "Open with" / double-click | Command-line argument | Installed app registers as a handler for .json/.jsonc/.json5 (`file_handlers` + `launchQueue`) |
| Backups | `%LOCALAPPDATA%\JSONsetRight\backups` | IndexedDB, last N per file; same Backups… dialog |
| Crash-recovery drafts | `%LOCALAPPDATA%\JSONsetRight\recovery` | IndexedDB, same 30-second timer and Recover prompt |
| Settings | `settings.json` | Browser storage |
| Changed by another program | Rust checks modified time | Re-read the file's modified time every 5 s and on focus, same prompts |
| Unsaved changes on close | Custom dialog per tab | Browser's standard "Leave site?" warning (wording can't be customized). Closing tabs inside JSONsetRight is unchanged |
| Window title | Tauri | Page title (shown on the installed app's window) |
| Web schemas | Rust download + disk cache | `fetch` + browser cache, so they work offline after the first time. A site that blocks browser downloads gets a clear message: download the schema and choose it in the schema dialog |
| Schema next to the file | Read by path | Ask once: "Choose the folder containing service.json so JSONsetRight can read ./service.schema.json". Remembered; the folder must contain the file (checked with `resolve()`) |

### 3.4 Installable and offline
- A web app manifest (name, icons, colors, file handlers) lets Edge offer **Install JSONsetRight**,
  which adds it to the Start menu with its own window.
- A service worker keeps a copy of the app for offline use. When a new version is published,
  JSONsetRight shows **"A new version is ready. Reload"**, never mid-edit.
- Edge is asked to keep JSONsetRight's storage permanent (`navigator.storage.persist()`), so backups
  aren't cleared when disk space is low.

### 3.5 Builds and hosting
- `npm run build` keeps building the desktop app as today. A new `npm run build:web` builds
  the website into `dist-web/`.
- Cloudflare Pages builds the site from GitHub on every push to `main`, at an address like
  `https://jsonsetright.pages.dev`. Free tier limits (500 builds/month) are far above what's needed.
- Desktop and browser versions share one version number and one GitHub Release.

---

## 4. What the browser version can't do (vs desktop)

- **No Firefox/Safari.** They can't save files in place.
- **Permission prompts.** Edge asks once per file per session before saving, and once per
  folder for schemas next to a file. Installed apps in recent Edge/Chrome can offer
  "Allow on every visit", which removes most of these.
- **Full paths aren't shown.** Tabs, the status bar and recent files show the file name, not
  `C:\…\name.json`.
- **The close warning is generic.** The browser's own "Leave site?" box, not JSONsetRight's
  per-file "Save changes?" (still used when closing a tab inside JSONsetRight).
- **Backups live in the browser.** Clearing Edge's site data for JSONsetRight deletes them.
- **"Open with" needs the installed app**, not just a browser tab.

---

## 5. Milestones

Each ends with tests passing, a commit, and something you can try.

| # | Milestone | Done when |
|---|---|---|
| **W1** | **Platform layer.** `Platform` interface, `FileRef`, desktop code moved into `platform/desktop.ts`, store/settings/safety/App use only the interface | All existing tests pass; desktop build unchanged in behavior (verified by tests and the dev preview; this PC's Smart App Control blocks running the `.exe`) |
| **W2** | **Web file access.** Open, Save, Save as, permissions, recent files from stored handles, drag & drop, title, "Leave site?" warning | You can open, edit and save a real file in Edge from the dev server |
| **W3** | **Web safety net.** Backups, recovery drafts and settings in IndexedDB; outside-change checks; persistent storage | Backups… restores, crash recovery offers your edits, VS Code edits are noticed |
| **W4** | **Schemas in the browser.** Web schemas with offline cache; folder permission for `./schema.json`; schema dialog picks files | `samples/service.json` gets its schema after one folder prompt; schemastore schemas work offline |
| **W5** | **Installable & offline.** Manifest, icons, service worker, file handlers, update prompt | Edge offers Install; installed app opens .json files from File Explorer and works offline |
| **W6** | **Hosting & release.** Cloudflare Pages project, README "Use JSONsetRight in your browser", release | `https://<name>.pages.dev` works; v4.0.0 released with both versions |

Rough size: W1 and W2 are the biggest; W3–W5 are smaller; W6 is mostly setup.

---

## 6. What you'll need to do

1. **W6:** create a free Cloudflare account and connect it to your GitHub repo (you sign in;
   I'll give exact steps and the build settings to enter). Choose the site name (e.g. `jsonsetright`).
2. **After each milestone:** try it in Edge. File pickers and permission prompts can't be
   clicked through automatically.

---

## 7. Risks

| Risk | Plan |
|---|---|
| Edge clears site storage (losing backups) | Request persistent storage; Backups… dialog says where backups live; recovery drafts are short-lived anyway |
| A schema website blocks browser downloads (CORS) | Clear message + "choose the schema file instead"; schemastore.org and GitHub raw files allow it |
| Permission prompts annoy people | Ask only when needed (first save, schema folder); installed app can remember permissions |
| Browser APIs change | All of them are used by VS Code for the Web; isolated in `platform/web.ts` |
| Two builds to maintain | Shared code is ~85%; platform differences live in two files; tests cover the shared part |
