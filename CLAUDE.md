# Talk-Client

Tauri v2 desktop Speech-to-Text app, Windows only. Rust backend, React 19 frontend.
See [README.md](README.md) for features, build requirements and troubleshooting.

## Commands

```bash
bun install
bun run tauri:dev      # dev build, MSVC env loaded by scripts/vcenv.bat
bun run tauri:build    # production installer
bun run tauri:check    # cargo check, no full build
bun run dev            # frontend alone, no Tauri shell
```

Run `bun run tauri:check` before committing. The native side compiles whisper.cpp,
so a cold build takes a long while; `tauri:check` is the fast feedback loop.

## Layout

- `src-tauri/src/lib.rs` registers commands and owns app state
- `src-tauri/src/transcription/`, `models/`, `audio/` are the local engine
- `src-tauri/src/server_transcription.rs` is the remote path
- `src-tauri/src/virtual_mic/` detects and routes through VB-Cable
- `src/views/` are the settings pages, `src/pages/` the overlay and setup wizard

## Conventions

- English in code and comments
- Conventional Commits
- Everything is written LF; a CRLF appearing is a tooling regression

## Things that bite

- **Build environment.** `scripts/vcenv.bat` finds `vcvarsall.bat` through vswhere and
  loads the MSVC x64 environment. Never add a redirection inside its vswhere
  backticks: escaping one breaks the quoted path and the probe silently finds
  nothing. `vcvarsall.bat` is itself noisy on stderr even on success, which is why the
  call is silenced and judged on its exit code.
- **Path length.** `vulkan-shaders-gen` nests its CMake scratch directories about 220
  characters deep on their own, so the checkout has to stay short, well under 50
  characters. The symptom is misleading: CMake reports that the C compiler cannot
  build a trivial program, naming a `TryCompile-*` directory rather than the length.
  A short checkout is not always enough either, since the target directory sits in
  the middle of that path; CI sets `CARGO_TARGET_DIR` to a root-level directory, and
  a local build needs the same. From `Documents\GitHub\t4lk\Talk-Client`, which is
  only 48 characters, the default target directory still crosses the limit, and the
  message that comes back is MSBuild's `MSB4184` rather than anything about CMake.
- **GPU is optional.** `vulkan` is a default feature; `--no-default-features` builds
  without the Vulkan SDK.
- **The VB-Cable payload is absent.** `src-tauri/nsis-hooks.nsh` ships
  `src-tauri/resources/VBCABLE_Driver/` and runs its setup at install time, but those
  binaries were Git LFS objects and the objects are gone from the remote. Fetch
  VB-Cable from vb-audio.com and unpack it there before building an installer.
- **Transcription is server-first.** A failing local model is not the whole story;
  check the server URL and token on the Transcription page first.
- **Two spellings of the old name are load-bearing.** The product is Talk, but
  `com.avpbynf.t4lk` still names the config and data directories, through
  `ProjectDirs::from("com", "avpbynf", "t4lk")` in four places and through the two
  paths `nsis-hooks.nsh` hardcodes for the uninstaller, and `t4lk.db` still names the
  history file. `AppTheme` keeps a `serde(alias)` on its two renamed variants for the
  same reason: `load_settings()` drops the whole file on a parse error and returns the
  defaults, so one stale value would take the server URL, the token and the shortcuts
  with it. Renaming any of them needs a migration first, not a find and replace.
- **The installer bitmaps carry the wordmark.** `src-tauri/icons/nsis-header.bmp` and
  `nsis-sidebar.bmp` are 24-bit BMP at sizes NSIS fixes, so they cannot be produced by
  the build. `python scripts/make-installer-images.py` redraws both from the real icon
  and the real Outfit face; run it after any change to the mark.
- **Feedback loops are not symmetric.** The frontend checks in seconds with
  `bun run build`, which is the same `tsc` pass the release runs. The Rust side cannot
  be checked at all without CMake, Ninja, the Vulkan SDK and an LLVM install, because
  `whisper-rs-sys` compiles whisper.cpp from its build script and generates its
  bindings with bindgen; even `cargo check` runs both. Missing LLVM is the one that
  misleads, since bindgen panics about `libclang.dll` and names no file of ours. On a
  machine without them, CI is the only verification and the loop is roughly twenty
  minutes, so read Rust changes carefully before pushing rather than iterating on the
  runner.
