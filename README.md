# t4lk-client

Desktop Speech-to-Text app for Windows. Hold a shortcut, talk, and the transcription
lands in your clipboard or is typed straight into the focused window.

Built with Tauri v2, React 19 and Tailwind CSS v4.

## How transcription is routed

Server first, local as a fallback. The app sends audio to a
[t4lk-server](https://github.com/avpbynf/t4lk-server) instance, and if that server is
unreachable it transcribes on your own machine with
[whisper-rs](https://github.com/tazz4843/whisper-rs), GPU-accelerated through Vulkan.
Configure the server URL and token on the Transcription page, or skip the server
entirely and run local-only.

## Features

- Global shortcuts, push-to-talk or toggle recording
- Recording overlay, themeable and repositionable
- Clipboard copy or direct keystroke injection into the active window
- Custom vocabulary and glossary to bias transcription toward your own terms
- Searchable history
- Usage statistics: time saved, activity over time
- Meeting mode, routing your mic through VB-Cable so other apps hear the same input
- Autostart, minimize to tray, media pause while recording

## Install

Grab the installer from the releases page, or build it yourself.

## Building

Windows only. The native side compiles whisper.cpp, so the first build is long.

| Requirement | Notes |
|---|---|
| Rust 1.90 | pinned by `src-tauri/rust-toolchain.toml` |
| [Bun](https://bun.sh) | frontend package manager and task runner |
| Visual Studio 2022 | "Desktop development with C++" workload; Community or Build Tools |
| CMake and Ninja | needed to build whisper.cpp |
| Vulkan SDK | only for the default `vulkan` feature |

```bash
bun install
bun run tauri:dev
```

`bun run tauri:build` produces the installer, and `bun run tauri:check` runs
`cargo check` without a full build.

To build without a GPU backend and skip the Vulkan SDK entirely, drop the default
feature:

```bash
cargo build --manifest-path src-tauri/Cargo.toml --no-default-features
```

### If the build fails

- **`cl.exe` not found.** The MSVC environment was not loaded. `scripts/vcenv.bat`
  locates `vcvarsall.bat` and runs the command inside it; the npm scripts already go
  through it, so run those rather than calling `tauri` directly.
- **CMake dies on a path that is too long.** `vulkan-shaders-gen` nests deep enough
  that the checkout path plus the build tree can cross the 250 character limit. Move
  the repo somewhere short, such as `C:\src\t4lk-client`, and rebuild.
- **Meeting mode reports VB-Cable missing.** The app only detects
  [VB-Audio Virtual Cable](https://vb-audio.com/Cable/), by enumerating audio devices.
  The NSIS installer is what installs the driver, silently and behind a UAC prompt, so
  a source build or a declined prompt leaves you without it. Install it by hand and
  restart the app.

### Building the installer

`bun run tauri:build` runs `src-tauri/nsis-hooks.nsh`, which ships the contents of
`src-tauri/resources/VBCABLE_Driver/` and runs `VBCABLE_Setup_x64.exe` at install
time. Those driver binaries are Git LFS objects and are **not** in the repository, so
fetch the VB-Cable package from [vb-audio.com](https://vb-audio.com/Cable/) and unpack
it there before building an installer. Everything else builds without them.

## Licence

MIT, see [LICENSE](LICENSE).
