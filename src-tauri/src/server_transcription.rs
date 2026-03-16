use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// A transcription segment received from the server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub text: String,
    #[serde(default)]
    pub start: f64,
    #[serde(default)]
    pub end: f64,
}

/// Server transcription error
#[derive(Debug)]
pub enum ServerError {
    ConnectionFailed(String),
    ServerUnavailable,
    Timeout,
    StreamError(String),
}

impl std::fmt::Display for ServerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            Self::ServerUnavailable => write!(f, "Server unavailable"),
            Self::Timeout => write!(f, "Request timeout"),
            Self::StreamError(msg) => write!(f, "Stream error: {}", msg),
        }
    }
}

impl std::error::Error for ServerError {}

/// Check if the transcription server is available
///
/// # Arguments
/// * `base_url` - Base URL of the server (e.g., "http://localhost:8000")
/// * `timeout_ms` - Timeout in milliseconds
pub async fn check_server_health(base_url: &str, timeout_ms: u64) -> Result<bool, ServerError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| ServerError::ConnectionFailed(e.to_string()))?;

    let url = format!("{}/health", base_url.trim_end_matches('/'));

    match client.get(&url).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(e) if e.is_timeout() => Err(ServerError::Timeout),
        Err(e) if e.is_connect() => Err(ServerError::ServerUnavailable),
        Err(e) => Err(ServerError::ConnectionFailed(e.to_string())),
    }
}

/// Transcribe audio using the server with SSE streaming
///
/// Uses reqwest directly with manual SSE parsing to support multipart uploads.
///
/// # Arguments
/// * `base_url` - Base URL of the server
/// * `wav_data` - WAV audio data
/// * `timeout_ms` - Timeout in milliseconds for the initial connection
/// * `language` - Optional language code (e.g., "fr", "en")
/// * `prompt` - Optional initial prompt for context/vocabulary
/// * `on_segment` - Callback for each transcription segment
/// * `on_step` - Callback for processing step changes
///
/// # Returns
/// Full transcription text
pub async fn transcribe_stream<F, S>(
    base_url: &str,
    wav_data: &[u8],
    timeout_ms: u64,
    language: Option<&str>,
    prompt: Option<&str>,
    mut on_segment: F,
    mut on_step: S,
) -> Result<String, ServerError>
where
    F: FnMut(TranscriptionSegment),
    S: FnMut(String),
{
    let url = format!(
        "{}/v1/audio/transcriptions/stream",
        base_url.trim_end_matches('/')
    );

    eprintln!("[SSE] Connecting to {}", url);
    if let Some(p) = prompt {
        eprintln!("[SSE] Prompt: {}", p);
    }

    // Create multipart form with the WAV file
    let part = reqwest::multipart::Part::bytes(wav_data.to_vec())
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| ServerError::ConnectionFailed(e.to_string()))?;

    let mut form = reqwest::multipart::Form::new().part("file", part);

    if let Some(lang) = language {
        form = form.text("language", lang.to_string());
    }

    if let Some(p) = prompt {
        form = form.text("prompt", p.to_string());
    }

    // Create client - no global timeout for streaming (we handle it per-chunk)
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| ServerError::ConnectionFailed(e.to_string()))?;

    let response = client
        .post(&url)
        .multipart(form)
        .header("Accept", "text/event-stream")
        .send()
        .await
        .map_err(|e| {
            eprintln!("[SSE] Request failed: {}", e);
            if e.is_timeout() {
                ServerError::Timeout
            } else if e.is_connect() {
                ServerError::ServerUnavailable
            } else {
                ServerError::ConnectionFailed(e.to_string())
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!("[SSE] Server returned {} - {}", status, body);
        return Err(ServerError::StreamError(format!(
            "Server returned status {}: {}",
            status, body
        )));
    }

    eprintln!("[SSE] Connected, receiving stream...");

    // Read the SSE stream
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_text = String::new();

    // JSON structures for server SSE events
    #[derive(Deserialize)]
    struct SegmentData {
        #[serde(default)]
        text: String,
        #[serde(default)]
        start: f64,
        #[serde(default)]
        end: f64,
        #[serde(default)]
        index: u32,
    }

    #[derive(Deserialize)]
    struct DoneData {
        #[serde(default)]
        text: String,
        #[serde(default)]
        language: Option<String>,
        #[serde(default)]
        duration: f64,
    }

    // SSE state: track which event type we are expecting
    let mut current_event: Option<String> = None;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| ServerError::StreamError(e.to_string()))?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        // Process complete lines from buffer
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                // Blank line resets the current event name per SSE spec
                current_event = None;
                continue;
            }

            // Parse "event: <name>" field
            if let Some(event_name) = line.strip_prefix("event:") {
                current_event = Some(event_name.trim().to_string());
                continue;
            }

            // Parse "data: {json}" field
            if let Some(json_str) = line.strip_prefix("data:") {
                let json_str = json_str.trim();
                let event_type = current_event.as_deref().unwrap_or("");

                match event_type {
                    "segment" => {
                        match serde_json::from_str::<SegmentData>(json_str) {
                            Ok(data) => {
                                if !data.text.is_empty() {
                                    eprintln!(
                                        "[SSE] Segment {}: {}",
                                        data.index, data.text
                                    );
                                    full_text.push_str(&data.text);
                                    on_segment(TranscriptionSegment {
                                        text: data.text,
                                        start: data.start,
                                        end: data.end,
                                    });
                                }
                            }
                            Err(e) => {
                                eprintln!(
                                    "[SSE] Failed to parse segment JSON '{}': {}",
                                    json_str, e
                                );
                            }
                        }
                    }
                    "done" => {
                        match serde_json::from_str::<DoneData>(json_str) {
                            Ok(data) => {
                                eprintln!(
                                    "[SSE] Done, duration: {}s, language: {:?}",
                                    data.duration, data.language
                                );
                                let final_text = if !data.text.is_empty() {
                                    data.text
                                } else {
                                    full_text.trim().to_string()
                                };
                                return Ok(final_text);
                            }
                            Err(e) => {
                                eprintln!(
                                    "[SSE] Failed to parse done JSON '{}': {}",
                                    json_str, e
                                );
                                return Ok(full_text.trim().to_string());
                            }
                        }
                    }
                    other => {
                        // Unknown or missing event type — ignore but log
                        if !other.is_empty() {
                            eprintln!("[SSE] Unknown event '{}', data: {}", other, json_str);
                        }
                        // Notify step change for unknown named events
                        on_step(other.to_string());
                    }
                }
            }
        }
    }

    eprintln!("[SSE] Stream ended, total text: {}", full_text);
    Ok(full_text.trim().to_string())
}
