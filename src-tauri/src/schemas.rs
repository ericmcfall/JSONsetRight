// Downloads JSON Schemas referenced by URL (e.g. "$schema": "https://json.schemastore.org/...").
// Each download is cached in %LOCALAPPDATA%\SafeJSON\schema-cache so schemas keep working
// offline. The cached copy is used first unless `refresh` is true.

use crate::files::app_data_dir;
use std::fs;
use std::io::Read;
use std::time::Duration;

const MAX_SCHEMA_BYTES: u64 = 5 * 1024 * 1024;

#[tauri::command]
pub fn fetch_schema(url: String, refresh: bool) -> Result<String, String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(format!("Not a web address: {url}"));
    }
    let dir = app_data_dir()?.join("schema-cache");
    let cached = dir.join(format!("{:016x}.json", fnv1a(url.as_bytes())));

    if !refresh {
        if let Ok(text) = fs::read_to_string(&cached) {
            return Ok(text);
        }
    }
    match download(&url) {
        Ok(text) => {
            let _ = fs::create_dir_all(&dir);
            let _ = fs::write(&cached, &text);
            Ok(text)
        }
        // Offline or the site is down: an older cached copy is better than nothing.
        Err(error) => fs::read_to_string(&cached).map_err(|_| error),
    }
}

fn download(url: &str) -> Result<String, String> {
    let response = ureq::get(url)
        .timeout(Duration::from_secs(15))
        .call()
        .map_err(|e| format!("Could not download the schema from {url}: {e}"))?;
    let mut text = String::new();
    response
        .into_reader()
        .take(MAX_SCHEMA_BYTES)
        .read_to_string(&mut text)
        .map_err(|e| format!("Could not read the schema from {url}: {e}"))?;
    Ok(text)
}

fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |hash, b| (hash ^ *b as u64).wrapping_mul(0x100000001b3))
}
