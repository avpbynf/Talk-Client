# T4lk Client -- UI Redesign Prompt

## Context

T4lk is an internal Speech-to-Text desktop app for T4lk (Tauri v2 + React 19 + TypeScript + Tailwind CSS v4). It records audio via a global hotkey, transcribes it (locally via whisper-rs or remotely via a FastAPI server on H100 GPU), and pastes the result into the active application.

The current UI works but needs a redesign to improve navigation flow, simplify configuration, and add missing features (sound feedback, shortcut chains).

## Tech Stack (do not change)

- **Tauri v2** (Rust backend, webview frontend)
- **React 19** with TypeScript
- **Tailwind CSS v4** (OKLCH dark theme, semantic design tokens)
- **shadcn/ui** components (Radix UI primitives, CVA)
- **Lucide React** icons
- **Fonts**: JetBrains Mono (monospace), Outfit (body)
- **No external CSS framework** -- all styles via Tailwind utilities + custom CSS in index.css

## Current Layout

```
[Custom Titlebar -- 36px, frameless drag region, recording indicator]
[Sidebar 72px, icon-only, tooltips] | [Main content, scrollable]
```

Sidebar currently has 4 items top-to-bottom: History, Transcription, Vocabulary, Preferences.
A status dot at the bottom indicates server/model state.

## Current Pages

### 1. History
- List of past transcriptions (max 100)
- Each item: text, timestamp, model name badge, copy button
- Empty state with instructions showing the keyboard shortcut
- "Clear all" button

### 2. Transcription (3 internal tabs: Moteur / Modele local / Serveur)
- **Moteur tab**: 3 mode cards (Local only / Server only / Server + Local fallback)
- **Modele local tab**: GPU selector (CPU/Vulkan) + model list (download/load/delete)
- **Serveur tab**: URL input, connection test, timeout selector (10s/30s/1min/2min)

### 3. Vocabulary
- Add terms (comma/space separated), drag-and-drop reorder, delete
- Info box explaining Whisper prompt injection
- T4lk default terms pre-loaded in Rust backend

### 4. Preferences
- Recording mode: Push-to-talk vs Toggle
- Shortcuts: main (Ctrl+Space) + cancel (Ctrl+F1), inline capture editor
- Overlay size: small/medium/large
- System: autostart, start minimized, pause media, preserve clipboard

## Design System (keep as-is)

- Dark OKLCH theme with semantic tokens (surface-deep/inset/raised/elevated/active)
- Color accents: cyan (active/loaded), amber (recording/warning), blue (server), purple (hybrid), green (success), red (destructive)
- Glass cards (backdrop-blur), hover-lift, press-effect, glow-hover
- Animations: fadeIn, slideIn, stagger-item, pulse-recording, spectrum bars
- Noise overlay texture (SVG fractal noise at 1.5% opacity)

---

## Redesign Requirements

### R1 -- Reorganize Navigation

Split the sidebar into **top group** and **bottom group**:

**Top (main content pages):**
- History (default landing page)
- Vocabulary

**Bottom (settings/config, visually separated):**
- Transcription (engine/model config)
- Preferences

The bottom group should feel like "settings" -- slightly dimmer icons, a subtle separator (thin line or spacing) above them. The status dot stays at the very bottom.

### R2 -- Simplify Transcription Mode

Replace the 3-mode selection (local / server / server+fallback) with a **2-mode** design:

- **Local**: Whisper runs on-device
- **Server**: Whisper runs on remote H100

When "Server" is selected, show a **fallback toggle** inline: "Fallback local si serveur indisponible" (switch). This replaces the third "hybrid" mode card entirely.

Also flatten the 3-tab structure. Instead of tabs, use a single scrollable page:
1. **Engine mode selector** (Local / Server) at the top
2. **Contextual settings below** that change based on the selected mode:
   - Local mode: GPU selector + model list
   - Server mode: URL + connection test + timeout + fallback toggle
   - When fallback is ON in server mode: also show the local model section below (collapsed/expandable)

### R3 -- Sound Feedback

Add configurable audio feedback when recording starts and stops:

- **Start sound**: played when the user triggers the recording hotkey
- **Stop sound**: played when recording ends (before transcription starts)

Settings in Preferences:
- Toggle: "Sons de feedback" (on/off, default off)
- When enabled, show 2 sub-options:
  - Start sound: dropdown with presets (subtle beep, click, chime) or "Aucun"
  - Stop sound: dropdown with presets or "Aucun"

Implementation notes:
- Use Web Audio API or `<audio>` elements in the frontend
- Bundle 3-4 short sound files (< 50KB each, OGG/MP3) in `public/sounds/`
- Sounds should be short (< 500ms), subtle, not jarring
- The overlay window also needs to hear these events (or the main window plays them)

### R4 -- Custom Shortcut Chains

Extend the shortcut system to support **companion shortcuts** that fire alongside the main recording shortcut:

Current:
- Main shortcut: Ctrl+Space (start/stop recording)
- Cancel shortcut: Ctrl+F1 (cancel recording)

New: add a **"Raccourcis compagnons"** section in Preferences:
- A list of user-defined shortcuts that are **simulated** (sent as keystrokes) when recording starts and/or stops
- Each companion shortcut has:
  - A label (user-defined, e.g. "Mute Discord", "Mute Teams")
  - The key combination (e.g. Ctrl+Shift+M)
  - When to fire: "Au demarrage" / "A l'arret" / "Les deux" (toggle or radio)
- Add/remove companion shortcuts dynamically
- Use case: user presses Ctrl+Space to record, the app also sends Ctrl+Shift+M to mute Discord and another shortcut to mute Teams

Implementation notes:
- Companion shortcuts are **simulated keystrokes** sent to the OS (not global shortcut listeners)
- On Windows: use `enigo` or `windows-rs` `SendInput` API from Rust
- The Tauri command would be something like `invoke("simulate_keystroke", { keys: "Ctrl+Shift+M" })`
- Fire companion shortcuts with a small delay (50-100ms) after the main action to avoid conflicts
- Persist in settings alongside main/cancel shortcuts

### R5 -- General UX Polish

- Smooth page transitions (already have fadeIn/slideIn, make sure they're consistent)
- The History page should feel like the "home" -- it's where users land and where transcription results appear
- Cards and sections should breathe -- generous spacing, not cramped
- Interactive elements should have clear hover/active states
- Keep the "professional internal tool" aesthetic -- not flashy, just well-crafted

---

## File Structure Reference

```
src/
  App.tsx                          -- Root: state, nav, layout, event listeners
  index.css                        -- Design tokens, animations, utilities
  components/
    Titlebar.tsx                   -- Custom window titlebar
    EngineModeCard.tsx             -- Engine mode selection card
    ModelCard.tsx                  -- Model download/load/delete row
    GpuSelector.tsx                -- CPU/Vulkan backend selector
    ui/                            -- shadcn/ui primitives (Button, Switch, etc.)
  views/
    HistoryView.tsx                -- Transcription history
    VocabularyView.tsx             -- Custom vocabulary management
    PreferencesView.tsx            -- Shortcuts, overlay, system settings
    transcription/
      TranscriptionView.tsx        -- Shell + tab navigation
      EngineTab.tsx                -- Engine mode selection (local/server/hybrid)
      LocalTab.tsx                 -- Local model + GPU config
      ServerTab.tsx                -- Server URL + timeout config
  pages/
    OverlayPage.tsx                -- Floating recording overlay (separate window)
    SetupWizard.tsx                -- First-launch wizard
  lib/
    utils.ts                       -- clsx + tailwind-merge helper
```

## Rust Commands Available (invoke)

Key Tauri commands the frontend can call:
- `get_settings` / `save_settings` -- load/save all settings
- `update_shortcut` / `update_cancel_shortcut` -- change hotkeys
- `disable_shortcuts` / `restore_shortcuts` -- temp disable during editing
- `get_downloaded_models` / `download_model` / `delete_model` / `load_model` / `unload_model`
- `check_server` -- test server connectivity
- `save_transcription_history` / `load_transcription_history`
- `save_overlay_position` / `load_overlay_position`
- `detect_gpus` / `set_gpu_backend`
- `complete_setup` / `is_setup_completed`

New commands that will need to be created for R3/R4:
- `simulate_keystroke` -- send OS-level keystrokes for companion shortcuts
- Sound playback can be handled purely in frontend (Web Audio API)

---

## Deliverables

Provide the complete updated source code for all modified/new files. Keep the existing design system, component patterns, and code style. Do not add new dependencies unless absolutely necessary (prefer Web Audio API over external sound libraries).
