//! Windows: low-level keyboard and mouse hooks on a dedicated thread.
//! No special permissions are needed.
//!
//! Windows silently removes a low-level hook that ever answers too slowly
//! (for example while the PC is very busy). So the hook thread runs at
//! time-critical priority, and it re-installs its hooks every 30 seconds;
//! a hook that was removed comes back by itself.

use std::ptr::{null, null_mut};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, OnceLock};

use windows_sys::Win32::Foundation::{GetLastError, HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Threading::{
    GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_TIME_CRITICAL,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetTimer, SetWindowsHookExW, TranslateMessage,
    UnhookWindowsHookEx, HC_ACTION, HHOOK, KBDLLHOOKSTRUCT, LLKHF_EXTENDED, MSG, WH_KEYBOARD_LL,
    WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_RBUTTONDOWN,
    WM_SYSKEYDOWN, WM_SYSKEYUP, WM_TIMER, WM_XBUTTONDOWN,
};

use crate::{keymap, InputEvent, MouseButton};

const REARM_EVERY_MS: u32 = 30_000;

static SENDER: OnceLock<Sender<InputEvent>> = OnceLock::new();

/// Which virtual keys are currently held, to ignore auto-repeat. Also keeps a
/// key from counting twice while old and new hooks overlap during a re-arm.
static HELD: [AtomicBool; 256] = [const { AtomicBool::new(false) }; 256];

// For `diagnostics()`: how the hooks were installed and how often they ran.
static STATUS: Mutex<String> = Mutex::new(String::new());
static KEY_CALLS: AtomicU64 = AtomicU64::new(0);
static CLICKS: AtomicU64 = AtomicU64::new(0);
static REARMS: AtomicU64 = AtomicU64::new(0);

fn send(event: InputEvent) {
    if let Some(tx) = SENDER.get() {
        let _ = tx.send(event);
    }
}

// Hook procedures must return quickly. They only push onto an unbounded
// channel, which never blocks.

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    KEY_CALLS.fetch_add(1, Ordering::Relaxed);
    if code == HC_ACTION as i32 && lparam != 0 {
        let info = &*(lparam as *const KBDLLHOOKSTRUCT);
        let held = &HELD[(info.vkCode & 0xFF) as usize];
        match wparam as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                // Holding a key repeats WM_KEYDOWN; only the first one counts.
                if !held.swap(true, Ordering::Relaxed) {
                    let extended = info.flags & LLKHF_EXTENDED != 0;
                    let side = keymap::windows_side(info.scanCode, extended, info.vkCode);
                    send(InputEvent::Key(side));
                }
            }
            WM_KEYUP | WM_SYSKEYUP => held.store(false, Ordering::Relaxed),
            _ => {}
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let button = match wparam as u32 {
            WM_LBUTTONDOWN => Some(MouseButton::Left),
            WM_RBUTTONDOWN => Some(MouseButton::Right),
            WM_MBUTTONDOWN => Some(MouseButton::Middle),
            WM_XBUTTONDOWN => Some(MouseButton::Other),
            _ => None,
        };
        if let Some(button) = button {
            CLICKS.fetch_add(1, Ordering::Relaxed);
            send(InputEvent::Mouse(button));
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

struct Hooks {
    keyboard: HHOOK,
    mouse: HHOOK,
}

impl Hooks {
    /// Installs a fresh pair of hooks. On a re-arm the new hooks go in
    /// before the old ones come out, so no key slips through in between.
    unsafe fn install(module: HINSTANCE) -> Hooks {
        let keyboard = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), module, 0);
        let keyboard_error = GetLastError();
        let mouse = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), module, 0);
        let mouse_error = GetLastError();
        let describe = |hook: HHOOK, error: u32| {
            if hook.is_null() {
                format!("failed (error {error})")
            } else {
                "ok".to_string()
            }
        };
        if let Ok(mut status) = STATUS.lock() {
            *status = format!(
                "keyboard hook {}, mouse hook {}",
                describe(keyboard, keyboard_error),
                describe(mouse, mouse_error)
            );
        }
        Hooks { keyboard, mouse }
    }

    fn any(&self) -> bool {
        !self.keyboard.is_null() || !self.mouse.is_null()
    }

    unsafe fn remove(self) {
        if !self.keyboard.is_null() {
            UnhookWindowsHookEx(self.keyboard);
        }
        if !self.mouse.is_null() {
            UnhookWindowsHookEx(self.mouse);
        }
    }
}

pub fn start(tx: Sender<InputEvent>) -> Result<(), String> {
    SENDER
        .set(tx)
        .map_err(|_| "the input listener is already running".to_string())?;

    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    std::thread::Builder::new()
        .name("deskbuddy-input".into())
        .spawn(move || unsafe {
            // Hooks are called on this thread: never let it wait for the CPU.
            SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);

            let module = GetModuleHandleW(null());
            let mut hooks = Hooks::install(module);
            if !hooks.any() {
                let _ = ready_tx.send(Err(
                    "could not install the keyboard and mouse hooks".to_string()
                ));
                return;
            }
            let _ = ready_tx.send(Ok(()));

            SetTimer(null_mut(), 0, REARM_EVERY_MS, None);

            // Low-level hooks are called on the thread that installed them,
            // so this thread has to keep pumping messages.
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                if msg.message == WM_TIMER {
                    let fresh = Hooks::install(module);
                    if fresh.any() {
                        std::mem::replace(&mut hooks, fresh).remove();
                        REARMS.fetch_add(1, Ordering::Relaxed);
                    }
                    continue;
                }
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        })
        .map_err(|e| e.to_string())?;

    ready_rx
        .recv()
        .map_err(|_| "the input thread stopped unexpectedly".to_string())?
}

pub fn keyboard_access() -> bool {
    true
}

pub fn request_keyboard_access() {}

pub fn diagnostics() -> String {
    let status = STATUS.lock().map(|s| s.clone()).unwrap_or_default();
    format!(
        "{}; keyboard hook called {} times, {} clicks seen, re-armed {} times",
        if status.is_empty() {
            "not started"
        } else {
            status.as_str()
        },
        KEY_CALLS.load(Ordering::Relaxed),
        CLICKS.load(Ordering::Relaxed),
        REARMS.load(Ordering::Relaxed)
    )
}
