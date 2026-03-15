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

/// Result of token verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenVerifyResult {
    /// Whether the server is reachable
    pub server_online: bool,
    /// Whether the token is valid (None if no token provided or server unreachable)
    pub token_valid: Option<bool>,
    /// Error message if any
    pub error: Option<String>,
}

/// Verify server connectivity and optionally token validity
///
/// # Arguments
/// * `base_url` - Base URL of the server (e.g., "http://localhost:8000")
/// * `timeout_ms` - Timeout in milliseconds
/// * `token` - Optional Bearer token to verify
pub async fn verify_server_token(
    base_url: &str,
    timeout_ms: u64,
    token: Option<&str>,
) -> TokenVerifyResult {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return TokenVerifyResult {
                server_online: false,
                token_valid: None,
                error: Some(e.to_string()),
            }
        }
    };

    // First check if server is online
    let health_url = format!("{}/health", base_url.trim_end_matches('/'));
    let server_online = match client.get(&health_url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    };

    if !server_online {
        return TokenVerifyResult {
            server_online: false,
            token_valid: None,
            error: Some("Server unreachable".to_string()),
        };
    }

    // If no token provided, just return server status
    let token = match token {
        Some(t) if !t.is_empty() => t,
        _ => {
            return TokenVerifyResult {
                server_online: true,
                token_valid: None,
                error: None,
            }
        }
    };

    // Verify token with /auth/verify endpoint
    let verify_url = format!("{}/auth/verify", base_url.trim_end_matches('/'));
    match client
        .get(&verify_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                TokenVerifyResult {
                    server_online: true,
                    token_valid: Some(true),
                    error: None,
                }
            } else if status.as_u16() == 401 || status.as_u16() == 403 {
                TokenVerifyResult {
                    server_online: true,
                    token_valid: Some(false),
                    error: Some("Invalid or expired token".to_string()),
                }
            } else {
                TokenVerifyResult {
                    server_online: true,
                    token_valid: None,
                    error: Some(format!("Unexpected status: {}", status)),
                }
            }
        }
        Err(e) => TokenVerifyResult {
            server_online: true,
            token_valid: None,
            error: Some(e.to_string()),
        },
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
/// * `initial_prompt` - Optional initial prompt for Whisper (glossary format)
/// * `vocabulary` - Optional raw vocabulary words (comma-separated) for LLM correction
/// * `token` - Optional Bearer token for authentication
/// * `format_backend` - Optional formatting backend ("goblin" or "llm")
/// * `format_style_prompt` - Optional style prompt for server-side formatting
/// * `format_intensity` - Optional formatting intensity (1-5)
/// * `on_segment` - Callback for each transcription segment
/// * `on_step` - Callback for processing step changes (e.g. "transcribing", "formatting", "correcting")
///
/// # Returns
/// Full transcription text (formatted if requested and available)
pub async fn transcribe_stream<F, S>(
    base_url: &str,
    wav_data: &[u8],
    timeout_ms: u64,
    initial_prompt: Option<&str>,
    vocabulary: Option<&str>,
    token: Option<&str>,
    format_backend: Option<&str>,
    format_style_prompt: Option<&str>,
    format_intensity: Option<u8>,
    mut on_segment: F,
    mut on_step: S,
) -> Result<String, ServerError>
where
    F: FnMut(TranscriptionSegment),
    S: FnMut(String),
{
    let url = format!("{}/transcribe/stream", base_url.trim_end_matches('/'));

    eprintln!("[SSE] Connecting to {}", url);
    if let Some(prompt) = initial_prompt {
        eprintln!("[SSE] Initial prompt: {}", prompt);
    }
    if let Some(vocab) = vocabulary {
        eprintln!("[SSE] Vocabulary for LLM correction: {}", vocab);
    }

    // Create multipart form with the WAV file
    let part = reqwest::multipart::Part::bytes(wav_data.to_vec())
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| ServerError::ConnectionFailed(e.to_string()))?;

    let mut form = reqwest::multipart::Form::new().part("file", part);

    // Add initial_prompt for Whisper if provided
    if let Some(prompt) = initial_prompt {
        form = form.text("initial_prompt", prompt.to_string());
    }

    // Add vocabulary for LLM correction if provided
    if let Some(vocab) = vocabulary {
        form = form.text("vocabulary", vocab.to_string());
    }

    // Add format parameters if provided
    if let Some(backend) = format_backend {
        form = form.text("format_backend", backend.to_string());
    }
    if let Some(prompt) = format_style_prompt {
        form = form.text("format_style_prompt", prompt.to_string());
    }
    if let Some(intensity) = format_intensity {
        form = form.text("format_intensity", intensity.to_string());
    }

    // Create client - no global timeout for streaming (we handle it per-chunk)
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| ServerError::ConnectionFailed(e.to_string()))?;

    // Send request
    let mut request = client
        .post(&url)
        .multipart(form)
        .header("Accept", "text/event-stream");

    // Add authorization header if token is provided
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }

    let response = request
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

    // JSON structure for server response
    #[derive(Deserialize)]
    struct SseData {
        #[serde(default)]
        text: Option<String>,
        #[serde(default)]
        done: bool,
        #[serde(default)]
        process_time: f64,
        #[serde(default)]
        step: Option<String>,
        #[serde(default)]
        corrected: Option<bool>,
        #[serde(default)]
        formatted: Option<bool>,
    }

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| ServerError::StreamError(e.to_string()))?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        // Process complete lines from buffer
        // Server format: "data: {json}\n" for each segment
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            // Skip empty lines
            if line.is_empty() {
                continue;
            }

            // Parse "data: {json}" format
            if let Some(json_str) = line.strip_prefix("data:") {
                let json_str = json_str.trim();

                match serde_json::from_str::<SseData>(json_str) {
                    Ok(data) => {
                        // Handle step events
                        if let Some(step) = data.step {
                            eprintln!("[SSE] Step: {}", step);
                            on_step(step);
                            continue;
                        }

                        if data.done {
                            eprintln!("[SSE] Done, process_time: {}s, corrected: {:?}, formatted: {:?}", data.process_time, data.corrected, data.formatted);
                            // If done event has text, use it as the final result
                            // (it may be formatted text from the server LLM)
                            if let Some(final_text) = data.text {
                                return Ok(final_text);
                            }
                            return Ok(full_text.trim().to_string());
                        }

                        if let Some(text) = data.text {
                            if !text.is_empty() {
                                eprintln!("[SSE] Segment: {}", text);
                                full_text.push_str(&text);
                                let segment = TranscriptionSegment {
                                    text,
                                    start: 0.0,
                                    end: 0.0,
                                };
                                on_segment(segment);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[SSE] Failed to parse JSON '{}': {}", json_str, e);
                    }
                }
            }
        }
    }

    eprintln!("[SSE] Stream ended, total text: {}", full_text);
    Ok(full_text.trim().to_string())
}
