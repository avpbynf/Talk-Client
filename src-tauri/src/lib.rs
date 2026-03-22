mod audio;
mod audio_encoder;
mod clipboard;
mod hotkeys;
mod keystroke;
mod models;
mod server_transcription;
mod settings;
mod transcription;
mod virtual_mic;

use audio::{AudioBuffer, AudioCaptureHandle};
use parking_lot::Mutex;
use settings::TranscriptionMode;
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

pub use models::ModelManager;
pub use transcription::{WhisperEngine, AcceleratorBackend, AcceleratorInfo, GpuVendor, GpuInfo};

/// Application state shared across all components
pub struct AppState {
    pub is_recording: Mutex<bool>,
    pub recording_mode: Mutex<RecordingMode>,
    pub current_model: Mutex<Option<String>>,
    pub model_manager: Arc<ModelManager>,
    pub audio_buffer: Mutex<Option<AudioBuffer>>,
    pub audio_capture_handle: Mutex<Option<AudioCaptureHandle>>,
    pub whisper_engine: Mutex<Option<WhisperEngine>>,
    pub accelerator_backend: Mutex<AcceleratorBackend>,
    pub gpu_vendor: Mutex<GpuVendor>,
    /// Custom vocabulary words to help Whisper recognize specific terms
    pub vocabulary: Mutex<Vec<String>>,
    /// Transcription mode: local or server
    pub transcription_mode: Mutex<TranscriptionMode>,
    /// Server URL for remote transcription
    pub server_url: Mutex<String>,
    /// Enable fallback to local Whisper if server unavailable
    pub server_fallback: Mutex<bool>,
    /// Server request timeout in milliseconds
    pub server_timeout: Mutex<u64>,
    /// Pause media playback during recording
    pub pause_media_on_record: Mutex<bool>,
    /// Track if we paused media (to resume on stop)
    pub did_pause_media: Mutex<bool>,
    /// Preserve clipboard content after pasting transcription
    pub preserve_clipboard: Mutex<bool>,
    /// Virtual mic controller for meeting mode
    pub virtual_mic: Mutex<virtual_mic::VirtualMicController>,
    /// Selected input device name (None = system default)
    pub input_device_name: Mutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_recording: Mutex::new(false),
            recording_mode: Mutex::new(RecordingMode::PushToTalk),
            current_model: Mutex::new(None),
            model_manager: Arc::new(ModelManager::new()),
            audio_buffer: Mutex::new(None),
            audio_capture_handle: Mutex::new(None),
            whisper_engine: Mutex::new(None),
            accelerator_backend: Mutex::new(AcceleratorBackend::Cpu),
            gpu_vendor: Mutex::new(GpuVendor::Cpu),
            vocabulary: Mutex::new(Vec::new()),
            transcription_mode: Mutex::new(TranscriptionMode::default()),
            server_url: Mutex::new("https://stt.example.com".to_string()),
            server_fallback: Mutex::new(true),
            server_timeout: Mutex::new(30000),
            pause_media_on_record: Mutex::new(false),
            did_pause_media: Mutex::new(false),
            preserve_clipboard: Mutex::new(false),
            virtual_mic: Mutex::new(virtual_mic::VirtualMicController::new()),
            input_device_name: Mutex::new(None),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingMode {
    PushToTalk,
    Toggle,
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
fn get_available_models() -> Vec<models::ModelInfo> {
    models::get_available_models()
}

#[tauri::command]
async fn download_model(
    model_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state
        .model_manager
        .download_model(&model_id, app)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_downloaded_models(state: tauri::State<'_, AppState>) -> Vec<String> {
    state.model_manager.get_downloaded_models()
}

#[tauri::command]
async fn load_model(model_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let model_path = state
        .model_manager
        .get_model_path(&model_id)
        .ok_or_else(|| format!("Model {} not found", model_id))?;

    // Unload previous model first to free memory
    {
        let mut engine_lock = state.whisper_engine.lock();
        if engine_lock.is_some() {
            *engine_lock = None;
            // Force drop by releasing the lock
        }
    }

    // Get the selected accelerator backend
    let backend = *state.accelerator_backend.lock();

    let engine = WhisperEngine::new_with_backend(&model_path, backend).map_err(|e| e.to_string())?;

    *state.whisper_engine.lock() = Some(engine);
    *state.current_model.lock() = Some(model_id.clone());

    // Save last model to settings
    let mut app_settings = settings::load_settings();
    app_settings.last_model = Some(model_id);
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }

    Ok(())
}

#[tauri::command]
fn unload_model(state: tauri::State<'_, AppState>) -> Result<(), String> {
    *state.whisper_engine.lock() = None;
    *state.current_model.lock() = None;
    Ok(())
}

#[tauri::command]
fn delete_model(
    model_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Check if the model is currently loaded
    let current = state.current_model.lock().clone();
    if current.as_deref() == Some(&model_id) {
        return Err(format!(
            "Impossible de supprimer '{}' car il est actuellement charge",
            model_id
        ));
    }

    // Delete the file
    state.model_manager.delete_model(&model_id).map_err(|e| e.to_string())?;

    // Emit the event
    let _ = app.emit("model-deleted", serde_json::json!({ "model_id": model_id }));

    Ok(())
}

#[tauri::command]
fn get_saved_settings() -> settings::AppSettings {
    settings::load_settings()
}

#[tauri::command]
fn get_transcription_history() -> Vec<settings::TranscriptionEntry> {
    settings::load_history()
}

#[tauri::command]
fn save_transcription_history(history: Vec<settings::TranscriptionEntry>) -> Result<(), String> {
    settings::save_history(&history)
}

#[tauri::command]
fn get_available_accelerators() -> Vec<AcceleratorInfo> {
    transcription::detect_available_accelerators()
}

#[tauri::command]
fn get_available_gpus() -> Vec<GpuInfo> {
    transcription::detect_available_gpus()
}

#[tauri::command]
fn get_best_accelerator() -> AcceleratorBackend {
    transcription::get_best_accelerator()
}

#[tauri::command]
fn get_current_accelerator(state: tauri::State<'_, AppState>) -> AcceleratorBackend {
    *state.accelerator_backend.lock()
}

#[tauri::command]
fn get_current_gpu_vendor(state: tauri::State<'_, AppState>) -> GpuVendor {
    *state.gpu_vendor.lock()
}

#[tauri::command]
fn set_gpu_vendor(vendor: GpuVendor, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let backend = AcceleratorBackend::from_vendor(vendor);
    *state.gpu_vendor.lock() = vendor;
    *state.accelerator_backend.lock() = backend;

    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.gpu_vendor = vendor;
    app_settings.accelerator_backend = backend;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }

    // Reload model with new backend if one is loaded
    let current_model = state.current_model.lock().clone();
    if let Some(model_id) = current_model {
        if let Some(model_path) = state.model_manager.get_model_path(&model_id) {
            // Unload current model
            *state.whisper_engine.lock() = None;

            // Reload with new backend
            let engine = WhisperEngine::new_with_backend(&model_path, backend)
                .map_err(|e| e.to_string())?;
            *state.whisper_engine.lock() = Some(engine);
        }
    }

    Ok(())
}

#[tauri::command]
fn set_accelerator_backend(backend: AcceleratorBackend, state: tauri::State<'_, AppState>) -> Result<(), String> {
    *state.accelerator_backend.lock() = backend;

    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.accelerator_backend = backend;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }

    // Reload model with new backend if one is loaded
    let current_model = state.current_model.lock().clone();
    if let Some(model_id) = current_model {
        if let Some(model_path) = state.model_manager.get_model_path(&model_id) {
            // Unload current model
            *state.whisper_engine.lock() = None;

            // Reload with new backend
            let engine = WhisperEngine::new_with_backend(&model_path, backend)
                .map_err(|e| e.to_string())?;
            *state.whisper_engine.lock() = Some(engine);
        }
    }

    Ok(())
}

#[tauri::command]
fn get_current_model(state: tauri::State<'_, AppState>) -> Option<String> {
    state.current_model.lock().clone()
}

#[tauri::command]
fn set_recording_mode(mode: RecordingMode, state: tauri::State<'_, AppState>) {
    *state.recording_mode.lock() = mode;
    // Save to hotkeys config
    let mut config = hotkeys::load_config().unwrap_or_default();
    config.mode = mode;
    let _ = hotkeys::save_config(&config);
}

#[tauri::command]
fn get_recording_mode(state: tauri::State<'_, AppState>) -> RecordingMode {
    *state.recording_mode.lock()
}

#[tauri::command]
fn is_recording(state: tauri::State<'_, AppState>) -> bool {
    *state.is_recording.lock()
}

#[tauri::command]
async fn start_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    if *state.is_recording.lock() {
        return Ok(());
    }

    let device_name = state.input_device_name.lock().clone();
    let (buffer, handle) = audio::start_capture_device(device_name.as_deref()).map_err(|e| e.to_string())?;

    *state.audio_buffer.lock() = Some(buffer);
    *state.audio_capture_handle.lock() = Some(handle);
    *state.is_recording.lock() = true;

    // Show overlay (pre-created at startup, just show it)
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        let _ = overlay.set_always_on_top(true);
    }

    let _ = app.emit("recording-started", ());

    Ok(())
}

#[tauri::command]
async fn stop_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    if !*state.is_recording.lock() {
        return Err("Not recording".to_string());
    }

    let audio_data = {
        let buffer_lock = state.audio_buffer.lock();
        if let Some(ref buffer) = *buffer_lock {
            buffer.take()
        } else {
            return Err("No audio buffer found".to_string());
        }
    };

    // Stop audio capture - dropping the handle signals the stream thread to exit
    *state.audio_capture_handle.lock() = None;
    *state.is_recording.lock() = false;

    // Hide overlay
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    let _ = app.emit("recording-stopped", ());

    // Transcribe the audio
    let transcription = {
        let engine_lock = state.whisper_engine.lock();
        if let Some(ref engine) = *engine_lock {
            engine.transcribe(&audio_data).map_err(|e| e.to_string())?
        } else {
            return Err("No model loaded".to_string());
        }
    };

    // Copy to clipboard and simulate paste
    #[cfg(windows)]
    {
        let _ = clipboard::copy_and_paste(&transcription);
    }

    let _ = app.emit("transcription-complete", &transcription);

    Ok(transcription)
}

#[tauri::command]
fn get_hotkey_config() -> hotkeys::HotkeyConfig {
    hotkeys::load_config().unwrap_or_default()
}

#[tauri::command]
fn save_hotkey_config(config: hotkeys::HotkeyConfig) -> Result<(), String> {
    hotkeys::save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    hotkeys::update_shortcut(&app, &shortcut).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_cancel_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    hotkeys::update_cancel_shortcut(&app, &shortcut).map_err(|e| e.to_string())
}

#[tauri::command]
fn disable_shortcuts(app: tauri::AppHandle) {
    hotkeys::disable_shortcuts(&app)
}

#[tauri::command]
fn enable_shortcuts(app: tauri::AppHandle) {
    hotkeys::enable_shortcuts(&app)
}

#[tauri::command]
fn cancel_recording(app: tauri::AppHandle) {
    hotkeys::cancel_recording(&app)
}

#[tauri::command]
fn save_overlay_position(x: f64, y: f64) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.overlay_position = Some(settings::OverlayPosition { x, y });
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_overlay_position() -> Option<settings::OverlayPosition> {
    settings::load_settings().overlay_position
}

#[tauri::command]
fn get_overlay_size() -> settings::OverlaySize {
    settings::load_settings().overlay_size
}

#[tauri::command]
fn set_overlay_size(app: tauri::AppHandle, size: settings::OverlaySize) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.overlay_size = size;
    settings::save_settings(&app_settings)?;

    // Resize existing overlay if it exists
    if let Some(overlay) = app.get_webview_window("overlay") {
        let (width, height) = size.dimensions();
        let _ = overlay.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
        // Re-apply always on top after resize
        let _ = overlay.set_always_on_top(true);
    }

    Ok(())
}

#[tauri::command]
fn get_overlay_theme() -> settings::OverlayTheme {
    settings::load_settings().overlay_theme
}

#[tauri::command]
fn set_overlay_theme(app: tauri::AppHandle, theme: settings::OverlayTheme) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.overlay_theme = theme;
    settings::save_settings(&app_settings)?;
    let _ = app.emit("overlay-theme-changed", theme);
    Ok(())
}

#[tauri::command]
fn get_vocabulary(state: tauri::State<'_, AppState>) -> Vec<String> {
    state.vocabulary.lock().clone()
}

#[tauri::command]
fn set_vocabulary(words: Vec<String>, state: tauri::State<'_, AppState>) {
    *state.vocabulary.lock() = words.clone();
    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.vocabulary = words;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn add_vocabulary_word(word: String, state: tauri::State<'_, AppState>) {
    let mut vocab = state.vocabulary.lock();
    if !vocab.contains(&word) {
        vocab.push(word);
        // Save to settings
        let mut app_settings = settings::load_settings();
        app_settings.vocabulary = vocab.clone();
        if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
    }
}

#[tauri::command]
fn remove_vocabulary_word(word: String, state: tauri::State<'_, AppState>) {
    let mut vocab = state.vocabulary.lock();
    vocab.retain(|w| w != &word);
    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.vocabulary = vocab.clone();
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
async fn show_overlay(app: tauri::AppHandle) -> Result<(), String> {
    // Check if overlay already exists
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.show().map_err(|e| e.to_string())?;
        let _ = overlay.set_always_on_top(true);
        return Ok(());
    }

    // Create new overlay window
    WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("/overlay".into()))
        .title("")
        .inner_size(200.0, 80.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================================================
// Server Transcription Commands
// ============================================================================

#[tauri::command]
fn get_transcription_mode(state: tauri::State<'_, AppState>) -> TranscriptionMode {
    *state.transcription_mode.lock()
}

#[tauri::command]
fn set_transcription_mode(mode: TranscriptionMode, state: tauri::State<'_, AppState>) {
    *state.transcription_mode.lock() = mode;
    let mut app_settings = settings::load_settings();
    app_settings.transcription_mode = mode;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_server_url(state: tauri::State<'_, AppState>) -> String {
    state.server_url.lock().clone()
}

#[tauri::command]
fn set_server_url(url: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if url.is_empty() {
        return Err("Server URL cannot be empty".to_string());
    }
    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("Invalid URL scheme '{}': only http and https are allowed", scheme)),
    }
    *state.server_url.lock() = url.clone();
    let mut app_settings = settings::load_settings();
    app_settings.server_url = url;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
    Ok(())
}

#[tauri::command]
fn get_server_fallback(state: tauri::State<'_, AppState>) -> bool {
    *state.server_fallback.lock()
}

#[tauri::command]
fn set_server_fallback(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.server_fallback.lock() = enabled;
    let mut app_settings = settings::load_settings();
    app_settings.server_fallback = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_server_timeout(state: tauri::State<'_, AppState>) -> u64 {
    *state.server_timeout.lock()
}

#[tauri::command]
fn set_server_timeout(timeout: u64, state: tauri::State<'_, AppState>) {
    *state.server_timeout.lock() = timeout;
    let mut app_settings = settings::load_settings();
    app_settings.server_timeout = timeout;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
async fn check_server_health(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let url = state.server_url.lock().clone();
    let timeout = *state.server_timeout.lock();
    server_transcription::check_server_health(&url, timeout)
        .await
        .map_err(|e| e.to_string())
}


// ============================================================================
// Setup Wizard Commands
// ============================================================================

#[tauri::command]
fn is_setup_completed() -> bool {
    settings::load_settings().setup_completed
}

#[tauri::command]
fn complete_setup() -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.setup_completed = true;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_pause_media_on_record(state: tauri::State<'_, AppState>) -> bool {
    *state.pause_media_on_record.lock()
}

#[tauri::command]
fn set_pause_media_on_record(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.pause_media_on_record.lock() = enabled;
    let mut app_settings = settings::load_settings();
    app_settings.pause_media_on_record = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_preserve_clipboard(state: tauri::State<'_, AppState>) -> bool {
    *state.preserve_clipboard.lock()
}

#[tauri::command]
fn set_preserve_clipboard(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.preserve_clipboard.lock() = enabled;
    let mut app_settings = settings::load_settings();
    app_settings.preserve_clipboard = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_autostart_enabled() -> bool {
    settings::load_settings().autostart_enabled
}

#[tauri::command]
async fn set_autostart_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
    }

    let mut app_settings = settings::load_settings();
    app_settings.autostart_enabled = enabled;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_start_minimized() -> bool {
    settings::load_settings().start_minimized
}

#[tauri::command]
fn set_start_minimized(enabled: bool) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.start_minimized = enabled;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_sound_feedback() -> bool {
    settings::load_settings().sound_feedback
}

#[tauri::command]
fn set_sound_feedback(enabled: bool) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.sound_feedback = enabled;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_start_sound() -> String {
    settings::load_settings().start_sound
}

#[tauri::command]
fn set_start_sound(preset: String) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.start_sound = preset;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_stop_sound() -> String {
    settings::load_settings().stop_sound
}

#[tauri::command]
fn set_stop_sound(preset: String) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.stop_sound = preset;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_server_token() -> String {
    settings::load_settings().server_token
}

#[tauri::command]
fn set_server_token(token: String) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.server_token = token;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn get_companion_shortcuts() -> Vec<settings::CompanionShortcut> {
    settings::load_settings().companion_shortcuts
}

#[tauri::command]
fn set_companion_shortcuts(shortcuts: Vec<settings::CompanionShortcut>) -> Result<(), String> {
    let mut app_settings = settings::load_settings();
    app_settings.companion_shortcuts = shortcuts;
    settings::save_settings(&app_settings)
}

#[tauri::command]
fn simulate_keystroke_cmd(keys: String) -> Result<(), String> {
    keystroke::simulate_keystroke(&keys)
}

// ============================================================================
// Virtual Mic Commands
// ============================================================================

#[tauri::command]
fn get_vbcable_status() -> virtual_mic::VBCableStatus {
    virtual_mic::detect_vbcable()
}

#[tauri::command]
fn get_meeting_mode(state: tauri::State<'_, AppState>) -> bool {
    state.virtual_mic.lock().is_active()
}

#[tauri::command]
fn set_meeting_mode(
    enabled: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut vm = state.virtual_mic.lock();

    if enabled {
        vm.enable().map_err(|e| e.to_string())?;
    } else {
        vm.disable();
    }

    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.meeting_mode_enabled = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }

    // Emit event to frontend
    let _ = app.emit("meeting-mode-changed", enabled);

    Ok(())
}

// ============================================================================
// Input Device Commands
// ============================================================================

#[tauri::command]
fn list_input_devices() -> Vec<String> {
    audio::list_input_devices()
}

#[tauri::command]
fn get_input_device(state: tauri::State<'_, AppState>) -> Option<String> {
    state.input_device_name.lock().clone()
}

#[tauri::command]
fn set_input_device(device_name: Option<String>, state: tauri::State<'_, AppState>) {
    *state.input_device_name.lock() = device_name.clone();
    let mut app_settings = settings::load_settings();
    app_settings.input_device_name = device_name;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

// ============================================================================
// App Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_available_models,
            download_model,
            get_downloaded_models,
            delete_model,
            load_model,
            unload_model,
            get_current_model,
            set_recording_mode,
            get_recording_mode,
            is_recording,
            start_recording,
            stop_recording,
            get_hotkey_config,
            save_hotkey_config,
            update_shortcut,
            update_cancel_shortcut,
            disable_shortcuts,
            enable_shortcuts,
            cancel_recording,
            show_overlay,
            hide_overlay,
            get_saved_settings,
            get_transcription_history,
            save_transcription_history,
            get_available_accelerators,
            get_available_gpus,
            get_best_accelerator,
            get_current_accelerator,
            get_current_gpu_vendor,
            set_gpu_vendor,
            set_accelerator_backend,
            save_overlay_position,
            get_overlay_position,
            get_overlay_size,
            set_overlay_size,
            get_overlay_theme,
            set_overlay_theme,
            get_vocabulary,
            set_vocabulary,
            add_vocabulary_word,
            remove_vocabulary_word,
            get_transcription_mode,
            set_transcription_mode,
            get_server_url,
            set_server_url,
            get_server_fallback,
            set_server_fallback,
            get_server_timeout,
            set_server_timeout,
            check_server_health,
            is_setup_completed,
            complete_setup,
            get_autostart_enabled,
            set_autostart_enabled,
            get_start_minimized,
            set_start_minimized,
            get_pause_media_on_record,
            set_pause_media_on_record,
            get_preserve_clipboard,
            set_preserve_clipboard,
            get_sound_feedback,
            set_sound_feedback,
            get_start_sound,
            set_start_sound,
            get_stop_sound,
            set_stop_sound,
            get_server_token,
            set_server_token,
            get_companion_shortcuts,
            set_companion_shortcuts,
            simulate_keystroke_cmd,
            get_vbcable_status,
            get_meeting_mode,
            set_meeting_mode,
            list_input_devices,
            get_input_device,
            set_input_device,
        ])
        .setup(|app| {
            // Load .env file in dev mode only
            #[cfg(debug_assertions)]
            let _ = dotenvy::dotenv();

            // Load saved settings into state
            let hotkey_config = hotkeys::load_config().unwrap_or_default();
            let app_settings = settings::load_settings();

            {
                let state = app.state::<AppState>();
                *state.recording_mode.lock() = hotkey_config.mode;
                *state.accelerator_backend.lock() = app_settings.accelerator_backend;
                *state.gpu_vendor.lock() = app_settings.gpu_vendor;
                *state.vocabulary.lock() = app_settings.vocabulary.clone();
                *state.transcription_mode.lock() = app_settings.transcription_mode;
                *state.server_url.lock() = app_settings.server_url.clone();
                *state.server_fallback.lock() = app_settings.server_fallback;
                *state.server_timeout.lock() = app_settings.server_timeout;
                *state.pause_media_on_record.lock() = app_settings.pause_media_on_record;
                *state.preserve_clipboard.lock() = app_settings.preserve_clipboard;
                *state.input_device_name.lock() = app_settings.input_device_name.clone();

                // Auto-start meeting mode if previously enabled
                if app_settings.meeting_mode_enabled {
                    let mut vm = state.virtual_mic.lock();
                    if let Err(e) = vm.enable() {
                        eprintln!("Failed to start meeting mode: {}", e);
                    }
                }
            }

            // Setup global shortcuts
            if let Err(e) = hotkeys::setup_shortcuts(app) {
                eprintln!("Failed to setup shortcuts: {}", e);
            }

            // Check if app should start minimized (via command line arg or setting)
            let args: Vec<String> = std::env::args().collect();
            let should_minimize = args.contains(&"--minimized".to_string()) || app_settings.start_minimized;

            if should_minimize {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // Setup tray menu
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&quit_item)
                .build()?;

            // Setup tray icon
            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("window icon missing from bundle").clone())
                .tooltip("T4lk")
                .menu(&menu)
                .on_menu_event(move |_app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Handle window close -> minimize to tray
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            // Pre-initialize overlay and warm up the webview.
            // Create visible so WebView2 eagerly loads HTML/JS/React.
            // The overlay is transparent + React renders null when idle,
            // so nothing is visible on screen. Hide after a short delay
            // to let the rendering pipeline fully initialize.
            let (width, height) = app_settings.overlay_size.dimensions();
            let mut overlay_builder = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("/overlay".into()))
                .title("")
                .inner_size(width, height)
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .focused(false);

            if let Some(pos) = app_settings.overlay_position {
                overlay_builder = overlay_builder.position(pos.x, pos.y);
            } else {
                overlay_builder = overlay_builder.center();
            }

            if let Ok(overlay_window) = overlay_builder.build() {
                let w = overlay_window.clone();
                std::thread::spawn(move || {
                    // Give WebView2 time to load and render React
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = w.hide();
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
