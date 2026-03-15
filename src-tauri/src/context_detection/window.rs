//! Active window detection module
//!
//! Uses active-win-pos-rs to detect the currently focused window
//! and infer context from its title.
//!
//! Supports special parsing for:
//! - Zed: Extracts filename, language, and project from title format "filename.ext - project - Zed"
//! - VS Code: Falls back to vscode-context.json file when available

/// Parsed information from Zed window title
#[derive(Debug, Clone)]
pub struct ZedContext {
    /// Current filename (e.g., "mod.rs")
    pub filename: String,
    /// Project/workspace name
    pub project: String,
    /// Programming language inferred from file extension
    pub language: String,
}

/// Pattern matching result for window title
struct WindowPattern {
    /// Domain/category (e.g., "vscode", "browser", "terminal")
    domain: &'static str,
    /// Patterns to match in window title (case-insensitive)
    patterns: &'static [&'static str],
}

const WINDOW_PATTERNS: &[WindowPattern] = &[
    WindowPattern {
        domain: "vscode",
        patterns: &["Visual Studio Code", "VSCode", "VS Code", "Code - "],
    },
    WindowPattern {
        domain: "ide",
        patterns: &[
            "WebStorm",
            "IntelliJ",
            "PyCharm",
            "RustRover",
            "CLion",
            "Rider",
            "Android Studio",
            "Xcode",
            "Zed",
            "Sublime Text",
            "Atom",
            "Neovim",
            "nvim",
        ],
    },
    WindowPattern {
        domain: "terminal",
        patterns: &[
            "Terminal",
            "PowerShell",
            "Command Prompt",
            "cmd.exe",
            "Windows Terminal",
            "iTerm",
            "Alacritty",
            "Warp",
            "Hyper",
            "Kitty",
        ],
    },
    WindowPattern {
        domain: "browser",
        patterns: &[
            "Chrome",
            "Firefox",
            "Safari",
            "Edge",
            "Brave",
            "Opera",
            "Vivaldi",
            "Arc",
        ],
    },
    WindowPattern {
        domain: "office",
        patterns: &[
            "Word",
            "Excel",
            "PowerPoint",
            "Outlook",
            "Google Docs",
            "Google Sheets",
            "Notion",
        ],
    },
    WindowPattern {
        domain: "communication",
        patterns: &["Slack", "Discord", "Teams", "Zoom", "Meet"],
    },
];

/// Detect the active window and return (title, domain, app_name)
#[cfg(windows)]
pub fn detect_active_window() -> Option<(String, String, Option<String>)> {
    use active_win_pos_rs::get_active_window;

    match get_active_window() {
        Ok(window) => {
            let title = window.title;
            let app_name = if window.app_name.is_empty() {
                None
            } else {
                Some(window.app_name.clone())
            };

            // Check if app is Zed first (more reliable than title parsing)
            let domain = if is_zed_app(&app_name) {
                "zed"
            } else {
                infer_domain_from_title(&title)
            };

            eprintln!(
                "[context_detection] Active window: '{}' (app: {:?}) -> domain: {}",
                title, app_name, domain
            );

            Some((title, domain.to_string(), app_name))
        }
        Err(_) => {
            eprintln!("[context_detection] Failed to get active window");
            None
        }
    }
}

/// Check if the app is Zed editor
fn is_zed_app(app_name: &Option<String>) -> bool {
    if let Some(name) = app_name {
        let name_lower = name.to_lowercase();
        name_lower == "zed" || name_lower == "zed.exe"
    } else {
        false
    }
}

/// Parse Zed window title to extract context
/// Supports multiple formats:
/// - "filename.ext - project - Zed" (older format)
/// - "project — filename.ext" (newer format with em dash)
#[cfg(windows)]
pub fn parse_zed_title(title: &str, is_zed_app: bool) -> Option<ZedContext> {
    // Format 1: "filename.ext - project - Zed" (must end with " - Zed")
    if title.ends_with(" - Zed") {
        let parts: Vec<&str> = title.split(" - ").collect();
        if parts.len() >= 3 {
            let filename = parts[0].trim().to_string();
            let project = parts[1].trim().to_string();
            return Some(build_zed_context(filename, project));
        }
    }

    // Format 2: "project — filename.ext" (with em dash, used when app is confirmed as Zed)
    if is_zed_app {
        // Try em dash separator (U+2014)
        if let Some((project, filename)) = title.split_once(" — ") {
            let project = project.trim().to_string();
            let filename = filename.trim().to_string();
            // Verify filename has an extension
            if filename.contains('.') {
                return Some(build_zed_context(filename, project));
            }
        }
        // Try regular dash as fallback
        if let Some((project, filename)) = title.split_once(" - ") {
            let project = project.trim().to_string();
            let filename = filename.trim().to_string();
            if filename.contains('.') && !filename.contains(" - ") {
                return Some(build_zed_context(filename, project));
            }
        }
    }

    None
}

fn build_zed_context(filename: String, project: String) -> ZedContext {
    let extension = filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    let language = extension_to_language(&extension);

    eprintln!(
        "[context_detection] Zed parsed: filename='{}', project='{}', language='{}'",
        filename, project, language
    );

    ZedContext {
        filename,
        project,
        language,
    }
}

/// Parsed information from VS Code window title
#[derive(Debug, Clone)]
pub struct VsCodeTitleContext {
    pub filename: String,
    pub workspace: Option<String>,
    pub language: String,
}

/// Parse VS Code window title to extract context
/// Common formats:
/// - "filename.ext - workspace - Visual Studio Code"
/// - "filename.ext (context) - workspace - Visual Studio Code"
/// - "filename.ext - Visual Studio Code"
pub fn parse_vscode_title(title: &str) -> Option<VsCodeTitleContext> {
    // Must contain Visual Studio Code or VS Code
    if !title.contains("Visual Studio Code") && !title.contains("VS Code") && !title.contains("Code - ") {
        return None;
    }

    // Split by " - " and work backwards (last part is always the app name)
    let parts: Vec<&str> = title.split(" - ").collect();

    if parts.is_empty() {
        return None;
    }

    // First part contains the filename (possibly with extra context in parentheses)
    let first_part = parts[0].trim();

    // Extract filename (remove parenthetical context if present)
    let filename = if let Some(paren_pos) = first_part.find(" (") {
        first_part[..paren_pos].trim().to_string()
    } else {
        first_part.to_string()
    };

    // Must have a file extension to be useful
    if !filename.contains('.') {
        return None;
    }

    // Workspace is typically the second-to-last part (before "Visual Studio Code")
    let workspace = if parts.len() >= 3 {
        // Skip the app name (last part) and get the workspace
        let ws = parts[parts.len() - 2].trim();
        if !ws.contains("Visual Studio Code") && !ws.contains("VS Code") {
            Some(ws.to_string())
        } else {
            None
        }
    } else {
        None
    };

    let extension = filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    let language = extension_to_language(&extension);

    eprintln!(
        "[context_detection] VS Code parsed: filename='{}', workspace={:?}, language='{}'",
        filename, workspace, language
    );

    Some(VsCodeTitleContext {
        filename,
        workspace,
        language,
    })
}

/// Infer implicit frameworks from file extension
/// Returns frameworks that are commonly associated with certain file types
pub fn infer_frameworks_from_extension(ext: &str) -> Vec<String> {
    match ext {
        "tsx" | "jsx" => vec!["react".to_string()],
        "vue" => vec!["vue".to_string()],
        "svelte" => vec!["svelte".to_string()],
        "astro" => vec!["astro".to_string()],
        "angular.ts" => vec!["angular".to_string()], // Rare but possible
        _ => vec![],
    }
}

#[cfg(not(windows))]
pub fn parse_zed_title(_title: &str, _is_zed_app: bool) -> Option<ZedContext> {
    None
}

#[cfg(not(windows))]
pub fn detect_active_window() -> Option<(String, String, Option<String>)> {
    None
}

/// Convert file extension to normalized language identifier
fn extension_to_language(ext: &str) -> String {
    match ext {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "py" | "pyw" => "python",
        "go" => "go",
        "java" => "java",
        "cs" => "csharp",
        "cpp" | "cc" | "cxx" | "hpp" | "h" => "cpp",
        "c" => "c",
        "html" | "htm" => "html",
        "css" | "scss" | "sass" | "less" => "css",
        "json" | "jsonc" => "json",
        "yaml" | "yml" => "yaml",
        "md" | "markdown" => "markdown",
        "sql" => "sql",
        "sh" | "bash" | "zsh" | "fish" => "shell",
        "ps1" | "psm1" => "shell",
        "dockerfile" => "docker",
        "toml" => "toml",
        "xml" => "xml",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "rb" => "ruby",
        "php" => "php",
        "lua" => "lua",
        "r" => "r",
        "ex" | "exs" => "elixir",
        "erl" | "hrl" => "erlang",
        "hs" => "haskell",
        "clj" | "cljs" | "cljc" => "clojure",
        "scala" | "sc" => "scala",
        "zig" => "zig",
        "nim" => "nim",
        "v" => "v",
        "dart" => "dart",
        "vue" => "vue",
        "svelte" => "svelte",
        _ => "generic_dev",
    }
    .to_string()
}

/// Infer domain from window title using pattern matching
fn infer_domain_from_title(title: &str) -> &'static str {
    let title_lower = title.to_lowercase();

    for pattern in WINDOW_PATTERNS {
        for p in pattern.patterns {
            if title_lower.contains(&p.to_lowercase()) {
                return pattern.domain;
            }
        }
    }

    "unknown"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_domain_vscode() {
        assert_eq!(
            infer_domain_from_title("mod.rs - whisper-flow - Visual Studio Code"),
            "vscode"
        );
        assert_eq!(infer_domain_from_title("Code - Insiders"), "vscode");
    }

    #[test]
    fn test_infer_domain_browser() {
        assert_eq!(
            infer_domain_from_title("Google - Chrome"),
            "browser"
        );
        assert_eq!(
            infer_domain_from_title("GitHub - Firefox"),
            "browser"
        );
    }

    #[test]
    fn test_infer_domain_terminal() {
        assert_eq!(
            infer_domain_from_title("Windows Terminal"),
            "terminal"
        );
        assert_eq!(
            infer_domain_from_title("Administrator: PowerShell"),
            "terminal"
        );
    }

    #[test]
    fn test_infer_domain_unknown() {
        assert_eq!(infer_domain_from_title("Some Random App"), "unknown");
    }

    #[test]
    fn test_infer_domain_zed() {
        assert_eq!(
            infer_domain_from_title("mod.rs - whisper-flow - Zed"),
            "ide"
        );
    }

    #[test]
    fn test_extension_to_language() {
        assert_eq!(extension_to_language("rs"), "rust");
        assert_eq!(extension_to_language("ts"), "typescript");
        assert_eq!(extension_to_language("tsx"), "typescript");
        assert_eq!(extension_to_language("js"), "javascript");
        assert_eq!(extension_to_language("py"), "python");
        assert_eq!(extension_to_language("go"), "go");
        assert_eq!(extension_to_language("unknown"), "generic_dev");
    }

    #[cfg(windows)]
    #[test]
    fn test_parse_zed_title_valid() {
        let ctx = parse_zed_title("mod.rs - whisper-flow - Zed", true);
        assert!(ctx.is_some());
        let ctx = ctx.unwrap();
        assert_eq!(ctx.filename, "mod.rs");
        assert_eq!(ctx.project, "whisper-flow");
        assert_eq!(ctx.language, "rust");
    }

    #[cfg(windows)]
    #[test]
    fn test_parse_zed_title_typescript() {
        let ctx = parse_zed_title("App.tsx - my-app - Zed", true);
        assert!(ctx.is_some());
        let ctx = ctx.unwrap();
        assert_eq!(ctx.filename, "App.tsx");
        assert_eq!(ctx.project, "my-app");
        assert_eq!(ctx.language, "typescript");
    }

    #[cfg(windows)]
    #[test]
    fn test_parse_zed_title_not_zed() {
        // When is_zed_app is false, should not match even with Zed in title
        assert!(parse_zed_title("mod.rs - whisper-flow - Visual Studio Code", false).is_none());
        assert!(parse_zed_title("Some Random Window", false).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn test_parse_zed_title_complex_project_name() {
        // Test with project name containing dashes
        let ctx = parse_zed_title("index.ts - my-complex-project - Zed", true);
        assert!(ctx.is_some());
        let ctx = ctx.unwrap();
        assert_eq!(ctx.filename, "index.ts");
        assert_eq!(ctx.project, "my-complex-project");
        assert_eq!(ctx.language, "typescript");
    }
}
