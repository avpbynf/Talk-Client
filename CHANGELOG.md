# Changelog

All notable changes to this project are documented in this file.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-08-26

### Bug Fixes

- (window) Open at 1190x750 so the home page fits

At 1200x700 the typing test sat under the fold on the page the application
  opens on. Fifty pixels taller and the whole thing is in the window, with the
  content centred rather than pressed against the top.
- (ui) Give controls a pointer, and stop the window selecting like a page

Tailwind 4 dropped the pointer cursor on buttons, so every control in the
  sidebar kept the arrow and read as inert. One base rule covers the whole
  application, and the classes sprinkled on individual buttons come back out.

  Dragging across the window also painted labels, headings and counters blue,
  which no desktop application does. Selection is off by default and handed back
  where there is something worth copying: the fields you type into, and the
  transcribed text in the history, which carries a .selectable class.
- (analytics) Give Retest room to breathe

It sat against the speed it re-measures, at ten pixels and off the baseline,
  so it read as a superscript rather than a link.
- (activity) Scale the graph against a real day

The intensity ceiling was 700 dictations in a day, a number nobody reaches, so
  every real day landed in the faintest band and a full year of work read as an
  empty grid. Eight gives a first week visible contrast and stops mattering as
  soon as there is a busier day to scale against.
- (installer) Retire the T4lk install, and reclaim the model cache

Tauri keys the uninstall entry on the product name rather than on the bundle
  identifier, so an install of Talk was invisible to the T4lk entry already on the
  machine: Windows would list two applications, keep two shortcuts, and leave the
  old binary on disk. NSIS_HOOK_PREINSTALL now deletes those keys and that
  directory. Never by running the old uninstaller, whose own hook reaches into the
  data directory, which is the whole point of having kept the identifier.

  The uninstall hook also did nothing at all. It deleted
  %APPDATA%\com.avpbynf.t4lk, and nothing is ever written there: on Windows the
  directories crate drops the qualifier, so the real path is %APPDATA%\avpbynf\t4lk.
  Uninstalling therefore left the models behind, a gigabyte and a half of them. It
  now reclaims those, since they download themselves again, and leaves
  settings.json and the history where a reinstall will find them.
- (titlebar) Put the application name before the status

The model or the server state came first and the name second, behind an em
  dash. The name now leads in full colour and the status follows it, in
  parentheses and dimmed.
- (transcription) Drop the slide on page load

slide-enter was on the whole page container, which no other view does, so
  Transcription alone appeared to slide in. The class stays where it belongs, on
  the block that reveals itself in SoundFeedbackSection.
- (history) Confirm before clearing everything

The button wiped the whole history on the click, with no way back. It now opens
  a small modal over the page, dismissed by Escape or by clicking beside it, using
  the words the dashboard already uses for the same question.

### Build

- Generate the installer bitmaps from a script

The two BMP the NSIS wizard displays were composed by hand, so the wordmark
  they carried survived the rename. They now come out of a script that draws
  the real icon and the real Outfit face on the dark theme tokens, and can be
  rebuilt whenever the mark changes.

### Documentation

- Show the home page in the README

Taken from the running application, at the size it now opens at, and reduced to
  a 256 colour palette: identical to the eye and a little over half the weight.
- Correct which string names the data directory

Four call sites resolve to %APPDATA%\avpbynf\t4lk, where settings.json, t4lk.db
  and better than a gigabyte of models live. The bundle identifier is a separate
  string naming only the WebView2 profile.
- Local and server are two modes, not a mode and a fallback

TranscriptionMode defaults to Local, and the wizard's first screen offers the
  two as equal choices. The README said server first and local as a rescue, which
  is the shape of one toggle inside server mode, not the shape of the product. It
  now says what each mode answers: a card in this machine, or a card in another
  one shared by everybody.

  The build table also named six tools and linked one. Each has its download page
  now, and the winget line that installs all but Visual Studio.
- Give the path budget instead of a bare example

The build writes 219 characters below the target directory, so the name of that
  directory is the whole budget: about 40 characters, which no path under
  Documents leaves.
- Name the path-length fix the build actually needs

The advice was to move the checkout. The target directory is the half that
  grows, and from a 48 character checkout the default one already crosses the
  limit. Both files now point at CARGO_TARGET_DIR, and record that the message
  which comes back is MSBuild's MSB4184, not anything mentioning CMake.
- Rewrite the README as the app's front door

It opened on what the app is built with. It now opens on why anyone would want
  it, and says what the local engine is for rather than only that it exists.
  CLAUDE.md gains the two traps this rename left behind, and the LLVM requirement
  that makes bindgen panic about a file belonging to nobody.
- Record that the Rust side has no local feedback loop

### Features

- (home) Make the statistics page a home page

It was already the landing view, and it opened on a report. It now opens on
  whether the shortcut will produce text right now: the mode in use, the model or
  the server behind it, the keys to hold, and the last thing dictated.

  The activity graph sits above the period selector and is deliberately never
  filtered. It is always the whole year, and putting the selector under it is
  what makes that readable rather than surprising.
- (analytics) Compare against what a subscription would cost

The API comparison answers what the audio would have cost to send somewhere.
  This answers the other question, which is what the alternatives charge to sit
  on the machine: Wispr Flow, Dragon Professional and superwhisper, times the
  months since the first dictation.

  Their prices rot, so they live in one place with the month they were checked,
  and that month is printed under the card. Mac-only tools are left out: a
  comparison against something that does not run on Windows would flatter Talk
  and mean nothing.
- (analytics) Let the summary answer over a period

db_get_analytics_summary took a typing speed and nothing else, so every figure
  on the page was a lifetime total. It now takes a window in days, today
  included, and null still means everything.

  It also returns two dates. firstDay is the earliest day carrying activity,
  which daily_stats keeps across a history clear, so it is the real start of use
  rather than the oldest row still kept. periodStart is the window's own start,
  and what a subscription would have billed is counted from whichever of the two
  comes later.
- (overlay) Bring back the size selector

The three sizes existed in Rust and set_overlay_size() really resized the
  window, but no control was exposed and App.tsx forced small on every mount. The
  selector sits next to the theme, and the forcing is gone: the window is already
  built from the persisted size at startup.

  show_overlay() built its window at 200x80, a size matching no OverlaySize
  variant, so an overlay that had to be re-created came back ignoring the setting.
  It reads the setting too now.
- (settings) Default to beep feedback and clipboard preservation

### Maintenance

- Rename the product from T4lk to Talk

The bundle identifier, the config and data directories and the history
  database keep their com.avpbynf.t4lk spelling. Renaming those would make
  every existing install lose its settings, its history and its downloaded
  model, for a string nobody reads.

  AppTheme keeps a serde alias for each of its two former variants for the
  same reason: load_settings() drops the whole file on a parse error, so a
  settings.json still holding "t4lk-dark" would take the server URL and the
  shortcuts down with it.

### Refactoring

- (i18n) The rest of the interface in English

Twenty files: the setup wizard, the preferences and their sections, the
  vocabulary, the history, the transcription tabs, the model and GPU cards, and
  the weekday labels the chart reads out of Rust.

  PreferencesView was also declared as PreferencesView with accents on the
  identifier itself, not only on its labels.

  Dates and counts go through UI_LOCALE rather than the system, so the history
  stops saying "aujourd'hui" in an English window.
- (home) One typeface, no history line, and the graph folded away

Five things, all from watching it run.

  The numbers were set in JetBrains Mono while everything around them was Outfit,
  which read as two designs sharing a card. One typeface throughout.

  The last dictation had its own row under the status strip. It said what the
  history page says, on every visit, and it put whatever was just dictated on
  screen for anyone walking past.

  The activity graph moves to the bottom, above the typing test, and opens on a
  chevron rather than being shown. It is the whole year whatever the period above
  says, so it answers a different question, and on a young history it is a year of
  empty squares nobody asked to see.

  The titlebar loses its status dot, which the home page now carries in words, and
  gains room between the name and the model.

  Figures also follow the interface rather than the machine: on a French Windows
  an English page was printing "2 733" with a narrow space and "août 2026".
- (analytics) Rewrite the cards in English, and stop opposing the modes

The four counters become four cards, each carrying the scope of its own figure
  rather than leaving them to be read as one.

  Where it ran no longer paints a split bar when only one mode has ever been
  used. Plenty of installs are local only or server only, and a bar cut at 100/0
  claims a balance that does not exist: it says which one, in a line, instead.

## [0.6.0] - 2026-08-26

### Bug Fixes

- (installer) Redraw the header, it carried the previous product name
- (installer) Redraw the sidebar, it carried the previous product name
- (shortcuts) Remove an unused local
- (history) Remove an unused import
- (overlay) Drop the unread size value, keep its setter
- (ui) Drop the unread isRecording value, keep its setter
- (ui) Give useRef an initial value, required by React 19 types
- (csp) Allow any HTTPS server instead of a single host
- (setup) Drop the hardcoded default server URL
- (ui) Drop the hardcoded default server URL
- (state) Drop the hardcoded default server URL
- (settings) Drop the hardcoded default server URL
- (installer) Skip the VB-Cable setup when its payload is absent
- (build) Detect any Visual Studio 2022 edition, fail loudly when none
- (i18n) Add missing French accents across all UI strings

- App: Préférences, Serveur connecté, Non prêt, Aucun modèle
  - Preferences: Préférences, système
  - InputDevice: périphérique, Défaut système, Rafraîchir
  - LocalTab: Modèles, téléchargé, Quantifiés
  - ServerTab: Vérification, Connecté, testé, Délai, modèle
  - ModelCard: Téléchargement
  - GpuSelector: Accélération, générique
  - TimeSaved: Transcription réelle
  - Analytics: all TYPING_SENTENCES with proper accents

### Build

- Commit the bun lockfile
- Pin the Tauri npm packages to the Rust crate minor

### Documentation

- Record how the path limit actually surfaces
- (build) Explain why cargo forces the Ninja generator
- Remove the throwaway redesign prompt
- Remove the throwaway overlay design prompt
- Add repository conventions
- Add a README
- Add the MIT licence

### Features

- (ui) Add motion animations, improve history UX, fix French accents

- Add motion library for micro-interactions
  - History: click card to copy, AnimatePresence for new entries, ghost
    clipboard icon feedback, whileTap press effect
  - History: unified layout with persistent header, disabled clear button
    when empty, simplified empty state
  - History: hide model badge for server transcriptions
  - Button: add cursor-pointer globally
  - Fix all missing French accents in UI strings (UTF-8)
- (dashboard) Redesign analytics with heatmap and compact stats

- Replace 2x2 card grid with single-row compact data strip (colored dots)
  - Replace bar chart with SVG yearly heatmap grid (365 days, 5 intensity levels)
  - Add month and day-of-week labels to heatmap
  - Add db_get_yearly_activity Rust command querying daily_stats for past 365 days
  - Add YearlyDayActivity type in Rust and TypeScript
  - Intensity thresholds: absolute baseline 700 with user-adaptive scaling
  - Rename nav label from Accueil to Dashboard
- (database) Migrate transcription history to SQLite with rusqlite

Replace JSON file persistence with a SQLite database using rusqlite.
  Add analytics SQL queries for the analytics view. Remove legacy JSON
  persistence code from settings.rs.
- (ui) Add analytics home page with stats dashboard

Add analytics home page as the default view with:
  - stats cards (transcription count, time saved, words transcribed, accuracy)
  - activity chart showing usage over time
  - cost comparison tracker vs OpenAI Whisper API
  - time savings tracker with cumulative metrics
  - typing speed calibration game for baseline measurement

### Maintenance

- Stop ignoring the bun lockfile
- Hide the line-ending normalization from blame
- Ignore the VB-Cable driver payload
- Normalize line endings to LF
- (release) Bump version to v0.6.0

### Performance

- (sound) Migrate audio feedback from Web Audio API to Rust

- Add rodio-based SoundEngine with pre-computed PCM buffers in RAM
  - Play sounds directly in Rust (start/stop/cancel recording) before
    emitting JS events, eliminating IPC + WebView latency
  - Keep OutputStream alive in dedicated parked thread (cpal !Send)
  - Pre-render overlay DOM with visibility:hidden instead of return null
  - Delete src/lib/audio.ts, remove JS sound refs/effects from App.tsx
  - Preview sounds in settings via invoke("preview_sound") instead of JS
  - Add tauri:check script to package.json for cargo check via vcenv

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

- (release) Bump version to v0.5.0
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
- (release) Bump version to 0.4.0
- (nsis) Add installer branding images

Header (150x57) and sidebar (164x314) with purple gradient
  matching app icon, wave motif, and T4lk text.
- Add git-cliff configuration and initial CHANGELOG
- Change authors from personal to T4lk

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
