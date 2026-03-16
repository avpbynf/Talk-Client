#[cfg(windows)]
use clipboard_win::{formats, raw, set_clipboard};
#[cfg(windows)]
use enigo::{Enigo, Key, Keyboard, Settings};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ClipboardError {
    #[error("Failed to set clipboard: {0}")]
    SetClipboard(String),
    #[error("Failed to simulate input: {0}")]
    SimulateInput(String),
}

#[cfg(windows)]
struct ClipboardSnapshot {
    formats: Vec<(u32, Vec<u8>)>,
}

/// Save all clipboard formats (except GDI handle-based ones) into a snapshot.
#[cfg(windows)]
fn save_clipboard() -> Option<ClipboardSnapshot> {
    // Formats based on GDI handles - cannot be read with get_vec
    const HANDLE_FORMATS: &[u32] = &[2, 3, 14]; // CF_BITMAP, CF_METAFILEPICT, CF_ENHMETAFILE

    if raw::open().is_err() {
        return None;
    }

    let mut formats = Vec::new();
    for format_id in raw::EnumFormats::new() {
        if HANDLE_FORMATS.contains(&format_id) {
            continue;
        }
        let mut data = Vec::new();
        if raw::get_vec(format_id, &mut data).is_ok() && !data.is_empty() {
            formats.push((format_id, data));
        }
    }

    let _ = raw::close();

    if formats.is_empty() {
        None
    } else {
        Some(ClipboardSnapshot { formats })
    }
}

/// Restore all clipboard formats from a snapshot, replacing current clipboard content.
#[cfg(windows)]
fn restore_clipboard(snapshot: ClipboardSnapshot) {
    if raw::open().is_err() {
        return;
    }

    let _ = raw::empty();

    for (format_id, data) in &snapshot.formats {
        let _ = raw::set_without_clear(*format_id, data);
    }

    let _ = raw::close();
}

#[cfg(windows)]
pub fn copy_and_paste(text: &str) -> Result<(), ClipboardError> {
    // Copy to clipboard
    set_clipboard(formats::Unicode, text)
        .map_err(|e| ClipboardError::SetClipboard(e.to_string()))?;

    // Small delay to ensure clipboard is updated
    std::thread::sleep(std::time::Duration::from_millis(50));

    simulate_paste()?;

    Ok(())
}

#[cfg(windows)]
fn simulate_paste() -> Result<(), ClipboardError> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| ClipboardError::SimulateInput(e.to_string()))?;

    enigo
        .key(Key::Control, enigo::Direction::Press)
        .map_err(|e| ClipboardError::SimulateInput(e.to_string()))?;
    enigo
        .key(Key::Unicode('v'), enigo::Direction::Click)
        .map_err(|e| ClipboardError::SimulateInput(e.to_string()))?;
    enigo
        .key(Key::Control, enigo::Direction::Release)
        .map_err(|e| ClipboardError::SimulateInput(e.to_string()))?;

    Ok(())
}

/// Copy text to clipboard and paste, optionally preserving the original clipboard content.
/// If `preserve_clipboard` is true, saves all clipboard formats, pastes, then restores them.
#[cfg(windows)]
pub fn type_text(text: &str, preserve_clipboard: bool) -> Result<(), ClipboardError> {
    if !preserve_clipboard {
        return copy_and_paste(text);
    }

    let saved = save_clipboard();

    copy_and_paste(text)?;

    // Wait for paste to be processed by the target application
    std::thread::sleep(std::time::Duration::from_millis(100));

    match saved {
        Some(snapshot) => restore_clipboard(snapshot),
        None => {
            // Clipboard was empty, clear it again
            if raw::open().is_ok() {
                let _ = raw::empty();
                let _ = raw::close();
            }
        }
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn copy_and_paste(_text: &str) -> Result<(), ClipboardError> {
    // Not implemented for non-Windows platforms yet
    Ok(())
}

#[cfg(not(windows))]
pub fn type_text(_text: &str, _preserve_clipboard: bool) -> Result<(), ClipboardError> {
    Ok(())
}

/// Type text directly using enigo.text() - works in terminals where Ctrl+V doesn't
#[cfg(windows)]
pub fn type_text_direct(text: &str) -> Result<(), ClipboardError> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| ClipboardError::SimulateInput(e.to_string()))?;

    enigo
        .text(text)
        .map_err(|e| ClipboardError::SimulateInput(e.to_string()))?;

    Ok(())
}

#[cfg(not(windows))]
pub fn type_text_direct(_text: &str) -> Result<(), ClipboardError> {
    Ok(())
}
