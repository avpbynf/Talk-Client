use crate::{audio, audio_encoder, context_detection, server_transcription, settings, AppState, RecordingMode};
use crate::settings::TranscriptionMode;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, EventTarget, Manager, WebviewUrl, WebviewWindowBuilder};
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

#[cfg(windows)]
fn mute_system_mic() -> bool {
    use windows::Win32::Media::Audio::{
        eCapture, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: Result<IMMDeviceEnumerator, _> =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
        let Ok(enumerator) = enumerator else { return false };
        let Ok(device) = enumerator.GetDefaultAudioEndpoint(eCapture, eConsole) else { return false };
        let Ok(volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) else { return false };
        let was_muted = volume.GetMute().unwrap_or_default().as_bool();
        if !was_muted {
            let _ = volume.SetMute(true, std::ptr::null());
            return true; // we changed the state
        }
        false // was already muted, don't restore later
    }
}

#[cfg(windows)]
fn unmute_system_mic() {
    use windows::Win32::Media::Audio::{
        eCapture, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: Result<IMMDeviceEnumerator, _> =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
        if let Ok(enumerator) = enumerator {
            if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eCapture, eConsole) {
                if let Ok(volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                    let _ = volume.SetMute(false, std::ptr::null());
                }
            }
        }
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
    ProjectDirs::from("com", "t4lk", "t4lk")
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

    // Clean up any existing shortcuts first
    let _ = global_shortcut.unregister_all();

    eprintln!("Setting up shortcuts:");
    eprintln!("  Main: {}", config.shortcut);
    eprintln!("  Cancel: {}", config.cancel_shortcut);

    // Parse and register main shortcut
    if let Ok(shortcut) = parse_shortcut(&config.shortcut) {
        let app_handle = app.handle().clone();

        if let Err(e) = global_shortcut.on_shortcut(shortcut, move |_app, _shortcut, event| {
            handle_shortcut_event(&app_handle, event.state);
        }) {
            eprintln!("  Main shortcut handler error: {}", e);
        }

        if let Err(e) = global_shortcut.register(shortcut) {
            eprintln!("  Main shortcut register error: {} - try a different shortcut", e);
        } else {
            eprintln!("  Main shortcut registered OK");
        }
    } else {
        eprintln!("  Main shortcut parse error for: {}", config.shortcut);
    }

    // Register cancel shortcut
    if let Ok(cancel_parsed) = parse_shortcut(&config.cancel_shortcut) {
        let app_handle_cancel = app.handle().clone();

        if let Err(e) = global_shortcut.on_shortcut(cancel_parsed, move |_app, _shortcut, event| {
            if matches!(event.state, ShortcutState::Pressed) {
                cancel_recording(&app_handle_cancel);
            }
        }) {
            eprintln!("  Cancel shortcut handler error: {}", e);
        }

        if let Err(e) = global_shortcut.register(cancel_parsed) {
            eprintln!("  Cancel shortcut register error: {}", e);
        } else {
            eprintln!("  Cancel shortcut registered OK");
        }
    } else {
        eprintln!("  Cancel shortcut parse error");
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
    let config = load_config().unwrap_or_default();
    let global_shortcut = app.global_shortcut();

    // Re-register main shortcut
    if let Ok(main_parsed) = parse_shortcut(&config.shortcut) {
        let app_handle = app.clone();
        let _ = global_shortcut.on_shortcut(main_parsed, move |_app, _shortcut, event| {
            handle_shortcut_event(&app_handle, event.state);
        });
        let _ = global_shortcut.register(main_parsed);
    }

    // Re-register cancel shortcut
    if let Ok(cancel_parsed) = parse_shortcut(&config.cancel_shortcut) {
        let app_handle_cancel = app.clone();
        let _ = global_shortcut.on_shortcut(cancel_parsed, move |_app, _shortcut, event| {
            if matches!(event.state, ShortcutState::Pressed) {
                cancel_recording(&app_handle_cancel);
            }
        });
        let _ = global_shortcut.register(cancel_parsed);
    }
}

pub fn update_shortcut(app: &AppHandle, new_shortcut: &str) -> Result<(), Box<dyn std::error::Error>> {
    // First, validate the new shortcut can be parsed
    let new_parsed = parse_shortcut(new_shortcut)?;

    let global_shortcut = app.global_shortcut();

    // Unregister ALL shortcuts first to avoid conflicts
    if let Err(e) = global_shortcut.unregister_all() {
        eprintln!("Warning: failed to unregister shortcuts: {}", e);
    }

    // Register the new shortcut with handler
    let app_handle = app.clone();
    if let Err(e) = global_shortcut.on_shortcut(new_parsed, move |_app, _shortcut, event| {
        handle_shortcut_event(&app_handle, event.state);
    }) {
        eprintln!("Warning: on_shortcut failed (may already exist): {}", e);
    }

    // Try to register main shortcut
    if let Err(e) = global_shortcut.register(new_parsed) {
        eprintln!("Warning: register failed: {} - will work after restart", e);
    }

    // Re-register cancel shortcut
    let config = load_config().unwrap_or_default();
    if let Ok(cancel_parsed) = parse_shortcut(&config.cancel_shortcut) {
        let app_handle_cancel = app.clone();
        let _ = global_shortcut.on_shortcut(cancel_parsed, move |_app, _shortcut, event| {
            if matches!(event.state, ShortcutState::Pressed) {
                cancel_recording(&app_handle_cancel);
            }
        });
        let _ = global_shortcut.register(cancel_parsed);
    }

    // Save to config - always save even if register failed
    let mut config = load_config().unwrap_or_default();
    config.shortcut = new_shortcut.to_string();
    if let Err(e) = save_config(&config) {
        eprintln!("Warning: failed to save config: {}", e);
    }

    Ok(())
}

pub fn update_cancel_shortcut(app: &AppHandle, new_shortcut: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Validate the new shortcut can be parsed
    let new_parsed = parse_shortcut(new_shortcut)?;

    let global_shortcut = app.global_shortcut();

    // Unregister ALL shortcuts first
    if let Err(e) = global_shortcut.unregister_all() {
        eprintln!("Warning: failed to unregister shortcuts: {}", e);
    }

    // Re-register main shortcut
    let config = load_config().unwrap_or_default();
    if let Ok(main_parsed) = parse_shortcut(&config.shortcut) {
        let app_handle = app.clone();
        let _ = global_shortcut.on_shortcut(main_parsed, move |_app, _shortcut, event| {
            handle_shortcut_event(&app_handle, event.state);
        });
        let _ = global_shortcut.register(main_parsed);
    }

    // Register new cancel shortcut
    let app_handle_cancel = app.clone();
    let _ = global_shortcut.on_shortcut(new_parsed, move |_app, _shortcut, event| {
        if matches!(event.state, ShortcutState::Pressed) {
            cancel_recording(&app_handle_cancel);
        }
    });
    let _ = global_shortcut.register(new_parsed);

    // Save to config
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

fn handle_shortcut_event(app: &AppHandle, state: ShortcutState) {
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

    // Resume media playback if we paused it
    #[cfg(windows)]
    resume_media_if_paused(&state);
    #[cfg(windows)]
    {
        let did_mute = std::mem::replace(&mut *state.did_mute_mic.lock(), false);
        if did_mute {
            unmute_system_mic();
        }
    }

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

    // Detect context NOW while the user is still in their editor (Zed, VS Code, etc.)
    // This must happen before showing overlay which would change the active window
    let detected_context = context_detection::detect();
    *state.last_detected_context.lock() = Some(detected_context.clone());
    eprintln!(
        "[context_detection] Context captured at recording start: language={:?}, workspace={:?}",
        detected_context.language, detected_context.workspace
    );

    // Emit context-updated event for UI
    let user_vocabulary = state.vocabulary.lock().clone();
    let vocabulary_prompt = context_detection::build_prompt(&detected_context, &user_vocabulary);
    let has_real_context = detected_context.language.is_some() || !detected_context.symbols.is_empty();

    let _ = app.emit("context-updated", serde_json::json!({
        "has_real_context": has_real_context,
        "language": detected_context.language,
        "symbols": detected_context.symbols,
        "workspace": detected_context.workspace,
        "frameworks": detected_context.frameworks,
        "window_title": detected_context.window_title,
        "domain": detected_context.domain,
        "vocabulary_prompt": vocabulary_prompt,
    }));

    // Show overlay first (without taking focus to keep cursor in place)
    if app.get_webview_window("overlay").is_none() {
        let app_settings = settings::load_settings();
        let (width, height) = app_settings.overlay_size.dimensions();

        let mut builder = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("/overlay".into()))
            .title("")
            .inner_size(width, height)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false);

        // Use saved position or center
        if let Some(pos) = app_settings.overlay_position {
            builder = builder.position(pos.x, pos.y);
        } else {
            builder = builder.center();
        }

        match builder.build() {
            Ok(window) => {
                // Force show and always on top
                let _ = window.show();
                let _ = window.set_always_on_top(true);
            }
            Err(e) => {
                eprintln!("Failed to create overlay window: {}", e);
            }
        }
    } else if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        let _ = overlay.set_always_on_top(true);
    }

    // Small delay to ensure overlay is visible before we emit state
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Start audio capture
    let (buffer, handle) = audio::start_capture().map_err(|e| e.to_string())?;
    let buffer_for_spectrum = buffer.clone();

    *state.audio_buffer.lock() = Some(buffer);
    *state.audio_capture_handle.lock() = Some(handle);
    *state.is_recording.lock() = true;

    // Pause media playback if enabled AND something is actually playing
    #[cfg(windows)]
    {
        let should_pause = *state.pause_media_on_record.lock();
        if should_pause {
            send_media_play_pause();
            *state.did_pause_media.lock() = true;
        }
    }

    // Mute system microphone if enabled
    #[cfg(windows)]
    {
        let should_mute = *state.mute_mic_on_record.lock();
        if should_mute {
            if mute_system_mic() {
                *state.did_mute_mic.lock() = true;
            }
        }
    }

    // Emit recording state
    let _ = app.emit("recording-started", ());

    // Start spectrum emission thread
    let app_for_spectrum = app.clone();
    std::thread::spawn(move || {
        let num_bars = 8;
        loop {
            // Check if still recording
            let state = app_for_spectrum.state::<AppState>();
            if !*state.is_recording.lock() {
                break;
            }

            // Get spectrum levels and emit to overlay
            let levels = buffer_for_spectrum.get_spectrum(num_bars);
            let _ = app_for_spectrum.emit_to(
                EventTarget::webview_window("overlay"),
                "audio-spectrum",
                levels,
            );

            // Emit every 50ms for smooth animation
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
            #[cfg(windows)]
            {
                let did_mute = std::mem::replace(&mut *state.did_mute_mic.lock(), false);
                if did_mute {
                    unmute_system_mic();
                }
            }
            return Err("No audio buffer found".to_string());
        }
    };

    // Stop audio capture - dropping the handle signals the stream thread to exit
    *state.audio_capture_handle.lock() = None;
    *state.is_recording.lock() = false;

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

    // Use context detected at recording start (when user was still in their editor)
    let detected_context = state
        .last_detected_context
        .lock()
        .clone()
        .unwrap_or_default();
    let user_vocabulary = state.vocabulary.lock().clone();
    let vocabulary_prompt = context_detection::build_prompt(&detected_context, &user_vocabulary);

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
                            #[cfg(windows)]
                            resume_media_if_paused(&state);
                            #[cfg(windows)]
                            {
                                let did_mute = std::mem::replace(&mut *state.did_mute_mic.lock(), false);
                                if did_mute {
                                    unmute_system_mic();
                                }
                            }
                            return Err(format!("Server failed: {}. No local model loaded for fallback.", e));
                        }
                    } else {
                        emit_to_overlay(app, "idle");
                        #[cfg(windows)]
                        resume_media_if_paused(&state);
                        #[cfg(windows)]
                        {
                            let did_mute = std::mem::replace(&mut *state.did_mute_mic.lock(), false);
                            if did_mute {
                                unmute_system_mic();
                            }
                        }
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
                #[cfg(windows)]
                resume_media_if_paused(&state);
                #[cfg(windows)]
                {
                    let did_mute = std::mem::replace(&mut *state.did_mute_mic.lock(), false);
                    if did_mute {
                        unmute_system_mic();
                    }
                }
                return Err("No model loaded".to_string());
            }
        }
    };

    emit_to_overlay(app, "idle");

    // Resume media playback if we paused it
    #[cfg(windows)]
    resume_media_if_paused(&state);
    #[cfg(windows)]
    {
        let did_mute = std::mem::replace(&mut *state.did_mute_mic.lock(), false);
        if did_mute {
            unmute_system_mic();
        }
    }

    // Hide overlay
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    // Copy and paste — use direct typing for terminals (SendInput doesn't work with WinUI)
    #[cfg(windows)]
    {
        let is_terminal = detected_context.domain.as_deref() == Some("terminal");
        if is_terminal {
            let _ = crate::clipboard::type_text_direct(&transcription);
        } else {
            let preserve = *state.preserve_clipboard.lock();
            let _ = crate::clipboard::type_text(&transcription, preserve);
        }
    }

    let _ = app.emit("transcription-complete", &transcription);

    Ok(transcription)
}
