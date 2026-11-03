//! Linux (X11 only): uses rdev's XRecord listener. Not an official target,
//! but handy for development and testing.

use std::collections::HashSet;
use std::sync::mpsc::Sender;

use rdev::{Button, EventType, Key};

use crate::{InputEvent, MouseButton, Side};

fn side(key: Key) -> Side {
    use Key::*;
    match key {
        Space => Side::Both,
        Escape | BackQuote | Num1 | Num2 | Num3 | Num4 | Num5 | Tab | KeyQ | KeyW | KeyE | KeyR
        | KeyT | CapsLock | KeyA | KeyS | KeyD | KeyF | KeyG | ShiftLeft | IntlBackslash | KeyZ
        | KeyX | KeyC | KeyV | KeyB | ControlLeft | MetaLeft | Alt | Function | F1 | F2 | F3
        | F4 | F5 | F6 => Side::Left,
        _ => Side::Right,
    }
}

pub fn start(tx: Sender<InputEvent>) -> Result<(), String> {
    std::thread::Builder::new()
        .name("deskbuddy-input".into())
        .spawn(move || {
            let mut held: HashSet<Key> = HashSet::new();
            let result = rdev::listen(move |event| match event.event_type {
                EventType::KeyPress(key) => {
                    // Holding a key repeats KeyPress; only the first one counts.
                    if held.insert(key) {
                        let _ = tx.send(InputEvent::Key(side(key)));
                    }
                }
                EventType::KeyRelease(key) => {
                    held.remove(&key);
                }
                EventType::ButtonPress(button) => {
                    let button = match button {
                        Button::Left => MouseButton::Left,
                        Button::Right => MouseButton::Right,
                        Button::Middle => MouseButton::Middle,
                        Button::Unknown(_) => MouseButton::Other,
                    };
                    let _ = tx.send(InputEvent::Mouse(button));
                }
                _ => {}
            });
            if let Err(e) = result {
                eprintln!("[deskbuddy] input listener stopped: {e:?}");
            }
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn keyboard_access() -> bool {
    true
}

pub fn request_keyboard_access() {}
