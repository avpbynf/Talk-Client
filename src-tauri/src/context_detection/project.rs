//! Project framework detection via parsing project files
//!
//! Parses Cargo.toml, package.json, and pyproject.toml to detect
//! frameworks and libraries used in the project.

use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;

/// Detected project context from parsing project files
#[derive(Debug, Clone, Default)]
pub struct ProjectContext {
    /// Primary programming language (e.g., "rust", "typescript", "python")
    pub language: Option<String>,
    /// Detected frameworks and libraries
    pub frameworks: Vec<String>,
    /// Whether this result came from cache
    pub cached: bool,
}

/// Cache entry with modification time for invalidation
struct CacheEntry {
    context: ProjectContext,
    mtime: SystemTime,
}

/// Global cache for project detection results
static PROJECT_CACHE: Lazy<Mutex<HashMap<String, CacheEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Detect frameworks from project files in the given worktree root
pub fn detect_project_frameworks(worktree_root: &Path) -> ProjectContext {
    let cache_key = worktree_root.to_string_lossy().to_string();

    // Check cache first
    if let Some(cached) = check_cache(&cache_key, worktree_root) {
        return cached;
    }

    let mut context = ProjectContext::default();

    // Try Cargo.toml (Rust)
    let cargo_path = worktree_root.join("Cargo.toml");
    if cargo_path.exists() {
        if let Some(rust_ctx) = parse_cargo_toml(&cargo_path) {
            context.language = Some("rust".to_string());
            context.frameworks = rust_ctx;
        }
    }

    // Try package.json (JavaScript/TypeScript)
    let package_path = worktree_root.join("package.json");
    if package_path.exists() {
        if let Some(js_ctx) = parse_package_json(&package_path) {
            if context.language.is_none() {
                context.language = Some("typescript".to_string());
            }
            context.frameworks.extend(js_ctx);
        }
    }

    // Try pyproject.toml (Python)
    let pyproject_path = worktree_root.join("pyproject.toml");
    if pyproject_path.exists() {
        if let Some(py_ctx) = parse_pyproject_toml(&pyproject_path) {
            if context.language.is_none() {
                context.language = Some("python".to_string());
            }
            context.frameworks.extend(py_ctx);
        }
    }

    // Deduplicate frameworks
    context.frameworks.sort();
    context.frameworks.dedup();

    // Cache the result
    update_cache(&cache_key, worktree_root, &context);

    context
}

/// Check cache and return if valid (file not modified)
fn check_cache(key: &str, worktree_root: &Path) -> Option<ProjectContext> {
    let cache = PROJECT_CACHE.lock().ok()?;
    let entry = cache.get(key)?;

    // Check if any project file has been modified
    let files_to_check = ["Cargo.toml", "package.json", "pyproject.toml"];

    for file in &files_to_check {
        let path = worktree_root.join(file);
        if path.exists() {
            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(mtime) = metadata.modified() {
                    if mtime > entry.mtime {
                        eprintln!("[context_detection] Cache invalidated: {} modified", file);
                        return None;
                    }
                }
            }
        }
    }

    let mut cached_context = entry.context.clone();
    cached_context.cached = true;
    Some(cached_context)
}

/// Update cache with new detection result
fn update_cache(key: &str, worktree_root: &Path, context: &ProjectContext) {
    let mtime = get_latest_mtime(worktree_root);
    if let Ok(mut cache) = PROJECT_CACHE.lock() {
        cache.insert(
            key.to_string(),
            CacheEntry {
                context: context.clone(),
                mtime,
            },
        );
    }
}

/// Get the latest modification time from project files
fn get_latest_mtime(worktree_root: &Path) -> SystemTime {
    let files = ["Cargo.toml", "package.json", "pyproject.toml"];
    let mut latest = SystemTime::UNIX_EPOCH;

    for file in &files {
        let path = worktree_root.join(file);
        if let Ok(metadata) = fs::metadata(&path) {
            if let Ok(mtime) = metadata.modified() {
                if mtime > latest {
                    latest = mtime;
                }
            }
        }
    }

    latest
}

/// Parse Cargo.toml and detect Rust frameworks
fn parse_cargo_toml(path: &Path) -> Option<Vec<String>> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: toml::Value = toml::from_str(&content).ok()?;

    let mut frameworks = Vec::new();

    // Check [dependencies] and [dev-dependencies]
    for section in ["dependencies", "dev-dependencies"] {
        if let Some(deps) = parsed.get(section).and_then(|v| v.as_table()) {
            for dep_name in deps.keys() {
                if let Some(framework) = match_rust_framework(dep_name) {
                    frameworks.push(framework);
                }
            }
        }
    }

    if frameworks.is_empty() {
        None
    } else {
        Some(frameworks)
    }
}

/// Match known Rust frameworks/libraries
fn match_rust_framework(dep: &str) -> Option<String> {
    let dep_lower = dep.to_lowercase();
    match dep_lower.as_str() {
        "tauri" => Some("tauri".to_string()),
        "tokio" => Some("tokio".to_string()),
        "serde" | "serde_json" => Some("serde".to_string()),
        "actix-web" | "actix" => Some("actix".to_string()),
        "axum" => Some("axum".to_string()),
        "rocket" => Some("rocket".to_string()),
        "warp" => Some("warp".to_string()),
        "diesel" => Some("diesel".to_string()),
        "sqlx" => Some("sqlx".to_string()),
        "reqwest" => Some("reqwest".to_string()),
        "clap" => Some("clap".to_string()),
        "tracing" => Some("tracing".to_string()),
        "anyhow" | "thiserror" => Some("error-handling".to_string()),
        _ => None,
    }
}

/// Partial structure for package.json parsing
#[derive(Deserialize)]
struct PackageJson {
    dependencies: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "devDependencies")]
    dev_dependencies: Option<HashMap<String, serde_json::Value>>,
}

/// Parse package.json and detect JS/TS frameworks
fn parse_package_json(path: &Path) -> Option<Vec<String>> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: PackageJson = serde_json::from_str(&content).ok()?;

    let mut frameworks = Vec::new();

    // Check dependencies and devDependencies
    for deps in [parsed.dependencies, parsed.dev_dependencies].into_iter().flatten() {
        for dep_name in deps.keys() {
            if let Some(framework) = match_js_framework(dep_name) {
                frameworks.push(framework);
            }
        }
    }

    if frameworks.is_empty() {
        None
    } else {
        Some(frameworks)
    }
}

/// Match known JavaScript/TypeScript frameworks
fn match_js_framework(dep: &str) -> Option<String> {
    match dep {
        "react" | "react-dom" => Some("react".to_string()),
        "vue" => Some("vue".to_string()),
        "next" => Some("nextjs".to_string()),
        "nuxt" => Some("nuxt".to_string()),
        "express" => Some("express".to_string()),
        "fastify" => Some("fastify".to_string()),
        "nestjs" | "@nestjs/core" => Some("nestjs".to_string()),
        "angular" | "@angular/core" => Some("angular".to_string()),
        "svelte" => Some("svelte".to_string()),
        "solid-js" => Some("solidjs".to_string()),
        "typescript" => Some("typescript".to_string()),
        "prisma" | "@prisma/client" => Some("prisma".to_string()),
        "drizzle-orm" => Some("drizzle".to_string()),
        "tailwindcss" => Some("tailwind".to_string()),
        "vite" => Some("vite".to_string()),
        "webpack" => Some("webpack".to_string()),
        "jest" => Some("jest".to_string()),
        "vitest" => Some("vitest".to_string()),
        _ => None,
    }
}

/// Parse pyproject.toml and detect Python frameworks
fn parse_pyproject_toml(path: &Path) -> Option<Vec<String>> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: toml::Value = toml::from_str(&content).ok()?;

    let mut frameworks = Vec::new();

    // Check [project.dependencies]
    if let Some(deps) = parsed
        .get("project")
        .and_then(|p| p.get("dependencies"))
        .and_then(|d| d.as_array())
    {
        for dep in deps {
            if let Some(dep_str) = dep.as_str() {
                // Extract package name (before version specifier)
                let pkg_name = dep_str
                    .split(|c| c == '>' || c == '<' || c == '=' || c == '[' || c == ';')
                    .next()
                    .unwrap_or(dep_str)
                    .trim();

                if let Some(framework) = match_python_framework(pkg_name) {
                    frameworks.push(framework);
                }
            }
        }
    }

    // Also check [tool.poetry.dependencies] for Poetry projects
    if let Some(deps) = parsed
        .get("tool")
        .and_then(|t| t.get("poetry"))
        .and_then(|p| p.get("dependencies"))
        .and_then(|d| d.as_table())
    {
        for dep_name in deps.keys() {
            if let Some(framework) = match_python_framework(dep_name) {
                frameworks.push(framework);
            }
        }
    }

    if frameworks.is_empty() {
        None
    } else {
        Some(frameworks)
    }
}

/// Match known Python frameworks
fn match_python_framework(dep: &str) -> Option<String> {
    let dep_lower = dep.to_lowercase();
    match dep_lower.as_str() {
        "fastapi" => Some("fastapi".to_string()),
        "django" => Some("django".to_string()),
        "flask" => Some("flask".to_string()),
        "pytorch" | "torch" => Some("pytorch".to_string()),
        "tensorflow" => Some("tensorflow".to_string()),
        "numpy" => Some("numpy".to_string()),
        "pandas" => Some("pandas".to_string()),
        "scikit-learn" | "sklearn" => Some("scikit-learn".to_string()),
        "sqlalchemy" => Some("sqlalchemy".to_string()),
        "pydantic" => Some("pydantic".to_string()),
        "pytest" => Some("pytest".to_string()),
        "httpx" => Some("httpx".to_string()),
        "celery" => Some("celery".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_parse_cargo_toml() {
        let temp_dir = TempDir::new().unwrap();
        let cargo_path = temp_dir.path().join("Cargo.toml");

        let mut file = fs::File::create(&cargo_path).unwrap();
        write!(
            file,
            r#"
[package]
name = "test"

[dependencies]
tauri = "2"
tokio = {{ version = "1", features = ["full"] }}
serde = "1"
"#
        )
        .unwrap();

        let frameworks = parse_cargo_toml(&cargo_path).unwrap();
        assert!(frameworks.contains(&"tauri".to_string()));
        assert!(frameworks.contains(&"tokio".to_string()));
        assert!(frameworks.contains(&"serde".to_string()));
    }

    #[test]
    fn test_parse_package_json() {
        let temp_dir = TempDir::new().unwrap();
        let package_path = temp_dir.path().join("package.json");

        let mut file = fs::File::create(&package_path).unwrap();
        write!(
            file,
            r#"{{
  "name": "test",
  "dependencies": {{
    "react": "^18.0.0",
    "next": "^14.0.0"
  }},
  "devDependencies": {{
    "typescript": "^5.0.0"
  }}
}}"#
        )
        .unwrap();

        let frameworks = parse_package_json(&package_path).unwrap();
        assert!(frameworks.contains(&"react".to_string()));
        assert!(frameworks.contains(&"nextjs".to_string()));
        assert!(frameworks.contains(&"typescript".to_string()));
    }

    #[test]
    fn test_parse_pyproject_toml() {
        let temp_dir = TempDir::new().unwrap();
        let pyproject_path = temp_dir.path().join("pyproject.toml");

        let mut file = fs::File::create(&pyproject_path).unwrap();
        write!(
            file,
            r#"
[project]
name = "test"
dependencies = [
    "fastapi>=0.100.0",
    "pydantic[email]>=2.0",
]
"#
        )
        .unwrap();

        let frameworks = parse_pyproject_toml(&pyproject_path).unwrap();
        assert!(frameworks.contains(&"fastapi".to_string()));
        assert!(frameworks.contains(&"pydantic".to_string()));
    }
}
