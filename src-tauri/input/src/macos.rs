//! macOS: listen-only Quartz event taps, each on its own run-loop thread.
//!
//! Mouse clicks work right away. Keystrokes need the "Input Monitoring"
//! permission (System Settings > Privacy & Security). We ask once, then
//! wait in the background until the user allows it.
//!
//! The callbacks only read the key code and flags. They deliberately avoid
//! the text-input APIs (TIS/UCKeyTranslate), which crash when used off the
//! main thread on recent macOS versions.

use std::ffi::c_void;
use std::ptr::{null, null_mut};
use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::mpsc::Sender;
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use crate::{keymap, InputEvent, MouseButton};

type CFMachPortRef = *mut c_void;
type CFRunLoopSourceRef = *mut c_void;
type CFRunLoopRef = *mut c_void;
type CFStringRef = *const c_void;
type CFAllocatorRef = *const c_void;
type CGEventRef = *mut c_void;
type CGEventTapProxy = *mut c_void;
type CGEventTapCallBack =
    unsafe extern "C" fn(CGEventTapProxy, u32, CGEventRef, *mut c_void) -> CGEventRef;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        events_of_interest: u64,
        callback: CGEventTapCallBack,
        user_info: *mut c_void,
    ) -> CFMachPortRef;
    fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
    fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
    fn CGEventGetFlags(event: CGEventRef) -> u64;
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    static kCFRunLoopCommonModes: CFStringRef;
    fn CFMachPortCreateRunLoopSource(
        allocator: CFAllocatorRef,
        port: CFMachPortRef,
        order: isize,
    ) -> CFRunLoopSourceRef;
    fn CFRunLoopGetCurrent() -> CFRunLoopRef;
    fn CFRunLoopAddSource(run_loop: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);
    fn CFRunLoopRun();
}

// CGEventTapLocation, CGEventTapPlacement, CGEventTapOptions
const SESSION_EVENT_TAP: u32 = 1;
const HEAD_INSERT_EVENT_TAP: u32 = 0;
const TAP_OPTION_LISTEN_ONLY: u32 = 1;

// CGEventType
const LEFT_MOUSE_DOWN: u32 = 1;
const RIGHT_MOUSE_DOWN: u32 = 3;
const KEY_DOWN: u32 = 10;
const FLAGS_CHANGED: u32 = 12;
const OTHER_MOUSE_DOWN: u32 = 25;
const TAP_DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
const TAP_DISABLED_BY_USER_INPUT: u32 = 0xFFFF_FFFF;

// CGEventField
const MOUSE_EVENT_BUTTON_NUMBER: u32 = 3;
const KEYBOARD_EVENT_AUTOREPEAT: u32 = 8;
const KEYBOARD_EVENT_KEYCODE: u32 = 9;

const fn bit(event_type: u32) -> u64 {
    1 << event_type
}
const KEY_MASK: u64 = bit(KEY_DOWN) | bit(FLAGS_CHANGED);
const MOUSE_MASK: u64 = bit(LEFT_MOUSE_DOWN) | bit(RIGHT_MOUSE_DOWN) | bit(OTHER_MOUSE_DOWN);

static SENDER: OnceLock<Sender<InputEvent>> = OnceLock::new();

fn send(event: InputEvent) {
    if let Some(tx) = SENDER.get() {
        let _ = tx.send(event);
    }
}

/// `user_info` points at the tap's own `AtomicPtr`, so a tap that macOS
/// switched off can switch itself back on.
unsafe extern "C" fn tap_callback(
    _proxy: CGEventTapProxy,
    event_type: u32,
    event: CGEventRef,
    user_info: *mut c_void,
) -> CGEventRef {
    match event_type {
        TAP_DISABLED_BY_TIMEOUT | TAP_DISABLED_BY_USER_INPUT => {
            if !user_info.is_null() {
                let tap = (*(user_info as *const AtomicPtr<c_void>)).load(Ordering::Acquire);
                if !tap.is_null() {
                    CGEventTapEnable(tap, true);
                }
            }
        }
        KEY_DOWN => {
            if CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) == 0 {
                let code = CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) as u16;
                send(InputEvent::Key(keymap::mac_side(code)));
            }
        }
        FLAGS_CHANGED => {
            let code = CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) as u16;
            if keymap::mac_modifier_pressed(code, CGEventGetFlags(event)) {
                send(InputEvent::Key(keymap::mac_side(code)));
            }
        }
        LEFT_MOUSE_DOWN => send(InputEvent::Mouse(MouseButton::Left)),
        RIGHT_MOUSE_DOWN => send(InputEvent::Mouse(MouseButton::Right)),
        OTHER_MOUSE_DOWN => {
            let number = CGEventGetIntegerValueField(event, MOUSE_EVENT_BUTTON_NUMBER);
            send(InputEvent::Mouse(if number == 2 {
                MouseButton::Middle
            } else {
                MouseButton::Other
            }));
        }
        _ => {}
    }
    event
}

/// Creates a listen-only tap for `mask` and runs this thread's run loop.
/// Only returns if the tap could not be created.
unsafe fn run_tap(mask: u64) -> Result<(), String> {
    let slot: &'static AtomicPtr<c_void> = Box::leak(Box::new(AtomicPtr::new(null_mut())));
    let tap = CGEventTapCreate(
        SESSION_EVENT_TAP,
        HEAD_INSERT_EVENT_TAP,
        TAP_OPTION_LISTEN_ONLY,
        mask,
        tap_callback,
        slot as *const AtomicPtr<c_void> as *mut c_void,
    );
    if tap.is_null() {
        return Err("macOS refused to create the event tap".into());
    }
    slot.store(tap, Ordering::Release);

    let source = CFMachPortCreateRunLoopSource(null(), tap, 0);
    if source.is_null() {
        return Err("could not attach the event tap to a run loop".into());
    }
    CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
    CGEventTapEnable(tap, true);
    CFRunLoopRun();
    Ok(())
}

pub fn start(tx: Sender<InputEvent>) -> Result<(), String> {
    SENDER
        .set(tx)
        .map_err(|_| "the input listener is already running".to_string())?;

    // Mouse clicks don't need any permission.
    thread::Builder::new()
        .name("deskbuddy-mouse".into())
        .spawn(|| unsafe {
            if let Err(e) = run_tap(MOUSE_MASK) {
                eprintln!("[deskbuddy] mouse listener: {e}");
            }
        })
        .map_err(|e| e.to_string())?;

    // Keystrokes need "Input Monitoring": ask once, then wait for it.
    thread::Builder::new()
        .name("deskbuddy-keys".into())
        .spawn(|| unsafe {
            if !CGPreflightListenEventAccess() {
                CGRequestListenEventAccess();
                while !CGPreflightListenEventAccess() {
                    thread::sleep(Duration::from_secs(2));
                }
            }
            if let Err(e) = run_tap(KEY_MASK) {
                eprintln!("[deskbuddy] keyboard listener: {e}");
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn keyboard_access() -> bool {
    unsafe { CGPreflightListenEventAccess() }
}

pub fn request_keyboard_access() {
    unsafe {
        CGRequestListenEventAccess();
    }
}
