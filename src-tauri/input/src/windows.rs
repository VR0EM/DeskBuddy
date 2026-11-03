//! Windows: low-level keyboard and mouse hooks on a dedicated thread.
//! No special permissions are needed.

use std::ptr::{null, null_mut};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::OnceLock;

use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage, HC_ACTION,
    KBDLLHOOKSTRUCT, LLKHF_EXTENDED, MSG, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP,
    WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_RBUTTONDOWN, WM_SYSKEYDOWN, WM_SYSKEYUP, WM_XBUTTONDOWN,
};

use crate::{keymap, InputEvent, MouseButton};

static SENDER: OnceLock<Sender<InputEvent>> = OnceLock::new();

/// Which virtual keys are currently held, to ignore auto-repeat.
static HELD: [AtomicBool; 256] = [const { AtomicBool::new(false) }; 256];

fn send(event: InputEvent) {
    if let Some(tx) = SENDER.get() {
        let _ = tx.send(event);
    }
}

// Hook procedures must return quickly, or Windows silently removes them.
// They only push onto an unbounded channel, which never blocks.

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
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
            send(InputEvent::Mouse(button));
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

pub fn start(tx: Sender<InputEvent>) -> Result<(), String> {
    SENDER
        .set(tx)
        .map_err(|_| "the input listener is already running".to_string())?;

    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    std::thread::Builder::new()
        .name("deskbuddy-input".into())
        .spawn(move || unsafe {
            let module = GetModuleHandleW(null());
            let keyboard = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), module, 0);
            let mouse = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), module, 0);
            let status = if keyboard.is_null() && mouse.is_null() {
                Err("could not install the keyboard and mouse hooks".to_string())
            } else {
                Ok(())
            };
            let failed = status.is_err();
            let _ = ready_tx.send(status);
            if failed {
                return;
            }
            // Low-level hooks are called on the thread that installed them,
            // so this thread has to keep pumping messages.
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
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
