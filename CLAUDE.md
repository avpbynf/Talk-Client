# t4lk-client

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
  the middle of that path; CI sets `CARGO_TARGET_DIR` to a root-level directory.
- **GPU is optional.** `vulkan` is a default feature; `--no-default-features` builds
  without the Vulkan SDK.
- **The VB-Cable payload is absent.** `src-tauri/nsis-hooks.nsh` ships
  `src-tauri/resources/VBCABLE_Driver/` and runs its setup at install time, but those
  binaries were Git LFS objects and the objects are gone from the remote. Fetch
  VB-Cable from vb-audio.com and unpack it there before building an installer.
- **Transcription is server-first.** A failing local model is not the whole story;
  check the server URL and token on the Transcription page first.
