# Changelog

All notable changes to this project are documented in this file.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-03-16

### Bug Fixes

- Align default server URL in React state to stt.example.com
- (history) Limit transcription history to 100 entries

Slice the array after prepend to keep only the 100 most recent
  transcriptions, preventing unbounded growth of history.json.
- (ui) Restore French UTF-8 accents and clean up GPU selector

- Add missing accents to all UI strings in 5 views (PreferencesView,
    TranscriptionView, VocabularyView, HistoryView, SetupWizard)
  - Swap CPU/Vulkan order in GPU selector (TranscriptionView)
  - Remove stale overlay size info message (PreferencesView)
- Remove dead screenshot/claude refs in hotkeys

Clean hotkeys/mod.rs: remove all screenshot capture logic, Claude API
  enhancement calls, and references to deleted AppState fields.
  Fix index.html title (Whisper Flow → T4lk).
  Fix overlay preview label (200x60 → 220x60 to match settings.rs).

### Documentation

- Remove orphan client cleanup design spec

Implementation complete, spec superseded by code.

### Features

- (client) Simplify vocabulary, remove bundled model, add mic mute

- Remove bundled 574MB GGML model: download from HuggingFace at first launch
  - Simplify vocabulary system: remove language-based vocabularies, add empty default vocabulary in settings, reduce setup wizard from 5 to 3 steps
  - Add mic mute feature: mute system microphone during recording via Windows Core Audio API
  - Simplify media pause to plain play/pause toggle (remove unreliable GSMTCS API)
  - Fix build warnings in transcription and window modules
- (release) Production packaging v0.3.0

Bundle large-v3-turbo-q5_0 GGML model (574 MB) via Git LFS for
  offline-first experience. Configure NSIS installer (currentUser,
  French/English). Copy bundled model to user data dir at startup.
- Migrate client from Whisper Flow to T4lk

Rebrand all identifiers (com.avpbynf.t4lk), titles, and config paths.
  Remove Claude API integration, screenshot capture, and server formatting.
  Adapt server_transcription.rs to new OpenAI-compatible API
  (/v1/audio/transcriptions/stream, no auth).
  Delete 7 dead files (claude_api.rs, screenshot/mod.rs, 5 views).

  -944 lines removed, +184 lines added across 25 files.
- Initial t4lk-client from Whisper Flow

Copy of whisper-client source code (Tauri v2 + React 19).
  Desktop STT app with local/server transcription, vocabulary, overlay.

### Maintenance

- (nsis) Add installer branding images

Header (150x57) and sidebar (164x314) with purple gradient
  matching app icon, wave motif, and T4lk text.
- Add git-cliff configuration and initial CHANGELOG
- Change authors from personal to avpbynf

### Refactoring

- (client) Remove dead code and simplify GPU to Vulkan + CPU

- Remove build_vocabulary, clipboard image functions and orphan tests
  - Simplify GPU stack: drop CUDA/Metal/IntelSYCL, keep Vulkan + CPU only
  - Remove dead overlay states (capturing, enhancing, server_formatting)
  - Fix: stop sending programming language name as Whisper language code
  - Update CSP for HTTP local/LAN, change dev port to 1421
  - Clean TranscriptionView, SetupWizard, App.tsx, OverlayPage

  Adds design spec docs/specs/2026-03-16-client-cleanup-design.md.

## Unreleased
