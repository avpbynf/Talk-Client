use std::path::PathBuf;
use thiserror::Error;
use xcap::Monitor;

#[derive(Error, Debug)]
pub enum ScreenshotError {
    #[error("Failed to get monitors: {0}")]
    MonitorError(String),
    #[error("Failed to capture screenshot: {0}")]
    CaptureError(String),
    #[error("Failed to save screenshot: {0}")]
    SaveError(String),
    #[error("No monitors found")]
    NoMonitors,
}

/// Mode de capture d'écran
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScreenshotMode {
    /// Capture tous les écrans
    AllScreens,
    /// Capture uniquement l'écran principal
    PrimaryOnly,
}

impl Default for ScreenshotMode {
    fn default() -> Self {
        Self::PrimaryOnly
    }
}

/// Capture les écrans selon le mode spécifié et retourne les chemins des fichiers
pub fn capture_screens(mode: ScreenshotMode) -> Result<Vec<PathBuf>, ScreenshotError> {
    let monitors = Monitor::all().map_err(|e| ScreenshotError::MonitorError(e.to_string()))?;

    if monitors.is_empty() {
        return Err(ScreenshotError::NoMonitors);
    }

    let monitors_to_capture: Vec<&Monitor> = match mode {
        ScreenshotMode::AllScreens => monitors.iter().collect(),
        ScreenshotMode::PrimaryOnly => {
            // Trouver l'écran principal (celui à position 0,0 généralement)
            monitors
                .iter()
                .find(|m| m.x() == 0 && m.y() == 0)
                .map(|m| vec![m])
                .unwrap_or_else(|| vec![monitors.first().unwrap()])
        }
    };

    let temp_dir = std::env::temp_dir().join("whisper-flow-screenshots");
    std::fs::create_dir_all(&temp_dir).map_err(|e| ScreenshotError::SaveError(e.to_string()))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let mut paths = Vec::new();

    for (i, monitor) in monitors_to_capture.iter().enumerate() {
        let image = monitor
            .capture_image()
            .map_err(|e| ScreenshotError::CaptureError(e.to_string()))?;

        let filename = format!("screenshot_{}_{}.png", timestamp, i);
        let path = temp_dir.join(&filename);

        image
            .save(&path)
            .map_err(|e| ScreenshotError::SaveError(e.to_string()))?;

        paths.push(path);
    }

    Ok(paths)
}

