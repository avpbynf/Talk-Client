mod audio;
mod audio_encoder;
mod claude_api;
mod clipboard;
mod context_detection;
mod hotkeys;
mod models;
mod screenshot;
mod server_transcription;
mod settings;
mod transcription;

use audio::{AudioBuffer, AudioCaptureHandle};
use parking_lot::Mutex;
use screenshot::ScreenshotMode;
use settings::TranscriptionMode;
use std::path::PathBuf;
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
    pub use_llm_enhancement: Mutex<bool>,
    pub claude_model: Mutex<String>,
    pub accelerator_backend: Mutex<AcceleratorBackend>,
    pub gpu_vendor: Mutex<GpuVendor>,
    pub use_screenshot_for_correction: Mutex<bool>,
    pub paste_screenshot_path: Mutex<bool>,
    pub screenshot_mode: Mutex<ScreenshotMode>,
    pub screenshot_paths: Mutex<Vec<PathBuf>>,
    pub screenshot_capture_in_progress: Mutex<bool>,
    /// Custom vocabulary words to help Whisper recognize specific terms
    pub vocabulary: Mutex<Vec<String>>,
    /// Last detected context from a real transcription (for debug display)
    pub last_detected_context: Mutex<Option<context_detection::DetectedContext>>,
    /// Transcription mode: local or server
    pub transcription_mode: Mutex<TranscriptionMode>,
    /// Server URL for remote transcription
    pub server_url: Mutex<String>,
    /// Enable fallback to local Whisper if server unavailable
    pub server_fallback: Mutex<bool>,
    /// Server request timeout in milliseconds
    pub server_timeout: Mutex<u64>,
    /// Server API token for authentication
    pub server_token: Mutex<Option<String>>,
    /// Pause media playback during recording
    pub pause_media_on_record: Mutex<bool>,
    /// Track if we paused media (to resume on stop)
    pub did_pause_media: Mutex<bool>,
    /// Preserve clipboard content after pasting transcription
    pub preserve_clipboard: Mutex<bool>,
    /// Enable server-side LLM formatting after transcription
    pub server_formatting_enabled: Mutex<bool>,
    /// Formatting backend: "goblin" or "llm"
    pub server_format_backend: Mutex<String>,
    /// Style prompt for server formatting
    pub server_format_style_prompt: Mutex<String>,
    /// Formatting intensity (1-5)
    pub server_format_intensity: Mutex<u8>,
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
            use_llm_enhancement: Mutex::new(false),
            claude_model: Mutex::new("haiku".to_string()),
            accelerator_backend: Mutex::new(AcceleratorBackend::Cpu),
            gpu_vendor: Mutex::new(GpuVendor::Cpu),
            use_screenshot_for_correction: Mutex::new(false),
            paste_screenshot_path: Mutex::new(false),
            screenshot_mode: Mutex::new(ScreenshotMode::default()),
            screenshot_paths: Mutex::new(Vec::new()),
            screenshot_capture_in_progress: Mutex::new(false),
            vocabulary: Mutex::new(Vec::new()),
            last_detected_context: Mutex::new(None),
            transcription_mode: Mutex::new(TranscriptionMode::default()),
            server_url: Mutex::new("http://localhost:8000".to_string()),
            server_fallback: Mutex::new(true),
            server_timeout: Mutex::new(30000),
            server_token: Mutex::new(None),
            pause_media_on_record: Mutex::new(false),
            did_pause_media: Mutex::new(false),
            preserve_clipboard: Mutex::new(false),
            server_formatting_enabled: Mutex::new(false),
            server_format_backend: Mutex::new("goblin".to_string()),
            server_format_style_prompt: Mutex::new("grammatical".to_string()),
            server_format_intensity: Mutex::new(3),
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
fn get_llm_enhancement(state: tauri::State<'_, AppState>) -> bool {
    *state.use_llm_enhancement.lock()
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
fn set_llm_enhancement(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.use_llm_enhancement.lock() = enabled;
    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.use_llm_enhancement = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_claude_model(state: tauri::State<'_, AppState>) -> String {
    state.claude_model.lock().clone()
}

#[tauri::command]
fn set_claude_model(model: String, state: tauri::State<'_, AppState>) {
    *state.claude_model.lock() = model.clone();
    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.claude_model = model;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
async fn check_claude_available() -> bool {
    // Check if claude CLI is available
    std::process::Command::new("claude")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
fn check_api_key_available() -> bool {
    claude_api::get_api_key().is_some()
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

fn enhance_with_claude(text: &str, model: &str) -> Result<String, String> {
    let prompt = format!(
        r#"Corrige et améliore cette transcription vocale. Garde le sens original, corrige les erreurs de reconnaissance vocale, ajoute la ponctuation appropriée. Réponds UNIQUEMENT avec le texte corrigé, sans explication ni commentaire:

{}"#,
        text
    );

    let output = std::process::Command::new("claude")
        .args(["-p", &prompt, "--model", model])
        .output()
        .map_err(|e| format!("Failed to run claude: {}", e))?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(result)
    } else {
        // If claude fails, return original text
        Ok(text.to_string())
    }
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

    let (buffer, handle) = audio::start_capture().map_err(|e| e.to_string())?;

    *state.audio_buffer.lock() = Some(buffer);
    *state.audio_capture_handle.lock() = Some(handle);
    *state.is_recording.lock() = true;

    // Show overlay
    if app.get_webview_window("overlay").is_none() {
        let app_settings = settings::load_settings();
        let (width, height) = app_settings.overlay_size.dimensions();

        let mut builder = WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("/overlay".into()))
            .title("")
            .inner_size(width, height)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false);

        // Use saved position or center
        if let Some(pos) = app_settings.overlay_position {
            builder = builder.position(pos.x, pos.y);
        } else {
            builder = builder.center();
        }

        let _ = builder.build();
    } else if let Some(overlay) = app.get_webview_window("overlay") {
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
    let mut transcription = {
        let engine_lock = state.whisper_engine.lock();
        if let Some(ref engine) = *engine_lock {
            engine.transcribe(&audio_data).map_err(|e| e.to_string())?
        } else {
            return Err("No model loaded".to_string());
        }
    };

    // Optionally enhance with Claude
    let use_llm = *state.use_llm_enhancement.lock();
    if use_llm && !transcription.is_empty() {
        let claude_model = state.claude_model.lock().clone();
        if let Ok(enhanced) = enhance_with_claude(&transcription, &claude_model) {
            transcription = enhanced;
        }
    }

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
fn get_screenshot_for_correction(state: tauri::State<'_, AppState>) -> bool {
    *state.use_screenshot_for_correction.lock()
}

#[tauri::command]
fn set_screenshot_for_correction(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.use_screenshot_for_correction.lock() = enabled;
    let mut app_settings = settings::load_settings();
    app_settings.use_screenshot_for_correction = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_paste_screenshot_path(state: tauri::State<'_, AppState>) -> bool {
    *state.paste_screenshot_path.lock()
}

#[tauri::command]
fn set_paste_screenshot_path(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.paste_screenshot_path.lock() = enabled;
    let mut app_settings = settings::load_settings();
    app_settings.paste_screenshot_path = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_screenshot_mode(state: tauri::State<'_, AppState>) -> ScreenshotMode {
    *state.screenshot_mode.lock()
}

#[tauri::command]
fn set_screenshot_mode(mode: ScreenshotMode, state: tauri::State<'_, AppState>) {
    *state.screenshot_mode.lock() = mode;
    // Save to settings
    let mut app_settings = settings::load_settings();
    app_settings.screenshot_mode = mode;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
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

/// Response for detected context (for UI display)
#[derive(serde::Serialize)]
struct DetectedContextResponse {
    /// Whether this is from a real transcription (true) or just showing available languages (false)
    has_real_context: bool,
    language: Option<String>,
    symbols: Vec<String>,
    workspace: Option<String>,
    frameworks: Vec<String>,
    window_title: Option<String>,
    domain: Option<String>,
    vocabulary_prompt: Option<String>,
    available_languages: Vec<String>,
}

#[tauri::command]
fn get_detected_context(state: tauri::State<'_, AppState>) -> DetectedContextResponse {
    // Detect current context in real-time (reads VS Code context file if available)
    let detected = context_detection::detect();
    let has_real_context = detected.language.is_some() || !detected.symbols.is_empty();

    let user_vocabulary = state.vocabulary.lock().clone();
    let vocabulary_prompt = context_detection::build_prompt(&detected, &user_vocabulary);
    let available_languages = context_detection::get_available_languages();

    DetectedContextResponse {
        has_real_context,
        language: detected.language,
        symbols: detected.symbols,
        workspace: detected.workspace,
        frameworks: detected.frameworks,
        window_title: detected.window_title,
        domain: detected.domain,
        vocabulary_prompt,
        available_languages,
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
fn get_server_token(state: tauri::State<'_, AppState>) -> Option<String> {
    state.server_token.lock().clone()
}

#[tauri::command]
fn set_server_token(token: Option<String>, state: tauri::State<'_, AppState>) {
    *state.server_token.lock() = token.clone();
    let mut app_settings = settings::load_settings();
    app_settings.server_token = token;
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

#[tauri::command]
async fn verify_server_token(
    state: tauri::State<'_, AppState>,
) -> Result<server_transcription::TokenVerifyResult, String> {
    let url = state.server_url.lock().clone();
    let timeout = *state.server_timeout.lock();
    let token = state.server_token.lock().clone();
    Ok(server_transcription::verify_server_token(&url, timeout, token.as_deref()).await)
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
fn get_server_formatting_enabled(state: tauri::State<'_, AppState>) -> bool {
    *state.server_formatting_enabled.lock()
}

#[tauri::command]
fn set_server_formatting_enabled(enabled: bool, state: tauri::State<'_, AppState>) {
    *state.server_formatting_enabled.lock() = enabled;
    let mut app_settings = settings::load_settings();
    app_settings.server_formatting_enabled = enabled;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_server_format_backend(state: tauri::State<'_, AppState>) -> String {
    state.server_format_backend.lock().clone()
}

#[tauri::command]
fn set_server_format_backend(backend: String, state: tauri::State<'_, AppState>) {
    *state.server_format_backend.lock() = backend.clone();
    let mut app_settings = settings::load_settings();
    app_settings.server_format_backend = backend;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_server_format_style_prompt(state: tauri::State<'_, AppState>) -> String {
    state.server_format_style_prompt.lock().clone()
}

#[tauri::command]
fn set_server_format_style_prompt(prompt: String, state: tauri::State<'_, AppState>) {
    *state.server_format_style_prompt.lock() = prompt.clone();
    let mut app_settings = settings::load_settings();
    app_settings.server_format_style_prompt = prompt;
    if let Err(e) = settings::save_settings(&app_settings) {
        eprintln!("Failed to save settings: {}", e);
    }
}

#[tauri::command]
fn get_server_format_intensity(state: tauri::State<'_, AppState>) -> u8 {
    *state.server_format_intensity.lock()
}

#[tauri::command]
fn set_server_format_intensity(intensity: u8, state: tauri::State<'_, AppState>) {
    let clamped = intensity.clamp(1, 5);
    *state.server_format_intensity.lock() = clamped;
    let mut app_settings = settings::load_settings();
    app_settings.server_format_intensity = clamped;
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
            get_llm_enhancement,
            set_llm_enhancement,
            get_claude_model,
            set_claude_model,
            check_claude_available,
            check_api_key_available,
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
            get_screenshot_for_correction,
            set_screenshot_for_correction,
            get_paste_screenshot_path,
            set_paste_screenshot_path,
            get_screenshot_mode,
            set_screenshot_mode,
            get_vocabulary,
            set_vocabulary,
            add_vocabulary_word,
            remove_vocabulary_word,
            get_detected_context,
            get_transcription_mode,
            set_transcription_mode,
            get_server_url,
            set_server_url,
            get_server_fallback,
            set_server_fallback,
            get_server_timeout,
            set_server_timeout,
            get_server_token,
            set_server_token,
            check_server_health,
            verify_server_token,
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
            get_server_formatting_enabled,
            set_server_formatting_enabled,
            get_server_format_backend,
            set_server_format_backend,
            get_server_format_style_prompt,
            set_server_format_style_prompt,
            get_server_format_intensity,
            set_server_format_intensity,
        ])
        .setup(|app| {
            // Load .env file for API keys
            let _ = dotenvy::dotenv();

            // Load saved settings into state
            let hotkey_config = hotkeys::load_config().unwrap_or_default();
            let app_settings = settings::load_settings();

            {
                let state = app.state::<AppState>();
                *state.recording_mode.lock() = hotkey_config.mode;
                *state.use_llm_enhancement.lock() = app_settings.use_llm_enhancement;
                *state.claude_model.lock() = app_settings.claude_model.clone();
                *state.accelerator_backend.lock() = app_settings.accelerator_backend;
                *state.gpu_vendor.lock() = app_settings.gpu_vendor;
                *state.use_screenshot_for_correction.lock() = app_settings.use_screenshot_for_correction;
                *state.paste_screenshot_path.lock() = app_settings.paste_screenshot_path;
                *state.screenshot_mode.lock() = app_settings.screenshot_mode;
                *state.vocabulary.lock() = app_settings.vocabulary.clone();
                *state.transcription_mode.lock() = app_settings.transcription_mode;
                *state.server_url.lock() = app_settings.server_url.clone();
                *state.server_fallback.lock() = app_settings.server_fallback;
                *state.server_timeout.lock() = app_settings.server_timeout;
                *state.server_token.lock() = app_settings.server_token.clone();
                *state.pause_media_on_record.lock() = app_settings.pause_media_on_record;
                *state.preserve_clipboard.lock() = app_settings.preserve_clipboard;
                *state.server_formatting_enabled.lock() = app_settings.server_formatting_enabled;
                *state.server_format_backend.lock() = app_settings.server_format_backend.clone();
                *state.server_format_style_prompt.lock() = app_settings.server_format_style_prompt.clone();
                *state.server_format_intensity.lock() = app_settings.server_format_intensity;
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
            let show_item = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // Setup tray icon
            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Whisper Flow")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
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

            // Pre-initialize overlay (hidden) so it's ready when needed
            let (width, height) = app_settings.overlay_size.dimensions();
            let mut overlay_builder = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("/overlay".into()))
                .title("")
                .inner_size(width, height)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false); // Start hidden

            if let Some(pos) = app_settings.overlay_position {
                overlay_builder = overlay_builder.position(pos.x, pos.y);
            } else {
                overlay_builder = overlay_builder.center();
            }

            let _ = overlay_builder.build();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
