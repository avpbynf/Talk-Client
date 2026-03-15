//! Language-specific vocabulary module
//!
//! Provides reduced vocabulary sets (30-40 words max) for each programming language.
//! These are used to bias Whisper toward recognizing technical terms.

use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::HashMap;

/// Vocabulary entry for a language
#[derive(Debug, Clone, Deserialize)]
pub struct LanguageVocabulary {
    /// Base vocabulary for the language
    pub base: Vec<String>,
    /// Framework-specific vocabulary
    #[serde(default)]
    pub frameworks: HashMap<String, Vec<String>>,
}

/// All vocabularies loaded from JSON or embedded
#[derive(Debug, Clone, Deserialize)]
pub struct Vocabularies {
    #[serde(flatten)]
    pub languages: HashMap<String, LanguageVocabulary>,
}

/// Embedded vocabularies (fallback if JSON file not found)
static EMBEDDED_VOCABULARIES: Lazy<Vocabularies> = Lazy::new(|| {
    let json = include_str!("../../resources/vocabularies.json");
    serde_json::from_str(json).unwrap_or_else(|e| {
        eprintln!("[vocabulary] Failed to parse embedded vocabularies: {}", e);
        Vocabularies {
            languages: HashMap::new(),
        }
    })
});

/// Get vocabulary for a language
pub fn get_vocabulary(language: &str) -> Option<&LanguageVocabulary> {
    EMBEDDED_VOCABULARIES.languages.get(language)
}

/// Get framework-specific vocabulary
pub fn get_framework_vocabulary<'a>(language: &str, framework: &str) -> Option<&'a Vec<String>> {
    EMBEDDED_VOCABULARIES
        .languages
        .get(language)
        .and_then(|lang| lang.frameworks.get(framework))
}

/// Get all available languages (used by UI to show supported languages)
pub fn get_available_languages() -> Vec<String> {
    let mut langs: Vec<String> = EMBEDDED_VOCABULARIES
        .languages
        .keys()
        .cloned()
        .collect();
    langs.sort();
    langs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_rust_vocabulary() {
        let vocab = get_vocabulary("rust");
        assert!(vocab.is_some());
        let vocab = vocab.unwrap();
        assert!(!vocab.base.is_empty());
        assert!(vocab.base.len() <= 50); // Should be reduced
    }

    #[test]
    fn test_get_framework_vocabulary() {
        let vocab = get_framework_vocabulary("rust", "tauri");
        assert!(vocab.is_some());
    }
}
