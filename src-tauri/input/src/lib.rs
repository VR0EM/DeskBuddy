//! Global keyboard and mouse activity listener for DeskBuddy.
//!
//! Privacy by design: this crate only reports *that* a key or mouse button
//! went down, plus which half of the keyboard the key sits on (so the buddy
//! knows which paw to use). It never reports which key was pressed, so text
//! can't be reconstructed from anything that leaves this crate.

use std::sync::mpsc::Sender;

pub mod keymap;

#[cfg(target_os = "linux")]
#[path = "linux.rs"]
mod platform;
#[cfg(target_os = "macos")]
#[path = "macos.rs"]
mod platform;
#[cfg(target_os = "windows")]
#[path = "windows.rs"]
mod platform;

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
mod platform {
    pub fn start(_tx: std::sync::mpsc::Sender<crate::InputEvent>) -> Result<(), String> {
        Err("this operating system is not supported".into())
    }
    pub fn keyboard_access() -> bool {
        false
    }
    pub fn request_keyboard_access() {}
}

/// Which half of the keyboard a key sits on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Left,
    Right,
    /// The space bar: both paws.
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputEvent {
    /// A key went down. Auto-repeat from holding a key is filtered out.
    Key(Side),
    /// A mouse button went down.
    Mouse(MouseButton),
}

/// Starts listening on background threads and sends every event to `tx`.
/// Call this once per process.
pub fn start(tx: Sender<InputEvent>) -> Result<(), String> {
    platform::start(tx)
}

/// Whether keystrokes can be observed. Always true, except on macOS before
/// the user allowed "Input Monitoring" for the app.
pub fn keyboard_access() -> bool {
    platform::keyboard_access()
}

/// macOS: asks for "Input Monitoring" (the system shows its prompt once).
/// Does nothing on other systems.
pub fn request_keyboard_access() {
    platform::request_keyboard_access()
}
