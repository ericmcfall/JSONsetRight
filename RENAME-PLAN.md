# Plan: rename SafeJSON to JSONsetRight

Status: **Planned. Nothing renamed yet.**

"SafeJSON" is already used by several other JSON tools. The app becomes **JSONsetRight**,
released as **v3.2.0**. The icon stays as it is.

Name check (1 Nov 2026): no software called JSONsetRight found on the web, no GitHub
repositories with that name, `ericmcfall/JSONsetRight` is available, and the npm name is free.

---

## 1. Decisions from the interview

| Topic | Decision |
|---|---|
| GitHub repository | **Rename** `ericmcfall/SafeJSON` → `ericmcfall/JSONsetRight` |
| Old online guide address | **Let it break.** Help buttons in SafeJSON 3.1 will show "page not found" |
| Version | **3.2.0** |
| Existing settings, recent files, backups | **Start fresh.** JSONsetRight uses a new, empty data folder; the old one is left untouched |
| Project folder on your PC | **Rename** to `C:\Users\Eric\Projects\JSONsetRight` (very last step) |
| Signing certificate profile | **Keep** the Azure profile named `SafeJSON` (a label only; signatures show "Eric McFall") |
| Older GitHub releases (v1.0–v3.1) | **Add a note** at the top of each pointing to JSONsetRight; files and titles unchanged |
| PLAN.md, PLAN-WEB.md | **Rename throughout**, plus a note that the app was originally called SafeJSON |
| Icon | **Unchanged** |

---

## 2. New names at a glance

| What | Now | After |
|---|---|---|
| Name shown to people | SafeJSON | **JSONsetRight** |
| Released program file | `SafeJSON.exe` | **`JSONsetRight.exe`** |
| Built program file | `src-tauri\target\release\safejson.exe` | `src-tauri\target\release\jsonsetright.exe` |
| Windows app ID | `com.safejson.app` | `com.jsonsetright.app` |
| App data folder | `%LOCALAPPDATA%\SafeJSON` | **`%LOCALAPPDATA%\JSONsetRight`** (new, empty) |
| Temporary file while saving | `.name.json.safejson-tmp` | `.name.json.jsonsetright-tmp` |
| npm / Cargo package names | `safejson`, `safejson_lib` | `jsonsetright`, `jsonsetright_lib` |
| GitHub repository | github.com/ericmcfall/SafeJSON | **github.com/ericmcfall/JSONsetRight** |
| Online user guide | ericmcfall.github.io/SafeJSON/ | **ericmcfall.github.io/JSONsetRight/** |
| HTML user guide file | `SafeJSON-User-Guide.html` | **`JSONsetRight-User-Guide.html`** |
| Project folder on your PC | `C:\Users\Eric\Projects\SafeJSON` | `C:\Users\Eric\Projects\JSONsetRight` |

**Spelling rule:** "JSONsetRight" everywhere people see it; all-lowercase `jsonsetright`
where Windows, npm or Rust require lowercase (package names, app ID, temp files).

---

## 3. What changes, file by file

The name appears 350 times in 43 files (counted 1 Nov 2026, excluding lock files).

### 3.1 The app (code)

| File | What changes |
|---|---|
| `src-tauri/tauri.conf.json` | Product name and window title → JSONsetRight; app ID → `com.jsonsetright.app`; version 3.2.0 |
| `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` | Package `jsonsetright`, library `jsonsetright_lib`; version 3.2.0 |
| `src-tauri/src/files.rs` | Data folder `%LOCALAPPDATA%\JSONsetRight`; temp-file suffix; error messages; test names |
| `src-tauri/src/schemas.rs` | Comments mentioning the cache folder |
| `package.json` | Package name `jsonsetright`; version 3.2.0 (lock file regenerated) |
| `index.html`, `src/App.tsx` | Page/window title "JSONsetRight"; developer hook `window.safejson` → `window.jsonsetright` |
| `src/ui/commands.ts` | Help link → `https://ericmcfall.github.io/JSONsetRight/user-guide/JSONsetRight-User-Guide.html` |
| `src/ui/Chrome.tsx` | Welcome screen heading and the "SafeJSON" text |
| `src/ui/SettingsDialog.tsx`, `src/ui/SchemaDialog.tsx`, `src/ui/safety.ts`, `src/ui/problems.ts`, `src/ui/TextEditor.tsx`, `src/store/settings.ts` | Messages and labels shown to people (backup folder path, "SafeJSON didn't close normally", problem source label "SafeJSON", …) |
| `src/engine/edits.ts`, `document.ts`, `text-edits.ts` | Messages like "SafeJSON blocked an edit…"; internal placeholder text; comments |

**Problem source label:** the Problems panel currently labels built-in checks as "SafeJSON". It
becomes "JSONsetRight".

### 3.2 Build, signing and release scripts

| File | What changes |
|---|---|
| `scripts/build-signed.ps1` | Copies `jsonsetright.exe` to `release\JSONsetRight.exe`; messages |
| `src-tauri/signing/metadata.json` | `CorrelationId` text only. **`CertificateProfileName` stays `"SafeJSON"`** (the Azure profile isn't renamed) |
| `scripts/build-docs.mjs` | Output file `JSONsetRight-User-Guide.html`; page title, header and footer |
| `.gitattributes`, `.gitignore` | Comments only |

### 3.3 Documentation

| File | What changes |
|---|---|
| `docs/user-guide/README.md` and chapters `01`–`14` | Every mention → JSONsetRight; `SafeJSON.exe` → `JSONsetRight.exe`; data folder → `%LOCALAPPDATA%\JSONsetRight`; online address → `ericmcfall.github.io/JSONsetRight/`; "describes JSONsetRight 3.2"; anchor "Where JSONsetRight keeps its own data" (links to it updated) |
| `docs/user-guide/01-installing.md` | New section **"Coming from SafeJSON?"**: settings and backups start fresh, how to re-create "Open with", the old `%LOCALAPPDATA%\SafeJSON` folder can be deleted once you're happy |
| `docs/user-guide/13-troubleshooting.md` | "My old settings/recent files are gone" entry; SmartScreen note (new file name starts building reputation again) |
| `docs/user-guide/SafeJSON-User-Guide.html` | Deleted; regenerated as `JSONsetRight-User-Guide.html` by `npm run docs` |
| `docs/index.html` | Redirect to the new guide file name; title |
| `README.md` | Name, guide links, signed-build instructions, license line |
| `PLAN.md`, `PLAN-WEB.md` | Renamed throughout; one-line note: "Originally named SafeJSON; renamed to JSONsetRight in v3.2.0 (see RENAME-PLAN.md)" |
| `RENAME-PLAN.md` | This plan: status updated to "Done" at the end |

### 3.4 Things that deliberately stay the same

- **The icon** (`src-tauri/icons/`).
- **The Azure signing profile name** `SafeJSON`.
- **Git history:** past commit messages and tags `v1.0.0`–`v3.1.0` keep the old name.
- **Old release files:** `SafeJSON.exe` and `SafeJSON-User-Guide.html` on v1.0–v3.1 stay as published.
- **The MIT copyright line** (it names Eric McFall, not the app).

---

## 4. Effects on existing users (say these in the release notes)

1. **Fresh start:** JSONsetRight doesn't read `%LOCALAPPDATA%\SafeJSON`. Settings (theme, schema
   rules, backup count), recent files, per-file schema choices and **backups** start empty.
   Backups stay in the old folder and can still be opened by hand.
2. **Save first:** unsaved work and crash-recovery drafts from SafeJSON are not picked up. Save
   everything in SafeJSON before switching.
3. **"Open with" / double-click:** associations point to `SafeJSON.exe` and must be set again
   for `JSONsetRight.exe`.
4. **Old Help buttons break:** SafeJSON 3.1's Help/F1 will show "page not found" (accepted).
5. **SmartScreen:** a new file name may get the "Windows protected your PC" warning again for a
   while. Smart App Control is unaffected, because the file is signed.
6. **Old links to the repository** (github.com/ericmcfall/SafeJSON/...) are redirected by
   GitHub automatically, as long as no new repository named "SafeJSON" is ever created.

---

## 5. Steps

Each step ends with tests passing and a commit.

| # | Step | Done when |
|---|---|---|
| **R1** | **Rename in the app and build settings** (sections 3.1–3.2); version 3.2.0 | All tests pass; no "safejson" left in code except the kept items in 3.4; dev preview shows JSONsetRight |
| **R2** | **Rename the documentation** (section 3.3), including the new "Coming from SafeJSON?" and troubleshooting entries; regenerate the HTML guide | Guide builds with no broken internal links; no stray "SafeJSON" except where it explains the rename |
| **R3** | **Signed build and checks**: `npm run build:signed` (your browser sign-in), then confirm the signature, version 3.2.0, that it starts under Smart App Control, and that it creates `%LOCALAPPDATA%\JSONsetRight` while leaving `%LOCALAPPDATA%\SafeJSON` untouched | All checks pass |
| **R4** | **GitHub**: push; rename the repository; point this PC's git at the new address; update the repo description; confirm GitHub Pages serves `ericmcfall.github.io/JSONsetRight/` **before** publishing (the Help button depends on it); tag and publish **v3.2.0** with `JSONsetRight.exe` and `JSONsetRight-User-Guide.html`; add the rename note to v1.0–v3.1 | Downloading v3.2.0 without signing in gives a validly signed JSONsetRight.exe; Help opens the new guide |
| **R5** | **Rename the project folder** on your PC, and move my notes for this project to the new folder's location | Project opens from `C:\Users\Eric\Projects\JSONsetRight`; tests still pass there |

**Order matters:** the new Help address only works after the repository rename (R4), so the
release is published after confirming that address is live.

---

## 6. What you'll need to do

1. **R3:** sign in when the browser opens for code signing (as for 3.0 and 3.1).
2. **R5:** close VS Code (and anything else using the project folder) before the folder is
   renamed, then reopen it from the new location. This Claude session started in the old folder,
   so continue in a **new session** opened in `C:\Users\Eric\Projects\JSONsetRight`.

---

## 7. Risks

| Risk | Plan |
|---|---|
| A leftover "SafeJSON" somewhere | A final search lists every remaining mention; each must be on the "deliberately kept" list |
| Breaking links inside the guide | The guide builder's link check (every internal link must reach a heading) runs in R2 |
| Pages takes time to appear at the new address | Check it's live before publishing; publishing waits if needed |
| Folder rename fails because a file is in use | Done last; close VS Code and dev servers first; if Windows still refuses, retry after a restart |
| Someone creates a new "SafeJSON" repo under your account later | That would stop GitHub's redirects for old links; noted in the README |
