//! Settings, tap statistics and custom buddies, saved as JSON files in the
//! app's data folder.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const DEFAULT_BUDDY: &str = "pip";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// Id of a preset (see ui/js/presets.js) or of a custom buddy.
    pub active_buddy: String,
    pub scale: f64,
    pub opacity: f64,
    pub always_on_top: bool,
    /// "Ghost mode": clicks go through the buddy.
    pub click_through: bool,
    pub show_counter: bool,
    /// Idle animations (breathing, ear twitches). Off saves a little energy.
    pub lively: bool,
    /// Fall asleep after this many idle minutes; 0 = never.
    pub sleep_minutes: u32,
    /// "left" or "right": which paw goes to the mouse.
    pub mouse_side: String,
    pub hidden: bool,
    /// Outer position of the buddy window in physical pixels.
    pub position: Option<[i32; 2]>,
    /// The welcome screen was shown once.
    pub welcomed: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            active_buddy: DEFAULT_BUDDY.into(),
            scale: 1.0,
            opacity: 1.0,
            always_on_top: true,
            click_through: false,
            show_counter: true,
            lively: true,
            sleep_minutes: 5,
            mouse_side: "right".into(),
            hidden: false,
            position: None,
            welcomed: false,
        }
    }
}

impl Settings {
    /// Keeps values in sensible ranges, whatever the settings file says.
    pub fn sanitize(&mut self) {
        let finite_or = |v: f64, d: f64| if v.is_finite() { v } else { d };
        self.scale = finite_or(self.scale, 1.0).clamp(0.5, 2.5);
        self.opacity = finite_or(self.opacity, 1.0).clamp(0.2, 1.0);
        self.sleep_minutes = self.sleep_minutes.min(240);
        if self.mouse_side != "left" {
            self.mouse_side = "right".into();
        }
        if self.active_buddy.is_empty() || self.active_buddy.len() > 64 {
            self.active_buddy = DEFAULT_BUDDY.into();
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Stats {
    pub total: u64,
    pub keys: u64,
    pub clicks: u64,
    /// Taps per local date ("2026-11-03").
    pub days: BTreeMap<String, u64>,
    pub first_day: Option<String>,
}

pub struct Store {
    dir: PathBuf,
    pub settings: Settings,
    pub stats: Stats,
    /// Custom buddies, kept as opaque JSON: their shape is the UI's business.
    pub buddies: Vec<Value>,
    pub settings_dirty: bool,
    pub stats_dirty: bool,
}

const SETTINGS_FILE: &str = "settings.json";
const STATS_FILE: &str = "stats.json";
const BUDDIES_FILE: &str = "buddies.json";

impl Store {
    pub fn load(dir: PathBuf) -> Self {
        if let Err(e) = fs::create_dir_all(&dir) {
            eprintln!("[deskbuddy] could not create {}: {e}", dir.display());
        }
        let mut settings: Settings = read_json(&dir.join(SETTINGS_FILE)).unwrap_or_default();
        settings.sanitize();
        let stats: Stats = read_json(&dir.join(STATS_FILE)).unwrap_or_default();
        let buddies: Vec<Value> = read_json(&dir.join(BUDDIES_FILE)).unwrap_or_default();
        Self {
            dir,
            settings,
            stats,
            buddies,
            settings_dirty: false,
            stats_dirty: false,
        }
    }

    /// Counts one tap and returns (total, today).
    pub fn record(&mut self, is_key: bool) -> (u64, u64) {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let stats = &mut self.stats;
        stats.total += 1;
        if is_key {
            stats.keys += 1;
        } else {
            stats.clicks += 1;
        }
        if stats.first_day.is_none() {
            stats.first_day = Some(today.clone());
        }
        let day = stats.days.entry(today).or_insert(0);
        *day += 1;
        let today_count = *day;
        self.stats_dirty = true;
        (self.stats.total, today_count)
    }

    pub fn today(&self) -> u64 {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        self.stats.days.get(&today).copied().unwrap_or(0)
    }

    pub fn save_settings(&mut self) {
        match write_json(&self.dir.join(SETTINGS_FILE), &self.settings) {
            Ok(()) => self.settings_dirty = false,
            Err(e) => eprintln!("[deskbuddy] could not save settings: {e}"),
        }
    }

    pub fn save_stats(&mut self) {
        match write_json(&self.dir.join(STATS_FILE), &self.stats) {
            Ok(()) => self.stats_dirty = false,
            Err(e) => eprintln!("[deskbuddy] could not save stats: {e}"),
        }
    }

    pub fn save_buddies(&self) -> Result<(), String> {
        write_json(&self.dir.join(BUDDIES_FILE), &self.buddies).map_err(|e| e.to_string())
    }

    /// Writes whatever changed since the last save.
    pub fn flush(&mut self) {
        if self.settings_dirty {
            self.save_settings();
        }
        if self.stats_dirty {
            self.save_stats();
        }
    }
}

/// Reads a JSON file. A file that exists but can't be parsed is renamed
/// (not deleted), so a bug can never silently wipe someone's tap count.
fn read_json<T: DeserializeOwned>(path: &Path) -> Option<T> {
    let text = fs::read_to_string(path).ok()?;
    match serde_json::from_str(&text) {
        Ok(value) => Some(value),
        Err(e) => {
            eprintln!("[deskbuddy] {} is unreadable ({e}), keeping a copy", path.display());
            let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
            let _ = fs::rename(path, path.with_extension(format!("json.broken-{stamp}")));
            None
        }
    }
}

/// Writes to a temporary file first, so a crash mid-write can't leave a
/// half-written file behind.
fn write_json<T: Serialize>(path: &Path, value: &T) -> io::Result<()> {
    let text = serde_json::to_string_pretty(value).map_err(io::Error::other)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text)?;
    fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("deskbuddy-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn counts_survive_a_reload() {
        let dir = temp_dir("reload");
        let mut store = Store::load(dir.clone());
        store.record(true);
        store.record(true);
        let (total, today) = store.record(false);
        assert_eq!((total, today), (3, 3));
        store.flush();

        let store = Store::load(dir.clone());
        assert_eq!(store.stats.total, 3);
        assert_eq!(store.stats.keys, 2);
        assert_eq!(store.stats.clicks, 1);
        assert_eq!(store.today(), 3);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn broken_files_are_kept_aside() {
        let dir = temp_dir("broken");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(STATS_FILE), "{ not json").unwrap();
        let store = Store::load(dir.clone());
        assert_eq!(store.stats.total, 0);
        let kept = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().contains("broken-"));
        assert!(kept);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn settings_are_clamped() {
        let mut s = Settings {
            scale: 99.0,
            opacity: -1.0,
            mouse_side: "up".into(),
            active_buddy: String::new(),
            ..Settings::default()
        };
        s.sanitize();
        assert_eq!(s.scale, 2.5);
        assert_eq!(s.opacity, 0.2);
        assert_eq!(s.mouse_side, "right");
        assert_eq!(s.active_buddy, DEFAULT_BUDDY);
    }

    #[test]
    fn unknown_and_missing_fields_fall_back_to_defaults() {
        let s: Settings = serde_json::from_str(r#"{"scale": 1.5, "somethingNew": true}"#).unwrap();
        assert_eq!(s.scale, 1.5);
        assert!(s.always_on_top);
        assert_eq!(s.active_buddy, DEFAULT_BUDDY);
    }
}
