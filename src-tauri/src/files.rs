// File access for the editor: reading, crash-safe saving, and backups.
//
// Backups live in %LOCALAPPDATA%\SafeJSON\backups\<file name>-<id>\ so project folders and
// git repositories stay clean. Each backup is the file as it was just before a save.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContents {
    text: String,
    modified_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    path: String,
    created_ms: u64,
}

/// Largest file the editor will open. The plan targets files under 1 MB; this leaves headroom.
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;

#[tauri::command]
pub fn read_text_file(path: String) -> Result<FileContents, String> {
    let path = Path::new(&path);
    let size = fs::metadata(path).map_err(|e| describe(e, path))?.len();
    if size > MAX_FILE_BYTES {
        return Err(format!(
            "{} is {:.1} MB, which is larger than SafeJSON supports (10 MB).",
            display_name(path),
            size as f64 / 1_048_576.0
        ));
    }
    let bytes = fs::read(path).map_err(|e| describe(e, path))?;
    let text = String::from_utf8(bytes).map_err(|_| {
        format!("{} is not UTF-8 text, so SafeJSON can't open it safely.", display_name(path))
    })?;
    Ok(FileContents { text, modified_ms: modified_ms(path)? })
}

/// Saves `text` to `path` without ever leaving a half-written file: the text goes to a
/// temporary file next to the target first, which then replaces the target in one step.
/// Returns the file's new modified time.
#[tauri::command]
pub fn save_text_file(path: String, text: String, backup_count: u32) -> Result<u64, String> {
    let path = Path::new(&path);
    if backup_count > 0 && path.exists() {
        make_backup(path, backup_count)?;
    }

    let temp = path.with_file_name(format!(".{}.safejson-tmp", display_name(path)));
    let write = || -> std::io::Result<()> {
        let mut file = fs::File::create(&temp)?;
        file.write_all(text.as_bytes())?;
        file.sync_all()?;
        fs::rename(&temp, path)
    };
    if let Err(e) = write() {
        let _ = fs::remove_file(&temp);
        return Err(describe(e, path));
    }
    modified_ms(path)
}

/// The file's last-modified time, or None if it no longer exists. Used to notice outside edits.
#[tauri::command]
pub fn file_modified_ms(path: String) -> Result<Option<u64>, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Ok(None);
    }
    modified_ms(path).map(Some)
}

/// Backups of a file, newest first.
#[tauri::command]
pub fn list_backups(path: String) -> Result<Vec<BackupInfo>, String> {
    let dir = backup_dir(Path::new(&path))?;
    let mut backups: Vec<BackupInfo> = backup_files(&dir)
        .into_iter()
        .filter_map(|file| {
            let created_ms = file.file_stem()?.to_str()?.parse().ok()?;
            Some(BackupInfo { path: file.to_string_lossy().into_owned(), created_ms })
        })
        .collect();
    backups.sort_by(|a, b| b.created_ms.cmp(&a.created_ms));
    Ok(backups)
}

// ---- settings: %LOCALAPPDATA%\SafeJSON\settings.json (the interface owns the format)

#[tauri::command]
pub fn read_settings() -> Result<Option<String>, String> {
    let path = app_data_dir()?.join("settings.json");
    Ok(fs::read_to_string(path).ok())
}

#[tauri::command]
pub fn write_settings(contents: String) -> Result<(), String> {
    let dir = app_data_dir()?;
    fs::create_dir_all(&dir).map_err(|e| describe(e, &dir))?;
    let path = dir.join("settings.json");
    let temp = dir.join("settings.json.tmp");
    fs::write(&temp, contents)
        .and_then(|_| fs::rename(&temp, &path))
        .map_err(|e| describe(e, &path))
}

/// Files named on the command line, e.g. from "Open with > SafeJSON" in File Explorer.
#[tauri::command]
pub fn startup_files() -> Vec<String> {
    std::env::args().skip(1).filter(|a| !a.starts_with('-')).collect()
}

// ---- auto-recovery drafts: %LOCALAPPDATA%\SafeJSON\recovery\<id>.json
// The interface decides what goes in a draft (file path, title, text); Rust only stores it.

#[tauri::command]
pub fn write_recovery_draft(id: String, contents: String) -> Result<(), String> {
    let dir = recovery_dir()?;
    fs::create_dir_all(&dir).map_err(|e| describe(e, &dir))?;
    let target = dir.join(format!("{}.json", safe_id(&id)));
    let temp = dir.join(format!("{}.tmp", safe_id(&id)));
    fs::write(&temp, contents)
        .and_then(|_| fs::rename(&temp, &target))
        .map_err(|e| describe(e, &target))
}

#[tauri::command]
pub fn delete_recovery_draft(id: String) -> Result<(), String> {
    let target = recovery_dir()?.join(format!("{}.json", safe_id(&id)));
    match fs::remove_file(&target) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(describe(e, &target)),
        _ => Ok(()),
    }
}

/// Contents of every draft left behind (normally none, unless SafeJSON did not close cleanly).
#[tauri::command]
pub fn list_recovery_drafts() -> Result<Vec<String>, String> {
    let dir = recovery_dir()?;
    let Ok(entries) = fs::read_dir(&dir) else { return Ok(vec![]) };
    Ok(entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|ext| ext == "json"))
        .filter_map(|p| fs::read_to_string(p).ok())
        .collect())
}

fn recovery_dir() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("recovery"))
}

/// Draft ids come from the interface; keep only characters that are safe in a file name.
fn safe_id(id: &str) -> String {
    id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect()
}

fn make_backup(path: &Path, keep: u32) -> Result<(), String> {
    let dir = backup_dir(path)?;
    fs::create_dir_all(&dir).map_err(|e| describe(e, &dir))?;
    // Records which file these backups belong to, for anyone browsing the folder.
    let _ = fs::write(dir.join("source.txt"), path.to_string_lossy().as_bytes());

    let target = dir.join(format!("{:013}.bak", now_ms()));
    fs::copy(path, &target).map_err(|e| describe(e, path))?;

    // Names are zero-padded timestamps, so sorting by name sorts oldest-first.
    let mut existing = backup_files(&dir);
    existing.sort();
    let excess = existing.len().saturating_sub(keep as usize);
    for old in existing.into_iter().take(excess) {
        let _ = fs::remove_file(old);
    }
    Ok(())
}

fn backup_files(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| p.extension().is_some_and(|ext| ext == "bak"))
                .collect()
        })
        .unwrap_or_default()
}

/// One folder per file: its name plus a short id from the full path (two settings.json files
/// in different folders get different backup folders).
fn backup_dir(path: &Path) -> Result<PathBuf, String> {
    let full = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let id = fnv1a(full.to_string_lossy().to_lowercase().as_bytes());
    Ok(app_data_dir()?
        .join("backups")
        .join(format!("{}-{:08x}", display_name(path), id as u32)))
}

pub fn app_data_dir() -> Result<PathBuf, String> {
    std::env::var("LOCALAPPDATA")
        .map(|base| PathBuf::from(base).join("SafeJSON"))
        .map_err(|_| "Could not find the LOCALAPPDATA folder.".to_string())
}

/// Simple stable hash (the same input gives the same id in every SafeJSON version).
fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |hash, b| (hash ^ *b as u64).wrapping_mul(0x100000001b3))
}

fn modified_ms(path: &Path) -> Result<u64, String> {
    let modified = fs::metadata(path).and_then(|m| m.modified()).map_err(|e| describe(e, path))?;
    Ok(modified.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn display_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_atomically_and_keeps_limited_backups() {
        let root = std::env::temp_dir().join(format!("safejson-test-{}", now_ms()));
        fs::create_dir_all(&root).unwrap();
        // Point backups at the temp folder instead of the real %LOCALAPPDATA%.
        unsafe { std::env::set_var("LOCALAPPDATA", &root) };
        let file = root.join("settings.json");
        let file_str = file.to_string_lossy().into_owned();

        save_text_file(file_str.clone(), "{\"v\": 0}".into(), 2).unwrap();
        for v in 1..=3 {
            std::thread::sleep(std::time::Duration::from_millis(5));
            save_text_file(file_str.clone(), format!("{{\"v\": {v}}}"), 2).unwrap();
        }

        assert_eq!(read_text_file(file_str.clone()).unwrap().text, "{\"v\": 3}");
        let backups = list_backups(file_str.clone()).unwrap();
        assert_eq!(backups.len(), 2, "only the newest 2 backups are kept");
        assert_eq!(fs::read_to_string(&backups[0].path).unwrap(), "{\"v\": 2}");
        assert!(!root.join(".settings.json.safejson-tmp").exists(), "temp file cleaned up");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rejects_non_utf8_files() {
        let file = std::env::temp_dir().join(format!("safejson-bin-{}.json", now_ms()));
        fs::write(&file, [0xff, 0xfe, 0x00]).unwrap();
        let err = read_text_file(file.to_string_lossy().into_owned()).err().unwrap();
        assert!(err.contains("not UTF-8"));
        fs::remove_file(file).unwrap();
    }
}

/// Turns an OS error into a sentence a person can act on.
fn describe(error: std::io::Error, path: &Path) -> String {
    use std::io::ErrorKind::*;
    let name = display_name(path);
    match error.kind() {
        NotFound => format!("{name} could not be found. It may have been moved or deleted."),
        PermissionDenied => format!(
            "Windows denied access to {name}. It may be read-only or open in another program."
        ),
        _ => format!("{name}: {error}"),
    }
}
