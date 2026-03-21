use crate::transcription::{AcceleratorBackend, GpuVendor};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionShortcut {
    pub id: String,
    pub label: String,
    pub keys: String,
    pub trigger: String, // "start", "stop", "both"
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionMode {
    Local,
    Server,
}

impl Default for TranscriptionMode {
    fn default() -> Self {
        Self::Local
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverlaySize {
    Small,
    Medium,
    Large,
}

impl Default for OverlaySize {
    fn default() -> Self {
        Self::Medium
    }
}

impl OverlaySize {
    pub fn dimensions(&self) -> (f64, f64) {
        match self {
            Self::Small => (160.0, 44.0),
            Self::Medium => (220.0, 60.0),
            Self::Large => (280.0, 76.0),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverlayTheme {
    Aurora,
    Sunset,
    Ocean,
    Neon,
    Frost,
    Neutral,
}

impl Default for OverlayTheme {
    fn default() -> Self {
        Self::Aurora
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub last_model: Option<String>,
    #[serde(default = "default_accelerator")]
    pub accelerator_backend: AcceleratorBackend,
    #[serde(default)]
    pub gpu_vendor: GpuVendor,
    #[serde(default)]
    pub overlay_position: Option<OverlayPosition>,
    #[serde(default)]
    pub overlay_size: OverlaySize,
    #[serde(default)]
    pub overlay_theme: OverlayTheme,
    /// Custom vocabulary words to help Whisper recognize specific terms
    #[serde(default = "default_vocabulary")]
    pub vocabulary: Vec<String>,
    /// Transcription mode: local Whisper or remote server
    #[serde(default)]
    pub transcription_mode: TranscriptionMode,
    /// Server URL for remote transcription
    #[serde(default = "default_server_url")]
    pub server_url: String,
    /// Enable fallback to local Whisper if server unavailable
    #[serde(default = "default_true")]
    pub server_fallback: bool,
    /// Server request timeout in milliseconds
    #[serde(default = "default_server_timeout")]
    pub server_timeout: u64,
    /// Whether the setup wizard has been completed
    #[serde(default)]
    pub setup_completed: bool,
    /// Whether to launch the app at system startup
    #[serde(default)]
    pub autostart_enabled: bool,
    /// Whether to start minimized to tray
    #[serde(default)]
    pub start_minimized: bool,
    /// Pause media playback during recording
    #[serde(default)]
    pub pause_media_on_record: bool,
    /// Preserve clipboard content after pasting transcription
    #[serde(default)]
    pub preserve_clipboard: bool,
    /// Sound feedback enabled
    #[serde(default)]
    pub sound_feedback: bool,
    /// Start sound preset (none, beep, click, chime)
    #[serde(default = "default_sound_none")]
    pub start_sound: String,
    /// Stop sound preset (none, beep, click, chime)
    #[serde(default = "default_sound_none")]
    pub stop_sound: String,
    /// API token for server (OpenAI-compatible)
    #[serde(default)]
    pub server_token: String,
    /// Companion shortcuts to simulate on recording start/stop
    #[serde(default)]
    pub companion_shortcuts: Vec<CompanionShortcut>,
    /// Enable meeting mode (route audio through VB-Cable)
    #[serde(default)]
    pub meeting_mode_enabled: bool,
    /// Selected input device name (None = system default)
    #[serde(default)]
    pub input_device_name: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_sound_none() -> String {
    "none".to_string()
}

fn default_server_url() -> String {
    "https://stt.example.com".to_string()
}

fn default_server_timeout() -> u64 {
    30000 // 30 seconds
}

fn default_vocabulary() -> Vec<String> {
    vec![
        "T4lk".to_string(),
        "t4lking".to_string(),
        "t4lking-online".to_string(),
        "Claude".to_string(),
        "CLAUDE.md".to_string(),
        "Zed".to_string(),
        "Sonnet".to_string(),
        "Celery".to_string(),
        "Rising".to_string(),
    ]
}

pub fn default_accelerator() -> AcceleratorBackend {
    AcceleratorBackend::Cpu
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            last_model: None,
            accelerator_backend: default_accelerator(),
            gpu_vendor: GpuVendor::default(),
            overlay_position: None,
            overlay_size: OverlaySize::default(),
            overlay_theme: OverlayTheme::default(),
            vocabulary: default_vocabulary(),
            transcription_mode: TranscriptionMode::default(),
            server_url: default_server_url(),
            server_fallback: true,
            server_timeout: default_server_timeout(),
            setup_completed: false,
            autostart_enabled: false,
            start_minimized: false,
            pause_media_on_record: false,
            preserve_clipboard: false,
            sound_feedback: false,
            start_sound: default_sound_none(),
            stop_sound: default_sound_none(),
            server_token: String::new(),
            companion_shortcuts: Vec::new(),
            meeting_mode_enabled: false,
            input_device_name: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionEntry {
    pub id: String,
    pub text: String,
    pub timestamp: String,
    pub model: Option<String>,
    pub enhanced: bool,
}

fn get_config_dir() -> PathBuf {
    ProjectDirs::from("com", "t4lk", "t4lk")
        .map(|dirs| dirs.config_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

fn get_settings_path() -> PathBuf {
    get_config_dir().join("settings.json")
}

fn get_history_path() -> PathBuf {
    get_config_dir().join("history.json")
}

pub fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_history() -> Vec<TranscriptionEntry> {
    let path = get_history_path();
    if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    }
}

pub fn save_history(history: &[TranscriptionEntry]) -> Result<(), String> {
    let path = get_history_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(history).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
