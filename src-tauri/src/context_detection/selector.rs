//! Vocabulary selection and prompt generation
//!
//! Combines detected context with language vocabularies and user terms
//! to generate an optimized prompt for Whisper (50-70 words max).
//!
//! Priority order (highest first):
//! 1. User-defined terms (always included)
//! 2. Document symbols (function names, etc.)
//! 3. Framework vocabulary
//! 4. Base language vocabulary

use std::collections::HashSet;

use super::vocabulary;
use super::DetectedContext;

/// Maximum number of words in the generated prompt
/// Whisper's initial_prompt has a limit of 224 tokens
const MAX_VOCABULARY_WORDS: usize = 70;

/// Maximum words from each source
const MAX_USER_WORDS: usize = 15;
const MAX_CONTEXT_NAMES: usize = 10; // workspace, language, framework names
const MAX_SYMBOL_WORDS: usize = 20;
const MAX_FRAMEWORK_WORDS: usize = 15;
const MAX_BASE_WORDS: usize = 25; // Reduced to make room for context names

/// Build a vocabulary prompt from detected context and user terms
///
/// Terms are added in priority order: user terms first (most important),
/// then symbols, frameworks, and base vocabulary.
pub fn build_prompt(context: &DetectedContext, user_terms: &[String]) -> Option<String> {
    let mut words: Vec<String> = Vec::with_capacity(MAX_VOCABULARY_WORDS);
    let mut seen: HashSet<String> = HashSet::with_capacity(MAX_VOCABULARY_WORDS);

    /// Add words from source into words/seen, skipping duplicates and respecting limits
    fn add_words(
        words: &mut Vec<String>,
        seen: &mut HashSet<String>,
        source: &[String],
        max: usize,
    ) {
        let mut added = 0;
        for word in source {
            if added >= max || words.len() >= MAX_VOCABULARY_WORDS {
                break;
            }
            let word_lower = word.to_lowercase();
            if !seen.contains(&word_lower) {
                seen.insert(word_lower);
                words.push(word.clone());
                added += 1;
            }
        }
    }

    // 1. User-defined terms FIRST (highest priority - always included)
    let valid_user_terms: Vec<String> = user_terms
        .iter()
        .filter(|w| !w.trim().is_empty())
        .cloned()
        .collect();
    add_words(&mut words, &mut seen, &valid_user_terms, MAX_USER_WORDS);

    // 2. Context names (workspace, language, frameworks) - important for recognition
    let context_names = build_context_names(context);
    add_words(&mut words, &mut seen, &context_names, MAX_CONTEXT_NAMES);

    // Track actual glossary boundary (user terms + context names actually added after dedup)
    let glossary_boundary = words.len();

    // 3. Document symbols (functions, classes from current file)
    let valid_symbols: Vec<String> = context
        .symbols
        .iter()
        .filter(|s| is_valid_symbol(s))
        .cloned()
        .collect();
    add_words(&mut words, &mut seen, &valid_symbols, MAX_SYMBOL_WORDS);

    // 4. Framework-specific vocabulary
    if let Some(ref language) = context.language {
        for framework in &context.frameworks {
            if let Some(fw_vocab) = vocabulary::get_framework_vocabulary(language, framework) {
                add_words(&mut words, &mut seen, fw_vocab, MAX_FRAMEWORK_WORDS);
            }
        }
    }

    // 5. Base language vocabulary (lowest priority - fills remaining space)
    if let Some(ref language) = context.language {
        if let Some(vocab) = vocabulary::get_vocabulary(language) {
            add_words(&mut words, &mut seen, &vocab.base, MAX_BASE_WORDS);
        }
    }

    if words.is_empty() {
        return None;
    }


    let prompt = if glossary_boundary > 0 && glossary_boundary < words.len() {
        let glossary_words = &words[..glossary_boundary];
        let tech_words = &words[glossary_boundary..];
        format!(
            "Glossary: {}. {}.",
            glossary_words.join(", "),
            tech_words.join(", "),
        )
    } else if glossary_boundary > 0 {
        format!("Glossary: {}.", words.join(", "))
    } else {
        format!("{}.", words.join(", "))
    };

    eprintln!(
        "[context_detection] Generated prompt with {} words: {}",
        words.len(),
        if prompt.len() > 100 {
            format!("{}...", &prompt[..100])
        } else {
            prompt.clone()
        }
    );

    Some(prompt)
}

/// Build a raw comma-separated vocabulary string from user terms only.
///
/// This is sent to the server for LLM-based vocabulary correction,
/// separate from the glossary prompt used for Whisper's initial_prompt.
pub fn build_vocabulary(user_terms: &[String]) -> Option<String> {
    let valid: Vec<&str> = user_terms
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if valid.is_empty() {
        return None;
    }

    Some(valid.join(", "))
}

/// Build a list of context names that Whisper might not recognize
/// Focus on project-specific terms, not common tech words
fn build_context_names(context: &DetectedContext) -> Vec<String> {
    let mut names = Vec::new();

    // Workspace/project name - MOST USEFUL (unique, Whisper can't guess)
    if let Some(ref workspace) = context.workspace {
        names.push(workspace.clone());
        // Also add without common prefixes
        if let Some(stripped) = workspace.strip_prefix('@') {
            names.push(stripped.to_string());
        }
        // Add parts if it contains dashes (e.g., "whisper-flow" -> "whisper", "flow")
        for part in workspace.split('-') {
            if part.len() >= 3 && !is_common_word(part) {
                names.push(part.to_string());
            }
        }
    }

    // Only add UNCOMMON framework names that Whisper might not know
    // Skip: React, Vue, Angular, Django, Express, etc. (Whisper knows these)
    for framework in &context.frameworks {
        if let Some(name) = get_uncommon_framework_name(framework) {
            names.push(name);
        }
    }

    names
}

/// Check if a word is too common to be useful in the prompt
fn is_common_word(word: &str) -> bool {
    let common = [
        "app", "web", "api", "cli", "lib", "core", "main", "test", "dev", "prod",
        "src", "bin", "pkg", "mod", "new", "old", "v1", "v2", "v3",
    ];
    common.contains(&word.to_lowercase().as_str())
}

/// Only return framework names that Whisper likely doesn't know well
/// Popular frameworks (React, Vue, Django, etc.) are already in Whisper's vocabulary
fn get_uncommon_framework_name(framework: &str) -> Option<String> {
    match framework {
        // Rust ecosystem - less mainstream
        "tauri" => Some("Tauri".to_string()),
        "tokio" => Some("Tokio".to_string()),
        "actix" => Some("Actix".to_string()),
        "axum" => Some("Axum".to_string()),
        "leptos" => Some("Leptos".to_string()),
        "dioxus" => Some("Dioxus".to_string()),
        // Other less common
        "prisma" => Some("Prisma".to_string()),
        "trpc" => Some("tRPC".to_string()),
        "htmx" => Some("HTMX".to_string()),
        "bun" => Some("Bun".to_string()),
        // Skip common ones: react, vue, angular, django, express, flask, etc.
        _ => None,
    }
}

/// Check if a symbol name is valid for inclusion in the vocabulary
/// Filters out common noise like single letters, numbers, etc.
fn is_valid_symbol(symbol: &str) -> bool {
    // Must be at least 2 characters
    if symbol.len() < 2 {
        return false;
    }

    // Must not be all digits
    if symbol.chars().all(|c| c.is_ascii_digit()) {
        return false;
    }

    // Must not be a common short variable name
    let common_short = ["i", "j", "k", "n", "x", "y", "z", "id", "ok", "err"];
    if common_short.contains(&symbol.to_lowercase().as_str()) {
        return false;
    }

    // Must contain at least one letter
    symbol.chars().any(|c| c.is_alphabetic())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_prompt_empty_context() {
        let context = DetectedContext::default();
        let prompt = build_prompt(&context, &[]);
        assert!(prompt.is_none());
    }

    #[test]
    fn test_build_prompt_with_language() {
        let context = DetectedContext {
            language: Some("rust".to_string()),
            ..Default::default()
        };
        let prompt = build_prompt(&context, &[]);
        assert!(prompt.is_some());
        let prompt = prompt.unwrap();
        assert!(prompt.contains("async") || prompt.contains("Result"));
    }

    #[test]
    fn test_build_prompt_with_user_terms() {
        let context = DetectedContext::default();
        let user_terms = vec!["CustomTerm".to_string(), "MyFunction".to_string()];
        let prompt = build_prompt(&context, &user_terms);
        assert!(prompt.is_some());
        let prompt = prompt.unwrap();
        assert!(prompt.contains("CustomTerm"));
        assert!(prompt.contains("MyFunction"));
    }

    #[test]
    fn test_user_terms_have_priority() {
        // User terms should appear FIRST in the prompt (highest priority)
        let context = DetectedContext {
            language: Some("rust".to_string()),
            symbols: vec!["some_function".to_string()],
            ..Default::default()
        };
        let user_terms = vec!["MyCustomTerm".to_string()];
        let prompt = build_prompt(&context, &user_terms).unwrap();

        // User term should be in the glossary section at the beginning
        assert!(prompt.starts_with("Glossary: MyCustomTerm"));
    }

    #[test]
    fn test_no_duplicates() {
        let context = DetectedContext {
            language: Some("rust".to_string()),
            symbols: vec!["async".to_string(), "Result".to_string()], // These exist in base vocab
            ..Default::default()
        };
        let prompt = build_prompt(&context, &[]).unwrap();

        // Count occurrences of "async" - should be exactly 1
        let count = prompt.split(", ").filter(|w| w.to_lowercase() == "async").count();
        assert_eq!(count, 1, "Duplicate 'async' found in prompt");
    }

    #[test]
    fn test_case_insensitive_dedup() {
        let context = DetectedContext::default();
        let user_terms = vec![
            "MyTerm".to_string(),
            "myterm".to_string(), // Same word, different case
            "MYTERM".to_string(), // Same word, different case
        ];
        let prompt = build_prompt(&context, &user_terms).unwrap();

        // Should only have one version (in glossary format)
        assert_eq!(prompt, "Glossary: MyTerm.");
    }

    #[test]
    fn test_is_valid_symbol() {
        assert!(is_valid_symbol("process_audio"));
        assert!(is_valid_symbol("WhisperEngine"));
        assert!(!is_valid_symbol("i"));
        assert!(!is_valid_symbol("123"));
        assert!(!is_valid_symbol("x"));
    }

    #[test]
    fn test_prompt_length_limit() {
        let context = DetectedContext {
            language: Some("rust".to_string()),
            symbols: (0..50).map(|i| format!("symbol_{}", i)).collect(),
            frameworks: vec!["tauri".to_string()],
            ..Default::default()
        };
        let user_terms: Vec<String> = (0..20).map(|i| format!("user_term_{}", i)).collect();
        let prompt = build_prompt(&context, &user_terms);
        assert!(prompt.is_some());

        let words: Vec<&str> = prompt.as_ref().unwrap().split(", ").collect();
        assert!(words.len() <= MAX_VOCABULARY_WORDS);
    }

    #[test]
    fn test_user_terms_always_included() {
        // Even with lots of symbols and base vocab, user terms should be included
        let context = DetectedContext {
            language: Some("rust".to_string()),
            symbols: (0..100).map(|i| format!("symbol_{}", i)).collect(),
            frameworks: vec!["tauri".to_string(), "tokio".to_string()],
            ..Default::default()
        };
        let user_terms = vec!["VeryImportantTerm".to_string()];
        let prompt = build_prompt(&context, &user_terms).unwrap();

        // User term MUST be present
        assert!(prompt.contains("VeryImportantTerm"));
    }

    #[test]
    fn test_build_context_names_with_workspace() {
        let context = DetectedContext {
            workspace: Some("whisper".to_string()),
            language: Some("rust".to_string()),
            frameworks: vec!["tauri".to_string()],
            ..Default::default()
        };
        let names = build_context_names(&context);

        // Workspace name is most important
        assert!(names.contains(&"whisper".to_string()));
        // Tauri is uncommon, should be included
        assert!(names.contains(&"Tauri".to_string()));
        // Language names are NOT included (Whisper knows "Rust")
    }

    #[test]
    fn test_build_context_names_strips_at_prefix() {
        let context = DetectedContext {
            workspace: Some("@Tests".to_string()),
            ..Default::default()
        };
        let names = build_context_names(&context);

        assert!(names.contains(&"@Tests".to_string()));
        assert!(names.contains(&"Tests".to_string()));
    }

    #[test]
    fn test_build_context_names_splits_dashed_names() {
        let context = DetectedContext {
            workspace: Some("whisper-flow".to_string()),
            ..Default::default()
        };
        let names = build_context_names(&context);

        assert!(names.contains(&"whisper-flow".to_string()));
        assert!(names.contains(&"whisper".to_string()));
        assert!(names.contains(&"flow".to_string()));
    }

    #[test]
    fn test_build_context_names_skips_common_parts() {
        let context = DetectedContext {
            workspace: Some("my-app-api".to_string()),
            ..Default::default()
        };
        let names = build_context_names(&context);

        // Full name included
        assert!(names.contains(&"my-app-api".to_string()));
        // "app" and "api" are too common, should be skipped
        assert!(!names.contains(&"app".to_string()));
        assert!(!names.contains(&"api".to_string()));
    }

    #[test]
    fn test_prompt_includes_workspace_but_not_common_frameworks() {
        let context = DetectedContext {
            workspace: Some("whisper-flow".to_string()),
            language: Some("typescript".to_string()),
            frameworks: vec!["react".to_string(), "tauri".to_string()],
            ..Default::default()
        };
        let prompt = build_prompt(&context, &[]).unwrap();

        // Should include workspace name (unique)
        assert!(prompt.contains("whisper-flow"));
        // Should include Tauri (uncommon)
        assert!(prompt.contains("Tauri"));
        // Should NOT include React (Whisper already knows it)
        // Note: React might still appear from vocabulary, but not from context names
    }

    #[test]
    fn test_uncommon_framework_names() {
        // Uncommon frameworks should be included
        assert_eq!(get_uncommon_framework_name("tauri"), Some("Tauri".to_string()));
        assert_eq!(get_uncommon_framework_name("axum"), Some("Axum".to_string()));
        assert_eq!(get_uncommon_framework_name("prisma"), Some("Prisma".to_string()));

        // Common frameworks should be skipped (Whisper knows them)
        assert_eq!(get_uncommon_framework_name("react"), None);
        assert_eq!(get_uncommon_framework_name("vue"), None);
        assert_eq!(get_uncommon_framework_name("django"), None);
    }

    #[test]
    fn test_build_vocabulary_empty() {
        assert_eq!(build_vocabulary(&[]), None);
    }

    #[test]
    fn test_build_vocabulary_filters_whitespace() {
        let terms = vec!["".to_string(), "  ".to_string(), "\t".to_string()];
        assert_eq!(build_vocabulary(&terms), None);
    }

    #[test]
    fn test_build_vocabulary_joins_terms() {
        let terms = vec!["Claude".to_string(), "Whisper".to_string(), "Tauri".to_string()];
        assert_eq!(build_vocabulary(&terms), Some("Claude, Whisper, Tauri".to_string()));
    }

    #[test]
    fn test_build_vocabulary_mixed_valid_and_empty() {
        let terms = vec!["Claude".to_string(), "".to_string(), "Whisper".to_string()];
        assert_eq!(build_vocabulary(&terms), Some("Claude, Whisper".to_string()));
    }

    #[test]
    fn test_glossary_format_with_user_terms_and_tech() {
        let context = DetectedContext {
            language: Some("rust".to_string()),
            ..Default::default()
        };
        let user_terms = vec!["Claude".to_string()];
        let prompt = build_prompt(&context, &user_terms).unwrap();

        // Should start with Glossary: prefix containing user terms
        assert!(prompt.starts_with("Glossary: Claude."));
        // Technical terms should follow after the glossary section
        assert!(prompt.contains("async") || prompt.contains("Result"));
    }

    #[test]
    fn test_glossary_boundary_with_dedup() {
        // If user term overlaps with context name, boundary should be correct
        let context = DetectedContext {
            workspace: Some("whisper".to_string()),
            language: Some("rust".to_string()),
            ..Default::default()
        };
        let user_terms = vec!["whisper".to_string()];
        let prompt = build_prompt(&context, &user_terms).unwrap();

        // "whisper" appears once (deduped), boundary = 1
        // Technical Rust terms should NOT be inside "Glossary:" section
        let parts: Vec<&str> = prompt.splitn(2, ". ").collect();
        if parts.len() == 2 {
            // Glossary part should only contain whisper
            assert!(parts[0].contains("whisper"));
            // Technical terms should be in the second part
            assert!(parts[1].contains("async") || parts[1].contains("Result") || parts[1].contains("fn"));
        }
    }
}
