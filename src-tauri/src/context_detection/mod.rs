//! Context detection module for automatic vocabulary generation
//!
//! This module detects the user's current context (VS Code file, active window)
//! and generates an optimized vocabulary prompt for Whisper transcription.

mod project;
mod selector;
mod vocabulary;
mod window;

use directories::{ProjectDirs, UserDirs};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

pub use selector::build_prompt;
pub use vocabulary::get_available_languages;

/// Maximum age for VS Code context file to be considered valid (30 seconds)
/// Extension updates every 1s, but file can be stale if VS Code loses focus
const VSCODE_CONTEXT_MAX_AGE: Duration = Duration::from_secs(30);

/// Detected context from various sources
#[derive(Debug, Clone, Default, Serialize)]
pub struct DetectedContext {
    /// Programming language (e.g., "rust", "typescript", "python")
    pub language: Option<String>,
    /// Symbols from the current file (function names, variables, etc.)
    pub symbols: Vec<String>,
    /// Workspace/project name
    pub workspace: Option<String>,
    /// Detected frameworks or extensions
    pub frameworks: Vec<String>,
    /// Active window title (fallback detection)
    pub window_title: Option<String>,
    /// Domain inferred from window title
    pub domain: Option<String>,
}

/// VS Code context file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VsCodeContext {
    #[serde(rename = "activeFile")]
    pub active_file: Option<ActiveFile>,
    pub symbols: Vec<Symbol>,
    pub workspace: Option<Workspace>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveFile {
    pub name: String,
    pub language: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    #[serde(rename = "type")]
    pub symbol_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub name: String,
    pub extensions: Vec<String>,
}

fn get_vscode_context_path() -> PathBuf {
    ProjectDirs::from("com", "t4lk", "t4lk")
        .map(|dirs| dirs.config_dir().join("vscode-context.json"))
        .unwrap_or_else(|| PathBuf::from("vscode-context.json"))
}

/// Read VS Code context if available and fresh
fn read_vscode_context() -> Option<VsCodeContext> {
    let path = get_vscode_context_path();

    if !path.exists() {
        return None;
    }

    // Check file age
    let metadata = std::fs::metadata(&path).ok()?;
    let modified = metadata.modified().ok()?;
    let age = SystemTime::now().duration_since(modified).ok()?;

    if age > VSCODE_CONTEXT_MAX_AGE {
        eprintln!(
            "[context_detection] VS Code context too old ({:.1}s > {}s)",
            age.as_secs_f32(),
            VSCODE_CONTEXT_MAX_AGE.as_secs()
        );
        return None;
    }

    let content = std::fs::read_to_string(&path).ok()?;
    let context: VsCodeContext = serde_json::from_str(&content).ok()?;

    eprintln!(
        "[context_detection] VS Code context loaded: language={:?}",
        context.active_file.as_ref().map(|f| &f.language)
    );

    Some(context)
}

/// Detect frameworks from project files (not VS Code extensions which are global)
fn detect_frameworks_from_project(workspace_name: &str) -> Vec<String> {
    // Try to find the project directory and detect frameworks from actual project files
    let user_dirs = directories::UserDirs::new();
    let home_dir = user_dirs.as_ref().map(|u| u.home_dir().to_path_buf());

    let potential_roots: Vec<std::path::PathBuf> = [
        std::env::current_dir().ok(),
        home_dir.as_ref().map(|h| h.join("Documents").join(workspace_name)),
        home_dir.as_ref().map(|h| h.join("Documents").join("@Tests").join(workspace_name)),
        home_dir.as_ref().map(|h| h.join("Documents").join("@Projects").join(workspace_name)),
        home_dir.as_ref().map(|h| h.join("Projects").join(workspace_name)),
        home_dir.as_ref().map(|h| h.join("dev").join(workspace_name)),
    ]
    .into_iter()
    .flatten()
    .collect();

    for root in potential_roots {
        if root.exists() {
            let project_ctx = project::detect_project_frameworks(&root);
            if !project_ctx.frameworks.is_empty() {
                return project_ctx.frameworks;
            }
        }
    }

    Vec::new()
}

/// Main detection function - detects from active window, uses VS Code file only if VS Code is focused
pub fn detect() -> DetectedContext {
    let mut context = DetectedContext::default();

    // First, detect which app is currently focused
    #[cfg(windows)]
    {
        if let Some((title, domain, app_name)) = window::detect_active_window() {
            context.window_title = Some(title.clone());
            context.domain = Some(domain.clone());

            // If VS Code is focused AND we have fresh context file, use it (has symbols)
            if domain == "vscode" {
                if let Some(vscode) = read_vscode_context() {
                    if let Some(ref file) = vscode.active_file {
                        context.language = Some(normalize_language(&file.language));
                    }

                    context.symbols = vscode
                        .symbols
                        .iter()
                        .map(|s| s.name.clone())
                        .collect();

                    if let Some(ref ws) = vscode.workspace {
                        context.workspace = Some(ws.name.clone());
                        context.frameworks = detect_frameworks_from_project(&ws.name);
                    }

                    eprintln!(
                        "[context_detection] VS Code focused, using context file: language={:?}, symbols={}",
                        context.language,
                        context.symbols.len()
                    );
                    return context;
                }
            }

            // For other apps or if VS Code context not available, use window detection
            // Only process code-related domains to avoid confusion
            let is_code_domain = matches!(domain.as_str(), "vscode" | "ide" | "zed" | "terminal");

            if is_code_domain {
                // Check if this is Zed editor (by app name or domain)
                let is_zed = domain == "zed" || app_name.as_ref().map_or(false, |n| {
                    let lower = n.to_lowercase();
                    lower == "zed" || lower == "zed.exe"
                });

                // Try to extract file context from window title
                let file_context: Option<(String, String, Option<String>)> = // (filename, language, workspace)
                    if let Some(zed_ctx) = window::parse_zed_title(&title, is_zed) {
                        Some((zed_ctx.filename, zed_ctx.language, Some(zed_ctx.project)))
                    } else if domain == "vscode" {
                        window::parse_vscode_title(&title)
                            .map(|ctx| (ctx.filename, ctx.language, ctx.workspace))
                    } else {
                        None
                    };

                if let Some((filename, file_language, workspace)) = file_context {
                    // Set language from the FILE being edited (priority over project)
                    context.language = Some(file_language.clone());
                    context.workspace = workspace.clone();

                    // Add filename to symbols
                    if !filename.is_empty() {
                        context.symbols.push(filename.clone());
                        if let Some(dot_pos) = filename.rfind('.') {
                            let name_without_ext = &filename[..dot_pos];
                            if !name_without_ext.is_empty() {
                                context.symbols.push(name_without_ext.to_string());
                            }
                        }
                    }

                    // Infer frameworks from file extension (e.g., .tsx -> react)
                    let extension = filename.rsplit('.').next().unwrap_or("").to_lowercase();
                    let implicit_frameworks = window::infer_frameworks_from_extension(&extension);
                    context.frameworks.extend(implicit_frameworks);

                    // Try to detect additional project frameworks from project files
                    if let Some(ref ws) = workspace {
                        let user_dirs = UserDirs::new();
                        let home_dir = user_dirs.as_ref().map(|u| u.home_dir().to_path_buf());

                        let mut potential_roots: Vec<Option<PathBuf>> = vec![
                            std::env::current_dir().ok(),
                        ];

                        if let Some(ref home) = home_dir {
                            potential_roots.push(Some(home.join("Documents").join(ws)));
                            potential_roots.push(Some(home.join("Documents").join("@Tests").join(ws)));
                            potential_roots.push(Some(home.join("Projects").join(ws)));
                            potential_roots.push(Some(home.join("dev").join(ws)));
                        }

                        for root in potential_roots.into_iter().flatten() {
                            if root.exists()
                                && (root.join("Cargo.toml").exists()
                                    || root.join("package.json").exists()
                                    || root.join("pyproject.toml").exists())
                            {
                                let project_ctx = project::detect_project_frameworks(&root);
                                if !project_ctx.frameworks.is_empty() {
                                    // Add project frameworks but DON'T override file language
                                    context.frameworks.extend(project_ctx.frameworks);
                                    eprintln!(
                                        "[context_detection] Project frameworks added: {:?}",
                                        context.frameworks
                                    );
                                    break;
                                }
                            }
                        }
                    }

                    // Deduplicate frameworks
                    context.frameworks.sort();
                    context.frameworks.dedup();

                    eprintln!(
                        "[context_detection] Editor context: language={:?}, workspace={:?}, frameworks={:?}",
                        context.language, context.workspace, context.frameworks
                    );
                    return context;
                }
            }

            // Generic domain-based language inference (non-code apps or unparseable titles)
            context.language = match domain.as_str() {
                "vscode" | "ide" | "zed" => Some("generic_dev".to_string()),
                "terminal" => Some("shell".to_string()),
                "browser" => Some("web".to_string()),
                _ => None,
            };
        }
    }

    context
}

/// Normalize language identifier from VS Code to our vocabulary keys
fn normalize_language(lang: &str) -> String {
    match lang.to_lowercase().as_str() {
        "rust" => "rust",
        "typescript" | "typescriptreact" => "typescript",
        "javascript" | "javascriptreact" => "javascript",
        "python" => "python",
        "go" | "golang" => "go",
        "java" => "java",
        "csharp" | "c#" => "csharp",
        "cpp" | "c++" => "cpp",
        "c" => "c",
        "html" => "html",
        "css" | "scss" | "sass" | "less" => "css",
        "json" | "jsonc" => "json",
        "yaml" | "yml" => "yaml",
        "markdown" | "md" => "markdown",
        "sql" => "sql",
        "shell" | "bash" | "zsh" | "sh" | "powershell" => "shell",
        "dockerfile" => "docker",
        _ => "generic_dev",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_language() {
        assert_eq!(normalize_language("rust"), "rust");
        assert_eq!(normalize_language("TypeScript"), "typescript");
        assert_eq!(normalize_language("typescriptreact"), "typescript");
        assert_eq!(normalize_language("Python"), "python");
        assert_eq!(normalize_language("unknown"), "generic_dev");
    }

    // test_detect_frameworks removed: detect_frameworks_from_extensions was renamed to
    // detect_frameworks_from_project with a different signature (takes workspace name, not extensions)
}
