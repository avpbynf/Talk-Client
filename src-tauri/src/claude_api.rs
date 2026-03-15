use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLI_TIMEOUT_SECS: u64 = 60;

/// Run a Command with a timeout, returning a descriptive error on timeout.
/// Spawns the process and waits in a blocking thread with a deadline.
fn run_command_with_timeout(mut cmd: Command) -> Result<std::process::Output, String> {
    let mut child = cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute claude CLI: {}", e))?;

    let deadline = std::time::Instant::now() + Duration::from_secs(CLI_TIMEOUT_SECS);

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process has exited, collect output
                return child.wait_with_output()
                    .map_err(|e| format!("Failed to read claude CLI output: {}", e));
            }
            Ok(None) => {
                // Still running - check timeout
                if std::time::Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait(); // Reap the process
                    return Err(format!("Claude CLI timed out after {} seconds", CLI_TIMEOUT_SECS));
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                return Err(format!("Failed to check claude CLI status: {}", e));
            }
        }
    }
}

/// Check if Claude Code CLI is available on the system
pub fn is_claude_cli_available() -> bool {
    Command::new("claude")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Call Claude using the Claude Code CLI (no API key needed)
/// Uses --tools "" to disable file access and keep responses focused
pub fn call_claude_cli(prompt: &str) -> Result<String, String> {
    eprintln!("Calling Claude via CLI...");

    let mut cmd = Command::new("claude");
    cmd.args([
        "-p", prompt,
        "--print",
        "--tools", "",  // Disable all tools - no file reading
        "--no-session-persistence",  // Don't use/save session context
    ]);
    let output = run_command_with_timeout(cmd)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI error: {}", stderr));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();
    eprintln!("Claude CLI response length: {} chars", response.len());

    Ok(response)
}

/// Call Claude using CLI with image files
/// Uses --add-dir to give Claude access to the screenshot directory
pub fn call_claude_cli_with_images(prompt: &str, image_paths: &[PathBuf]) -> Result<String, String> {
    eprintln!("Calling Claude via CLI with {} images...", image_paths.len());

    if image_paths.is_empty() {
        return call_claude_cli(prompt);
    }

    // Build the prompt with explicit image file references
    let mut full_prompt = String::new();
    full_prompt.push_str("IMAGES DE CONTEXTE - Lis ces fichiers image avec l'outil Read:\n\n");
    for path in image_paths {
        // Use full absolute path
        let abs_path = path.canonicalize().unwrap_or_else(|_| path.clone());
        full_prompt.push_str(&format!("- {}\n", abs_path.display()));
    }
    full_prompt.push_str("\nAnalyse ces images pour comprendre le contexte visuel.\n\n");
    full_prompt.push_str(prompt);

    // Get the directory containing the images to add with --add-dir
    let image_dirs: Vec<String> = image_paths
        .iter()
        .filter_map(|p| p.parent())
        .filter_map(|p| p.canonicalize().ok())
        .map(|p| p.to_string_lossy().to_string())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let mut args = vec![
        "-p".to_string(),
        full_prompt,
        "--print".to_string(),
        "--allowedTools".to_string(),
        "Read".to_string(),
        "--no-session-persistence".to_string(),
    ];

    // Add each image directory
    for dir in &image_dirs {
        args.push("--add-dir".to_string());
        args.push(dir.clone());
        eprintln!("Adding directory access: {}", dir);
    }

    let mut cmd = Command::new("claude");
    cmd.args(&args);
    let output = run_command_with_timeout(cmd)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI error: {}", stderr));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();
    eprintln!("Claude CLI response length: {} chars", response.len());

    Ok(response)
}

// Request types
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum RequestContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { source: ImageSource },
}

#[derive(Debug, Serialize)]
struct ImageSource {
    #[serde(rename = "type")]
    source_type: &'static str,
    media_type: String,
    data: String,
}

#[derive(Debug, Serialize)]
struct Message {
    role: &'static str,
    content: Vec<RequestContent>,
}

#[derive(Debug, Serialize)]
struct ApiRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

// Response types
#[derive(Debug, Deserialize)]
struct ResponseContent {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiResponse {
    content: Vec<ResponseContent>,
}

fn get_model_id(model: &str) -> &'static str {
    match model {
        "haiku" => "claude-3-5-haiku-latest",
        "sonnet" => "claude-sonnet-4-20250514",
        "opus" => "claude-opus-4-20250514",
        _ => "claude-3-5-haiku-latest",
    }
}

pub fn get_api_key() -> Option<String> {
    std::env::var("ANTHROPIC_API_KEY").ok()
}

/// Read image file and encode as base64
fn encode_image(path: &PathBuf) -> Result<(String, String), String> {
    let data = std::fs::read(path)
        .map_err(|e| format!("Failed to read image {}: {}", path.display(), e))?;

    // Detect media type from extension
    let media_type = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "image/png", // Default to PNG
    };

    let base64_data = BASE64.encode(&data);

    eprintln!("Encoded image: {} ({}, {} bytes -> {} base64 chars)",
        path.display(), media_type, data.len(), base64_data.len());

    Ok((base64_data, media_type.to_string()))
}

pub async fn call_claude_with_images(prompt: &str, model: &str, image_paths: &[PathBuf]) -> Result<String, String> {
    let api_key = get_api_key()
        .ok_or_else(|| "ANTHROPIC_API_KEY not set".to_string())?;

    let client = reqwest::Client::new();

    // Build content array with images first, then text
    let mut content: Vec<RequestContent> = Vec::new();

    // Add images
    for path in image_paths {
        match encode_image(path) {
            Ok((data, media_type)) => {
                content.push(RequestContent::Image {
                    source: ImageSource {
                        source_type: "base64",
                        media_type,
                        data,
                    },
                });
            }
            Err(e) => {
                eprintln!("Warning: {}", e);
            }
        }
    }

    // Add text prompt
    content.push(RequestContent::Text {
        text: prompt.to_string(),
    });

    let request = ApiRequest {
        model: get_model_id(model).to_string(),
        max_tokens: 4096,
        messages: vec![Message {
            role: "user",
            content,
        }],
    };

    eprintln!("Calling Claude API with model: {}, {} images", get_model_id(model), image_paths.len());

    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("Claude API error {}: {}", status, error_text);
        return Err(format!("API error {}: {}", status, error_text));
    }

    let api_response: ApiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract text from response
    let text = api_response
        .content
        .into_iter()
        .filter_map(|block| {
            if block.content_type == "text" {
                block.text
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("");

    eprintln!("Claude response length: {} chars", text.len());

    Ok(text)
}

/// Enhance transcription (correct errors, add punctuation, with optional visual context)
/// Uses Claude CLI if available, falls back to API
pub async fn enhance_transcription(text: &str, model: &str, screenshot_paths: &[PathBuf]) -> Result<String, String> {
    let prompt = if screenshot_paths.is_empty() {
        format!(
            r#"Corrige cette transcription vocale. Garde le sens, corrige les erreurs, ajoute la ponctuation. Reponds UNIQUEMENT avec le texte corrige:

{}"#,
            text
        )
    } else {
        format!(
            r#"Corrige cette transcription vocale. Tu as acces au contexte visuel de l'ecran de l'utilisateur (captures d'ecran ci-dessus). Utilise ce contexte pour mieux comprendre les termes techniques, noms propres, ou references visuelles.

Transcription a corriger:
{}

Reponds UNIQUEMENT avec le texte corrige, sans explication."#,
            text
        )
    };

    // Try CLI first, fall back to API
    if is_claude_cli_available() {
        eprintln!("Using Claude CLI for enhancement");
        if screenshot_paths.is_empty() {
            call_claude_cli(&prompt)
        } else {
            call_claude_cli_with_images(&prompt, screenshot_paths)
        }
    } else if get_api_key().is_some() {
        eprintln!("Using Claude API for enhancement");
        call_claude_with_images(&prompt, model, screenshot_paths).await
    } else {
        Err("Neither Claude CLI nor API key available".to_string())
    }
}

