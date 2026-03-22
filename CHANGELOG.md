# Changelog

All notable changes to this project are documented in this file.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-03-22

### Bug Fixes

- (hotkeys) Eliminate closure accumulation on enable/disable cycles

Replaced per-shortcut on_shortcut() calls with single
  Builder::with_handler() dispatch pattern — zero closure allocation on
  enable/disable/update cycles. Removed console.log from hot path.
- (audio) Prevent memory leaks in resample buffers and web audio

- Fix resample_buffer drain skipped when consumed >= len (audio + virtual mic)
  - Cap virtual mic ring buffer at 96k samples to prevent unbounded growth
  - Disconnect AudioContext oscillator/gain nodes after playback ends
  - Add clearTimeout cleanup on InputDeviceSection unmount
- (ui) Clean up ServerTab text colors, remove SSE box

- Remove SSE streaming info box (unnecessary)
  - Fix Token API label/description using text-muted instead of
    text-muted-foreground (matching URL label style)
  - Fix fallback description same issue
  - Remove unused Activity import
- (ui) Homogenize spacing, colors, typography

- Replace hardcoded emerald-500/red-500 with design tokens
    (bg-success/bg-destructive) in MeetingModeSection
  - Add missing space-y-4 to LocalTab and ServerTab card containers
  - Align info-box opacity to /10 + /20 (ServerTab SSE box)
  - Align GpuSelector icon background opacity to /10
  - Standardize label sizing to text-sm font-medium across all
    preference sections (InputDevice, System, MeetingMode)
  - Normalize placeholder opacity in CompanionShortcutsSection
  - Unify empty state border to border-border-card
- (ui) Use shadcn Select component for input device dropdown
- Use direct import for find_vbcable_device in router
- Remove unused exports and dead code warnings
- (ui) Swap shortcuts and recording mode section order
- (ui) Design audit polish pass

- Add section header to ShortcutsSection (was the only section without)
  - Normalize SystemSection: remove icon badges from last 2 items to
    match the plain style of the first 2
  - Unify kbd sizing: remove inline overrides in KeyCaptureField, use
    global kbd style consistently
  - Fix CompanionShortcuts padding to match other sections (p-5)
  - Switch OverlaySection to cn() instead of template literals
  - Add focus-visible ring + keyboard support to KeyCaptureField
  - Fix accent: Theme → Thème
- (ui) Cursor-pointer on all interactive elements + French accents

- Add cursor-pointer to all buttons, selects, clickable elements
    across all preference sections
  - Fix missing French accents: Démarrage, Arrêt, assigné, etc.
- (ui) Replace trash icon with X for companion shortcut delete
- (ui) Remove key capture border + reduce card bottom padding
- (ui) Always-visible delete button + remove row borders

Delete button no longer hidden on hover. Remove border/background
  from rows for a cleaner inline look — background only shows when
  dragging.
- Play stop sound on recording cancellation
- Event listeners lost in StrictMode + companion UI polish

- Reset hasRegisteredListeners flag in cleanup so listeners survive
    React 18 StrictMode unmount/remount cycle (fixes sounds + companion
    shortcuts not firing)
  - Extract fireCompanionShortcuts helper with error logging
  - Redesign companion shortcuts: color-coded trigger badges (green
    start, amber stop, cyan both), segmented trigger control in edit
    mode, hover-reveal actions, separator dots, better empty state
- (ui) Key-capture for companion shortcuts + cancel trigger

- Replace text input with proper key-capture interface (same as main
    shortcuts section) for companion shortcut key assignment
  - Companion shortcuts now fire on recording cancellation (stop trigger)
- Companion shortcuts on cancel + titlebar visibility

- Fire companion shortcuts (trigger "stop"/"both") when recording is
    cancelled, matching the behavior of normal stop
  - Change titlebar title from text-muted (nearly invisible) to
    text-muted-foreground for proper contrast
- (build) Upgrade whisper-rs 0.16, add Ninja generator

- Upgrade whisper-rs 0.14 -> 0.16 (bindgen 0.72 fixes opaque structs)
  - Add .cargo/config.toml with CMAKE_GENERATOR=Ninja (bypasses vswhere)
  - Add rust-toolchain.toml pinning Rust 1.90.0
  - Commit Cargo.lock (removed from .gitignore)
  - Add tauri:dev/build/clean scripts with auto vcvarsall.bat
  - Adapt transcription code to whisper-rs 0.16 API changes
- Correct IAudioMeterInformation import path for windows crate 0.62

Move import from Win32::Media::Audio to Win32::Media::Audio::Endpoints
  and re-add Win32_Media_Audio_Endpoints feature flag in Cargo.toml.
- (hotkeys) Resolve IAudioEndpointVolume build errors

Add missing windows crate features Win32_System_Com_StructuredStorage
  and Win32_System_Variant in Cargo.toml, and fix import path from
  Audio to Audio::Endpoints in hotkeys/mod.rs.
- (tray) Remove duplicate tray icon and redundant show menu item

Remove trayIcon from tauri.conf.json which was duplicating the icon
  already created by TrayIconBuilder in lib.rs. Also remove the redundant
  "Show" menu item from the tray menu since left-clicking the icon already
  shows the window.
- (clipboard) Use direct typing fallback for terminals

SendInput (enigo Ctrl+V) is ignored by WinUI apps like Windows Terminal.
  When the active window domain is "terminal", use enigo.text() for direct
  character typing instead of clipboard + Ctrl+V simulation.

### Features

- (ui) Add app theme system with 7 predefined themes

Add a complete theming system for the app appearance, independent
  from the overlay themes. Uses CSS custom property overrides via
  data-theme attribute on <html>. No external library needed.
- (ui) Split Appearance page, redesign titlebar + mic

- Add AppearanceView page with Overlay section
  - Move SoundFeedback back to PreferencesView (recording behavior)
  - Reorder Preferences: Mic, Mode, Shortcuts, Sounds, Companion,
    Meeting, System
  - Add Appearance nav item (Palette icon) in sidebar
  - Move status dot from sidebar to titlebar with contextual label
    (model name or server status before app name)
  - Redesign InputDeviceSection with colored icon, refresh button
    with spin animation, default device name detection
  - Add cursor-pointer to ServerTab refresh button
- Add input device selector in preferences

Enumerate available input devices via cpal and let the user choose
  which microphone to use for STT capture. Defaults to system default.
  New dropdown in preferences page, persisted in settings.
- Add virtual mic meeting mode (VB-Cable routing)

Route real microphone through VB-Cable so meeting apps hear silence
  during STT recording. Adds virtual_mic module (detector, router,
  controller), meeting mode toggle in preferences, muted indicator
  in overlay, and NSIS hook for VB-Cable silent install.

  New files: virtual_mic/{mod,detector,router,controller}.rs,
  MeetingModeSection.tsx, .gitattributes (LFS for exe resources).
  Modified: lib.rs, settings.rs, hotkeys/mod.rs, nsis-hooks.nsh,
  PreferencesView.tsx, OverlayPage.tsx.
- (ui) Reorder companion shortcuts with up/down buttons

Add chevron up/down buttons in the edit mode action bar to move
  shortcuts in the list. Buttons are disabled at list boundaries.
- (overlay) Multi-arc glow effect with customizable themes

- Replace single rotating arc with 3 independent arcs at different speeds
    and directions (one counter-clockwise), creating a Gemini-like effect
  - Arcs almost freeze at silence, come alive with audio (sine wobble for
    organic variation, smoothed audio decay for gradual slowdown)
  - Add 6 theme presets (Aurora, Sunset, Ocean, Neon, Frost, Neutral) that
    control border glow colors AND interior UI (mic, bars, timer, dots)
  - Theme selection UI in Preferences with color preview dots
  - Real-time theme switching via Tauri event (no restart needed)
  - Fix overlay transparency: body bg override, shadow(false), clip ambient
    glow to pill shape to prevent dark rectangle artifacts
- (ui) Overlay polish, sidebar icons, cleanup dead code

- Overlay: animated enter/exit, rotating glow border, spectrum bars
    with GPU compositing, processing dots, elapsed timer
  - Sidebar: simplified nav with Cpu/BookA icons, bottom status dot
  - Remove unused type_text_direct from clipboard module
  - Suppress dead_code warnings on server transcription structs
  - Simplify SystemSection (remove overlay description card)
  - Add vcenv.bat script, simplify tauri:dev/tauri:build scripts
  - Add design docs and specs
- (ui) Wire sound feedback (R3) and companion shortcuts (R4)
- (backend) Add sound, companion shortcuts, server token settings
- Add Web Audio API sound synthesis engine
- (ui) Reorganize sidebar with top/bottom groups

Split nav items into content group (History, Vocabulary) on top
  and settings group (Transcription, Preferences) on bottom,
  separated by a subtle divider line.
- (ui) Preferences -- shortcuts side-by-side, simplify overlay
- (ui) Flatten transcription page into single scrollable view

Replace 3-tab structure with 2-mode selector (Local/Server), add token
  field and fallback toggle to ServerTab, delete EngineTab and
  EngineModeCard. App.tsx gains serverToken state and passes it through.
- (ui) History -- local vs server source badge
- (ui) Vocabulary -- info box on top, fix dedup and space handling
- (ui) Simplify titlebar -- remove recording indicator

### Maintenance

- Update Cargo.lock
- Rebrand to T4lk with com.avpbynf.t4lk identity

- Rename t4lk/T4lk to t4lk/T4lk everywhere
  - Update app identifier to com.avpbynf.t4lk
  - Replace the legacy lib with t4lk_lib
  - Empty default vocabulary (remove T4lk terms)
  - Remove all T4lk branding references
- Bundle VB-Cable driver for NSIS installer

Add full VBCABLE_Driver directory (setup exe + driver files) to
  resources. Update NSIS hook to extract the entire folder before
  running setup. Add LFS tracking for binary files (.exe, .sys, .cat)
  and gitignore exception for bundled executables.
- (nsis) Add post-uninstall hook to clean user data

### Performance

- (overlay) Warm up WebView2 at startup for instant show

Create overlay window visible (not hidden) at startup so WebView2
  eagerly loads HTML/JS/React. Hide after 500ms once rendering pipeline
  is initialized. Move transparent background override to an inline
  <script> in index.html (runs before CSS, prevents dark flash).
  Remove the runtime useEffect style injection from OverlayPage.
- (recording) Optimize start timing by reordering operations

Mute virtual mic first (instant AtomicBool flip), start audio capture
  immediately, then show overlay. Removes 50ms sleep and overlay
  re-creation (~100ms+ WebviewWindow build). Overlay is pre-created at
  startup and simply shown/hidden — never recreated in the hot path.
  Net latency reduction: ~150ms+ on recording start.

### Refactoring

- (ui) Remove fixed headers, scroll titles

- Remove fixed header bars from all 4 views (History, Vocabulary,
    Transcription, Preferences) and move title/description/actions
    into the scrollable content area with a subtle separator
  - Move "Décharger" button from TranscriptionView header into
    ModelCard component (next to the loaded model)
  - Pass onUnload prop through LocalTab to ModelCard
  - Clean up unused imports (Activity, X, Button) in TranscriptionView
  - Fix HistoryView spacing: space-y-6 layout, space-y-3 cards only
  - Fix ShortcutsSection card wrapper consistency
- Replace VB-Cable with open-source Virtual Audio Driver

Swap donationware VB-Cable (not compatible with commercial use)
  for VirtualDrivers/Virtual-Audio-Driver (MIT license, signed via
  SignPath.io). Driver package reduced from ~1.1MB to ~100KB.
  NSIS hook now uses pnputil instead of setup exe.
  Rename all VBCable references to VirtualAudio across Rust and
  frontend code.
- (ui) Click-to-capture keys with cancel X, no pencil
- (ui) Auto-save + drag-to-reorder companion shortcuts

- Remove edit/view modes, draft state, save/cancel buttons — all
    fields are inline-editable and auto-save on change
  - Add drag-to-reorder with @dnd-kit (same pattern as vocabulary)
    using GripVertical handle
  - Delete button appears on hover
  - Each row: [grip] [label input] [trigger dropdown] [key capture] [trash]
- Extract KeyCaptureField shared component

- Create reusable KeyCaptureField with pencil-to-capture pattern,
    proper modifier+key validation, disable/enable global shortcuts
  - Remove all duplicated key capture logic from CompanionShortcutsSection
  - Fix bug: capture now stays active until a valid combo is pressed
    (modifier+key), not just one keypress
- (ui) Pencil button to enter key capture mode

Keys are displayed as read-only kbd tags in edit mode. Click the
  pencil icon to enter capture mode, press a key combo, and it
  auto-exits capture. Avoids accidental key capture when clicking
  into the edit panel.
- (ui) Use Select dropdown for companion trigger mode

Replace segmented button group with a Select dropdown for the
  start/stop/both trigger selection in companion shortcut edit mode.
- (ui) Reorder action bar in companion shortcut edit
- (ui) Click-to-edit companion shortcuts, remove buttons

Entire row is clickable (cursor pointer) to enter edit mode.
  Remove edit/delete hover buttons from view mode — delete is available
  in edit mode action bar.
- (ui) Reorder companion shortcut fields

Display order changed to Label > Trigger > Keys in both view and
  edit modes for better readability.
- (ui) Compact inline companion shortcuts layout

View mode: single row with trigger badge, kbd tags, label, edit/delete.
  Edit mode: inline trigger buttons, key capture, label input, save/cancel.
  New shortcut auto-enters edit mode on creation.
- (ui) Split PreferencesView into 5 section components

Extract RecordingModeSection, ShortcutsSection, CompanionShortcutsSection,
  SoundFeedbackSection, and SystemSection into src/views/preferences/.
  PreferencesView.tsx reduced from 584 to ~100 lines.
- (transcription) Split TranscriptionView into sub-components

Split 770-line TranscriptionView into focused sub-components:
  - views/transcription/ orchestrator + EngineTab, LocalTab, ServerTab
  - components/ shared: EngineModeCard, GpuSelector, ModelCard

  Lift serverStatus to App.tsx, fix sidebar status dot to reflect
  correct state per transcription mode (local/server/hybrid), and
  migrate remaining inline OKLCH values to semantic design tokens.
- (ui) Migrate inline OKLCH values to semantic design tokens

Add 16 semantic OKLCH tokens (surface hierarchy, border hierarchy, mode
  accent colors) to index.css @theme. Migrate all inline OKLCH values and
  Tailwind named colors (blue-*, purple-*, amber-*, red-*, cyan-*) to
  semantic tokens across 6 files.

  Zero visual regression - all values map to their exact OKLCH equivalents.
- (client) Remove context detection module and fix media controls

Remove context_detection module (window/IDE/framework detection, ~1523 lines).
  Remove mute mic feature (muted cpal capture, self-sabotaging).
  Fix media pause: check audio playback via IAudioMeterInformation before
  sending MediaPlayPause, resume at recording stop instead of post-transcription.
  Remove active-win-pos-rs, toml, once_cell dependencies.

  -1966 lines deleted.

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
  - Simplify vocabulary system: remove language-based vocabularies, add 9 default terms in settings, reduce setup wizard from 5 to 3 steps
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
  (/v1/audio/transcriptions/stream, no auth). Add T4lk business vocabulary.
  Delete 7 dead files (claude_api.rs, screenshot/mod.rs, 5 views).

  -944 lines removed, +184 lines added across 25 files.
- Initial t4lk-client from Whisper Flow

Copy of whisper-client source code (Tauri v2 + React 19).
  Desktop STT app with local/server transcription, vocabulary, overlay.

### Maintenance

- (release) Bump version to 0.4.0
- (nsis) Add installer branding images

Header (150x57) and sidebar (164x314) with purple gradient
  matching app icon, wave motif, and T4lk text.
- Add git-cliff configuration and initial CHANGELOG
- Change authors from personal to T4lk

### Refactoring

- (client) Remove dead code and simplify GPU to Vulkan + CPU

- Remove build_vocabulary, clipboard image functions and orphan tests
  - Simplify GPU stack: drop CUDA/Metal/IntelSYCL, keep Vulkan + CPU only
  - Remove dead overlay states (capturing, enhancing, server_formatting)
  - Fix: stop sending programming language name as Whisper language code
  - Update CSP for HTTP local/LAN, change dev port to 1421
  - Clean TranscriptionView, SetupWizard, App.tsx, OverlayPage

  Adds design spec docs/specs/2026-03-16-client-cleanup-design.md.

---
*Generated by [git-cliff](https://git-cliff.org/)*
