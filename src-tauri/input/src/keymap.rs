//! Decides which paw a key belongs to, from the key's physical position.
//!
//! Both Windows scan codes and macOS key codes describe where a key sits on
//! the keyboard, not which letter it types, so AZERTY, QWERTZ and QWERTY
//! keyboards all behave the same.

use crate::Side;

/// Windows: classify a key from its hardware scan code.
/// `extended` is the LLKHF_EXTENDED flag; `vk` the virtual-key code.
pub fn windows_side(scan_code: u32, extended: bool, vk: u32) -> Side {
    match vk {
        0x5B => return Side::Left,         // left Windows key
        0x5C | 0x5D => return Side::Right, // right Windows key, menu key
        _ => {}
    }
    // Extended keys are the arrows, the navigation block, right Ctrl/Alt and
    // some numpad keys: all on the right.
    if extended {
        return Side::Right;
    }
    match scan_code {
        0x39 => Side::Both, // space
        0x01                // Esc
        | 0x29              // ` (left of 1)
        | 0x02..=0x06       // 1 2 3 4 5
        | 0x0F..=0x14       // Tab Q W E R T
        | 0x3A              // Caps Lock
        | 0x1E..=0x22       // A S D F G
        | 0x2A              // left Shift
        | 0x56              // extra ISO key next to left Shift
        | 0x2C..=0x30       // Z X C V B
        | 0x1D              // left Ctrl (right Ctrl is extended)
        | 0x38              // left Alt (right Alt is extended)
        | 0x3B..=0x40       // F1 - F6
        => Side::Left,
        _ => Side::Right,
    }
}

/// macOS: classify a key from its virtual key code (kVK_* constants).
pub fn mac_side(keycode: u16) -> Side {
    match keycode {
        0x31 => Side::Both, // space
        0x00 | 0x01 | 0x02 | 0x03 | 0x05 // A S D F G
        | 0x06 | 0x07 | 0x08 | 0x09 | 0x0B // Z X C V B
        | 0x0C | 0x0D | 0x0E | 0x0F | 0x11 // Q W E R T
        | 0x12 | 0x13 | 0x14 | 0x15 | 0x17 // 1 2 3 4 5
        | 0x0A | 0x32 // § and ` (ISO / ANSI)
        | 0x30 // Tab
        | 0x35 // Esc
        | 0x37 | 0x38 | 0x39 | 0x3A | 0x3B // Cmd Shift CapsLock Option Control (left)
        | 0x3F // fn
        | 0x66 // JIS Eisu
        | 0x7A | 0x78 | 0x63 | 0x76 | 0x60 | 0x61 // F1 - F6
        => Side::Left,
        _ => Side::Right,
    }
}

/// macOS sends modifier keys as "flags changed" events for both press and
/// release. Returns true when `keycode` was pressed, judging by the
/// device-specific bits in the event's `flags`.
pub fn mac_modifier_pressed(keycode: u16, flags: u64) -> bool {
    let mask: u64 = match keycode {
        0x38 => 0x0000_0002, // left Shift
        0x3C => 0x0000_0004, // right Shift
        0x3B => 0x0000_0001, // left Control
        0x3E => 0x0000_2000, // right Control
        0x3A => 0x0000_0020, // left Option
        0x3D => 0x0000_0040, // right Option
        0x37 => 0x0000_0008, // left Command
        0x36 => 0x0000_0010, // right Command
        0x3F => 0x0080_0000, // fn
        // Caps Lock only reports a toggle, once per press.
        0x39 => return true,
        _ => return false,
    };
    flags & mask != 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_letters_split_down_the_middle() {
        assert_eq!(windows_side(0x1E, false, 0x41), Side::Left); // A
        assert_eq!(windows_side(0x22, false, 0x47), Side::Left); // G
        assert_eq!(windows_side(0x23, false, 0x48), Side::Right); // H
        assert_eq!(windows_side(0x26, false, 0x4C), Side::Right); // L
        assert_eq!(windows_side(0x39, false, 0x20), Side::Both); // space
    }

    #[test]
    fn windows_modifiers_use_their_own_side() {
        assert_eq!(windows_side(0x1D, false, 0xA2), Side::Left); // left Ctrl
        assert_eq!(windows_side(0x1D, true, 0xA3), Side::Right); // right Ctrl
        assert_eq!(windows_side(0x38, false, 0xA4), Side::Left); // left Alt
        assert_eq!(windows_side(0x38, true, 0xA5), Side::Right); // AltGr
        assert_eq!(windows_side(0x5B, true, 0x5B), Side::Left); // left Win
        assert_eq!(windows_side(0x48, true, 0x26), Side::Right); // arrow up
    }

    #[test]
    fn mac_letters_split_down_the_middle() {
        assert_eq!(mac_side(0x00), Side::Left); // A
        assert_eq!(mac_side(0x05), Side::Left); // G
        assert_eq!(mac_side(0x04), Side::Right); // H
        assert_eq!(mac_side(0x10), Side::Right); // Y
        assert_eq!(mac_side(0x11), Side::Left); // T
        assert_eq!(mac_side(0x31), Side::Both); // space
        assert_eq!(mac_side(0x24), Side::Right); // Return
    }

    #[test]
    fn mac_modifier_press_and_release() {
        assert!(mac_modifier_pressed(0x38, 0x0002_0102)); // left Shift down
        assert!(!mac_modifier_pressed(0x38, 0x0000_0100)); // released
        assert!(mac_modifier_pressed(0x36, 0x0010_0110)); // right Cmd down
        assert!(!mac_modifier_pressed(0x36, 0x0010_0108)); // only left Cmd still down
        assert!(!mac_modifier_pressed(0x00, 0xFFFF_FFFF)); // not a modifier
    }
}
