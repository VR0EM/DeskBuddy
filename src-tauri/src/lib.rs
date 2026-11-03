//! DeskBuddy: a small, efficient desk companion that taps along while you type.
//!
//! Rust owns the windows, the tray icon, the input listener and the saved
//! data. Everything you see is drawn by the web UI in `ui/`.

mod store;

use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::image::Image;
use tauri::menu::{CheckMenuItemBuilder, Menu, MenuBuilder, MenuEvent};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, RunEvent, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window, WindowEvent, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use deskbuddy_input::{InputEvent, MouseButton as InputButton, Side};
use store::{Settings, Stats, Store, DEFAULT_BUDDY};

const BUDDY: &str = "buddy";
const SETTINGS: &str = "settings";
const TRAY_ID: &str = "deskbuddy";
/// Buddy window size at 100%, in logical pixels. Matches the SVG viewBox in ui/js/render.js.
const BUDDY_W: f64 = 240.0;
const BUDDY_H: f64 = 200.0;
/// Passed by the login item, so a login start never pops up the settings.
const AUTOSTART_FLAG: &str = "--autostart";

struct AppState {
    store: Mutex<Store>,
}

fn store(app: &AppHandle) -> MutexGuard<'_, Store> {
    app.state::<AppState>()
        .inner()
        .store
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    settings: Settings,
    stats: Stats,
    today: u64,
    buddies: Vec<Value>,
    platform: &'static str,
    keyboard_access: bool,
    autostart: bool,
    version: String,
}

/// Sent to the UI for every key or mouse press.
#[derive(Clone, Serialize)]
struct Tap {
    /// "key" or "mouse"
    kind: &'static str,
    /// For keys: "left", "right" or "both" (space). For mouse: the button.
    side: &'static str,
    total: u64,
    today: u64,
}

// ---------------------------------------------------------------- commands

#[tauri::command]
fn get_state(app: AppHandle) -> Snapshot {
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    let s = store(&app);
    Snapshot {
        settings: s.settings.clone(),
        stats: s.stats.clone(),
        today: s.today(),
        buddies: s.buddies.clone(),
        platform: std::env::consts::OS,
        keyboard_access: deskbuddy_input::keyboard_access(),
        autostart,
        version: app.package_info().version.to_string(),
    }
}

/// Merges `patch` (any subset of the settings) into the settings.
#[tauri::command]
fn update_settings(app: AppHandle, patch: Value) -> Result<Settings, String> {
    change_settings(&app, |s| merge_patch(s, &patch))
}

/// Adds a custom buddy, or replaces the one with the same id.
#[tauri::command]
fn save_buddy(app: AppHandle, buddy: Value) -> Result<(), String> {
    let id = buddy
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty() && id.len() <= 64)
        .ok_or("a buddy needs an id")?
        .to_string();
    let list = {
        let mut s = store(&app);
        match s.buddies.iter_mut().find(|b| buddy_id(b) == Some(&id)) {
            Some(existing) => *existing = buddy,
            None => s.buddies.push(buddy),
        }
        s.save_buddies()?;
        s.buddies.clone()
    };
    let _ = app.emit("buddies-changed", &list);
    Ok(())
}

#[tauri::command]
fn delete_buddy(app: AppHandle, id: String) -> Result<(), String> {
    let (list, was_active) = {
        let mut s = store(&app);
        s.buddies.retain(|b| buddy_id(b) != Some(id.as_str()));
        s.save_buddies()?;
        (s.buddies.clone(), s.settings.active_buddy == id)
    };
    let _ = app.emit("buddies-changed", &list);
    if was_active {
        change_settings(&app, |s| {
            s.active_buddy = DEFAULT_BUDDY.into();
            Ok(())
        })?;
    }
    Ok(())
}

// Commands that create windows or menus are async: doing that from a
// synchronous command can deadlock on Windows.

#[tauri::command]
async fn open_settings_window(app: AppHandle, tab: Option<String>) {
    open_settings(&app, tab.as_deref());
}

#[tauri::command]
async fn show_buddy_menu(app: AppHandle, window: Window) -> Result<(), String> {
    let settings = store(&app).settings.clone();
    let menu = build_menu(&app, &settings, MenuKind::Buddy).map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    let result = if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    };
    result.map_err(|e| e.to_string())?;
    launcher.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn keyboard_access() -> bool {
    deskbuddy_input::keyboard_access()
}

/// macOS: asks for Input Monitoring and opens the matching settings page.
#[tauri::command]
fn open_input_monitoring() {
    deskbuddy_input::request_keyboard_access();
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent")
            .spawn();
    }
}

#[tauri::command]
fn reset_buddy_position(app: AppHandle) {
    reset_position(&app);
}

#[tauri::command]
fn quit(app: AppHandle) {
    store(&app).flush();
    app.exit(0);
}

// ---------------------------------------------------------------- settings

fn buddy_id(buddy: &Value) -> Option<&str> {
    buddy.get("id").and_then(Value::as_str)
}

fn merge_patch(settings: &mut Settings, patch: &Value) -> Result<(), String> {
    let patch = patch.as_object().ok_or("settings must be an object")?;
    let mut value = serde_json::to_value(&*settings).map_err(|e| e.to_string())?;
    if let Some(fields) = value.as_object_mut() {
        for (key, v) in patch {
            // The window position is tracked here, never taken from the UI.
            if key != "position" {
                fields.insert(key.clone(), v.clone());
            }
        }
    }
    *settings = serde_json::from_value(value).map_err(|e| e.to_string())?;
    Ok(())
}

/// Changes the settings, saves them, and updates windows, tray and UI.
fn change_settings(
    app: &AppHandle,
    change: impl FnOnce(&mut Settings) -> Result<(), String>,
) -> Result<Settings, String> {
    let (old, new) = {
        let mut s = store(app);
        let old = s.settings.clone();
        let mut new = old.clone();
        change(&mut new)?;
        new.sanitize();
        if new == old {
            return Ok(new);
        }
        s.settings = new.clone();
        s.save_settings();
        (old, new)
    };
    apply_settings(app, Some(&old), &new);
    refresh_tray(app, &new);
    let _ = app.emit("settings-changed", &new);
    Ok(new)
}

fn toggle(app: &AppHandle, change: impl FnOnce(&mut Settings)) {
    let _ = change_settings(app, |s| {
        change(s);
        Ok(())
    });
}

/// Applies the settings that live on the buddy window itself.
fn apply_settings(app: &AppHandle, old: Option<&Settings>, new: &Settings) {
    let Some(window) = app.get_webview_window(BUDDY) else {
        return;
    };
    if old.is_none_or(|o| o.scale != new.scale) {
        resize_buddy(&window, new.scale);
    }
    if old.is_none_or(|o| o.always_on_top != new.always_on_top) {
        let _ = window.set_always_on_top(new.always_on_top);
    }
    if old.is_none_or(|o| o.click_through != new.click_through) {
        let _ = window.set_ignore_cursor_events(new.click_through);
    }
    if old.is_none_or(|o| o.hidden != new.hidden) {
        let _ = if new.hidden {
            window.hide()
        } else {
            window.show()
        };
    }
}

// ---------------------------------------------------------------- buddy window

fn create_buddy_window(app: &AppHandle, settings: &Settings) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, BUDDY, WebviewUrl::App("buddy.html".into()))
        .title("DeskBuddy")
        .inner_size(BUDDY_W * settings.scale, BUDDY_H * settings.scale)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(settings.always_on_top)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .accept_first_mouse(true)
        .focused(false)
        .visible(false)
        .build()?;

    let saved = settings
        .position
        .map(|[x, y]| PhysicalPosition::new(x, y))
        .filter(|p| is_on_screen(&window, *p, settings.scale));
    if let Some(position) = saved.or_else(|| default_position(&window, settings.scale)) {
        let _ = window.set_position(position);
    }
    if settings.click_through {
        let _ = window.set_ignore_cursor_events(true);
    }
    if !settings.hidden {
        let _ = window.show();
    }
    Ok(window)
}

/// The buddy window's size in physical pixels. Computed instead of asked:
/// a window that hasn't been shown yet may report a size of zero.
fn buddy_size(scale: f64, scale_factor: f64) -> PhysicalSize<i32> {
    LogicalSize::new(BUDDY_W * scale, BUDDY_H * scale).to_physical(scale_factor)
}

/// Bottom-right corner of the main screen, above the taskbar or Dock.
fn default_position(window: &WebviewWindow, scale: f64) -> Option<PhysicalPosition<i32>> {
    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten())?;
    let area = monitor.work_area();
    let size = buddy_size(scale, monitor.scale_factor());
    let margin = (16.0 * monitor.scale_factor()) as i32;
    Some(PhysicalPosition::new(
        area.position.x + area.size.width as i32 - size.width - margin,
        area.position.y + area.size.height as i32 - size.height,
    ))
}

/// Whether the window's centre would land on one of the connected screens
/// (a screen may have been unplugged since the position was saved).
fn is_on_screen(window: &WebviewWindow, position: PhysicalPosition<i32>, scale: f64) -> bool {
    let size = buddy_size(scale, window.scale_factor().unwrap_or(1.0));
    let cx = position.x + size.width / 2;
    let cy = position.y + size.height / 2;
    window
        .available_monitors()
        .map(|monitors| {
            monitors.iter().any(|m| {
                let (p, s) = (m.position(), m.size());
                cx >= p.x && cx < p.x + s.width as i32 && cy >= p.y && cy < p.y + s.height as i32
            })
        })
        .unwrap_or(false)
}

/// Resizes around the bottom centre, where the buddy sits, so it doesn't
/// wander off when it grows or shrinks.
fn resize_buddy(window: &WebviewWindow, scale: f64) {
    let target = LogicalSize::new(BUDDY_W * scale, BUDDY_H * scale);
    let before = (window.outer_position(), window.outer_size());
    let _ = window.set_size(target);
    if let (Ok(position), Ok(size)) = before {
        let factor = window.scale_factor().unwrap_or(1.0);
        let new = target.to_physical::<i32>(factor);
        let x = position.x + (size.width as i32 - new.width) / 2;
        let y = position.y + (size.height as i32 - new.height);
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

fn reset_position(app: &AppHandle) {
    let scale = store(app).settings.scale;
    if let Some(window) = app.get_webview_window(BUDDY) {
        if let Some(position) = default_position(&window, scale) {
            let _ = window.set_position(position);
        }
    }
    toggle(app, |s| s.hidden = false);
}

fn on_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != BUDDY {
        return;
    }
    match event {
        WindowEvent::Moved(position) => {
            let mut s = store(window.app_handle());
            s.settings.position = Some([position.x, position.y]);
            s.settings_dirty = true;
        }
        WindowEvent::CloseRequested { api, .. } => {
            // Alt+F4 on the buddy hides it, instead of leaving the app without one.
            api.prevent_close();
            toggle(window.app_handle(), |s| s.hidden = true);
        }
        _ => {}
    }
}

// ---------------------------------------------------------------- settings window

fn open_settings(app: &AppHandle, tab: Option<&str>) {
    if let Some(window) = app.get_webview_window(SETTINGS) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(tab) = tab {
            let _ = app.emit_to(SETTINGS, "open-tab", tab);
        }
        return;
    }
    let page = match tab {
        Some(tab) => format!("settings.html#{tab}"),
        None => "settings.html".to_string(),
    };
    let built = WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App(page.into()))
        .title("DeskBuddy")
        .inner_size(1000.0, 700.0)
        .min_inner_size(820.0, 580.0)
        .center()
        .focused(true)
        // Let the page itself receive dropped image files (the drawing upload).
        .disable_drag_drop_handler()
        .build();
    match built {
        Ok(window) => {
            let _ = window.set_focus();
        }
        Err(e) => eprintln!("[deskbuddy] could not open settings: {e}"),
    }
}

// ---------------------------------------------------------------- menus & tray

#[derive(PartialEq)]
enum MenuKind {
    Tray,
    Buddy,
}

fn build_menu(app: &AppHandle, s: &Settings, kind: MenuKind) -> tauri::Result<Menu<Wry>> {
    let visible = CheckMenuItemBuilder::with_id("visible", "Buddy tonen")
        .checked(!s.hidden)
        .build(app)?;
    let ghost = CheckMenuItemBuilder::with_id("ghost", "Spookmodus (klikken gaan erdoorheen)")
        .checked(s.click_through)
        .build(app)?;
    let on_top = CheckMenuItemBuilder::with_id("on-top", "Altijd bovenop")
        .checked(s.always_on_top)
        .build(app)?;

    let mut menu = MenuBuilder::new(app)
        .text("settings", "Instellingen…")
        .separator();
    if kind == MenuKind::Tray {
        menu = menu.item(&visible);
    }
    menu = menu.item(&ghost).item(&on_top);
    if kind == MenuKind::Buddy {
        menu = menu.text("hide", "Verbergen");
    }
    menu.separator()
        .text("reset-position", "Terug naar de hoek")
        .separator()
        .text("quit", "DeskBuddy afsluiten")
        .build()
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "settings" => open_settings(app, None),
        "visible" => toggle(app, |s| s.hidden = !s.hidden),
        "hide" => toggle(app, |s| s.hidden = true),
        "ghost" => toggle(app, |s| s.click_through = !s.click_through),
        "on-top" => toggle(app, |s| s.always_on_top = !s.always_on_top),
        "reset-position" => reset_position(app),
        "quit" => {
            store(app).flush();
            app.exit(0);
        }
        _ => {}
    }
}

fn create_tray(app: &AppHandle, settings: &Settings) -> tauri::Result<()> {
    let menu = build_menu(app, settings, MenuKind::Tray)?;
    // macOS wants a black "template" icon that it recolours for the menu bar.
    #[cfg(target_os = "macos")]
    let (icon, template) = (
        Image::from_bytes(include_bytes!("../icons/tray-template.png"))?,
        true,
    );
    #[cfg(not(target_os = "macos"))]
    let (icon, template) = (
        Image::from_bytes(include_bytes!("../icons/tray.png"))?,
        false,
    );

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(template)
        .tooltip("DeskBuddy")
        .menu(&menu)
        // Windows: left click opens the settings, right click shows the menu.
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_tray_icon_event(|tray, event| {
            if cfg!(target_os = "macos") {
                return;
            }
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_settings(tray.app_handle(), None);
            }
        })
        .build(app)?;
    Ok(())
}

fn refresh_tray(app: &AppHandle, settings: &Settings) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        match build_menu(app, settings, MenuKind::Tray) {
            Ok(menu) => {
                let _ = tray.set_menu(Some(menu));
            }
            Err(e) => eprintln!("[deskbuddy] could not update the tray menu: {e}"),
        }
    }
}

// ---------------------------------------------------------------- input & saving

fn start_input(app: AppHandle) {
    let (tx, rx) = std::sync::mpsc::channel();
    if let Err(e) = deskbuddy_input::start(tx) {
        eprintln!("[deskbuddy] input listener unavailable: {e}");
        return;
    }
    eprintln!("[deskbuddy] listening: {}", deskbuddy_input::diagnostics());
    let spawned = std::thread::Builder::new()
        .name("deskbuddy-taps".into())
        .spawn(move || {
            for event in rx {
                let (kind, side) = match event {
                    InputEvent::Key(Side::Left) => ("key", "left"),
                    InputEvent::Key(Side::Right) => ("key", "right"),
                    InputEvent::Key(Side::Both) => ("key", "both"),
                    InputEvent::Mouse(InputButton::Left) => ("mouse", "left"),
                    InputEvent::Mouse(InputButton::Right) => ("mouse", "right"),
                    InputEvent::Mouse(InputButton::Middle) => ("mouse", "middle"),
                    InputEvent::Mouse(InputButton::Other) => ("mouse", "other"),
                };
                let (total, today) = store(&app).record(kind == "key");
                let _ = app.emit(
                    "tap",
                    Tap {
                        kind,
                        side,
                        total,
                        today,
                    },
                );
            }
        });
    if let Err(e) = spawned {
        eprintln!("[deskbuddy] could not start the tap thread: {e}");
    }
}

/// Saves counts every few seconds instead of on every tap.
/// With DESKBUDDY_DEBUG set, it also logs how the input listener is doing.
fn start_autosave(app: AppHandle) {
    let debug = std::env::var_os("DESKBUDDY_DEBUG").is_some();
    let spawned = std::thread::Builder::new()
        .name("deskbuddy-autosave".into())
        .spawn(move || loop {
            std::thread::sleep(Duration::from_secs(15));
            store(&app).flush();
            if debug {
                eprintln!("[deskbuddy] input: {}", deskbuddy_input::diagnostics());
            }
        });
    if let Err(e) = spawned {
        eprintln!("[deskbuddy] could not start autosave: {e}");
    }
}

// ---------------------------------------------------------------- app

pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin: a second launch just opens the settings.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            open_settings(app, None);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_FLAG]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_state,
            update_settings,
            save_buddy,
            delete_buddy,
            open_settings_window,
            show_buddy_menu,
            set_autostart,
            keyboard_access,
            open_input_monitoring,
            reset_buddy_position,
            quit,
        ])
        .on_menu_event(on_menu_event)
        .on_window_event(on_window_event)
        .setup(|app| {
            // A desk buddy lives in the menu bar, not in the Dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let loaded = Store::load(app.path().app_data_dir()?);
            let settings = loaded.settings.clone();
            app.manage(AppState {
                store: Mutex::new(loaded),
            });

            let handle = app.handle().clone();
            create_buddy_window(&handle, &settings)?;
            if let Err(e) = create_tray(&handle, &settings) {
                eprintln!("[deskbuddy] no tray icon: {e}");
            }
            start_input(handle.clone());
            start_autosave(handle.clone());

            let autostarted = std::env::args().any(|arg| arg == AUTOSTART_FLAG);
            if !settings.welcomed && !autostarted {
                open_settings(&handle, Some("welkom"));
                let mut s = store(&handle);
                s.settings.welcomed = true;
                s.save_settings();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("DeskBuddy could not start")
        .run(|app, event| match event {
            // Closing the settings window must not quit; only "Afsluiten" does.
            RunEvent::ExitRequested { api, code, .. } if code.is_none() => api.prevent_exit(),
            RunEvent::Exit => store(app).flush(),
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => open_settings(app, None),
            _ => {}
        });
}
