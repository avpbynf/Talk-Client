//! The overlay window, and the one thing Windows will not keep on its own.

use tauri::{AppHandle, Manager, WebviewWindow};

/// Show the overlay, and put it back on top, which is a second thing.
///
/// `show()` is `ShowWindow(SW_SHOW)`, which makes the window visible exactly
/// where it already sat in the z-order. The `set_always_on_top(true)` this
/// replaces looks like it covered the rest and does not: tao holds the
/// always-on-top flag in its own window state and its `apply_diff` returns
/// early when nothing changed, so a window built with `always_on_top(true)`
/// never gets a `SetWindowPos` out of being asked for it again.
///
/// Windows takes a window out of the topmost band on its own account, and a
/// full screen application is only the most obvious of the ways. Read off a
/// running install: the overlay still carried `WS_EX_TOPMOST` while sitting
/// sixty-five windows down the z-order, under the browser and under Talk's own
/// window, so a dictation drew it behind whatever was on screen. Nothing in the
/// application put it back, which is why restarting was the repair: that builds
/// the window again.
pub fn show(app: &AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        raise(&overlay);
    }
}

/// Ask Windows for the topmost band again, whatever tao believes the flag is.
#[cfg(windows)]
pub fn raise(overlay: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    };

    let Ok(handle) = overlay.hwnd() else {
        return;
    };

    // NOACTIVATE, because the overlay must never take the focus off whatever
    // the dictation is about to be typed into. ASYNCWINDOWPOS, because this is
    // called from the recording path rather than from the thread that owns the
    // window, and a cross-thread SetWindowPos otherwise waits on that thread.
    unsafe {
        let _ = SetWindowPos(
            HWND(handle.0 as _),
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_ASYNCWINDOWPOS | SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

#[cfg(not(windows))]
pub fn raise(overlay: &WebviewWindow) {
    let _ = overlay.set_always_on_top(true);
}
