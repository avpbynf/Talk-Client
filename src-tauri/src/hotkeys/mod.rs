use crate::{audio, audio_encoder, server_transcription, AppState, RecordingMode};
use crate::settings::TranscriptionMode;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, EventTarget, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use thiserror::Error;

#[cfg(windows)]
fn send_media_play_pause() {
    use enigo::{Enigo, Key, Keyboard, Settings};
    if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
        let _ = enigo.key(Key::MediaPlayPause, enigo::Direction::Click);
    }
}

#[cfg(windows)]
fn resume_media_if_paused(state: &AppState) {
    let did_pause = std::mem::replace(&mut *state.did_pause_media.lock(), false);
    if did_pause {
        send_media_play_pause();
    }
}

/// Check if audio is currently playing on the default render device.
/// Uses IAudioMeterInformation to read the peak level — if > 0, something is playing.
#[cfg(windows)]
fn is_audio_playing() -> bool {
    use windows::Win32::Media::Audio::{
        eRender, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: Result<IMMDeviceEnumerator, _> =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
        let Ok(enumerator) = enumerator else { return false };
        let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) else { return false };
        let Ok(meter) = device.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) else { return false };
        let Ok(peak) = meter.GetPeakValue() else { return false };
        peak > 0.001
    }
}

#[derive(Error, Debug)]
pub enum HotkeyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub shortcut: String,
    #[serde(default = "default_cancel_shortcut")]
    pub cancel_shortcut: String,
    pub mode: RecordingMode,
}

fn default_cancel_shortcut() -> String {
    "Ctrl+F1".to_string()
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            shortcut: "Ctrl+Space".to_string(),
            cancel_shortcut: default_cancel_shortcut(),
            mode: RecordingMode::Toggle,
        }
    }
}

fn get_config_path() -> PathBuf {
    ProjectDirs::from("com", "avpbynf", "t4lk")
        .map(|dirs| dirs.config_dir().join("hotkeys.json"))
        .unwrap_or_else(|| PathBuf::from("hotkeys.json"))
}

pub fn load_config() -> Result<HotkeyConfig, HotkeyError> {
    let path = get_config_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    } else {
        Ok(HotkeyConfig::default())
    }
}

pub fn save_config(config: &HotkeyConfig) -> Result<(), HotkeyError> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, content)?;
    Ok(())
}

pub fn setup_shortcuts(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = load_config().unwrap_or_default();
    let global_shortcut = app.global_shortcut();
    let state = app.state::<AppState>();

    let _ = global_shortcut.unregister_all();

    // Store parsed shortcuts in AppState — the single handler in Builder::with_handler
    // dispatches based on these values. No on_shortcut calls needed.
    if let Ok(shortcut) = parse_shortcut(&config.shortcut) {
        *state.main_shortcut.lock() = Some(shortcut);
        if let Err(e) = global_shortcut.register(shortcut) {
            eprintln!("Main shortcut register error: {} - try a different shortcut", e);
        }
    }

    if let Ok(cancel_parsed) = parse_shortcut(&config.cancel_shortcut) {
        *state.cancel_shortcut.lock() = Some(cancel_parsed);
        if let Err(e) = global_shortcut.register(cancel_parsed) {
            eprintln!("Cancel shortcut register error: {}", e);
        }
    }

    Ok(())
}

pub fn disable_shortcuts(app: &AppHandle) {
    let global_shortcut = app.global_shortcut();
    if let Err(e) = global_shortcut.unregister_all() {
        eprintln!("Warning: failed to unregister shortcuts: {}", e);
    }
}

pub fn enable_shortcuts(app: &AppHandle) {
    let global_shortcut = app.global_shortcut();
    let state = app.state::<AppState>();

    // Just re-register — handlers are in Builder::with_handler, no closure allocation
    let main = *state.main_shortcut.lock();
    if let Some(main) = main {
        let _ = global_shortcut.register(main);
    }
    let cancel = *state.cancel_shortcut.lock();
    if let Some(cancel) = cancel {
        let _ = global_shortcut.register(cancel);
    }
}

pub fn update_shortcut(app: &AppHandle, new_shortcut: &str) -> Result<(), Box<dyn std::error::Error>> {
    let new_parsed = parse_shortcut(new_shortcut)?;
    let global_shortcut = app.global_shortcut();
    let state = app.state::<AppState>();

    if let Err(e) = global_shortcut.unregister_all() {
        eprintln!("Warning: failed to unregister shortcuts: {}", e);
    }

    // Update stored shortcut and register (no on_shortcut — handler is in Builder)
    *state.main_shortcut.lock() = Some(new_parsed);
    if let Err(e) = global_shortcut.register(new_parsed) {
        eprintln!("Warning: register failed: {} - will work after restart", e);
    }

    // Re-register cancel shortcut
    let cancel = *state.cancel_shortcut.lock();
    if let Some(cancel) = cancel {
        let _ = global_shortcut.register(cancel);
    }

    let mut config = load_config().unwrap_or_default();
    config.shortcut = new_shortcut.to_string();
    if let Err(e) = save_config(&config) {
        eprintln!("Warning: failed to save config: {}", e);
    }

    Ok(())
}

pub fn update_cancel_shortcut(app: &AppHandle, new_shortcut: &str) -> Result<(), Box<dyn std::error::Error>> {
    let new_parsed = parse_shortcut(new_shortcut)?;
    let global_shortcut = app.global_shortcut();
    let state = app.state::<AppState>();

    if let Err(e) = global_shortcut.unregister_all() {
        eprintln!("Warning: failed to unregister shortcuts: {}", e);
    }

    // Re-register main shortcut
    let main = *state.main_shortcut.lock();
    if let Some(main) = main {
        let _ = global_shortcut.register(main);
    }

    // Update stored cancel shortcut and register (no on_shortcut — handler is in Builder)
    *state.cancel_shortcut.lock() = Some(new_parsed);
    let _ = global_shortcut.register(new_parsed);

    let mut config = load_config().unwrap_or_default();
    config.cancel_shortcut = new_shortcut.to_string();
    if let Err(e) = save_config(&config) {
        eprintln!("Warning: failed to save config: {}", e);
    }

    Ok(())
}

fn parse_shortcut(shortcut_str: &str) -> Result<Shortcut, Box<dyn std::error::Error>> {
    let parts: Vec<&str> = shortcut_str.split('+').collect();

    let mut modifiers = Modifiers::empty();
    let mut key_code = None;

    for part in parts {
        let part = part.trim();
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "shift" => modifiers |= Modifiers::SHIFT,
            "alt" => modifiers |= Modifiers::ALT,
            "super" | "win" | "meta" => modifiers |= Modifiers::SUPER,
            "space" => key_code = Some(Code::Space),
            "enter" | "return" => key_code = Some(Code::Enter),
            "tab" => key_code = Some(Code::Tab),
            "escape" | "esc" => key_code = Some(Code::Escape),
            "backspace" => key_code = Some(Code::Backspace),
            "delete" => key_code = Some(Code::Delete),
            "insert" => key_code = Some(Code::Insert),
            "home" => key_code = Some(Code::Home),
            "end" => key_code = Some(Code::End),
            "pageup" => key_code = Some(Code::PageUp),
            "pagedown" => key_code = Some(Code::PageDown),
            "up" | "arrowup" => key_code = Some(Code::ArrowUp),
            "down" | "arrowdown" => key_code = Some(Code::ArrowDown),
            "left" | "arrowleft" => key_code = Some(Code::ArrowLeft),
            "right" | "arrowright" => key_code = Some(Code::ArrowRight),
            // F-keys
            "f1" => key_code = Some(Code::F1),
            "f2" => key_code = Some(Code::F2),
            "f3" => key_code = Some(Code::F3),
            "f4" => key_code = Some(Code::F4),
            "f5" => key_code = Some(Code::F5),
            "f6" => key_code = Some(Code::F6),
            "f7" => key_code = Some(Code::F7),
            "f8" => key_code = Some(Code::F8),
            "f9" => key_code = Some(Code::F9),
            "f10" => key_code = Some(Code::F10),
            "f11" => key_code = Some(Code::F11),
            "f12" => key_code = Some(Code::F12),
            // Numbers
            "0" | "digit0" => key_code = Some(Code::Digit0),
            "1" | "digit1" => key_code = Some(Code::Digit1),
            "2" | "digit2" => key_code = Some(Code::Digit2),
            "3" | "digit3" => key_code = Some(Code::Digit3),
            "4" | "digit4" => key_code = Some(Code::Digit4),
            "5" | "digit5" => key_code = Some(Code::Digit5),
            "6" | "digit6" => key_code = Some(Code::Digit6),
            "7" | "digit7" => key_code = Some(Code::Digit7),
            "8" | "digit8" => key_code = Some(Code::Digit8),
            "9" | "digit9" => key_code = Some(Code::Digit9),
            // Letters
            "a" => key_code = Some(Code::KeyA),
            "b" => key_code = Some(Code::KeyB),
            "c" => key_code = Some(Code::KeyC),
            "d" => key_code = Some(Code::KeyD),
            "e" => key_code = Some(Code::KeyE),
            "f" => key_code = Some(Code::KeyF),
            "g" => key_code = Some(Code::KeyG),
            "h" => key_code = Some(Code::KeyH),
            "i" => key_code = Some(Code::KeyI),
            "j" => key_code = Some(Code::KeyJ),
            "k" => key_code = Some(Code::KeyK),
            "l" => key_code = Some(Code::KeyL),
            "m" => key_code = Some(Code::KeyM),
            "n" => key_code = Some(Code::KeyN),
            "o" => key_code = Some(Code::KeyO),
            "p" => key_code = Some(Code::KeyP),
            "q" => key_code = Some(Code::KeyQ),
            "r" => key_code = Some(Code::KeyR),
            "s" => key_code = Some(Code::KeyS),
            "t" => key_code = Some(Code::KeyT),
            "u" => key_code = Some(Code::KeyU),
            "v" => key_code = Some(Code::KeyV),
            "w" => key_code = Some(Code::KeyW),
            "x" => key_code = Some(Code::KeyX),
            "y" => key_code = Some(Code::KeyY),
            "z" => key_code = Some(Code::KeyZ),
            _ => {}
        }
    }

    let code = key_code.ok_or("No valid key found in shortcut")?;

    Ok(Shortcut::new(Some(modifiers), code))
}

pub fn handle_shortcut_event(app: &AppHandle, state: ShortcutState) {
    let app_state = app.state::<AppState>();
    let mode = *app_state.recording_mode.lock();

    match mode {
        RecordingMode::PushToTalk => {
            match state {
                ShortcutState::Pressed => {
                    // Start recording
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = start_recording_internal(&app);
                    });
                }
                ShortcutState::Released => {
                    // Stop recording and transcribe
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = stop_recording_internal(&app).await;
                    });
                }
            }
        }
        RecordingMode::Toggle => {
            if matches!(state, ShortcutState::Pressed) {
                let is_recording = *app_state.is_recording.lock();
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if is_recording {
                        let _ = stop_recording_internal(&app).await;
                    } else {
                        let _ = start_recording_internal(&app);
                    }
                });
            }
        }
    }
}

pub fn cancel_recording(app: &AppHandle) {
    let state = app.state::<AppState>();

    // Only cancel if we're actually recording
    if !*state.is_recording.lock() {
        return;
    }

    // Stop recording flag
    *state.is_recording.lock() = false;

    // Stop audio capture and clear buffer
    *state.audio_capture_handle.lock() = None;
    *state.audio_buffer.lock() = None;

    // Unmute virtual mic on cancel
    {
        let vm = state.virtual_mic.lock();
        if vm.is_active() {
            vm.unmute();
            let _ = app.emit("meeting-mode-muted", false);
        }
    }

    // Resume media playback if we paused it
    #[cfg(windows)]
    resume_media_if_paused(&state);

    // Hide overlay
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    // Emit cancelled event
    let _ = app.emit("recording-cancelled", ());
}

fn start_recording_internal(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();

    if *state.is_recording.lock() {
        return Ok(());
    }

    // 1. Mute virtual mic FIRST (instant — just flips an AtomicBool)
    {
        let vm = state.virtual_mic.lock();
        if vm.is_active() {
            vm.mute();
            let _ = app.emit("meeting-mode-muted", true);
        }
    }

    // 2. Start audio capture immediately (use selected device or system default)
    let device_name = state.input_device_name.lock().clone();
    let (buffer, handle) = audio::start_capture_device(device_name.as_deref()).map_err(|e| e.to_string())?;
    let buffer_for_spectrum = buffer.clone();

    *state.audio_buffer.lock() = Some(buffer);
    *state.audio_capture_handle.lock() = Some(handle);
    *state.is_recording.lock() = true;

    // 3. Pause media playback if enabled AND something is actually playing
    #[cfg(windows)]
    {
        let should_pause = *state.pause_media_on_record.lock();
        if should_pause && is_audio_playing() {
            send_media_play_pause();
            *state.did_pause_media.lock() = true;
        }
    }

    // 4. Show overlay (pre-created at startup, just show it — never recreate)
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        let _ = overlay.set_always_on_top(true);
    }

    // 5. Emit recording state
    let _ = app.emit("recording-started", ());

    // 6. Start spectrum emission thread
    let app_for_spectrum = app.clone();
    std::thread::spawn(move || {
        let num_bars = 8;
        loop {
            let state = app_for_spectrum.state::<AppState>();
            if !*state.is_recording.lock() {
                break;
            }

            let levels = buffer_for_spectrum.get_spectrum(num_bars);
            let _ = app_for_spectrum.emit_to(
                EventTarget::webview_window("overlay"),
                "audio-spectrum",
                levels,
            );

            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    });

    Ok(())
}

async fn stop_recording_internal(app: &AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();

    if !*state.is_recording.lock() {
        return Err("Not recording".to_string());
    }

    let audio_data = {
        let buffer_lock = state.audio_buffer.lock();
        if let Some(ref buffer) = *buffer_lock {
            buffer.take()
        } else {
            #[cfg(windows)]
            resume_media_if_paused(&state);
            return Err("No audio buffer found".to_string());
        }
    };

    // Stop audio capture - dropping the handle signals the stream thread to exit
    *state.audio_capture_handle.lock() = None;
    *state.is_recording.lock() = false;

    // Unmute virtual mic after STT recording
    {
        let vm = state.virtual_mic.lock();
        if vm.is_active() {
            vm.unmute();
            let _ = app.emit("meeting-mode-muted", false);
        }
    }

    // Resume media playback immediately at recording stop (not after transcription)
    #[cfg(windows)]
    resume_media_if_paused(&state);

    let _ = app.emit("recording-stopped", ());

    // Helper to emit to overlay window
    let emit_to_overlay = |app: &AppHandle, processing_state: &str| {
        let _ = app.emit_to(EventTarget::webview_window("overlay"), "processing-state", processing_state);
    };

    // Emit transcribing state
    emit_to_overlay(app, "transcribing");

    // Get transcription mode settings
    let transcription_mode = *state.transcription_mode.lock();
    let server_url = state.server_url.lock().clone();
    let server_fallback = *state.server_fallback.lock();
    let server_timeout = *state.server_timeout.lock();

    // Build vocabulary prompt from custom words only (comma-separated, no prefix)
    let user_vocabulary = state.vocabulary.lock().clone();
    let vocabulary_prompt = if user_vocabulary.is_empty() {
        None
    } else {
        Some(user_vocabulary.join(", "))
    };

    // Transcribe based on mode
    let transcription = match transcription_mode {
        TranscriptionMode::Server => {
            // Try server transcription
            emit_to_overlay(app, "streaming");

            // Encode audio to WAV
            let wav_data = audio_encoder::encode_wav(&audio_data, 16000, 1)
                .map_err(|e| format!("Failed to encode WAV: {}", e))?;

            // Create callback for streaming segments
            let app_for_stream = app.clone();
            let on_segment = move |segment: server_transcription::TranscriptionSegment| {
                let _ = app_for_stream.emit_to(
                    EventTarget::webview_window("overlay"),
                    "transcription-segment",
                    &segment,
                );
            };

            // Try server transcription
            // Note: detected_context.language is a programming language name (e.g. "rust",
            // "generic_dev"), NOT a Whisper language code. Pass None to let the server use
            // its configured DEFAULT_LANGUAGE.
            match server_transcription::transcribe_stream(&server_url, &wav_data, server_timeout, None, vocabulary_prompt.as_deref(), on_segment, |_| {}).await {
                Ok(text) => text,
                Err(e) => {
                    eprintln!("Server transcription failed: {}", e);

                    // Fallback to local if enabled
                    if server_fallback {
                        eprintln!("Falling back to local Whisper transcription");
                        emit_to_overlay(app, "transcribing");

                        let app_clone = app.clone();
                        let engine_lock = state.whisper_engine.lock();
                        if let Some(ref engine) = *engine_lock {
                            engine
                                .transcribe_with_options(&audio_data, vocabulary_prompt.as_deref(), move |progress| {
                                    let _ = app_clone.emit_to(
                                        EventTarget::webview_window("overlay"),
                                        "transcription-progress",
                                        progress,
                                    );
                                })
                                .map_err(|e| e.to_string())?
                        } else {
                            emit_to_overlay(app, "idle");
                            return Err(format!("Server failed: {}. No local model loaded for fallback.", e));
                        }
                    } else {
                        emit_to_overlay(app, "idle");
                        return Err(format!("Server transcription failed: {}", e));
                    }
                }
            }
        }
        TranscriptionMode::Local => {
            // Local Whisper transcription
            let app_clone = app.clone();
            let engine_lock = state.whisper_engine.lock();
            if let Some(ref engine) = *engine_lock {
                engine
                    .transcribe_with_options(&audio_data, vocabulary_prompt.as_deref(), move |progress| {
                        let _ = app_clone.emit_to(
                            EventTarget::webview_window("overlay"),
                            "transcription-progress",
                            progress,
                        );
                    })
                    .map_err(|e| e.to_string())?
            } else {
                emit_to_overlay(app, "idle");
                return Err("No model loaded".to_string());
            }
        }
    };

    emit_to_overlay(app, "idle");

    // Hide overlay
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    // Copy to clipboard and simulate paste
    #[cfg(windows)]
    {
        let preserve = *state.preserve_clipboard.lock();
        let _ = crate::clipboard::type_text(&transcription, preserve);
    }

    let _ = app.emit("transcription-complete", &transcription);

    Ok(transcription)
}
