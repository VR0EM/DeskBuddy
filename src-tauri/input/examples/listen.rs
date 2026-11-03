//! Prints what the listener sees, to check it on a real machine:
//!
//!     cargo run -p deskbuddy-input --example listen -- 20
//!
//! (the number is how many seconds to listen).

use std::time::{Duration, Instant};

fn main() {
    let seconds: u64 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);
    let (tx, rx) = std::sync::mpsc::channel();
    if let Err(e) = deskbuddy_input::start(tx) {
        eprintln!("could not start: {e}");
        std::process::exit(1);
    }
    println!(
        "listening for {seconds} s: {}",
        deskbuddy_input::diagnostics()
    );
    let end = Instant::now() + Duration::from_secs(seconds);
    while let Some(left) = end.checked_duration_since(Instant::now()) {
        match rx.recv_timeout(left) {
            Ok(event) => println!("{event:?}"),
            Err(_) => break,
        }
    }
    println!("done: {}", deskbuddy_input::diagnostics());
}
