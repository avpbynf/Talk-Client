# T4lk Overlay Redesign Prompt

## Context

T4lk is a Speech-to-Text desktop app (Tauri v2 + React 19 + Tailwind CSS v4). During recording, a small floating overlay window appears on screen to show the user that recording is active. The overlay is a separate Tauri window (transparent, frameless, always-on-top, draggable).

The current overlay is a basic rectangle with a mic icon + audio spectrum bars. It works but looks dated and lacks personality.

## Current Implementation

The overlay has 4 states:
1. **Recording** -- User is speaking. Shows mic icon + live audio spectrum bars (5-8 vertical bars animated from Rust audio data at 50ms intervals)
2. **Transcribing** (local) -- Whisper is processing. Shows brain icon + progress bar (0-100%) or spinner
3. **Streaming / Server transcribing** -- Server is processing. Shows server icon + spinner
4. **Idle** -- Hidden (returns null)

The overlay is draggable (position saved automatically). Current size: 160x44px (small format).

Current color: purple (`oklch(0.65 0.18 300)`)

## Design System (must follow)

- Dark theme, OKLCH color space
- Background: `oklch(0.13 0.01 260)` (very dark blue-gray)
- Purple accent (recording state): `oklch(0.65 0.18 300)`
- Blue accent (server/processing): `oklch(0.65 0.18 250)`
- Fonts: Outfit (body), JetBrains Mono (monospace)
- Existing CSS utilities available: `backdrop-blur-sm`, `animate-pulse`, `rounded-full`, `shadow-lg`

## What I Want

Design a beautiful, modern overlay that feels like a premium desktop tool. Think of it as a floating widget like macOS's AirDrop indicator or Spotify's mini player.

### Shape and Style
- **Pill/capsule shape** (fully rounded, `rounded-full`) instead of a rectangle
- **Glassmorphism** effect: semi-transparent background with backdrop-blur
- **Subtle glow/shadow** around the pill that matches the state color (purple for recording, blue for processing)
- Compact but not cramped -- content should breathe

### Recording State
- Mic icon with a subtle pulse animation (not the standard `animate-pulse` -- something smoother)
- **Live audio spectrum**: keep the vertical bars but make them more elegant (thinner, more bars, smoother animation with CSS transitions)
- **Elapsed time** counter (e.g., "0:03", "1:24") instead of "Ecoute..." text -- more useful information
- The whole pill should have a faint purple glow that pulses subtly with the audio level

### Processing State (local transcription)
- Brain icon
- Smooth progress bar or circular progress indicator
- Percentage text in monospace

### Server Processing State
- Server icon
- Elegant spinner (not the default Loader2 spin -- something more refined)
- "Transcription..." text or just the spinner

### Animations
- **Entry**: overlay should fade in + scale up slightly when recording starts
- **Exit**: fade out when going idle
- **State transitions**: smooth crossfade between recording/processing/server states
- **Spectrum bars**: use CSS transitions with slight stagger delays for a wave effect

### Size
- Fixed small format: approximately 200x44px (adjust as needed for the pill shape)
- No size selector -- one size only

## Technical Constraints

- This is a Tauri window, rendered in a webview. Standard HTML/CSS/React.
- The component receives audio spectrum data as an array of 8 floats (0-1) via Tauri events at ~50ms intervals
- The overlay must be draggable (existing `onMouseDown -> startDragging()` handler)
- Must work on Windows (the primary target platform)
- No external animation libraries -- use CSS animations/transitions and React state only
- Keep the existing Tauri event listeners and state management logic unchanged
- Only redesign the visual rendering (`renderContent` function and the outer container)

## Current Code Reference

```tsx
// Outer container (the entire window)
<div
  className="h-screen w-screen bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-center gap-3 select-none cursor-grab active:cursor-grabbing"
  onMouseDown={handleMouseDown}
>
  {renderContent()}
</div>

// Recording state content
<>
  <div className="relative">
    <Mic className="h-4 w-4 text-hybrid" />
    <span className="absolute -top-1 -right-1 h-2 w-2 bg-hybrid rounded-full animate-pulse" />
  </div>
  <div className="flex items-center gap-0.5 h-6">
    {spectrum.map((level, i) => (
      <div
        key={i}
        className="w-1 bg-hybrid rounded-full transition-all duration-50"
        style={{ height: `${Math.max(3, 3 + level * 21)}px` }}
      />
    ))}
  </div>
  <span className="text-sm font-medium text-foreground">Ecoute...</span>
</>
```

## Deliverables

Provide ONLY the updated `renderContent()` function and the outer container JSX. Do not change the state management, event listeners, or Tauri integration code. I will copy-paste your rendering code into the existing component.

Include any new CSS keyframes/animations that need to be added to the stylesheet (I'll put them in index.css).

Focus on making it look stunning. This is the most visible UI element -- users see it every time they record.
